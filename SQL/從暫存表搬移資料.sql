-- 步驟 A: 建立百貨公司基本資料 (名字改為 '板橋遠百')
--INSERT INTO DEPARTMENT_STORE (name, address, city)
--VALUES (N'板橋遠百', N'新北市板橋區中山路一段152號', N'NewTaipei');

-- 步驟 B: 從暫存表搬運品牌資料
INSERT INTO BRAND_PRESENCE (name, location, floor)
SELECT 
    name,       -- 對應 CSV 的欄位
    location, -- 對應 CSV 的欄位
    floor           -- 對應 CSV 的欄位
FROM 新光三越台北天母店;      -- 這是您剛剛匯入的暫存表名稱，如果名字不一樣請修改

-- 步驟 C: (選用) 搬完後，刪除暫存表
DROP TABLE 新光三越台北天母店;