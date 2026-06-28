import sqlite3
import os

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'database.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE user ADD COLUMN last_login DATETIME")
    conn.commit()
    print("Successfully added last_login column to user table.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("Column last_login already exists.")
    else:
        print(f"Error: {e}")

conn.close()
