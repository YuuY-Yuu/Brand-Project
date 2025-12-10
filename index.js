// 1. 引入 express 工具
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// 2. 設定允許跨網域連線 (讓前端可以連你的後端)
app.use(cors());
app.use(express.json());

// 3. 寫一個簡單的測試接口 (當有人敲門，就回傳 Hello)
app.get('/', (req, res) => {
  res.send('你好！我是後端，我正在運作中！🚀');
});

// 新增：查品牌接口 (當前端傳來品牌名稱，就回傳一個結果)
app.get('/api/brand-location', (req, res) => {
  // 1. 取得前端傳來的品牌名稱 (例如: Nike)
  const brandName = req.query.name; 
  
  // 2. 實際專案中，這裡會是「去資料庫查詢」的程式碼
  //    但現在我們先用假資料來模擬結果
  if (brandName === 'Nike') {
    res.json({
      success: true,
      data: {
        brand: 'Nike',
        location: '新光三越 A11',
        floor: '3F'
      }
    });
  } else {
    // 3. 如果查不到其他品牌，就回傳錯誤訊息
    res.json({
      success: false,
      message: `查無品牌：${brandName} 的資訊`
    });
  }
});

// 新增：查縣市百貨接口
app.get('/api/store-by-city', (req, res) => {
  // 1. 取得前端傳來的縣市名稱 (例如: Taichung)
  const cityName = req.query.city;
  
  // 2. 這裡一樣是模擬資料
  if (cityName === 'Taichung') {
    res.json({
      success: true,
      data: [
        { name: '新光三越 台中中港店', address: '台灣大道三段301號' },
        { name: '台中大遠百', address: '台灣大道三段251號' },
        { name: 'LaLaport 台中', address: '進德路600號' }
      ]
    });
  } else {
    // 3. 如果查不到其他縣市，就回傳錯誤訊息
    res.json({
      success: false,
      message: `查無縣市：${cityName} 的百貨資料`
    });
  }
});

// 4. 啟動伺服器 (開始接客)
app.listen(port, () => {
  console.log(`後端伺服器已經啟動，正在監聽 Port ${port}`);
});