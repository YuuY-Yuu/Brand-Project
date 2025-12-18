-- 1. 把 MallTable 改名為 DEPARTMENT_STORE
--EXEC sp_rename 'MallTable', 'DEPARTMENT_STORE';

---- 2. 把 BrandTable 改名為 BRAND_PRESENCE (暫時先這樣對應，雖然欄位還沒完全正規化)
EXEC sp_rename 'BRAND_PRESENCE', 'BRAND_PRESENCE_Wrong';--BRAND_PRESENCE_Wrong

---- 3. 修改欄位名稱以符合您的設計
---- 修改百貨表欄位
--EXEC sp_rename 'DEPARTMENT_STORE.id', 'store_id', 'COLUMN';
---- city 和 address 您的設計裡也有，不用改

---- 修改品牌表欄位
--EXEC sp_rename 'BRAND_PRESENCE.id', 'presence_id', 'COLUMN';
--EXEC sp_rename 'BRAND_PRESENCE.brand_name', 'name', 'COLUMN'; -- 您的圖中 BRAND 表是用 name，我們先暫時用這個
---- location 和 floor 我們原本就有，先留著

--EXEC sp_rename 'BRAND_PRESENCE_Wrong', 'BRAND_PRESENCE';--BRAND_PRESENCE_Wrong