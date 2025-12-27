from flask import Blueprint, jsonify, request, Response
from .models import Sentence, Word, Root, WordInstance
from .extensions import db
from deep_translator import GoogleTranslator
from tashaphyne.stemming import ArabicLightStemmer
import nltk
from nltk.stem.isri import ISRIStemmer
# import re
import string

main = Blueprint('main', __name__)

# --- INITIALIZATION ---
tashaphyne_stemmer = ArabicLightStemmer()
isri_stemmer = ISRIStemmer()
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab')

# --- HELPER FUNCTIONS ---

def clean_punctuation(text):
    """Strips Arabic and English punctuation for cleaner matching."""
    punctuation = string.punctuation + '،؛؟”'
    translator = str.maketrans('', '', punctuation)
    return text.translate(translator).strip()

def calculate_completeness(sentence):
    """
    Determines if a sentence is complete based on database state.
    Complete = 
    1. Sentence has a translation (and is not empty).
    2. All words are resolved (linked via WordInstance OR exact match OR unique fuzzy match).
    """
    # 1. Check if Sentence has translation
    if not sentence.translation or not sentence.translation.strip():
        return False
    if not sentence.plaintext:
        return False

    tokens = sentence.plaintext.split()
    
    # Get explicit instances for this sentence
    instances = {i.index: i.word_id for i in WordInstance.query.filter_by(sentence_id=sentence.sentence_id).all()}
    
    for idx, raw_token in enumerate(tokens):
        # 2. Check Explicit Link (WordInstance)
        if idx in instances:
            continue

        # 3. Clean punctuation
        token = clean_punctuation(raw_token)
        if not token:
            continue # Ignore pure punctuation

        # 4. Check Exact Match
        exact_matches = Word.query.filter_by(plaintext=token).first()
        if exact_matches:
            continue

        # 5. Check Pruned/Fuzzy Match (for Ambiguity)
        tashaphyne_stemmer.light_stem(token)
        pruned_token = tashaphyne_stemmer.get_unvocalized()
        
        fuzzy_matches = Word.query.filter_by(prune=pruned_token).all()
        
        if len(fuzzy_matches) == 1:
            # Single fuzzy match -> Valid
            continue
        
        # If no match or ambiguous (multiple matches), it's incomplete
        return False
                
    return True

def update_sentence_completeness(sentence):
    """Helper to calculate and save completeness."""
    is_complete = calculate_completeness(sentence)
    if sentence.complete != is_complete:
        sentence.complete = is_complete
        return True 
    return False

# --- API ENDPOINTS ---

@main.route('/')
def home():
    return jsonify({"status": "API is running. Frontend is hosted separately."})

@main.route('/get-data')
def get_data():
    row = Sentence.query.first()
    return jsonify({'message': row.plaintext if row else "No data found"})

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
    instances = WordInstance.query.all()
    return jsonify([{
        'sentence_id': i.sentence_id,
        'word_id': i.word_id,
        'index': i.index
    } for i in instances])

@main.route('/api/link-word', methods=['POST'])
def link_word_instance():
    data = request.get_json()
    sentence_id = data.get('sentence_id')
    word_id = data.get('word_id')
    index = data.get('index')

    if sentence_id is None or word_id is None or index is None:
        return jsonify({'error': 'Missing data'}), 400

    try:
        instance = WordInstance.query.filter_by(sentence_id=sentence_id, index=index).first()
        if instance:
            instance.word_id = word_id
        else:
            instance = WordInstance(sentence_id=sentence_id, word_id=word_id, index=index)
            db.session.add(instance)
        
        sentence = Sentence.query.get(sentence_id)
        if sentence:
            update_sentence_completeness(sentence)

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/unlink-word', methods=['POST'])
def unlink_word_instance():
    data = request.get_json()
    sentence_id = data.get('sentence_id')
    index = data.get('index')

    try:
        instance = WordInstance.query.filter_by(sentence_id=sentence_id, index=index).first()
        if instance:
            db.session.delete(instance)
            sentence = Sentence.query.get(sentence_id)
            if sentence:
                update_sentence_completeness(sentence)
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
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated_text = translator.translate(text)
        return jsonify({'translatedText': translated_text})
    except Exception as e:
        print(f"Translation Error: {e}")
        return jsonify({'error': 'Translation failed', 'details': str(e)}), 500
    
