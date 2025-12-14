from flask import Blueprint, render_template, jsonify
from .models import Sentence

# Create a Blueprint named 'main'
main = Blueprint('main', __name__)

@main.route('/')
def home():
    return render_template('index.html')

@main.route('/get-data')
def get_data():
    # Query the Sentence table defined in models.py
    row = Sentence.query.first()
    return jsonify({'message': row.plaintext if row else "No data found"})