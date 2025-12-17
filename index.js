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
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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
// 🤖 API 3: AI 推薦 (Gemini)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (智慧路由版)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (暴力關鍵字版 - 解決無類別問題)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (終極版：支援地點 + 類別交叉搜尋)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (修正語法、無紅線版)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (反向過濾版 - 精準度最高)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (省流版：一次對話，不會爆額度)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (本機模擬版 - 暫時繞過 Google API 以便測試系統)
// =========================================================
// =========================================================
// 🤖 API 3: AI 推薦 (全量名單判讀版 - 既然不分類，就讓 AI 硬看)
// =========================================================
app.get('/api/ai-recommend', async (req, res) => {
    const userQuery = req.query.q || '';
    if (!userQuery) return res.status(400).json({ success: false });

    console.log(`🤖 (全量版) 使用者問：${userQuery}`);

    try {
        // --- 步驟 1: 簡單判斷使用者在問哪間百貨 (鎖定範圍) ---
        // 為了避免把「全台灣」的品牌都丟給 AI (會爆掉)，我們先鎖定百貨
        let targetLoc = "";
        const q = userQuery.toLowerCase();

        if (q.includes("a13")) targetLoc = "遠百信義A13"; 
        else if (q.includes("a11")) targetLoc = "台北信義新天地 A11";
        else if (q.includes("a8")) targetLoc = "台北信義新天地 A8";
        else if (q.includes("統領")) targetLoc = "桃園統領百貨";
        else if (q.includes("板橋")) targetLoc = "板橋大遠百"; // 請根據您 DB 實際名稱調整
        else if (q.includes("桃園")) targetLoc = "桃園"; // 廣泛搜尋

        // --- 步驟 2: 撈出該範圍的「全部」品牌 ---
        let rawBrands = [];
        if (pool) {
            const request = pool.request();
            let sqlQuery = "";
            
            if (targetLoc) {
                // 有指定百貨，撈該百貨全部
                request.input('loc', sql.NVarChar, `%${targetLoc}%`);
                sqlQuery = `SELECT name, floor, location FROM BRAND_PRESENCE WHERE location LIKE @loc`;
            } else {
                // 沒指定百貨，這很危險(資料太多)，我們先限制只撈前 100 筆給 AI 判斷，不然會爆
                sqlQuery = `SELECT TOP 100 name, floor, location FROM BRAND_PRESENCE`;
            }
            
            const dbRes = await request.query(sqlQuery);
            rawBrands = dbRes.recordset;
        }

        if (rawBrands.length === 0) {
             return res.json({ success: true, reply: "資料庫裡找不到該百貨的任何資料，請確認資料庫是否有建立品牌數據。", data: [] });
        }

        // --- 步驟 3: 整包丟給 AI 篩選 ---
        // 把品牌名稱串成字串，例如 "Nike, Adidas, 鼎泰豐, Uniqlo..."
        const brandListText = rawBrands.map(b => b.name).join(", ");
        
        console.log(`📦 撈到 ${rawBrands.length} 筆品牌，正在送給 AI 判讀...`);

        const prompt = `
            使用者問：「${userQuery}」。
            以下是我們資料庫裡有的所有品牌名單：
            [ ${brandListText} ]

            請當作你是一個分類過濾器：
            1. 根據使用者的問題，從上面名單中挑選出符合的品牌。
            2. 例如使用者問「吃的」，你就挑出所有餐廳；問「鞋子」，就挑出鞋店。
            3. 如果使用者問的是某個特定品牌(如 Nike)，就挑出 Nike。
            4. 請回傳一個 JSON 陣列，只包含符合的品牌名稱。例如：["鼎泰豐", "瓦城"]。
            5. 如果都沒有符合的，回傳 []。
        `;

        // 使用 gemini-1.5-flash (它處理長文章能力較好)
        // 如果這個模型還是 404，請改回 gemini-flash-latest
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        
        let matchedNames = [];
        try { matchedNames = JSON.parse(text); } catch(e) {
            console.error("AI 解析失敗", e);
        }

        console.log("🎯 AI 挑選結果:", matchedNames);

        // --- 步驟 4: 回傳結果 ---
        // 根據 AI 挑出來的名字，回去 rawBrands 把完整資訊 (樓層等) 抓出來
        const finalData = rawBrands.filter(b => matchedNames.includes(b.name));

        let replyText = "";
        if (finalData.length > 0) {
            replyText = `根據您的需求，在資料庫名單中幫您挑選出以下結果：\n` + 
                        finalData.map(d => `• ${d.name} (${d.location} ${d.floor})`).join("\n");
        } else {
            replyText = "AI 看過資料庫名單後，認為沒有符合您需求的品牌。";
        }

        res.json({ 
            success: true, 
            reply: replyText, 
            keywords: [],
            data: finalData.map(d => ({ // 轉成前端要的格式
                storeName: d.location,
                brand_name: d.name,
                floor: d.floor
            }))
        });

    } catch (err) {
        console.error('AI Error:', err);
        // 如果爆掉 (例如名單太長)，建議使用者分類
        if (err.message.includes('429') || err.message.includes('limit')) {
            res.json({ success: true, reply: "⚠️ 該百貨品牌太多，AI 一時處理不完 (超過額度)。建議我們還是幫資料庫加上「類別」欄位會比較穩！", data: [] });
        } else {
            res.json({ success: false, message: '系統忙碌中' });
        }
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