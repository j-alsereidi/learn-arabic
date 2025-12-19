from flask import Blueprint, render_template, jsonify, send_from_directory, request, Response
import os
from .models import Sentence, Word, Root, Flashcard, WordInstance
from .extensions import db
from deep_translator import GoogleTranslator
from tashaphyne.stemming import ArabicLightStemmer
import nltk
from nltk.stem.isri import ISRIStemmer
import re
import string

main = Blueprint('main', __name__)
BUILD_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

# Intialize Tashaphyne Stemmer
tashaphyne_stemmer = ArabicLightStemmer()

# Initialize NLTK ISRIStemmer
isri_stemmer = ISRIStemmer()
nltk.download('punkt_tab')

def clean_punctuation(text):
    # Arabic and English punctuation to strip
    punctuation = string.punctuation + '،؛؟”'
    translator = str.maketrans('', '', punctuation)
    return text.translate(translator).strip()

@main.route('/', defaults={'path': ''})
@main.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(BUILD_DIR, path)):
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, 'index.html')

# API endpoints for app.jsx

@main.route('/api/sentences')
def api_sentences():
    sentences = Sentence.query.all()
    return jsonify([{
        'sentence_id': s.sentence_id,
        'plaintext': s.plaintext,
        'translation': s.translation,
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
        'root_id': w.root_id,
        'prune': w.prune
    } for w in words])

@main.route('/api/roots')
def api_roots():
    roots = Root.query.all()
    return jsonify([{
        'root_id': r.root_id,
        'plaintext': r.plaintext,
        'translation': r.translation
    } for r in roots])

@main.route('/api/word-instances')
def api_word_instances():
    """Returns all explicit links between sentences and words."""
    instances = WordInstance.query.all()
    return jsonify([{
        'sentence_id': i.sentence_id,
        'word_id': i.word_id,
        'index': i.index
    } for i in instances])

