import pandas as pd
from sqlalchemy import create_engine, text
import urllib
import os

# ==========================================
# 🛠️ 設定區 (CSV 檔案清單)
# ==========================================
CSV_FILES_LIST = [
    '桃園統領百貨_含類別.csv'
]

TABLE_NAME = 'BRAND_PRESENCE'
SERVER = 'localhost'
DATABASE = 'BrandLocationDB'
# ==========================================

def run_csv_smart_patch():
    print("🚀 準備開始匯入 CSV 檔案 (智慧補全模式)...")
    
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

    # SQL 指令 (邏輯：沒資料就新增，有資料缺類別就補齊，都有就跳過)
    sql_check = text(f"SELECT category FROM {TABLE_NAME} WHERE location=:loc AND floor=:flr AND name=:nm")
    sql_insert = text(f"INSERT INTO {TABLE_NAME} (location, floor, name, category) VALUES (:loc, :flr, :nm, :cat)")
    sql_update = text(f"UPDATE {TABLE_NAME} SET category=:cat WHERE location=:loc AND floor=:flr AND name=:nm")

    with engine.connect() as conn:
        for csv_file in CSV_FILES_LIST:
            print(f"📂 正在處理 CSV: {csv_file} ...")
            
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
            
            df = df.fillna('') # 清除空白

            processed_count = 0 
            skipped_count = 0   
            
            for index, row in df.iterrows():
                # 這裡會自動去抓 CSV 裡的對應欄位
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
                        processed_count += 1
                    else:
                        db_category = result[0]
                        if db_category is None or db_category == '':
                            conn.execute(sql_update, params)
                            processed_count += 1
                            print(f"   🆙 補齊類別: {row['name']}")
                        else:
                            skipped_count += 1

                except Exception as e:
                    print(f"   ⚠️ 第 {index} 筆錯誤: {e}")

            conn.commit()
            print(f"   -> ✅ 成功處理 (新增/補齊): {processed_count} 筆 / ⏹️ 略過: {skipped_count} 筆\n")

    print("🎉 CSV 檔案匯入完成！")

if __name__ == '__main__':
    run_csv_smart_patch()

# python import_csv.py