@main.route('/suggest-words', methods=['POST'])
def suggest_words():
    data = request.get_json()
    words_input = data.get('words', [])
    suggestions = []
    translator = GoogleTranslator(source='ar', target='en')

    for raw_word_text in words_input:
        word_text = clean_punctuation(raw_word_text)
        if not word_text: continue

        try:
            tashaphyne_stemmer.light_stem(word_text)
            root_text = tashaphyne_stemmer.get_root()
            word_translation = translator.translate(word_text)
            root_translation = translator.translate(root_text) if root_text else ""

            suggestions.append({
                'plaintext': word_text,
                'translation': word_translation,
                'root_plaintext': root_text,
                'root_translation': root_translation
            })
        except Exception as e:
            suggestions.append({'plaintext': word_text, 'translation': "Error", 'root_plaintext': "Error", 'root_translation': "Error"})

    return jsonify(suggestions)

@main.route('/suggest-words-isri', methods=['POST'])
def suggest_words_isri():
    data = request.get_json()
    words_input = data.get('words', [])
    suggestions = []
    translator = GoogleTranslator(source='ar', target='en')

    for raw_word_text in words_input:
        word_text = clean_punctuation(raw_word_text)
        if not word_text: continue

        try:
            root_text = isri_stemmer.stem(word_text)
            word_translation = translator.translate(word_text)
            root_translation = translator.translate(root_text) if root_text else ""

            suggestions.append({
                'plaintext': word_text,
                'translation': word_translation,
                'root_plaintext': root_text,
                'root_translation': root_translation
            })
        except Exception as e:
            suggestions.append({'plaintext': word_text, 'translation': "Error", 'root_plaintext': "Error", 'root_translation': "Error"})

    return jsonify(suggestions)

@main.route('/add-words', methods=['POST'])
def add_words():
    data = request.get_json()
    confirmed_items = data.get('items', [])
    new_roots_count = 0
    new_words_count = 0
    added_plaintexts = []

    try:
        for item in confirmed_items:
            word_text = clean_punctuation(item.get('plaintext', ''))
            word_trans = item.get('translation')
            root_text = item.get('root_plaintext')
            root_trans = item.get('root_translation')

            if not word_text or not root_text: continue

            existing_root = Root.query.filter_by(plaintext=root_text).first()
            if existing_root:
                root_id = existing_root.root_id
            else:
                new_root = Root(plaintext=root_text, translation=root_trans)
                db.session.add(new_root)
                db.session.flush()
                root_id = new_root.root_id
                new_roots_count += 1

            tashaphyne_stemmer.light_stem(word_text)
            prune_text = tashaphyne_stemmer.get_unvocalized()

            new_word = Word(
                root_id=root_id,
                plaintext=word_text,
                translation=word_trans,
                prune=prune_text,
                frequency=50,
                known=False
            )
            db.session.add(new_word)
            new_words_count += 1
            added_plaintexts.append(word_text)

        db.session.commit()

        incomplete_sentences = Sentence.query.filter_by(complete=False).all()
        for sent in incomplete_sentences:
            for w in added_plaintexts:
                if w in sent.plaintext:
                    update_sentence_completeness(sent)
                    break
        
        db.session.commit()
        return jsonify({'success': True, 'new_roots_count': new_roots_count, 'new_words_count': new_words_count})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/update-root/<int:root_id>', methods=['PUT'])
