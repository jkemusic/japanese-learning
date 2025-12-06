const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_API_KEY');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(cors());
app.use(express.json());

// Ensure files exist
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '{}');

// Helper to read/write DB
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const readHistory = () => JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
const writeHistory = (data) => fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));

// Scraping Endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    const direction = req.query.direction || 'zh-ja'; // 'zh-ja' or 'ja-zh'
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {

        let targetQuery = query;
        let originalQuery = null;
        let translationError = null;
        let translatedMeaning = null; // For ja-zh mode

        // Handle Chinese-to-Japanese translation
        if (direction === 'zh-ja') {
            // Detect Chinese input (simple regex for common Chinese ranges)
            const isChinese = /[\u4e00-\u9fa5]/.test(query) && !/[\u3040-\u309f\u30a0-\u30ff]/.test(query);

            if (isChinese && process.env.GEMINI_API_KEY) {
                console.log(`Detected Chinese input: "${query}". Translating to Japanese...`);
                try {
                    const prompt = `Translate the Chinese word "${query}" to the most common Japanese word (Kanji or Kana). Return ONLY the Japanese word.`;
                    const resultLLM = await model.generateContent(prompt);
                    const response = await resultLLM.response;
                    const translated = response.text().trim();

                    if (translated) {
                        console.log(`Translated "${query}" to "${translated}"`);
                        targetQuery = translated;
                        originalQuery = query;
                    }
                } catch (e) {
                    console.error('Translation failed:', e.message);
                    if (e.message.includes('429')) {
                        translationError = 'API Quota Exceeded (Translation)';
                    } else {
                        translationError = 'Translation Failed';
                    }
                }
            }
        }

        const url = `https://www.sigure.tw/dict/jp/${encodeURIComponent(targetQuery)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        let $ = cheerio.load(data);
        const result = {
            word: $('.word-card__word').text().trim(),
            reading: $('.word-card__kana').text().trim(),
            accent: $('.word-card__badge--accent').text().trim(),
            part: $('.word-card__badge--part').text().trim(),
            level: $('.word-card__badge--level').text().trim(),
            meaning: $('.word-card__translation-text').first().text().trim(),
            examples: [],
            originalQuery: originalQuery
        };

        // If no word found, try to convert to Hiragana and search again
        if (!result.word) {
            console.log('Word not found. Trying to convert to Hiragana...');
            if (process.env.GEMINI_API_KEY) {
                try {
                    const prompt = `Convert "${query}" to Hiragana. Return ONLY the Hiragana.`;
                    const resultLLM = await model.generateContent(prompt);
                    const response = await resultLLM.response;
                    const hiragana = response.text().trim();
                    console.log(`Converted "${query}" to "${hiragana}". Retrying search...`);

                    if (hiragana && hiragana !== query) {
                        const url2 = `https://www.sigure.tw/dict/jp/${encodeURIComponent(hiragana)}`;
                        const { data: data2 } = await axios.get(url2, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });
                        const $2 = cheerio.load(data2);
                        result.word = $2('.word-card__word').text().trim();
                        result.reading = $2('.word-card__kana').text().trim();
                        result.accent = $2('.word-card__badge--accent').text().trim();
                        result.part = $2('.word-card__badge--part').text().trim();
                        result.level = $2('.word-card__badge--level').text().trim();
                        result.meaning = $2('.word-card__translation-text').first().text().trim();

                        // Scrape examples for the new result
                        $2('.word-card__examples-list li').each((i, el) => {
                            const jap = $2(el).find('.example-jp').text().trim();
                            const cht = $2(el).find('.example-ch').text().trim();
                            if (jap) result.examples.push({ jap, cht });
                        });
                    }
                } catch (e) {
                    console.error('Conversion failed:', e.message);
                }
            }
        }

        if (!result.word) {
            if (translationError) {
                return res.status(429).json({ error: `找不到資料 (${translationError})` });
            }
            return res.status(404).json({ error: 'Word not found' });
        }



        // Actually, the previous code block had example scraping AFTER the 404 check.
        // I inserted the retry logic BEFORE the 404 check.
        // So I should move the initial example scraping into the initial try block or just check if examples are empty.

        // Let's just rely on the fact that `result.examples` is initialized to [] and populated if found.
        // If initial search found word, it populated examples (wait, I need to check where I inserted).

        // The insertion point was replacing lines 56-58 (the 404 check).
        // The initial example scraping was at lines 85-89, which is AFTER the 404 check.
        // So if I insert retry logic at 56, I need to make sure I scrape examples for the INITIAL successful search too?
        // No, the initial search scraping happened at lines 46-53 (basic info).
        // Example scraping was later.

        // Correct flow:


        // Update History
        const history = readHistory();
        const now = new Date().toISOString();
        if (!history[result.word]) {
            history[result.word] = { count: 0, lastSearched: null };
        }

        // Prepare response with previous history data BEFORE incrementing for "last time" context, 
        // OR return the updated data. The user asked for "This word has been searched X times" and "Last searched on...".
        // Usually "Last searched" implies the previous time.
        // Let's return the current state (including this search) but maybe also the previous date?
        // Simpler: Return the updated count and the *previous* date (if any), then update the date.

        const previousDate = history[result.word].lastSearched;
        history[result.word].count += 1;
        history[result.word].lastSearched = now;
        writeHistory(history);

        result.history = {
            count: history[result.word].count,
            lastSearched: previousDate // Return the date BEFORE this current search
        };

        // Try to scrape examples
        console.log('Attempting to scrape examples...');
        $('.word-card__examples-list li').each((i, el) => {
            const jap = $(el).find('.example-jp').text().trim();
            const cht = $(el).find('.example-ch').text().trim();
            if (jap) result.examples.push({ jap, cht });
        });
        console.log(`Scraped ${result.examples.length} examples.`);

        // If no examples found, use LLM
        if (result.examples.length === 0) {
            if (process.env.GEMINI_API_KEY) {
                console.log('No examples found. Using LLM fallback...');
                try {
                    const prompt = `Generate 3 simple Japanese example sentences for the word "${result.word}" (${result.meaning}). 
                    Format as JSON array of objects with 'jap' (Japanese sentence) and 'cht' (Traditional Chinese translation, Taiwan usage).
                    Example: [{"jap": "猫がいます。", "cht": "有一隻貓。"}]`;

                    const resultLLM = await model.generateContent(prompt);
                    const response = await resultLLM.response;
                    const text = response.text();
                    console.log('LLM Response:', text);

                    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    result.examples = JSON.parse(jsonStr);
                    result.isLLM = true;
                    console.log('LLM examples generated successfully.');
                } catch (llmError) {
                    console.error('LLM generation failed:', llmError);
                }
            } else {
                console.log('No examples found and GEMINI_API_KEY is missing.');
            }
        }

        // Handle Japanese-to-Chinese translation
        if (direction === 'ja-zh' && process.env.GEMINI_API_KEY) {
            console.log(`Japanese-to-Chinese mode. Translating "${result.word}" to Chinese...`);
            try {
                const prompt = `Translate the Japanese word "${result.word}" (reading: ${result.reading}) to Traditional Chinese (Taiwan usage). Return ONLY the Chinese translation, no explanation.`;
                const resultLLM = await model.generateContent(prompt);
                const response = await resultLLM.response;
                const translated = response.text().trim();

                if (translated) {
                    console.log(`Translated "${result.word}" to "${translated}"`);
                    result.translatedMeaning = translated;
                    result.originalMeaning = result.meaning; // Keep original meaning from dictionary
                }
            } catch (e) {
                console.error('Japanese-to-Chinese translation failed:', e.message);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Scraping error:', error.message);
        res.status(500).json({ error: 'Failed to fetch data' });
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

// Saved Words Endpoints
app.get('/api/saved', (req, res) => {
    res.json(readDB());
});

app.post('/api/save', (req, res) => {
    const newWord = req.body;
    const db = readDB();
    if (!db.find(w => w.word === newWord.word)) {
        db.push(newWord);
        writeDB(db);
    }
    res.json({ success: true, data: db });
});

app.delete('/api/saved/:word', (req, res) => {
    const wordToDelete = req.params.word;
    let db = readDB();
    db = db.filter(w => w.word !== wordToDelete);
    writeDB(db);
    res.json({ success: true, data: db });
});

// Heartbeat System
// Heartbeat System
let lastHeartbeat = Date.now();
let isConnected = false;
const SHUTDOWN_DELAY = 60000; // 60 seconds

// Check for heartbeat every second
setInterval(() => {
    // Only check for shutdown if we have established a connection at least once
    if (isConnected && Date.now() - lastHeartbeat > SHUTDOWN_DELAY) {
        console.log('No heartbeat received. Shutting down...');
        process.exit(0);
    }
}, 1000);

app.get('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    isConnected = true; // Mark as connected on first heartbeat
    res.json({ status: 'alive' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Auto-shutdown enabled: Server will close if no heartbeat for ${SHUTDOWN_DELAY / 1000}s (after first connection)`);
});
