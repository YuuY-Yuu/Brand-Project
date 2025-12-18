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

// 請確認 .env 裡有 GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 資料庫設定 (請自行確認帳密是否正確)
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

// =========================================================
// 🔍 API 1: 綜合搜尋 (支援多品牌、找百貨)
// =========================================================
app.get('/api/smart-search', async (req, res) => {
    // 👇 加入這一行，這樣後端收到請求時，黑色視窗就會跳出文字
    console.log("🔔 後端收到搜尋請求了！參數：", req.query); 

    const { city, brand } = req.query;
   
    if (!pool) return res.status(500).json({ success: false, message: "DB未連線" });

    try {
        let query = `
            SELECT DISTINCT 
                D.name as storeName, 
                D.address, 
                D.phone, 
                D.business_hours, 
                D.floor_range,
                B.name as brand_name,
                B.floor
            FROM DEPARTMENT_STORE D
            LEFT JOIN BRAND_PRESENCE B ON D.name = B.location
            WHERE 1=1
        `;
        
        const request = pool.request();

        // 1. 城市篩選
        if (city && city !== 'All') {
            query += ` AND D.city = @city`;
            request.input('city', sql.NVarChar, city);
        }

        // 2. 品牌篩選 (支援多品牌，例如 "Nike, Adidas")
        // 邏輯：只要該百貨有其中一個品牌就顯示
        if (brand) {
            const brands = brand.split(/[\s,，、]+/).filter(Boolean);
            if (brands.length > 0) {
                query += ` AND (`;
                const conditions = brands.map((b, i) => {
                    request.input(`brand${i}`, sql.NVarChar, `%${b}%`);
                    return `B.name LIKE @brand${i}`;
                });
                query += conditions.join(' OR ');
                query += `)`;
            }
        }

        // 如果只搜百貨 (沒搜品牌)，就只回傳百貨資訊 (去重)
        if (!brand) {
             query = `
                SELECT DISTINCT 
                    D.name as storeName, D.address, D.phone, D.business_hours, D.floor_range
                FROM DEPARTMENT_STORE D
                WHERE 1=1
            `;
            if (city && city !== 'All') {
                query += ` AND D.city = @city`;
            }
        }

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// =========================================================
// 🏢 API 2: 查詢某百貨的「完整樓層品牌清單」 (這是給樓層導覽用的)
// =========================================================
app.get('/api/mall-floors', async (req, res) => {
    const storeName = req.query.name;
    if (!storeName) return res.status(400).json({ success: false });

    try {
        const query = `
            SELECT floor, name as brand_name 
            FROM BRAND_PRESENCE 
            WHERE location = @storeName
            ORDER BY floor
        `; // 簡單排序，如果要有 B1, 1F, 2F 這種順序，前端處理比較簡單
        
        const result = await pool.request()
            .input('storeName', sql.NVarChar, storeName)
            .query(query);

        // 整理資料格式: { "1F": ["Nike", "Adidas"], "2F": [...] }
        const floors = {};
        result.recordset.forEach(row => {
            if (!floors[row.floor]) floors[row.floor] = [];
            floors[row.floor].push(row.brand_name);
        });

        res.json({ success: true, data: floors });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// =========================================================
// 🤖 API 3: AI 推薦 (整合新版角色指令與格式要求)
// =========================================================
app.get('/api/ai-recommend', async (req, res) => {
    const userQuery = req.query.q || '';
    if (!userQuery) return res.status(400).json({ success: false });

    console.log(`🤖 使用者問：${userQuery}`);

    try {
        if (!pool) return res.status(500).json({ success: false, reply: "資料庫未連線" });

        // 1. 撈資料
        const sqlQuery = `
            SELECT D.name as storeName, D.phone, D.business_hours, B.name as brand_name, B.floor
            FROM DEPARTMENT_STORE D
            JOIN BRAND_PRESENCE B ON D.name = B.location
        `;
        const dbRes = await pool.request().query(sqlQuery);
        
        // 2. 整理資料給 AI
        const dataContext = dbRes.recordset.map(row => 
            `[${row.storeName}] 品牌:${row.brand_name} 樓層:${row.floor} | 電話:${row.phone} | 時間:${row.business_hours}`
        ).join("\n");

        // 3. 組合 Prompt (這裡加入了您指定的新規則！)
        const prompt = `
            【資料庫內容】：
            ${dataContext}

            【使用者問題】：
            「${userQuery}」

            【你的角色與任務】：
            你是一個聖誕購物 AI 顧問 🎅。

            【回答規範 (請嚴格遵守)】：
            1. **語氣**：回答要親切、有聖誕氣氛 (可適量使用 Emoji 🎄🎁)。
            2. **格式重點**：
               - 當提到 **【百貨公司名稱】**、**【餐廳或品牌名稱】**、**【樓層 (如 B2, 4F, GBF)】** 時，請務必使用 Markdown 粗體格式 (用兩個星號 ** 包起來)。
               - 例如：推薦您去 **板橋大遠百** 的 **9F** 吃 **鼎泰豐**。
            3. **內容長度**：內容要精簡，重點呈現，讓使用者一眼就能看完，不要廢話。
            4. **邏輯**：GBF 樓層請視為 1F 下方。如果找不到資料請老實說。
        `;

        // 4. 送出
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        res.json({ success: true, reply: response.text() });

    } catch (err) {
        console.error('AI Error:', err);
        res.json({ success: false, reply: "聖誕老人連線忙碌中，請稍後再試！🎅" });
    }
});

// 取得所有百貨清單 (用於首頁輪播)
app.get('/api/stores', async (req, res) => {
    try {
        if (!pool) return res.status(500).json({ success: false });
        const result = await pool.request().query("SELECT name, address, city FROM DEPARTMENT_STORE");
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});

// 指令: node index.js

// push: git add .
// commit: git commit -m "訊息"
// push: git push origin main

//pull: git pull origin master