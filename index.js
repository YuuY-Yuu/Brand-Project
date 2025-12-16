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

// 建立連線池 (連線池讓程式可以重複使用連線，效率更高)
let pool;
async function connectToDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ 資料庫連線池建立成功！");
    } catch (err) {
        // 如果資料庫還沒建立，程式不會當機，只會報錯
        console.error('❌ 資料庫連線失敗:', err.message);
        console.error('請確認資料庫服務已開啟，且連線資訊正確！');
    }
}

// 立即連線資料庫
connectToDatabase();

// 2. 設定允許跨網域連線 (讓前端可以連你的後端)
app.use(cors());
app.use(express.json());

// 3. 寫一個簡單的測試接口 (當有人敲門，就回傳 Hello)
app.get('/', (req, res) => {
  res.send('你好！我是後端，我正在運作中！🚀');
});

// 新增：查品牌接口 (當前端傳來品牌名稱，就回傳一個結果)
app.get('/api/brand-location', async (req, res) => { // 1. 取得前端傳來的品牌名稱 (例如: Nike)
  const brandName = req.query.name; 
  
  // 2. 「去資料庫查詢」的程式碼
    if (!pool) {
        return res.json({ success: false, message: '資料庫尚未連線，請稍後再試。' });
    }

    try {
        const result = await pool.request()
            .input('BrandParam', sql.NVarChar, brandName)
            .query('SELECT location, floor FROM BrandTable WHERE name = @BrandParam');

        if (result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset[0]
            });
        } else {
            res.json({
                success: false,
                message: `查無品牌：${brandName} 的資訊`
            });
        }
    } catch (err) {
        console.error('查詢品牌錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// 新增：查縣市百貨接口
app.get('/api/store-by-city', async (req, res) => {
  // 1. 取得前端傳來的縣市名稱 (例如: Taichung)
  const cityName = req.query.city;
  
  // 2. 「去資料庫查詢」的程式碼
    if (!pool) {
        return res.json({ success: false, message: '資料庫尚未連線，請稍後再試。' });
    }

    try {
        const result = await pool.request()
            .input('CityParam', sql.NVarChar, cityName)
            .query('SELECT name, address FROM MallTable WHERE city = @CityParam');

        if (result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset
            });
        } else {
            res.json({
                success: false,
                message: `查無縣市：${cityName} 的百貨資料`
            });
        }
    } catch (err) {
        console.error('查詢縣市錯誤:', err.message);
        res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
}); 

// 4. 啟動伺服器 (開始接客)
app.listen(port, () => {
  console.log(`後端伺服器已經啟動，正在監聽 Port ${port}`);
});