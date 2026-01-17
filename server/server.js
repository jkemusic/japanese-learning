const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 3000;
const SHUTDOWN_DELAY = 60000; // 60 seconds
const DB_FILE = path.join(__dirname, 'db.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_API_KEY');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(cors());
app.use(express.json());

// MongoDB Models
const HistorySchema = new mongoose.Schema({
    word: { type: String, unique: true },
    count: { type: Number, default: 0 },
    lastSearched: Date
});
const History = mongoose.model('History', HistorySchema);

const SavedWordSchema = new mongoose.Schema({
    word: { type: String }, // Removed unique: true to allow homographs
    reading: String,
    accent: String,
    part: String,
    level: String,
    meaning: String,
    examples: Array,
    savedAt: { type: Date, default: Date.now },
    flashcardStats: {
        correct: { type: Number, default: 0 },
        incorrect: { type: Number, default: 0 },
        lastReview: { type: Date, default: null }
    }
});
// Compound unique index: Word + Reading must be unique
SavedWordSchema.index({ word: 1, reading: 1 }, { unique: true });
const SavedWord = mongoose.model('SavedWord', SavedWordSchema);

// MongoDB Connection & Migration
let useLocalDB = false;

// Helpers for Local DB
const getLocalHistory = () => {
    if (!fs.existsSync(HISTORY_FILE)) return {};
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
};
const saveLocalHistory = (data) => fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));

const getLocalSaved = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};
const saveLocalSaved = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(async () => {
        console.log('Connected to MongoDB');

        // Fix for Homographs: Drop legacy unique index on 'word' if it exists.
        // We moved to compound index { word: 1, reading: 1 }
        try {
            const indexes = await SavedWord.collection.indexes();
            const wordIndex = indexes.find(idx => idx.name === 'word_1');
            if (wordIndex) {
                console.log('Dropping legacy index: word_1');
                await SavedWord.collection.dropIndex('word_1');
            }
        } catch (e) {
            console.warn('Index drop warning:', e.message);
        }

        await migrateData();
    })
    .catch(err => {
        console.error('MongoDB connection failed (Timeout or Auth Error). Switching to LOCAL JSON mode.');
        console.error('Connection Error Details:', err.message);
        useLocalDB = true;
    });

