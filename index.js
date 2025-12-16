// ==========================================
// 1. 系統設定
// ==========================================
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const app = express();
const port = 3000;

// ==========================================
// 2. 資料庫連線 (使用您的 project_user)
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
        console.log("✅ 資料庫連線成功！(表格已更新為 DEPARTMENT_STORE / BRAND_PRESENCE)");
    } catch (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    }
}

initializeDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.send('後端運作中 (Schema Updated)'));

// ==========================================
// API 1: 查品牌 (更新表名與欄位)
// ==========================================
app.get('/api/brand-location', async (req, res) => { 
    if (!pool) return res.status(503).json({ success: false, message: 'DB未連線' });

    let brandName = req.query.name || '';
    brandName = brandName.replace(/，/g, ','); 

    try {
        // 🔄 表名改成 BRAND_PRESENCE，欄位用 name
        const query = `
            SELECT name, location, floor 
            FROM BRAND_PRESENCE 
            WHERE name IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ','))
        `;
        const result = await pool.request().input('BrandParam', sql.NVarChar, brandName).query(query);
        
        if (result.recordset.length > 0) res.json({ success: true, data: result.recordset });
        else res.json({ success: false, message: `查無品牌：${brandName}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}); 

// ==========================================
// API 2: 查縣市百貨 (更新表名)
// ==========================================
app.get('/api/store-by-city', async (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB未連線' });
    const cityName = req.query.city || '';

    try {
        // 🔄 表名改成 DEPARTMENT_STORE
        const query = 'SELECT name, address FROM DEPARTMENT_STORE WHERE city = @CityParam';
        const result = await pool.request().input('CityParam', sql.NVarChar, cityName).query(query);

        if (result.recordset.length > 0) res.json({ success: true, data: result.recordset });
        else res.json({ success: false, message: `查無縣市：${cityName}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}); 

// ==========================================
// API 3: 複合查詢 (更新表名)
// ==========================================
app.get('/api/search-brand-in-city', async (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB未連線' });

    let brandName = req.query.brand || '';
    const cityName = req.query.city || '';
    brandName = brandName.replace(/，/g, ',');

    try {
        // 🔄 修改 JOIN 的表名
        const query = `
            SELECT B.name, B.location, B.floor, D.address 
            FROM BRAND_PRESENCE B
            JOIN DEPARTMENT_STORE D ON B.location = D.name
            WHERE D.city = @CityParam
            AND B.name IN (
                SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ',')
            )
        `;
        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, brandName)
            .input('CityParam', sql.NVarChar, cityName)
            .query(query);

        if (result.recordset.length > 0) res.json({ success: true, data: result.recordset });
        else res.json({ success: false, message: `查無資料` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.listen(port, () => {
    console.log(`🚀 後端伺服器啟動 (Port ${port})`);
});