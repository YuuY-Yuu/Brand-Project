import pandas as pd
from sqlalchemy import create_engine, text
import urllib
import os

# ==========================================
# 🛠️ 設定區 (已更新為這 4 個新檔案)
# ==========================================
# ⚠️ 注意：檔名裡的空格要完全一樣喔 (例如 DIAMOND  TOWERS 中間有兩個空白)
EXCEL_FILES_LIST = [
    'DIAMOND  TOWERS 二館_含類別.xlsx',
    'DIAMOND  TOWERS一館_含類別.xlsx',
    '新光三越台北南西店_含類別.xlsx',
    '新光三越台北站前店_含類別.xlsx'
]

TABLE_NAME = 'BRAND_PRESENCE'     # 資料表名稱
SERVER = 'localhost'              # 伺服器名稱
DATABASE = 'BrandLocationDB'      # 資料庫名稱
# ==========================================

def run_import_diamond_skm():
    print("🚀 準備開始匯入 4 個新檔案 (智慧補全模式)...")
    
    # 1. 建立連線
    print("正在連線到 SQL Server ...")
    try:
        driver = 'ODBC Driver 17 for SQL Server'
        conn_str = f'DRIVER={{{driver}}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'
        params = urllib.parse.quote_plus(conn_str)
        engine = create_engine(f'mssql+pyodbc:///?odbc_connect={params}')
        print("✅ 連線成功！\n")
    except Exception as e:
        print(f"❌ 連線失敗: {e}")
        return

    # 2. 準備 SQL 指令
    sql_check = text(f"SELECT category FROM {TABLE_NAME} WHERE location=:loc AND floor=:flr AND name=:nm")
    sql_insert = text(f"INSERT INTO {TABLE_NAME} (location, floor, name, category) VALUES (:loc, :flr, :nm, :cat)")
    sql_update = text(f"UPDATE {TABLE_NAME} SET category=:cat WHERE location=:loc AND floor=:flr AND name=:nm")

    # 3. 開始處理
    with engine.connect() as conn:
        for excel_file in EXCEL_FILES_LIST:
            print(f"📂 正在處理: {excel_file} ...")
            
            if not os.path.exists(excel_file):
                print(f"   ⚠️ 找不到檔案，請檢查檔名是否正確！(特別注意空格)")
                continue

            try:
                df = pd.read_excel(excel_file, engine='openpyxl')
                df = df.fillna('') # 清除空白值
            except Exception as e:
                print(f"   ❌ 讀取失敗: {e}")
                continue
            
            inserted = 0
            updated = 0
            skipped = 0
            
            for index, row in df.iterrows():
                params = {
                    "loc": row['location'],
                    "flr": row['floor'],
                    "nm": row['name'],
                    "cat": row['類別']
                }

                try:
                    # 步驟 1: 檢查資料庫
                    result = conn.execute(sql_check, params).fetchone()

                    if result is None:
                        # 情況 A: 新增
                        conn.execute(sql_insert, params)
                        inserted += 1
                    else:
                        db_category = result[0]
                        # 情況 B: 補齊類別 (原本是空的才補)
                        if db_category is None or db_category == '':
                            conn.execute(sql_update, params)
                            updated += 1
                            print(f"   🆙 補齊類別: {row['name']} ({row['floor']})")
                        else:
                            # 情況 C: 跳過
                            skipped += 1
                            print(f"   ⏭️  已存在略過: {row['name']} ({row['floor']})")

                except Exception as e:
                    print(f"   ⚠️ 第 {index} 筆錯誤: {e}")

            conn.commit()
            print(f"   📊 小結: 新增 {inserted} / 更新 {updated} / 略過 {skipped}\n")

    print("🎉 全部作業完成！")

if __name__ == '__main__':
    run_import_diamond_skm()

# python import_excel.py