// ==========================================
// 1. 系統設定
// ==========================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// ==========================================
// 2. 資料庫連線
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
        console.log("✅ 資料庫連線成功！(含樓層顯示)");
    } catch (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    }
}

initializeDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// =========================================================
// 🔍 API 1: 單查品牌 (含樓層)
// =========================================================
app.get('/api/brand-location', async (req, res) => {
    const brandName = req.query.name || '';

    if (!pool) return res.status(500).json({ success: false, message: "DB未連線" });

    try {
        const query = `
            SELECT DISTINCT
                D.name as storeName,    
                D.address,              
                B.name as brand_name,
                B.floor  -- ✅ 加回樓層
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE B.name LIKE @BrandParam
        `;
        
        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, `%${brandName}%`)
            .query(query);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ SQL 錯誤:", err);
        res.status(500).json({ success: false, message: "資料庫錯誤" });
    }
});


// =========================================================
// 🔍 API 2: 單查城市 (不需要樓層，因為是列出百貨)
// =========================================================
app.get('/api/store-by-city', async (req, res) => {
    const cityName = req.query.city || '';

    if (!pool) return res.status(500).json({ success: false, message: "DB未連線" });

    try {
        const query = `
            SELECT DISTINCT
                name as storeName, 
                address, 
                '百貨公司' as brand_name 
            FROM DEPARTMENT_STORE 
            WHERE city = @CityParam
        `;

        const result = await pool.request()
            .input('CityParam', sql.NVarChar, cityName)
            .query(query);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ SQL 錯誤:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// =========================================================
// 🔍 API 3: 城市 + 品牌 (含樓層)
// =========================================================
app.get('/api/search-brand-in-city', async (req, res) => {
    const { city, brand } = req.query;

    if (!pool) return res.status(500).json({ success: false, message: "DB未連線" });

    try {
        const query = `
            SELECT DISTINCT
                D.name as storeName, 
                D.address, 
                B.name as brand_name,
                B.floor -- ✅ 加回樓層
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE D.city = @CityParam AND B.name LIKE @BrandParam
        `;

        const result = await pool.request()
            .input('CityParam', sql.NVarChar, city)
            .input('BrandParam', sql.NVarChar, `%${brand}%`)
            .query(query);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ SQL 錯誤:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// =========================================================
// 🤖 API 4: AI 推薦 (含樓層)
// =========================================================
app.get('/api/ai-recommend', async (req, res) => {
    const userQuery = req.query.q || '';
    if (!userQuery) return res.status(400).json({ success: false, message: '請輸入問題' });

    try {
        const prompt = `
            你是一個百貨公司導覽員。使用者問：「${userQuery}」。
            請列出 3-5 個台灣常見的相關品牌名稱 (例如: Nike, Adidas, 瓦城)。
            規則：只回傳 JSON 字串陣列，不要有其他文字。
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json|```/g, '').trim(); 
        let suggestedBrands = [];
        try { suggestedBrands = JSON.parse(text); } catch (e) {}

        if (suggestedBrands.length === 0) return res.json({ success: true, ai_suggestion: [], data: [] });
        if (!pool) return res.status(503).json({ success: false, message: 'DB未連線' });

        const conditions = suggestedBrands.map((_, i) => `B.name LIKE @brand${i}`).join(' OR ');

        // ✅ SQL 裡加回 B.floor
        const sqlQuery = `
            SELECT DISTINCT TOP 20
                D.name as storeName, 
                D.address, 
                B.name as brand_name,
                B.floor 
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE ${conditions}
        `;

        const request = pool.request();
        suggestedBrands.forEach((brand, i) => {
            request.input(`brand${i}`, sql.NVarChar, `%${brand}%`);
        });

        const dbResult = await request.query(sqlQuery);

        res.json({
            success: true,
            user_question: userQuery,
            ai_suggestion: suggestedBrands,
            data: dbResult.recordset
        });

    } catch (err) {
        console.error('AI 錯誤:', err);
        res.json({ success: false, message: 'AI 暫時無法回應' });
    }
});

app.listen(port, () => {
    console.log(`🚀 伺服器啟動: http://localhost:${port}`);
});