import sqlite3
import os
from flask import Flask, jsonify, render_template  # Changed import

app = Flask(__name__)
DB_NAME = "demo.db"

def init_db():
    if not os.path.exists(DB_NAME):
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS content (text TEXT)")
        cursor.execute("INSERT INTO content (text) VALUES ('Hello World')")
        conn.commit()
        conn.close()

@app.route('/')
def home():
    # Flask automatically looks in the 'templates' folder for this file
    return render_template('index.html') 

@app.route('/get-data')
def get_data():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT text FROM content LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return jsonify({'message': row[0] if row else "No data found"})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)