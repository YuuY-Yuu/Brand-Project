import pandas as pd
from sqlalchemy import create_engine
import urllib

# ==========================================
# 設定區 (請修改這裡！)
# ==========================================
EXCEL_FILE = '大江購物中心.xlsx'      # 你的 Excel 檔名
TABLE_NAME = '大江購物中心'        # 你想在 SQL 裡建立的資料表名稱
SERVER = 'localhost'          # 你的 SQL Server 名稱 (通常是 localhost 或 電腦名稱)
DATABASE = 'BrandLocationDB'           # 你的資料庫名稱
# ==========================================

def run_import():
    print("--- 開始執行匯入程序 ---")

    # 1. 讀取 Excel
    print(f"正在讀取 Excel 檔案: {EXCEL_FILE} ...")
    try:
        # engine='openpyxl' 專門用來讀取 xlsx 檔案
        df = pd.read_excel(EXCEL_FILE, engine='openpyxl')
        print(f"成功讀取！共發現 {len(df)} 筆資料。")
    except FileNotFoundError:
        print("❌ 錯誤：找不到 Excel 檔案，請確認檔名是否正確，且放在同一個資料夾。")
        return
    except Exception as e:
        print(f"❌ 讀取 Excel 失敗：{e}")
        return

    # 2. 建立資料庫連線
    print("正在連線到 SQL Server ...")
    try:
        # 使用 Windows 驗證 (Trusted_Connection=yes)，不需要帳號密碼
        driver = 'ODBC Driver 17 for SQL Server'
        conn_str = f'DRIVER={{{driver}}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'
        
        # 轉換連線字串格式
        params = urllib.parse.quote_plus(conn_str)
        engine = create_engine(f'mssql+pyodbc:///?odbc_connect={params}')
        
        # 測試連線
        with engine.connect() as conn:
            pass
        print("連線成功！")
        
    except Exception as e:
        print(f"❌ 資料庫連線失敗：{e}")
        print("提示：請確認 Server 名稱正確，且已安裝 ODBC Driver 17。")
        return

    # 3. 寫入資料庫
    print(f"正在將資料寫入資料表 [{TABLE_NAME}] ...")
    try:
        df.to_sql(
            name=TABLE_NAME,
            con=engine,
            if_exists='append',  # append: 追加到後面 (若表不存在會自動建立)
            index=False,         # 不要把 Pandas 的索引數字存進去
            chunksize=1000       # 分批寫入，避免當機
        )
        print("✅ 匯入成功！作業完成。")
        
    except Exception as e:
        print(f"❌ 寫入資料庫時發生錯誤：{e}")

# 執行主程式
if __name__ == '__main__':
    run_import()

#指令: python import_db.py