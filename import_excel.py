import pandas as pd
from sqlalchemy import create_engine, text
import urllib
import os

# ==========================================
# 🛠️ 設定區 (Excel 檔案清單)
# ==========================================
EXCEL_FILES_LIST = [
    '新光三越台北南西店三館_含類別.xlsx',
    '新光三越台北天母店_含類別.xlsx',
    '新光三越台北天母店二館_含類別.xlsx'
]

TABLE_NAME = 'BRAND_PRESENCE'
SERVER = 'localhost'
DATABASE = 'BrandLocationDB'
# ==========================================

def run_import_fix_columns():
    print("🚀 準備開始匯入 Excel 檔案 (強制修正標題模式)...")
    
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

    sql_check = text(f"SELECT category FROM {TABLE_NAME} WHERE location=:loc AND floor=:flr AND name=:nm")
    sql_insert = text(f"INSERT INTO {TABLE_NAME} (location, floor, name, category) VALUES (:loc, :flr, :nm, :cat)")
    sql_update = text(f"UPDATE {TABLE_NAME} SET category=:cat WHERE location=:loc AND floor=:flr AND name=:nm")

    with engine.connect() as conn:
        for excel_file in EXCEL_FILES_LIST:
            print(f"📂 正在處理: {excel_file} ...")
            
            if not os.path.exists(excel_file):
                print(f"   ⚠️ 找不到檔案，請確認檔名！")
                continue

            try:
                # 讀取 Excel
                df = pd.read_excel(excel_file, engine='openpyxl')
                
                # 強制修正欄位 (不管標題叫什麼，前4欄就是 location, floor, name, 類別)
                if len(df.columns) >= 4:
                    new_columns = ['location', 'floor', 'name', '類別'] + df.columns.tolist()[4:]
                    df.columns = new_columns
                else:
                    print("   ❌ 欄位數量不足 4 欄，跳過！")
                    continue

                df = df.fillna('') # 清除空白

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
                    result = conn.execute(sql_check, params).fetchone()

                    if result is None:
                        conn.execute(sql_insert, params)
                        inserted += 1
                    else:
                        db_category = result[0]
                        if db_category is None or db_category == '':
                            conn.execute(sql_update, params)
                            updated += 1
                        else:
                            skipped += 1

                except Exception as e:
                    print(f"   ⚠️ 第 {index} 筆錯誤: {e}")

            conn.commit()
            print(f"   📊 小結: 新增 {inserted} / 更新 {updated} / 略過 {skipped}\n")

    print("🎉 Excel 檔案匯入完成！")

if __name__ == '__main__':
    run_import_fix_columns()

# python import_excel.py