def update_root(root_id):
    data = request.get_json()
    try:
        root = Root.query.get(root_id)
        if not root: return jsonify({'error': 'Root not found'}), 404

        root.plaintext = data.get('plaintext', root.plaintext)
        root.translation = data.get('translation', root.translation)

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/update-word/<int:word_id>', methods=['PUT'])
def update_word(word_id):
    data = request.get_json()
    try:
        word = Word.query.get(word_id)
        if not word: return jsonify({'error': 'Word not found'}), 404

        old_root_id = word.root_id
        old_plaintext = word.plaintext
        
        new_plaintext = clean_punctuation(data.get('plaintext', ''))
        new_translation = data.get('translation')
        new_root_text = data.get('root_plaintext')
        new_root_trans = data.get('root_translation')

        word.plaintext = new_plaintext
        word.translation = new_translation
        
        tashaphyne_stemmer.light_stem(new_plaintext)
        word.prune = tashaphyne_stemmer.get_unvocalized()

        existing_root = Root.query.filter_by(plaintext=new_root_text).first()
        new_root_created = False
        deleted_root = False

        if existing_root:
            if new_root_trans: existing_root.translation = new_root_trans
            word.root_id = existing_root.root_id
        else:
            new_root = Root(plaintext=new_root_text, translation=new_root_trans)
            db.session.add(new_root)
            db.session.flush()
            word.root_id = new_root.root_id
            new_root_created = True

        db.session.flush()

        if old_root_id != word.root_id:
            remaining = Word.query.filter_by(root_id=old_root_id).count()
            if remaining == 0:
                old_root = Root.query.get(old_root_id)
                if old_root:
                    db.session.delete(old_root)
                    deleted_root = True

        sents_old = Sentence.query.filter(Sentence.plaintext.like(f'%{old_plaintext}%')).all()
        for s in sents_old: update_sentence_completeness(s)
        
        if new_plaintext != old_plaintext:
            sents_new = Sentence.query.filter(Sentence.plaintext.like(f'%{new_plaintext}%')).all()
            for s in sents_new: update_sentence_completeness(s)
            
        linked = WordInstance.query.filter_by(word_id=word_id).all()
        for inst in linked:
            s = Sentence.query.get(inst.sentence_id)
            if s: update_sentence_completeness(s)

        db.session.commit()
        return jsonify({'success': True, 'new_root_created': new_root_created, 'deleted_root': deleted_root})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/delete-sentence/<int:sentence_id>', methods=['DELETE'])
def delete_sentence(sentence_id):
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence: return jsonify({'error': 'Sentence not found'}), 404
        
        WordInstance.query.filter_by(sentence_id=sentence_id).delete()
        db.session.delete(sentence)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/delete-word/<int:word_id>', methods=['DELETE'])
def delete_word(word_id):
    try:
        word = Word.query.get(word_id)
        if not word: return jsonify({'error': 'Word not found'}), 404
        
        root_id = word.root_id
        word_plain = word.plaintext
        linked_ids = [i.sentence_id for i in WordInstance.query.filter_by(word_id=word_id).all()]
        
        db.session.delete(word)
        db.session.flush() 

        deleted_root = False
        if Word.query.filter_by(root_id=root_id).count() == 0:
            root = Root.query.get(root_id)
            if root:
                db.session.delete(root)
                deleted_root = True
        
        for sid in linked_ids:
            s = Sentence.query.get(sid)
            if s: update_sentence_completeness(s)
            
        text_matches = Sentence.query.filter(Sentence.plaintext.like(f'%{word_plain}%')).all()
        for s in text_matches: update_sentence_completeness(s)

        db.session.commit()
        return jsonify({'success': True, 'deleted_root': deleted_root})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/update-sentence/<int:sentence_id>', methods=['PUT'])
def update_sentence(sentence_id):
    data = request.get_json()
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence: return jsonify({'error': 'Sentence not found'}), 404
        
        old_length = sentence.length
        sentence.plaintext = data.get('plaintext', sentence.plaintext)
        sentence.translation = data.get('translation', sentence.translation)
        sentence.length = len(sentence.plaintext.split())

        if old_length != sentence.length:
            WordInstance.query.filter_by(sentence_id=sentence_id).delete() 
        
        update_sentence_completeness(sentence)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
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
        db.session.flush() 
        update_sentence_completeness(new_sentence)
        db.session.commit()
        return jsonify({'success': True, 'sentence_id': new_sentence.sentence_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/twilio/webhook', methods=['POST'])
def twilio_webhook():
    try:
        message_body = request.form.get('Body')
        if not message_body:
            return Response("<Response><Message>Error</Message></Response>", mimetype='text/xml')

        new_sentence = Sentence(
            plaintext=message_body,
            translation="", 
            complete=False,
            length=len(message_body.split())
        )
        db.session.add(new_sentence)
        db.session.flush()
        update_sentence_completeness(new_sentence)
        db.session.commit()
        return Response(f"<Response><Message>Saved sentence ✅ \"{message_body}\"</Message></Response>", mimetype='text/xml')
    except Exception as e:
        db.session.rollback()
        return Response("<Response><Message>Error</Message></Response>", mimetype='text/xml')

@main.route('/api/toggle-known/<int:word_id>', methods=['POST'])
def toggle_known(word_id):
    try:
        word = Word.query.get(word_id)
        if not word:
            return jsonify({'error': 'Word not found'}), 404
        
        word.known = not word.known
        db.session.commit()
        
        return jsonify({'success': True, 'new_known': word.known})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500