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
// 🔍 API 1: 綜合搜尋 (支援多品牌、找百貨+支援嚴格模糊搜尋與自動糾錯)
// =========================================================
app.get('/api/smart-search', async (req, res) => {
    console.log("🔔 後端收到搜尋請求：", req.query); 

    let { city, brand } = req.query;
    let suggestion = null;

    if (!pool) return res.status(500).json({ success: false, message: "DB未連線" });

    try {
        const executeSearch = async (searchBrand) => {
            const request = pool.request(); // 每次搜尋建立新的 request
            let query = "";

            // 1. 先決定「主查詢語法」 (品牌搜尋 vs 純百貨搜尋)
            if (searchBrand) {
                // --- A. 品牌搜尋模式 ---
                query = `
                    SELECT DISTINCT 
                        D.name as storeName, D.address, D.phone, D.business_hours, D.floor_range,
                        B.name as brand_name, B.floor
                    FROM DEPARTMENT_STORE D
                    LEFT JOIN BRAND_PRESENCE B ON D.name = B.location
                    WHERE 1=1
                `;
                // 🔴 關鍵修改：把輸入字串切開 (支援空白或逗號分隔)
                // 例如 "chanel adidas" -> ["chanel", "adidas"]
                const keywords = searchBrand.split(/[\s,]+/).filter(k => k.trim());
                
                if (keywords.length > 0) {
                    query += " AND (";
                    keywords.forEach((kw, index) => {
                        // 動態產生參數名稱 brand0, brand1... 避免衝突
                        const paramName = `brandKw${index}`;
                        
                        if (index > 0) query += " OR "; // 用 OR 連接
                        query += `B.name LIKE @${paramName}`;
                        
                        // 綁定參數
                        request.input(paramName, sql.NVarChar, `%${kw}%`);
                    });
                    query += ")";
                }

            } else {
                // --- B. 純百貨搜尋模式 ---
                query = `
                    SELECT DISTINCT 
                        D.name as storeName, D.address, D.phone, D.business_hours, D.floor_range 
                    FROM DEPARTMENT_STORE D 
                    WHERE 1=1
                `;
            }

            // 2. 共通的「縣市過濾」 (統一寫在最後，避免重複宣告參數)
            if (city && city !== 'All') {
                // 記得確認資料庫欄位是 city 還是 city_key，這裡依您的指示設為 city
                query += ` AND D.city = @city`; 
                request.input('city', sql.NVarChar, city);
            }

            return await request.query(query);
        };

        // 1. 第一次嘗試：用原始輸入搜尋
        let result = await executeSearch(brand);

        // 2. 如果沒結果且有輸入品牌 -> 啟動「模糊搜尋」
        if (result.recordset.length === 0 && brand) {
            console.log("🤔 找不到精確結果，啟動模糊比對...");
            
            const allBrandsRes = await pool.request().query("SELECT DISTINCT name FROM BRAND_PRESENCE");
            const allBrands = allBrandsRes.recordset.map(b => b.name);
            const bestMatch = findBestMatch(brand, allBrands);

            // ✨ 關鍵修正：加入「長度權重」限制，避免亂猜
            // 規則：允許的錯誤距離，不能超過輸入字串長度的 50%
            // 例如 "泡麵" (len 2)，最大允許錯誤 1。但 "3M" 差了 2，所以會被過濾掉。
            const maxAllowedDistance = Math.ceil(brand.length * 0.5);

            if (bestMatch && bestMatch.distance <= 3 && bestMatch.distance <= maxAllowedDistance) {
                console.log(`✨ 修正搜尋: ${brand} -> ${bestMatch.target} (距離: ${bestMatch.distance})`);
                suggestion = bestMatch.target; 
                result = await executeSearch(bestMatch.target);
            } else {
                console.log("🚫 模糊比對失敗 (差異過大)，判定為無效搜尋");
            }
        }

        res.json({ 
            success: true, 
            data: result.recordset,
            suggestion: suggestion 
        });

    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== 演算法小工具：萊文斯坦距離 (Levenshtein Distance) ==========
function findBestMatch(input, targets) {
    if (!input || !targets) return null;
    let best = null;
    let minDistance = Infinity;
    const lowerInput = input.toLowerCase();

    targets.forEach(target => {
        if (!target) return;
        const lowerTarget = target.toLowerCase();
        // 簡單優化：如果包含在內，視為極度相似
        if (lowerTarget.includes(lowerInput)) {
            if (minDistance > 0) { minDistance = 0; best = target; }
            return;
        }
        const dist = levenshtein(lowerInput, lowerTarget);
        if (dist < minDistance) {
            minDistance = dist;
            best = target;
        }
    });
    return { target: best, distance: minDistance };
}

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // 初始化矩陣
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

    // 計算距離
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // 替換
                    Math.min(
                        matrix[i][j - 1] + 1, // 插入
                        matrix[i - 1][j] + 1  // 刪除
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
}


// =========================================================
// 🏢 API 2: 查詢某百貨的「完整樓層品牌清單」 (含分類版)
// =========================================================
app.get('/api/mall-floors', async (req, res) => {
    const storeName = req.query.name;
    if (!storeName) return res.status(400).json({ success: false });

    try {
        // 1. 修改 SQL：多撈取 category 欄位
        const query = `
            SELECT floor, name as brand_name, category
            FROM BRAND_PRESENCE 
            WHERE location = @storeName
            ORDER BY floor
        `;
        
        const result = await pool.request()
            .input('storeName', sql.NVarChar, storeName)
            .query(query);

        // 2. 整理資料格式 (巢狀結構)
        // 目標格式: { "1F": { "運動用品": ["Nike", "Adidas"], "餐飲": ["Starbucks"] } }
        const floors = {};

        result.recordset.forEach(row => {
            const f = row.floor;
            // 如果資料庫 category 為空，給一個預設值 '其他專櫃'
            const cat = row.category || '其他專櫃';

            if (!floors[f]) floors[f] = {};
            if (!floors[f][cat]) floors[f][cat] = [];
            
            floors[f][cat].push(row.brand_name);
        });

        res.json({ success: true, data: floors });

    } catch (err) {
        console.error(err);
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

        // 3. 組合 Prompt (🔴 加入了新的「糾錯告知」規則)
        const prompt = `
            【資料庫內容】：
            ${dataContext}

            【使用者問題】：
            「${userQuery}」

            【你的角色與任務】：
            你是一個聖誕購物 AI 顧問 🎅。

            【回答規範 (請嚴格遵守)】：
            1. **糾錯告知 (最重要)**：如果使用者輸入的品牌名稱有誤（拼錯字），請務必在回答的一開始明確告知：「**找不到 [使用者輸入]，但我猜您是想找 [正確名稱]**」，然後再根據正確名稱回答。
            2. **語氣**：回答要親切、有聖誕氣氛 (可適量使用 Emoji 🎄🎁)。
            3. **格式重點**：
               - 當提到 **【百貨公司名稱】**、**【餐廳或品牌名稱】**、**【樓層 (如 B2, 4F, GBF)】** 時，請務必使用 Markdown 粗體格式 (用兩個星號 ** 包起來)。
            4. **內容長度**：內容要精簡，重點呈現。
            5. **邏輯**：GBF 樓層請視為 1F 下方。
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