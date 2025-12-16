// ==========================================
// 1. 系統設定與套件引入
// ==========================================
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const app = express();
const port = 3000;

// ==========================================
// 2. 資料庫連線設定
// ==========================================
const dbConfig = {
    user: 'project_user',
    password: '12345',
    server: 'localhost',       // 已設定 TCP 1433 固定 Port
    database: 'BrandLocationDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;

// 初始化資料庫連線
async function initializeDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ 資料庫連線成功！後端已準備就緒。");
    } catch (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    }
}

initializeDatabase();

// ==========================================
// 3. 中介軟體設定
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 讓瀏覽器可以讀取前端網頁

// 簡單的健康檢查接口
app.get('/', (req, res) => {
    res.send('後端伺服器運作正常 (Real DB Mode)');
});

// ==========================================
// API 1: 查品牌 (支援多品牌搜尋)
// ==========================================
app.get('/api/brand-location', async (req, res) => { 
    if (!pool) return res.status(503).json({ success: false, message: '資料庫尚未連線' });

    let brandName = req.query.name || '';
    // 防呆處理：將中文逗號轉為英文逗號
    brandName = brandName.replace(/，/g, ','); 

    try {
        const query = `
            SELECT brand_name as name, location, floor 
            FROM BrandTable 
            WHERE brand_name IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ','))
        `;
        
        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, brandName)
            .query(query);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: `查無品牌：${brandName}` });
        }
    } catch (err) {
        console.error('查品牌錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// ==========================================
// API 2: 查縣市百貨
// ==========================================
app.get('/api/store-by-city', async (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: '資料庫尚未連線' });

    const cityName = req.query.city || '';

    try {
        const query = 'SELECT name, address FROM MallTable WHERE city = @CityParam';
        
        const result = await pool.request()
            .input('CityParam', sql.NVarChar, cityName)
            .query(query);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: `查無縣市：${cityName}` });
        }
    } catch (err) {
        console.error('查縣市錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// ==========================================
// API 3: 複合查詢 (品牌 + 縣市)
// ==========================================
app.get('/api/search-brand-in-city', async (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: '資料庫尚未連線' });

    let brandName = req.query.brand || '';
    const cityName = req.query.city || '';
    brandName = brandName.replace(/，/g, ',');

    try {
        const query = `
            SELECT B.brand_name as name, B.location, B.floor, M.address 
            FROM BrandTable B
            JOIN MallTable M ON B.location = M.name
            WHERE M.city = @CityParam
            AND B.brand_name IN (
                SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ',')
            )
        `;

        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, brandName)
            .input('CityParam', sql.NVarChar, cityName)
            .query(query);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: `在 ${cityName} 找不到相關品牌資訊` });
        }
    } catch (err) {
        console.error('複合查詢錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
});

// ==========================================
// 4. 啟動伺服器
// ==========================================
app.listen(port, () => {
    console.log(`🚀 後端伺服器已啟動: http://localhost:${port}`);
});