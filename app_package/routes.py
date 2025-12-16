from flask import Blueprint, render_template, jsonify, send_from_directory, request
import os
from .models import Sentence, Word, Root, Flashcard, WordInstance
from deep_translator import GoogleTranslator

main = Blueprint('main', __name__)
BUILD_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

@main.route('/', defaults={'path': ''})
@main.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(BUILD_DIR, path)):
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, 'index.html')

@main.route('/get-data')
def get_data():
    row = Sentence.query.first()
    return jsonify({'message': row.plaintext if row else "No data found"})

# API endpoints for app.jsx
@main.route('/api/sentences')
def api_sentences():
    sentences = Sentence.query.all()
    return jsonify([{
        'sentence_id': s.sentence_id,
        'plaintext': s.plaintext,
        'translation': s.translation,
        'source_id': s.source_id,
        'complete': s.complete,
        'length': s.length
    } for s in sentences])

@main.route('/api/words')
def api_words():
    words = Word.query.all()
    return jsonify([{
        'word_id': w.word_id,
        'plaintext': w.plaintext,
        'translation': w.translation,
        'frequency': w.frequency,
        'known': w.known,
        'root_id': w.root_id
    } for w in words])

@main.route('/api/roots')
def api_roots():
    roots = Root.query.all()
    return jsonify([{
        'root_id': r.root_id,
        'plaintext': r.plaintext,
        'translation': r.translation
    } for r in roots])

@main.route('/api/tables')
def api_tables():
    """Return metadata about available tables"""
    return jsonify({
        'tables': ['sentences', 'words', 'roots', 'flashcards']
    })

@main.route('/api/languages')
def api_languages():
    """Return supported languages"""
    return jsonify({
        'languages': ['ar', 'en']
    })

@main.route('/translate', methods=['POST'])
def translate_text():
    data = request.get_json()
    text = data.get('q')
    source_lang = data.get('source', 'ar')
    target_lang = data.get('target', 'en')

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        # Use deep_translator directly
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated_text = translator.translate(text)
        
        return jsonify({'translatedText': translated_text})

    except Exception as e:
        print(f"Translation Error: {e}")
        return jsonify({'error': 'Translation failed', 'details': str(e)}), 500