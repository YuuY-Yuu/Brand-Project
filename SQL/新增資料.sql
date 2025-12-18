-- 1. 在百貨公司表 (DEPARTMENT_STORE) 新增一個欄位叫 floor_range
--ALTER TABLE DEPARTMENT_STORE ADD floor_range NVARCHAR(50);
--ALTER TABLE DEPARTMENT_STORE ADD phone NVARCHAR(50);
--ALTER TABLE DEPARTMENT_STORE ADD business_hours NVARCHAR(100);

-- 2. 補上目前的資料
-- 設定 板橋遠百
--UPDATE DEPARTMENT_STORE 
--SET phone = N'03-468-0999', 
--    business_hours = N'11:00 — 22:00'
--WHERE name = N'大江購物中心 MetroWalk';

--UPDATE DEPARTMENT_STORE
--SET name = N'大江購物中心'
--WHERE name = N'大江購物中心 MetroWalk';

--SELECT * FROM BRAND_PRESENCE


--UPDATE BRAND_PRESENCE
--SET location = N'板橋遠百'
--WHERE location = N'遠百板橋';

--DELETE FROM BRAND_PRESENCE
--WHERE location = N'桃園遠東百貨' 


CREATE TABLE BRAND_PRESENCE (
    presence_id INT PRIMARY KEY IDENTITY(1,1), -- 自動編號，不用自己輸入
    name NVARCHAR(100),                        -- 品牌名稱 (如: NIKE)
    location NVARCHAR(100),                    -- 地點 (如: 桃園遠東百貨)
    floor NVARCHAR(50),                        -- 樓層 (如: 7F)
    category NVARCHAR(100)                     -- 類別 (如: 戶外休閒，允許空值)
);