const migrateData = async () => {
    try {
        // Migrate History
        const historyCount = await History.countDocuments();
        if (historyCount === 0 && fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            if (data.trim() !== '{}') {
                const localHistory = JSON.parse(data);
                const docs = Object.entries(localHistory).map(([word, val]) => ({
                    word,
                    count: val.count,
                    lastSearched: val.lastSearched
                }));
                if (docs.length > 0) {
                    await History.insertMany(docs);
                    console.log(`Migrated ${docs.length} history items to Cloud.`);
                }
            }
        }

        // Migrate Saved Words
        const savedCount = await SavedWord.countDocuments();
        if (savedCount === 0 && fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() !== '[]') {
                const localSaved = JSON.parse(data);
                if (localSaved.length > 0) {
                    // Try/Catch for duplicates just in case
                    try {
                        await SavedWord.insertMany(localSaved);
                        console.log(`Migrated ${localSaved.length} saved words to Cloud.`);
                    } catch (e) {
                        console.warn('Migration warning ( SavedWords):', e.message);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Migration failed:', e);
    }
};

// Scraping Endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    const direction = req.query.direction || 'ja-zh'; // 'zh-ja' or 'ja-zh'
    if (!query) return res.status(400).json({ error: 'Query is required' });

    // Helper function to scrape Sigure
    const scrapeSigure = async (target) => {
        try {
            const url = `https://www.sigure.tw/dict/jp/${encodeURIComponent(target)}`;
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const $ = cheerio.load(data);
            const results = [];

            $('.word-card').each((i, card) => {
                const $card = $(card);
                const word = $card.find('.word-card__word').text().trim();
                // ... (rest of parsing logic stays same, just copying structure)
                if (!word) return;

                const result = {
                    word: word,
                    reading: $card.find('.word-card__kana').text().trim(),
                    accent: $card.find('.word-card__badge--accent').text().trim(),
                    part: $card.find('.word-card__badge--part').text().trim(),
                    level: $card.find('.word-card__badge--level').text().trim(),
                    meaning: $card.find('.word-card__translation-text').first().text().trim(),
                    examples: []
                };

                $card.find('.word-card__examples-list li').each((j, el) => {
                    const jap = $(el).find('.example-jp').text().trim();
                    const cht = $(el).find('.example-ch').text().trim();
                    if (jap) result.examples.push({ jap, cht });
                });

                results.push(result);
            });

            return results.length > 0 ? results : null;
        } catch (e) {
            console.error(`Scrape failed for ${target}:`, e.message);
            return null;
        }
    };

    try {
        let results = null; // Array of results
        let originalQuery = null;
        let apiError = null;

        // 1. Try Direct Search first
        console.log(`Attempting direct search for: "${query}"`);
        results = await scrapeSigure(query);

        // 2. If not found, try fallbacks (Only if API key exists)
        if (!results && process.env.GEMINI_API_KEY) {
            console.log(`Direct search failed for "${query}". Checking fallbacks...`);

            // Check if input looks like Chinese (and not Japanese Kana)
            const isChinese = /[\u4e00-\u9fa5]/.test(query) && !/[\u3040-\u309f\u30a0-\u30ff]/.test(query);

            if (direction === 'zh-ja' && isChinese) {
                try {
                    console.log(`Input looks like Chinese. Translating "${query}" to Japanese...`);
                    const prompt = `Translate the Chinese word "${query}" to the most common Japanese word (Kanji or Kana). Return ONLY the Japanese word.`;
                    const resultLLM = await model.generateContent(prompt);
                    const translated = resultLLM.response.text().trim();

                    if (translated) {
                        console.log(`Translated to "${translated}". Searching...`);
                        results = await scrapeSigure(translated);
                        if (results) originalQuery = query; // Store original if found via translation
                    }
                } catch (e) {
                    console.error('Translation failed:', e.message);
                    apiError = e.message;
                }
            }

            // If still not found, try converting to Hiragana
            if (!results) {
                try {
                    console.log(`Trying conversion to Hiragana for "${query}"...`);
                    const prompt = `Convert "${query}" to Hiragana. Return ONLY the Hiragana.`;
                    const resultLLM = await model.generateContent(prompt);
                    const hiragana = resultLLM.response.text().trim();

                    if (hiragana && hiragana !== query) {
                        console.log(`Converted to "${hiragana}". Searching...`);
                        results = await scrapeSigure(hiragana);
                    }
                } catch (e) {
                    console.error('Conversion failed:', e.message);
                    if (!apiError) apiError = e.message;
                }
            }
        }

        // 3. Final Result Check
        if (!results) {
            if (apiError && apiError.includes('429')) {
                return res.status(429).json({ error: '找不到單字 (且 API 額度已滿，無法翻譯)' });
            }
            return res.status(404).json({ error: '找不到單字' });
        }

        // Process results update History
        const now = new Date();

        for (const result of results) {
            if (originalQuery) result.originalQuery = originalQuery;

            // Update History
            const now = new Date();
            let count = 1;
            let lastSearched = now;

            if (useLocalDB) {
                // Local Mode: Update history.json
                try {
                    const history = getLocalHistory();
                    let previousLastSearched = null; // Store previous time

                    if (!history[result.word]) {
                        history[result.word] = { count: 0, lastSearched: null };
                    } else {
                        previousLastSearched = history[result.word].lastSearched; // Capture existing
                    }

                    history[result.word].count += 1;
                    history[result.word].lastSearched = now.toISOString();
                    saveLocalHistory(history);

                    count = history[result.word].count;
                    // Send PREVIOUS lastSearched to UI, so user sees "Last viewed: 2 days ago" instead of "Just now"
                    // If never searched before, it remains null (or maybe user wants to know it's new)
                    lastSearched = previousLastSearched;
                } catch (e) {
                    console.error('Local history update failed:', e);
                }
            } else {
                // Cloud Mode: Update MongoDB
                try {
                    let historyItem = await History.findOne({ word: result.word });
                    let previousLastSearched = null;

                    if (!historyItem) {
                        historyItem = new History({ word: result.word });
                    } else {
                        previousLastSearched = historyItem.lastSearched;
                    }

                    historyItem.count += 1;
                    historyItem.lastSearched = now;
                    await historyItem.save();

                    count = historyItem.count;
                    lastSearched = previousLastSearched;
                } catch (e) {
                    console.error('MongoDB history update failed:', e);
                }
            }

            result.history = {
                count: count,
                lastSearched: lastSearched
            };

            // LLM Example Fallback
            if (result.examples.length === 0 && process.env.GEMINI_API_KEY && results.length <= 3) {
                console.log(`No examples found for ${result.word}. Using LLM fallback...`);
                try {
                    const prompt = `Generate 3 simple Japanese example sentences for the word "${result.word}" (${result.meaning}). 
                    Format as JSON array of objects with 'jap' (Japanese sentence) and 'cht' (Traditional Chinese translation, Taiwan usage).
                    Example: [{"jap": "猫がいます。", "cht": "有一隻貓。"}]`;

                    const resultLLM = await model.generateContent(prompt);
                    const text = resultLLM.response.text();
                    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    result.examples = JSON.parse(jsonStr);
                    result.isLLM = true;
                } catch (e) {
                    console.error('LLM example generation failed:', e.message);
                }
            }

            // JA-ZH Extra Translation
            if (direction === 'ja-zh' && process.env.GEMINI_API_KEY && results.length <= 3) {
                try {
                    const prompt = `Translate the Japanese word "${result.word}" (reading: ${result.reading}) to Traditional Chinese (Taiwan usage). Return ONLY the Chinese translation, no explanation.`;
                    const resultLLM = await model.generateContent(prompt);
                    result.translatedMeaning = resultLLM.response.text().trim();
                    result.originalMeaning = result.meaning;
                } catch (e) {
                    console.error('JA-ZH translation failed:', e.message);
                }
            }
        }

        res.json(results);

    } catch (error) {
        console.error('Search handler error:', error.message);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Suggestion Endpoint (LLM)
app.get('/api/suggest', async (req, res) => {
    const query = req.query.q;
    const direction = req.query.direction || 'zh-ja';
    if (!query) return res.json([]);

    if (!process.env.GEMINI_API_KEY) {
        return res.json([]); // No API key, no suggestions
    }

    try {
        let prompt;

        if (direction === 'zh-ja') {
            // Chinese to Japanese: suggest Japanese words related to the Chinese input
            prompt = `Based on the Chinese word or phrase "${query}", suggest 5 related Japanese words that a learner might want to know. 
            Return a strict JSON array of objects with these keys:
            - "word": The Japanese word (Kanji or Kana)
            - "reading": The reading in Hiragana/Katakana
            - "meaning": The meaning in Traditional Chinese (繁體中文, Taiwan usage)
            
            Example output:
            [{"word": "猫", "reading": "ねこ", "meaning": "貓"}, {"word": "子猫", "reading": "こねこ", "meaning": "小貓"}]`;
        } else {
            // Japanese to Chinese: suggest Japanese words related to the Japanese input
            prompt = `Based on the Japanese word or phrase "${query}", suggest 5 related Japanese words. 
            Return a strict JSON array of objects with these keys:
            - "word": The Japanese word (Kanji or Kana)
            - "reading": The reading in Hiragana/Katakana
            - "meaning": The meaning in Traditional Chinese (繁體中文, Taiwan usage)
            
            Example output:
            [{"word": "猫", "reading": "ねこ", "meaning": "貓"}, {"word": "子猫", "reading": "こねこ", "meaning": "小貓"}]`;
        }

        const resultLLM = await model.generateContent(prompt);
        const response = await resultLLM.response;
        const text = response.text();

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(jsonStr);

        res.json(suggestions);
    } catch (error) {
        console.error('Suggestion error:', error.message);
        res.json([]); // Return empty array on error
    }
});

// Grammar Endpoint (LLM)
app.get('/api/grammar', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API Key missing' });
    }

    try {
        const prompt = `Explain the Japanese grammar point "${query}". 
        Return a strict JSON object with these keys:
        - "grammar": The grammar pattern itself (e.g., "～ほど～ない")
        - "meaning": The meaning in Traditional Chinese (繁體中文, Taiwan usage)
        - "usage": A brief explanation of how to use it (connection rules, nuance) in Traditional Chinese
        - "examples": An array of objects with "jap" (Japanese sentence) and "cht" (Traditional Chinese translation)
        
        Example output:
        {
            "grammar": "N + ほど～ない",
            "meaning": "沒有比...更...",
            "usage": "接在名詞後面，表示該名詞是程度最高的，沒有其他事物能比得上。",
            "examples": [{"jap": "今年の夏ほど暑い夏はない。", "cht": "沒有比今年夏天更熱的夏天了。"}]
        }`;

        const resultLLM = await model.generateContent(prompt);
        const response = await resultLLM.response;
        const text = response.text();

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr);

        res.json(result);
    } catch (error) {
        console.error('Grammar generation error:', error.message);
        res.status(500).json({ error: 'Failed to generate grammar explanation' });
    }
});

// Saved Words Endpoints (MongoDB)
app.get('/api/saved', async (req, res) => {
    try {
        // Check for local mode OR if MongoDB is not connected (fail-safe)
        if (useLocalDB || mongoose.connection.readyState !== 1) {
            console.log('Using Local DB (Mode flag:', useLocalDB, 'State:', mongoose.connection.readyState, ')');
            const saved = getLocalSaved();
            const history = getLocalHistory();

            // Merge history data
            const words = saved.map(item => {
                const h = history[item.word];
                return {
                    ...item,
                    searchCount: h ? h.count : 0,
                    lastSearched: h ? h.lastSearched : null
                };
            }).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            return res.json(words);
        }

        const words = await SavedWord.aggregate([
            {
                $lookup: {
                    from: 'histories',
                    localField: 'word',
                    foreignField: 'word',
                    as: 'historyData'
                }
            },
            {
                $addFields: {
                    searchCount: { $ifNull: [{ $arrayElemAt: ["$historyData.count", 0] }, 0] },
                    lastSearched: { $arrayElemAt: ["$historyData.lastSearched", 0] }
                }
            },
            {
                $project: {
                    historyData: 0
                }
            },
            { $sort: { savedAt: -1 } }
        ]);

        res.json(words);
    } catch (e) {
        console.error('Saved words fetch error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save', async (req, res) => {
    const newWord = req.body;
    try {
        if (useLocalDB) {
            const saved = getLocalSaved();
            // Check for existing word AND reading
            const existingIndex = saved.findIndex(w => w.word === newWord.word && w.reading === newWord.reading);

            if (existingIndex === -1) {
                // Add new
                saved.push({ ...newWord, savedAt: new Date(), flashcardStats: { correct: 0, incorrect: 0, lastReview: null } });
            } else {
                // Update existing? Usually save doesn't update unless specific logic
            }
            saveLocalSaved(saved);
            return res.json({ success: true, data: saved.reverse() }); // Return reversed for display
        }

        // Cloud DB: Check for word AND reading
        const existing = await SavedWord.findOne({ word: newWord.word, reading: newWord.reading });
        if (!existing) {
            await new SavedWord(newWord).save();
        }
        // Return updated list
        const words = await SavedWord.find().sort({ savedAt: -1 });
        res.json({ success: true, data: words });
    } catch (e) {
        // Handle Duplicate Key Error specifically if index hasn't updated yet or race condition
        if (e.code === 11000) {
            console.warn('Duplicate entry ignored.');
            return res.json({ success: true }); // Treat as success
        }
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/saved/:word', async (req, res) => {
    const wordToDelete = req.params.word;
    const readingToDelete = req.query.reading; // Get reading from query param

    try {
        if (useLocalDB) {
            let saved = getLocalSaved();
            if (readingToDelete) {
                // Delete specific match (word + reading)
                saved = saved.filter(w => !(w.word === wordToDelete && w.reading === readingToDelete));
            } else {
                // Backward compatibility: Delete ALL matches for this word if no reading provided
                saved = saved.filter(w => w.word !== wordToDelete);
            }
            saveLocalSaved(saved);
            return res.json({ success: true, data: saved.reverse() });
        }

        if (readingToDelete) {
            await SavedWord.deleteOne({ word: wordToDelete, reading: readingToDelete });
        } else {
            await SavedWord.deleteMany({ word: wordToDelete });
        }

        const words = await SavedWord.find().sort({ savedAt: -1 });
        res.json({ success: true, data: words });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Flashcard Review Endpoint
app.post('/api/flashcard/review', async (req, res) => {
    const { word, result, reading } = req.body; // Accept reading for specificity
    if (!word || !result) return res.status(400).json({ error: 'Missing word or result' });

    try {
        if (useLocalDB) {
            const saved = getLocalSaved();
            // Try to find by word AND reading if provided, otherwise just word (fallback)
            const target = saved.find(w => w.word === word && (!reading || w.reading === reading));

            if (target) {
                if (!target.flashcardStats) target.flashcardStats = { correct: 0, incorrect: 0, lastReview: null };

                if (result === 'correct') target.flashcardStats.correct++;
                else target.flashcardStats.incorrect++;

                target.flashcardStats.lastReview = new Date();
                saveLocalSaved(saved);
            }
            return res.json({ success: true, data: target });
        }

        const updateField = result === 'correct' ? 'flashcardStats.correct' : 'flashcardStats.incorrect';
        const query = { word };
        if (reading) query.reading = reading;

        const savedWord = await SavedWord.findOneAndUpdate(
            query,
            {
                $inc: { [updateField]: 1 },
                $set: { 'flashcardStats.lastReview': new Date() }
            },
            { new: true }
        );
        res.json({ success: true, data: savedWord });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/heartbeat', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const statusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    // Explicitly return local if flag is set, regardless of actual Mongoose state (which might be 0)
    const finalDbStatus = useLocalDB ? 'connected' : (statusMap[dbState] || 'unknown');
    const finalDbMode = useLocalDB ? 'local' : 'cloud';

    res.json({
        status: 'alive',
        dbStatus: finalDbStatus,
        dbMode: finalDbMode
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Auto-shutdown enabled: Server will close if no heartbeat for ${SHUTDOWN_DELAY / 1000}s (after first connection)`);
});
