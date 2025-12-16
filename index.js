// ==========================================
// 1. 系統設定與套件引入
// ==========================================
require('dotenv').config(); // 讀取 .env 檔案裡的 Key
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // 引入 Gemini

const app = express();
const port = 3000;

// 初始化 Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// ==========================================
// 2. 資料庫連線設定 (您的設定)
// ==========================================
const dbConfig = {
    user: 'project_user',
    password: '12345',
    server: 'localhost',
    database: 'BrandLocationDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;

async function initializeDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ 資料庫連線成功！");
    } catch (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    }
}

initializeDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.send('後端 AI 導覽員已就緒 🤖'));

// ==========================================
// 🌟 新增功能：AI 智慧推薦接口 (RAG 簡易版)
// ==========================================
app.get('/api/ai-recommend', async (req, res) => {
    const userQuery = req.query.q || ''; // 使用者問的問題，例如 "我想買慢跑鞋"

    if (!userQuery) return res.status(400).json({ success: false, message: '請輸入問題' });

    console.log(`🤖 使用者問：${userQuery}`);

    try {
        // 1. 【AI 思考】 請 Gemini 把「口語需求」轉成「品牌關鍵字」
        const prompt = `
            你是一個百貨公司導覽員。使用者想找：「${userQuery}」。
            請根據使用者的需求，列出 5 到 8 個台灣百貨公司常見的相關品牌名稱。
            
            規則：
            1. 只給我品牌名稱，不要有其他廢話。
            2. 用 JSON 陣列格式回傳，例如：["Nike", "Adidas", "Puma"]。
            3. 如果使用者問吃的，就回傳餐廳品牌；問穿的，就回傳服飾品牌。
            4. 品牌名稱請用最常見的寫法（例如 "Nike", "Uniqlo", "瓦城"）。
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // 清理 AI 回傳的格式 (有時候 AI 會多加 markdown 符號)
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const suggestedBrands = JSON.parse(text); // 轉成陣列
        console.log(`💡 AI 推薦品牌：`, suggestedBrands);

        if (suggestedBrands.length === 0) {
            return res.json({ success: false, message: 'AI 想不到相關品牌' });
        }

        // 2. 【資料庫查詢】 拿 AI 給的品牌名去資料庫撈
        if (!pool) return res.status(503).json({ success: false, message: 'DB未連線' });

        // 動態產生 SQL： WHERE name LIKE '%Brand1%' OR name LIKE '%Brand2%' ...
        // 這裡用 LIKE 是為了增加命中率 (例如 AI 回傳 "Uniqlo"，資料庫是 "UNIQLO")
        const conditions = suggestedBrands.map(brand => `B.name LIKE N'%${brand}%'`).join(' OR ');
        
        const sqlQuery = `
            SELECT B.name, B.location, B.floor, D.address 
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE ${conditions}
        `;

        const dbResult = await pool.request().query(sqlQuery);

        // 3. 【回傳結果】
        res.json({
            success: true,
            user_question: userQuery,
            ai_suggestion: suggestedBrands, // 讓前端知道 AI 推薦了誰
            data: dbResult.recordset      // 資料庫真的撈到的結果
        });

    } catch (err) {
        console.error('AI 處理錯誤:', err);
        // 如果 AI 失敗或 JSON 解析失敗，回傳空結果以免前端爆掉
        res.json({ success: false, message: 'AI 大腦暫時打結了，請稍後再試' });
    }
});

// ==========================================
// 舊有的 API (查品牌、查縣市) - 繼續保留
// ==========================================
app.get('/api/brand-location', async (req, res) => { 
    // ... (保留原本的程式碼，這裡省略不貼以免太長，請直接用您原本的即可)
    // ⚠️ 如果您是直接覆蓋，記得要把下面這些舊 API 補回來喔！
    // 為了方便您，我把完整的舊 API 也貼在下面：
    if (!pool) return res.json({ success: false });
    let brandName = req.query.name || '';
    brandName = brandName.replace(/，/g, ','); 
    try {
        const query = `SELECT name, location, floor FROM BRAND_PRESENCE WHERE name IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ','))`;
        const result = await pool.request().input('BrandParam', sql.NVarChar, brandName).query(query);
        res.json({ success: true, data: result.recordset });
    } catch(e) { res.status(500).send(e.message); }
});

app.get('/api/store-by-city', async (req, res) => {
    if (!pool) return res.json({ success: false });
    const cityName = req.query.city || '';
    try {
        const query = 'SELECT name, address FROM DEPARTMENT_STORE WHERE city = @CityParam';
        const result = await pool.request().input('CityParam', sql.NVarChar, cityName).query(query);
        res.json({ success: true, data: result.recordset });
    } catch(e) { res.status(500).send(e.message); }
});

app.get('/api/search-brand-in-city', async (req, res) => {
    if (!pool) return res.json({ success: false });
    let brandName = req.query.brand || '';
    const cityName = req.query.city || '';
    brandName = brandName.replace(/，/g, ',');
    try {
        const query = `
            SELECT B.name, B.location, B.floor, D.address 
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE D.city = @CityParam
            AND B.name IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ','))
        `;
        const result = await pool.request().input('BrandParam', sql.NVarChar, brandName).input('CityParam', sql.NVarChar, cityName).query(query);
        res.json({ success: true, data: result.recordset });
    } catch(e) { res.status(500).send(e.message); }
});

app.listen(port, () => {
    console.log(`🚀 AI 後端伺服器啟動: http://localhost:${port}`);
});