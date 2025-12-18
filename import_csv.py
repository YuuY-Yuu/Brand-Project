import pandas as pd
from sqlalchemy import create_engine, text
import urllib
import os

# ==========================================
# 🛠️ 設定區
# ==========================================
CSV_FILES_LIST = [
    '遠百板橋_含類別.csv',
    '板橋大遠百_含類別.csv',
    '桃園遠東百貨_含類別.csv',
    '遠百信義A13_含類別.csv'
]

TABLE_NAME = 'BRAND_PRESENCE'
SERVER = 'localhost'
DATABASE = 'BrandLocationDB'
# ==========================================

def run_csv_with_details():
    print("🚀 準備開始匯入 CSV (詳細顯示跳過名單)...")
    
    try:
        driver = 'ODBC Driver 17 for SQL Server'
        conn_str = f'DRIVER={{{driver}}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'
        params = urllib.parse.quote_plus(conn_str)
        engine = create_engine(f'mssql+pyodbc:///?odbc_connect={params}')
    except Exception as e:
        print(f"❌ 連線失敗: {e}")
        return

    sql_check = text(f"SELECT category FROM {TABLE_NAME} WHERE location=:loc AND floor=:flr AND name=:nm")
    sql_insert = text(f"INSERT INTO {TABLE_NAME} (location, floor, name, category) VALUES (:loc, :flr, :nm, :cat)")
    sql_update = text(f"UPDATE {TABLE_NAME} SET category=:cat WHERE location=:loc AND floor=:flr AND name=:nm")

    with engine.connect() as conn:
        for csv_file in CSV_FILES_LIST:
            print(f"\n📂 正在處理: {csv_file} ...")
            
            if not os.path.exists(csv_file):
                print(f"   ⚠️ 找不到檔案，跳過！")
                continue

            try:
                df = pd.read_csv(csv_file, encoding='utf-8-sig')
            except:
                try:
                    df = pd.read_csv(csv_file, encoding='big5')
                except:
                    print(f"   ❌ 讀取失敗，無法識別編碼。")
                    continue
            
            df = df.fillna('')

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
                            print(f"   🆙 補齊類別: {row['name']} ({row['floor']})")
                        else:
                            skipped += 1
                            # 這裡會印出每一筆被跳過的詳細資料
                            print(f"   ⏭️  已存在略過: {row['name']} ({row['floor']})")

                except Exception as e:
                    print(f"   ⚠️ 第 {index} 筆錯誤: {e}")

            conn.commit()
            print(f"   📊 小結: 新增 {inserted} / 更新 {updated} / 略過 {skipped}")

    print("\n🎉 CSV 作業完成！")

if __name__ == '__main__':
    run_csv_with_details()

# python import_csv.py