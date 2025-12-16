// 1. 引入 express 工具
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// 新增：SQL Server 連線設定
const sql = require('mssql');

// TODO: 請替換為您 SQL Server 伺服器的真實資料！
const dbConfig = {
    user: 'Your_DB_Username',        // 換成您的資料庫帳號
    password: 'Your_DB_Password',    // 換成您的資料庫密碼
    server: 'localhost',             // 如果資料庫在本機，用 localhost，不然請換成 IP
    database: 'Your_Database_Name',  // 換成您和隊友約定好的資料庫名稱
    options: {
        encrypt: false, // 如果使用本機或非加密連線，設定為 false
        trustServerCertificate: true // 信任伺服器憑證 (處理本機連線問題)
    }
};

// 建立連線池
let pool;
async function connectToDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ 資料庫連線池建立成功！");
    } catch (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
        console.error('請確認資料庫服務已開啟，且連線資訊正確！');
    }
}

connectToDatabase();

// 2. 設定允許跨網域連線
app.use(cors());
app.use(express.json());

// 3. 測試接口
app.get('/', (req, res) => {
  res.send('你好！我是後端，我正在運作中！🚀');
});

// ==========================================
// API 1: 查品牌接口 (修正版：支援含空白的品牌名)
// ==========================================
app.get('/api/brand-location', async (req, res) => { 
    let brandName = req.query.name || '';

    // 🧹 修正後的資料清洗：
    // 1. 只把「中文逗號」換成「英文逗號」。
    // 2. 不再把「空白」變成逗號，這樣 Under Armour 才不會被切斷。
    brandName = brandName.replace(/，/g, ','); 

    if (!pool) {
        return res.json({ success: false, message: '資料庫尚未連線' });
    }

    try {
        // 🚀 SQL 升級：使用 LTRIM 和 RTRIM
        // 這樣如果使用者輸入 "Nike, Under Armour" (逗號後有空白)，
        // SQL 會自動把 " Under Armour" 旁邊的空白修剪掉，變成正確的 "Under Armour"
        const query = `
            SELECT name, location, floor 
            FROM BrandTable 
            WHERE name IN (
                SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@BrandParam, ',')
            )
        `;

        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, brandName)
            .query(query);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: `查無品牌：${brandName} 的資訊` });
        }
    } catch (err) {
        console.error('查詢品牌錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// ==========================================
// API 2: 查縣市百貨接口 (不用改，維持原樣)
// ==========================================
app.get('/api/store-by-city', async (req, res) => {
    const cityName = req.query.city;
    if (!pool) return res.json({ success: false, message: '資料庫尚未連線' });

    try {
        const result = await pool.request()
            .input('CityParam', sql.NVarChar, cityName)
            .query('SELECT name, address FROM MallTable WHERE city = @CityParam');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: `查無縣市：${cityName} 的百貨資料` });
        }
    } catch (err) {
        console.error('查詢縣市錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// ==========================================
// API 3: 複合查詢接口 (修正版：支援含空白的品牌名)
// ==========================================
app.get('/api/search-brand-in-city', async (req, res) => {
    if (!pool) return res.json({ success: false, message: '資料庫尚未連線' });

    let brandName = req.query.brand || '';
    const cityName = req.query.city;

    // 🧹 同樣只處理逗號，保留單字間的空白
    brandName = brandName.replace(/，/g, ',');

    try {
        // SQL 升級：同樣加上 LTRIM(RTRIM(...)) 來修剪頭尾空白
        const query = `
            SELECT B.name, B.location, B.floor, M.address 
            FROM BrandTable B
            JOIN MallTable M ON B.location = M.name
            WHERE M.city = @CityParam
            AND B.name IN (
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
            res.json({ success: false, message: `在 ${cityName} 找不到這些品牌 (${brandName}) 的資訊` });
        }
    } catch (err) {
        console.error('複合查詢錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
});

// 4. 啟動伺服器
app.listen(port, () => {
  console.log(`後端伺服器已經啟動，正在監聽 Port ${port}`);
});