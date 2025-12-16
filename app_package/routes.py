from flask import Blueprint, render_template, jsonify, send_from_directory, request
import os
from .models import Sentence, Word, Root, Flashcard, WordInstance
from .extensions import db
from deep_translator import GoogleTranslator
from tashaphyne.stemming import ArabicLightStemmer
import re

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
    
@main.route('/suggest-words', methods=['POST'])
def suggest_words():
    """
    Takes a list of Arabic words.
    Returns suggested Root and Translations for each.
    """
    data = request.get_json()
    words_input = data.get('words', [])
    
    suggestions = []
    translator = GoogleTranslator(source='ar', target='en')

    for word_text in words_input:
        try:
            # 1. Stem to get Root
            # Note: Tashaphyne might return multiple roots or need specific handling
            # simplistic approach:
            stemmer = ArabicLightStemmer()
            stemmer.light_stem(word_text)
            root_text = stemmer.get_root()
            
            # 2. Translate Word
            word_translation = translator.translate(word_text)
            
            # 3. Translate Root
            root_translation = translator.translate(root_text)

            suggestions.append({
                'plaintext': word_text,
                'translation': word_translation,
                'root_plaintext': root_text,
                'root_translation': root_translation
            })
        except Exception as e:
            print(f"Error processing word {word_text}: {e}")
            suggestions.append({
                'plaintext': word_text,
                'translation': "Error",
                'root_plaintext': "Error",
                'root_translation': "Error"
            })

    return jsonify(suggestions)

@main.route('/add-words', methods=['POST'])
def add_words():
    """
    Receives confirmed list of words to add.
    Checks for existing roots.
    Adds new Roots and Words to DB.
    """
    data = request.get_json()
    confirmed_items = data.get('items', [])
    
    new_roots_count = 0
    new_words_count = 0

    try:
        for item in confirmed_items:
            word_text = item.get('plaintext')
            word_trans = item.get('translation')
            root_text = item.get('root_plaintext')
            root_trans = item.get('root_translation')

            # 1. Check if Root exists
            existing_root = Root.query.filter_by(plaintext=root_text).first()
            
            if existing_root:
                root_id = existing_root.root_id
            else:
                # Create new Root
                new_root = Root(plaintext=root_text, translation=root_trans)
                db.session.add(new_root)
                db.session.flush() # Flush to get the new root_id immediately
                root_id = new_root.root_id
                new_roots_count += 1

            # 2. Create Word
            # Basic pruning (removing diacritics) for 'prune' field if needed, 
            # here just copying plaintext or simple normalization
            prune_text = re.sub(r'[\u064B-\u065F\u0640]', '', word_text) 

            new_word = Word(
                root_id=root_id,
                plaintext=word_text,
                translation=word_trans,
                prune=prune_text,
                frequency=50, # Default frequency
                known=False
            )
            db.session.add(new_word)
            new_words_count += 1

        db.session.commit()
        return jsonify({
            'success': True, 
            'new_roots_count': new_roots_count,
            'new_words_count': new_words_count
        })

    except Exception as e:
        db.session.rollback()
        print(f"Database Error: {e}")
        return jsonify({'error': str(e)}), 500