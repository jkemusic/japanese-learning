# Japanese Learning System 📚

A powerful Japanese learning tool providing vocabulary search, grammar explanations, and sentence generation. Integrated with Google Gemini AI for smart translation and Chinese dictionary support.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![React](https://img.shields.io/badge/React-19.2.0-blue.svg)

## ✨ Key Features

### 📖 Vocabulary Search
- **Instant Search**: View complete information immediately upon entering a Japanese word.
- **Bi-directional Translation**: Supports Chinese → Japanese and Japanese → Chinese modes.
- **Smart Chinese Translation**: Input Chinese to automatically translate to Japanese and search.
- **Japanese to Chinese**: Input Japanese words to get Traditional Chinese translations via AI.
- **Toggle Direction**: One-click switch between CN→JP and JP→CN modes.
- **Kana Conversion**: Automatically attempts to convert input to Hiragana for searching.
- **Complete Details**: Includes Kana reading, accent, part of speech, JLPT level, and Chinese meaning.

### 💬 Sentence System
- **Web Scraping**: Prioritizes scraping examples from the sigure.tw Japanese dictionary.
- **AI Generation**: Uses Gemini AI to generate practical examples when none are found.
- **Bilingual**: Japanese examples paired with Traditional Chinese translations.

### 📝 Grammar Explanations
- **AI Powered**: Uses Gemini AI to explain Japanese grammar.
- **Detailed Explanations**: Includes grammar patterns, meanings, and usage instructions.
- **Practical Examples**: Provides multiple sentence examples to aid understanding.

### 💡 Smart Suggestions
- **Related Vocabulary**: Provides related Japanese word suggestions based on search terms.
- **Quick Learning**: Click on suggested words to search immediately.

### 📚 Saved Words (Flashcards)
- **Local Storage**: Save important words to your personal vocabulary list.
- **History Tracking**: Automatically records search counts and timestamps.
- **Flashcard Mode**: Practice saved words with flip cards and spaced repetition (SRS) feedback (Correct/Forgot/Stats).
- **Management**: Sort by Date or Popularity, filter by JLPT level, and delete words.

### 🔄 Auto Shutdown
- **Smart Management**: Backend automatically shuts down 60 seconds after the frontend is closed.
- **Heartbeat Check**: Ensures resources aren't wasted using a heartbeat mechanism.

## 🚀 Quick Start

### System Requirements

- **Node.js** 18.0 or higher
- **npm** or **yarn**
- **Google Gemini API Key** (Optional, but highly recommended)

### Installation

#### Method 1: One-Click Start (Recommended)

1. **Ensure Node.js is installed**
   - Download from [nodejs.org](https://nodejs.org)

2. **Set API Key**
   - Get a free API Key from [Google AI Studio](https://aistudio.google.com/apikey)
   - Create `server/.env` file and add:
     ```env
     GEMINI_API_KEY=your_api_key_here
     ```

3. **Double Click to Start**
   - Double click `start_silent.vbs` or `start_app.bat`
   - The script will automatically:
     - ✅ Detect Node.js path
     - ✅ Install missing dependencies
     - ✅ Start backend and frontend servers
     - ✅ Open browser

#### Method 2: Manual Installation

1. **Clone or Download Project**
   ```bash
   # Enter project directory
   cd JapaneseLearning
   ```

2. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set Environment Variables**
   - Set Gemini API Key in `server/.env`

5. **Start Application**
   ```bash
   # Double click start_app.bat
   # Or manually start two terminals:
   
   # Terminal 1 - Backend
   cd server
   node server.js
   
   # Terminal 2 - Frontend
   cd client
   npm run dev
   ```

6. **Open Browser**
   - Go to http://localhost:5173

## 📁 Project Structure

```
JapaneseLearning/
├── client/                 # React Frontend
│   ├── src/               # Source Code
│   ├── public/            # Static Assets
│   ├── package.json       # Frontend Dependencies
│   └── vite.config.js     # Vite Config
├── server/                # Express Backend
│   ├── server.js          # Main Server File
│   ├── db.json            # Saved Words Database (Old/Backup)
│   ├── history.json       # Search History
│   ├── .env               # Environment Variables (Create manually)
│   └── package.json       # Backend Dependencies
├── start_app.bat          # Windows Start Script
├── start_silent.vbs       # Silent Start Script
└── README.md              # Project Documentation
```

## 🛠️ Tech Stack

### Frontend
- **React 19.2.0** - UI Framework
- **Vite 7.2.4** - Build Tool
- **Axios** - HTTP Requests
- **Lucide React** - Icons

### Backend
- **Express 5.2.1** - Web Framework
- **Google Generative AI** - Gemini API Integration
- **Mongoose** - MongoDB ODM
- **Axios** - HTTP Requests
- **Cheerio** - HTML Parsing (Web Scraping)
- **CORS** - Cross-Origin Resource Sharing
- **dotenv** - Environment Variable Management

## 🔧 Configuration

### Environment Variables

Set in `server/.env`:

```env
# Google Gemini API Key (Required for AI features)
GEMINI_API_KEY=your_api_key_here

# MongoDB URI (Required for History/Saved Words persistence)
MONGODB_URI=mongodb+srv://...
```

### Getting an API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Log in with Google account
3. Click "Create API Key"
4. Copy and paste into `.env` file

> [!IMPORTANT]
> Free Tier: Gemini API provides 200 free requests per day. If exceeded, wait for reset or upgrade.

## 📚 API Endpoints

### Backend API (Port 3000)

| Endpoint | Method | Params | Description |
|------|------|------|------|
| `/api/search` | GET | `q`: query<br>`direction`: `zh-ja` or `ja-zh` | Search word info, supports bi-directional translation |
| `/api/suggest` | GET | `q`: keyword | Get related vocabulary suggestions |
| `/api/grammar` | GET | `q`: grammar pattern | Get grammar explanations |
| `/api/saved` | GET | - | Get saved words |
| `/api/save` | POST | word object | Save a word |
| `/api/saved/:word` | DELETE | `word`: word string | Delete a saved word |
| `/api/flashcard/review` | POST | `word`, `result` | Update flashcard SRS stats (correct/incorrect) |
| `/api/heartbeat` | GET | - | Server heartbeat check |

## 🎯 Usage Guide

### Vocabulary Search

#### CN → JP Mode (Default)
1. Ensure direction button says "CN → JP".
2. Enter Chinese word (e.g., 貓).
3. System translates to Japanese (猫) and searches.
4. View complete info, reading, and examples.

#### JP → CN Mode
1. Click ⇄ button to switch to "JP → CN".
2. Enter Japanese word (e.g., 猫).
3. AI translates to Traditional Chinese after dictionary lookup.
4. Shows AI meaning and original dictionary meaning.

#### General
1. Press Enter or click Search.
2. Click "Save" (Bookmark icon) to add to list.

### Grammar Search
1. Switch to "Grammar (AI)" tab.
2. Enter grammar pattern (e.g., ほど～ない).
3. View AI-generated explanation and examples.

### Vocabulary Management & Flashcards
1. Scroll down to "Saved Words".
2. Use JLPT filters (N5-N1).
3. **Flashcards**: Click "🔊 Flashcards" button to start practice mode.
   - Flip cards, mark as Known/Forgot.
   - SRS system tracks your progress.

## 🔄 Start Script Features

`start_app.bat` features:

### ✅ Auto Node.js Detection
- Checks common install paths
- Auto-adds to PATH
- Supports nvm

### ✅ Auto Dependency Install
- Checks `node_modules`
- Runs `npm install` if missing

### ✅ Error Handling
- Clear error messages
- Troubleshooting tips

## 🐛 FAQ

### Q: No reaction when double-clicking?
**A:** Check if Node.js is installed. Run `node --version` in CMD.

### Q: "Node.js not found"?
**A:** 
- Download from [nodejs.org](https://nodejs.org)
- Restart script after install

### Q: API Quota Exceeded?
**A:** 
- Free tier limit is 200 req/day.
- Wait for reset or upgrade.

### Q: Can't find certain words?
**A:** 
- Source is sigure.tw.
- Try entering Kana or alternative writing.

### Q: Are examples AI-generated?
**A:** 
- Real examples from sigure.tw are prioritized.
- AI is used only as fallback (marked `isLLM: true`).

### Q: How to stop the server?
**A:** 
- Close the browser (auto-shutdowns in 60s).
- Or close the two command windows.

## 🤝 Contribution
Issues and Pull Requests welcome!

## 📄 License
ISC License

## 🙏 Acknowledgements
- [sigure.tw](https://www.sigure.tw) - Dictionary Data
- [Google Gemini](https://ai.google.dev) - AI Support
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Cloud Database

## 📞 Contact
Open an Issue for questions!

---

Made with ❤️ for Japanese learners
