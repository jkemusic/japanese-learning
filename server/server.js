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
    word: { type: String, unique: true },
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
const SavedWord = mongoose.model('SavedWord', SavedWordSchema);

// MongoDB Connection & Migration
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        await migrateData();
    })
    .catch(err => console.error('MongoDB connection error:', err));

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

            // Update History in MongoDB
            let historyItem = await History.findOne({ word: result.word });
            if (!historyItem) {
                historyItem = new History({ word: result.word });
            }
            const previousDate = historyItem.lastSearched;
            historyItem.count += 1;
            historyItem.lastSearched = now;
            await historyItem.save();

            result.history = {
                count: historyItem.count,
                lastSearched: previousDate
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
        
        if (words.length > 0) {
            console.log('Debug /api/saved first item:', JSON.stringify(words[0], null, 2));
        } else {
            console.log('Debug /api/saved: No saved words found.');
        }

        res.json(words);
    } catch (e) {
        console.error('Saved words fetch error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save', async (req, res) => {
    const newWord = req.body;
    try {
        const existing = await SavedWord.findOne({ word: newWord.word });
        if (!existing) {
            await new SavedWord(newWord).save();
        }
        // Return updated list
        const words = await SavedWord.find().sort({ savedAt: -1 });
        res.json({ success: true, data: words });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/saved/:word', async (req, res) => {
    const wordToDelete = req.params.word;
    try {
        await SavedWord.deleteOne({ word: wordToDelete });
        const words = await SavedWord.find().sort({ savedAt: -1 });
        res.json({ success: true, data: words });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Flashcard Review Endpoint
app.post('/api/flashcard/review', async (req, res) => {
    const { word, result } = req.body; // result: 'correct' | 'incorrect'
    if (!word || !result) return res.status(400).json({ error: 'Missing word or result' });

    try {
        const updateField = result === 'correct' ? 'flashcardStats.correct' : 'flashcardStats.incorrect';
        const savedWord = await SavedWord.findOneAndUpdate(
            { word },
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

// Heartbeat System
app.get('/api/heartbeat', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const statusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    res.json({ 
        status: 'alive', 
        dbStatus: statusMap[dbState] || 'unknown',
        dbMode: process.env.MONGODB_URI ? 'cloud' : 'local' 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Auto-shutdown enabled: Server will close if no heartbeat for ${SHUTDOWN_DELAY / 1000}s (after first connection)`);
});
