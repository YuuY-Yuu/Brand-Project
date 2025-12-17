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

UPDATE BRAND_PRESENCE
SET location = N'大江購物中心'
WHERE location = N'大江購物中心MetroWalk';

SELECT * FROM BRAND_PRESENCE