@main.route('/api/link-word', methods=['POST'])
def link_word_instance():
    """Creates or updates a link between a specific word in a sentence and a Word definition."""
    data = request.get_json()
    sentence_id = data.get('sentence_id')
    word_id = data.get('word_id')
    index = data.get('index')

    if sentence_id is None or word_id is None or index is None:
        return jsonify({'error': 'Missing data'}), 400

    try:
        # Check if link exists
        instance = WordInstance.query.filter_by(sentence_id=sentence_id, index=index).first()
        
        if instance:
            instance.word_id = word_id
        else:
            instance = WordInstance(sentence_id=sentence_id, word_id=word_id, index=index)
            db.session.add(instance)
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/unlink-word', methods=['POST'])
def unlink_word_instance():
    """Removes a link."""
    data = request.get_json()
    sentence_id = data.get('sentence_id')
    index = data.get('index')

    try:
        instance = WordInstance.query.filter_by(sentence_id=sentence_id, index=index).first()
        if instance:
            db.session.delete(instance)
            db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
    Tashaphyne-based.
    """
    data = request.get_json()
    words_input = data.get('words', [])
    
    suggestions = []
    translator = GoogleTranslator(source='ar', target='en')

    for raw_word_text in words_input:
        # Clean punctuation
        word_text = clean_punctuation(raw_word_text)
        if not word_text: continue

        try:
            # 1. Stem to get Root
            # Note: Tashaphyne might return multiple roots or need specific handling
            # simplistic approach:
            tashaphyne_stemmer.light_stem(word_text)
            root_text = tashaphyne_stemmer.get_root()
            
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

@main.route('/suggest-words-isri', methods=['POST'])
def suggest_words_isri():
    """
    NLTK ISRIStemmer-based suggestions.
    """
    data = request.get_json()
    words_input = data.get('words', [])
    
    suggestions = []
    translator = GoogleTranslator(source='ar', target='en')

    for raw_word_text in words_input:

        # Clean punctuation
        word_text = clean_punctuation(raw_word_text)
        if not word_text: continue
        
        try:
            # 1. Stem using ISRI
            # ISRI usually doesn't need as much normalization, but we can do simple ones
            root_text = isri_stemmer.stem(word_text)
            
            # 2. Translate
            word_translation = translator.translate(word_text)
            if root_text:
                 root_translation = translator.translate(root_text)
            else:
                 root_translation = ""

            suggestions.append({
                'plaintext': word_text,
                'translation': word_translation,
                'root_plaintext': root_text,
                'root_translation': root_translation
            })
        except Exception as e:
            print(f"Error processing word {word_text} with ISRI: {e}")
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
            # Clean incoming plaintext just in case, though suggestions usually handle it
            word_text = clean_punctuation(item.get('plaintext', ''))
            word_trans = item.get('translation')
            root_text = item.get('root_plaintext')
            root_trans = item.get('root_translation')

            if not word_text or not root_text:
                continue

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
            # previously: prune_text = re.sub(r'[\u064B-\u065F\u0640]', '', word_text)
            tashaphyne_stemmer.light_stem(word_text)
            prune_text = tashaphyne_stemmer.get_unvocalized()

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
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@main.route('/api/update-word/<int:word_id>', methods=['PUT'])
def update_word(word_id):
    data = request.get_json()
    try:
        word = Word.query.get(word_id)
        if not word:
            return jsonify({'error': 'Word not found'}), 404

        old_root_id = word.root_id
        
        # New data
        new_plaintext = clean_punctuation(data.get('plaintext', ''))
        new_translation = data.get('translation')
        new_root_text = data.get('root_plaintext')
        new_root_trans = data.get('root_translation')

        # Update word fields
        word.plaintext = new_plaintext
        word.translation = new_translation
        
        # Update prune
        tashaphyne_stemmer.light_stem(new_plaintext)
        word.prune = tashaphyne_stemmer.get_unvocalized()

        # Handle Root logic
        # Check if the new root exists
        existing_root = Root.query.filter_by(plaintext=new_root_text).first()
        
        deleted_root = False
        new_root_created = False

        if existing_root:
            # Root exists. 
            # 1. Always update the translation of the existing root if provided
            if new_root_trans:
                existing_root.translation = new_root_trans
            
            # 2. Link word to this root
            word.root_id = existing_root.root_id
        else:
            # Create new root
            new_root = Root(plaintext=new_root_text, translation=new_root_trans)
            db.session.add(new_root)
            db.session.flush()
            word.root_id = new_root.root_id
            new_root_created = True

        # Flush to save word changes so we can check for orphans
        db.session.flush()

        # Check if old root is orphaned (only if we changed roots)
        if old_root_id != word.root_id:
            remaining_count = Word.query.filter_by(root_id=old_root_id).count()
            if remaining_count == 0:
                old_root = Root.query.get(old_root_id)
                if old_root:
                    db.session.delete(old_root)
                    deleted_root = True

        db.session.commit()
        
        return jsonify({
            'success': True,
            'new_root_created': new_root_created,
            'deleted_root': deleted_root
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Sentence/Word Deletion Endpoints

@main.route('/api/delete-sentence/<int:sentence_id>', methods=['DELETE'])
def delete_sentence(sentence_id):
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence:
            return jsonify({'error': 'Sentence not found'}), 404
        
        WordInstance.query.filter_by(sentence_id=sentence_id).delete()

        db.session.delete(sentence)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Sentence deleted'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting sentence: {e}")
        return jsonify({'error': str(e)}), 500

@main.route('/api/delete-word/<int:word_id>', methods=['DELETE'])
def delete_word(word_id):
    try:
        # Find word by plaintext to handle duplicates if schema allowed, 
        # but here we use ID so it is specific. 
        # Ideally we want to delete this specific Word instance.
        word = Word.query.get(word_id)
        if not word:
            return jsonify({'error': 'Word not found'}), 404
        
        root_id = word.root_id
        
        # Delete the word
        db.session.delete(word)
        db.session.flush() # Flush to update DB state before checking counts

        # Check if root is orphaned
        deleted_root = False
        remaining_words_count = Word.query.filter_by(root_id=root_id).count()
        
        if remaining_words_count == 0:
            root = Root.query.get(root_id)
            if root:
                db.session.delete(root)
                deleted_root = True
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Word deleted', 
            'deleted_root': deleted_root
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting word: {e}")
        return jsonify({'error': str(e)}), 500

# --- Sentence Edit Endpoints ---

@main.route('/api/update-sentence/<int:sentence_id>', methods=['PUT'])
def update_sentence(sentence_id):
    data = request.get_json()
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence:
            return jsonify({'error': 'Sentence not found'}), 404
        
        old_length = sentence.length
        sentence.plaintext = data.get('plaintext', sentence.plaintext)
        sentence.translation = data.get('translation', sentence.translation)
        sentence.length = len(sentence.plaintext.split())

        # If length changed, handle WordInstances accordingly.
        if old_length != sentence.length:
            WordInstance.query.filter_by(sentence_id=sentence_id).delete() 
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating sentence: {e}")
        return jsonify({'error': str(e)}), 500

@main.route('/api/create-sentence', methods=['POST'])
def create_sentence():
    data = request.get_json()
    try:
        new_sentence = Sentence(
            plaintext=data.get('plaintext'),
            translation=data.get('translation'),
            complete=False,
            length=len(data.get('plaintext', '').split())
        )
        db.session.add(new_sentence)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'sentence_id': new_sentence.sentence_id
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error creating sentence: {e}")
        return jsonify({'error': str(e)}), 500

@main.route('/api/twilio/webhook', methods=['POST'])
def twilio_webhook():
    """
    Endpoint for Twilio WhatsApp Webhook.
    Receives incoming message data and creates a new Sentence.
    """
    try:
        # Twilio sends form-encoded data
        message_body = request.form.get('Body')
        sender = request.form.get('From')

        if not message_body:
            return Response("<Response><Message>Error: No text received.</Message></Response>", mimetype='text/xml')

        # Create new sentence
        new_sentence = Sentence(
            plaintext=message_body,
            translation="", # Empty initially
            complete=False,
            length=len(message_body.split())
        )
        db.session.add(new_sentence)
        db.session.commit()

        # Respond to Twilio with TwiML
        response_message = f"Saved sentence ✅ \"{message_body}\""
        xml_response = f"""
        <Response>
            <Message>{response_message}</Message>
        </Response>
        """
        return Response(xml_response, mimetype='text/xml')

    except Exception as e:
        db.session.rollback()
        print(f"Twilio Webhook Error: {e}")
        return Response("<Response><Message>Server Error: Could not save sentence.</Message></Response>", mimetype='text/xml')