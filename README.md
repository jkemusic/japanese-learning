# 日文學習系統 📚

一個功能強大的日文學習工具，提供單字查詢、文法解釋、例句生成等功能，並整合 Google Gemini AI 提供智能翻譯和中文查詞支援。

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![React](https://img.shields.io/badge/React-19.2.0-blue.svg)

## ✨ 主要功能

### 📖 單字查詢
- **即時查詢**：輸入日文單字立即顯示完整資訊
- **雙向翻譯**：支援中文→日文、日文→中文兩種查詢模式
- **中文智能翻譯**：支援輸入中文，自動翻譯成日文後查詢
- **日文轉中文**：輸入日文單字，使用 AI 翻譯成繁體中文
- **翻譯方向切換**：一鍵切換中→日或日→中模式
- **假名轉換**：自動嘗試將輸入轉換為平假名重新查詢
- **完整資訊**：包含假名讀音、重音、詞性、級數、中文意思

### 💬 例句系統
- **網頁爬取**：優先從 sigure.tw 日文辭典爬取例句
- **AI 生成**：無例句時使用 Gemini AI 自動生成實用例句
- **雙語對照**：日文例句搭配繁體中文翻譯

### 📝 文法解釋
- **AI 驅動**：使用 Gemini AI 解釋日文文法
- **詳細說明**：包含文法模式、意思、用法說明
- **實例演示**：提供多個例句幫助理解

### 💡 智能建議
- **關聯詞彙**：根據搜尋詞提供相關日文單字建議
- **快速學習**：一鍵點擊建議詞彙即可查詢

### 📚 單字收藏
- **本地儲存**：將重要單字儲存到個人單字本
- **搜尋歷史**：自動記錄查詢次數和時間
- **資料管理**：支援刪除和管理已儲存的單字

### 🔄 自動關機
- **智能管理**：前端關閉後，後端自動在 60 秒後關閉
- **心跳檢測**：透過心跳機制確保資源不浪費

## 🚀 快速開始

### 系統需求

- **Node.js** 18.0 或更高版本
- **npm** 或 **yarn**
- **Google Gemini API Key**（選用，但強烈建議）

### 安裝步驟

#### 方法一：一鍵啟動（推薦）

1. **確保已安裝 Node.js**
   - 從 [nodejs.org](https://nodejs.org) 下載安裝

2. **設定 API Key**
   - 到 [Google AI Studio](https://aistudio.google.com/apikey) 取得免費 API Key
   - 在 `server/.env` 檔案中設定：
     ```env
     GEMINI_API_KEY=你的API金鑰
     ```

3. **雙擊啟動**
   - 直接雙擊 `start_silent.vbs` 或 `start_app.bat`
   - 腳本會自動：
     - ✅ 偵測 Node.js 路徑
     - ✅ 安裝缺少的依賴
     - ✅ 啟動前後端伺服器
     - ✅ 開啟瀏覽器

#### 方法二：手動安裝

1. **克隆或下載專案**
   ```bash
   # 進入專案資料夾
   cd 日文
   ```

2. **安裝後端依賴**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **安裝前端依賴**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **設定環境變數**
   - 在 `server/.env` 中設定 Gemini API Key

5. **啟動應用程式**
   ```bash
   # 雙擊 start_app.bat
   # 或手動啟動兩個終端機：
   
   # 終端機 1 - 後端
   cd server
   node server.js
   
   # 終端機 2 - 前端
   cd client
   npm run dev
   ```

6. **開啟瀏覽器**
   - 前往 http://localhost:5173

## 📁 專案結構

```
日文/
├── client/                 # React 前端
│   ├── src/               # 原始碼
│   ├── public/            # 靜態資源
│   ├── package.json       # 前端依賴
│   └── vite.config.js     # Vite 配置
├── server/                # Express 後端
│   ├── server.js          # 主要伺服器檔案
│   ├── db.json            # 已儲存單字資料庫
│   ├── history.json       # 搜尋歷史記錄
│   ├── .env               # 環境變數（需自行建立）
│   └── package.json       # 後端依賴
├── start_app.bat          # Windows 啟動腳本
├── start_silent.vbs       # 靜默啟動腳本
└── README.md              # 專案說明文件
```

## 🛠️ 技術棧

### 前端
- **React 19.2.0** - UI 框架
- **Vite 7.2.4** - 建置工具
- **Axios** - HTTP 請求
- **Lucide React** - 圖示庫

### 後端
- **Express 5.2.1** - Web 框架
- **Google Generative AI** - Gemini API 整合
- **Axios** - HTTP 請求
- **Cheerio** - HTML 解析（網頁爬蟲）
- **CORS** - 跨域資源共享
- **dotenv** - 環境變數管理

## 🔧 配置說明

### 環境變數

在 `server/.env` 中設定：

```env
# Google Gemini API Key（必需，用於 AI 功能）
GEMINI_API_KEY=你的API金鑰
```

### API Key 取得方式

1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登入 Google 帳號
3. 點擊「Create API Key」
4. 複製 API Key 並貼到 `.env` 檔案

> [!IMPORTANT]
> 免費額度：Gemini API 提供每天 200 次請求的免費額度。如果超過額度，請等待隔天重置或升級方案。

## 📚 API 端點

### 後端 API (Port 3000)

| 端點 | 方法 | 參數 | 說明 |
|------|------|------|------|
| `/api/search` | GET | `q`: 查詢詞彙<br>`direction`: 翻譯方向 (`zh-ja` 或 `ja-zh`) | 查詢單字資訊，支援雙向翻譯 |
| `/api/suggest` | GET | `q`: 關鍵字 | 取得相關單字建議 |
| `/api/grammar` | GET | `q`: 文法句型 | 查詢文法解釋 |
| `/api/saved` | GET | - | 取得已儲存的單字 |
| `/api/save` | POST | 單字物件 | 儲存單字 |
| `/api/saved/:word` | DELETE | `word`: 單字 | 刪除已儲存的單字 |
| `/api/heartbeat` | GET | - | 心跳檢測 |

## 🎯 使用說明

### 單字查詢

#### 中文→日文模式（預設）
1. 確認翻譯方向按鈕顯示「中→日」
2. 在搜尋框輸入中文詞彙（如：貓）
3. 系統自動翻譯成日文（猫）後查詢字典
4. 查看完整的日文單字資訊、讀音、例句

#### 日文→中文模式
1. 點擊 ⇄ 按鈕切換到「日→中」模式
2. 在搜尋框輸入日文單字（如：猫）
3. 查詢字典後，AI 自動翻譯成繁體中文
4. 顯示 AI 翻譯的中文意思，並附上字典原文供參考

#### 一般操作
1. 按 Enter 或點擊搜尋按鈕
2. 查看單字資訊、例句和相關建議
3. 點擊「收藏」按鈕儲存到單字本

### 文法查詢
1. 切換到「文法查詢 (AI)」標籤
2. 輸入文法句型（如：ほど～ない）
3. 查看 AI 生成的詳細解釋和例句

### 管理單字本
1. 向下滾動到「收藏單字」區域
2. 使用級數篩選器（N5、N4、N3、N2、N1）
3. 點擊單字卡片查看詳細資訊
4. 點擊 ❌ 刪除不需要的單字

## 🔄 啟動腳本功能

`start_app.bat` 提供以下智能功能：

### ✅ Node.js 自動偵測
- 檢查常見安裝位置
- 自動加入 PATH 環境變數
- 支援 nvm 多版本管理

### ✅ 依賴自動安裝
- 檢查 `node_modules` 是否存在
- 缺少時自動執行 `npm install`
- 分別處理前後端依賴

### ✅ 錯誤處理
- 清楚的錯誤訊息
- 安裝失敗時提供解決建議
- 找不到 Node.js 時提供下載連結

## 🐛 常見問題

### Q: 雙擊後沒有反應？
**A:** 確認 Node.js 已安裝。開啟命令提示字元執行 `node --version` 檢查。

### Q: 顯示「找不到 Node.js」？
**A:** 
- 到 [nodejs.org](https://nodejs.org) 下載安裝 Node.js
- 安裝後重新啟動腳本

### Q: API Quota Exceeded 錯誤？
**A:** 
- Gemini API 免費額度為每天 200 次請求
- 等待隔天重置或減少查詢頻率
- 考慮升級到付費方案

### Q: 查不到某些單字？
**A:** 
- 本系統使用 sigure.tw 作為資料來源
- 如果該辭典沒有收錄，可能查不到
- 嘗試輸入假名或其他寫法

### Q: 例句都是 AI 生成的？
**A:** 
- 優先爬取 sigure.tw 的真實例句
- 只有在無例句時才使用 AI 生成
- AI 生成的例句會標記為 `isLLM: true`

### Q: 如何關閉伺服器？
**A:** 
- 關閉瀏覽器後，伺服器會在 60 秒後自動關閉
- 或直接關閉兩個命令視窗

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

ISC License

## 🙏 致謝

- [sigure.tw](https://www.sigure.tw) - 提供日文辭典資料
- [Google Gemini](https://ai.google.dev) - AI 功能支援
- 所有使用者的回饋和建議

## 📞 聯絡方式

如有問題或建議，歡迎開 Issue 討論！

---

Made with ❤️ for Japanese learners
