-- 步驟 A: 建立百貨公司基本資料
INSERT INTO DEPARTMENT_STORE (name, address, city, phone, business_hours, floor_range)
VALUES (N'大江購物中心 MetroWalk', N'320桃園市中壢區中園路二段501號', N'Taoyuan', N'03-468-0999', N'11:00 — 22:00', N'B1~5F');

-- 步驟 B: 從暫存表搬運品牌資料
INSERT INTO BRAND_PRESENCE (name, location, floor)
SELECT 
    name,       -- 對應 CSV 的欄位
    location, -- 對應 CSV 的欄位
    floor           -- 對應 CSV 的欄位
FROM 大江購物中心;      -- 這是您剛剛匯入的暫存表名稱，如果名字不一樣請修改

--查詢
SELECT * FROM 大江購物中心

-- 步驟 C: (選用) 搬完後，刪除暫存表
--DROP TABLE 新光三越台北天母店二館;