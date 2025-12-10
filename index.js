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

// 4. 啟動伺服器 (開始接客)
app.listen(port, () => {
  console.log(`後端伺服器已經啟動，正在監聽 Port ${port}`);
});