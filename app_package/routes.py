from flask import Blueprint, jsonify, request, Response
from .models import (AnyWord, CUSTOM_LEMMA_BASE, Lemma, MyLemma, Sentence, Word, WordInstance, bare, find_lemma,
                     lemma_state, new_lemma, nfc, prune)
from .extensions import db
from deep_translator import GoogleTranslator
from deep_translator.exceptions import TooManyRequests
import json
import os
import re
import string
import time
import urllib.request
import requests

main = Blueprint('main', __name__)

CAMELIRA_URL = 'https://camelira.abudhabi.nyu.edu/api/disambig'

# --- HELPER FUNCTIONS ---

# Arabic -> English. Google first (deep-translator scrapes its free web page, no key); when Google refuses,
# e.g. by rate-limiting this machine (HTTP 429), DeepL's free API, with DEEPL_API_KEY in app_package/.env.
GOOGLE_PAUSE = 600  # seconds to skip Google after it rate-limits us, so each request doesn't wait on a refusal
_google_paused_until = 0.0

def deepl(text):
    key = os.getenv('DEEPL_API_KEY')
    if not key:
        raise RuntimeError('Google Translate is refusing requests and no DEEPL_API_KEY is set in app_package/.env')
    res = requests.post('https://api-free.deepl.com/v2/translate', timeout=20,
                        headers={'Authorization': f'DeepL-Auth-Key {key}'},
                        json={'text': [text], 'source_lang': 'AR', 'target_lang': 'EN-US'})
    res.raise_for_status()
    return res.json()['translations'][0]['text']

def translate(text):
    global _google_paused_until
    if time.time() >= _google_paused_until:
        try:
            return GoogleTranslator(source='ar', target='en').translate(text)
        except TooManyRequests:
            _google_paused_until = time.time() + GOOGLE_PAUSE
            print('Google Translate is rate-limiting this machine: using DeepL for the next 10 minutes')
        except Exception as e:
            print(f'Google Translate failed ({e}): trying DeepL')
    return deepl(text)

def clean_punctuation(text):
    """Strips Arabic and English punctuation for cleaner matching."""
    punctuation = string.punctuation + '،؛؟”'
    translator = str.maketrans('', '', punctuation)
    return text.translate(translator).strip()

def lemmatize(sentence):
    """{surface word: top Camelira analysis}; analysis['lex'] is what Camelira's 'Lemmatized' view shows."""
    req = urllib.request.Request(
        CAMELIRA_URL,
        json.dumps({'dialect': 'auto', 'sentence': sentence}).encode(),
        {'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        disambig = json.load(res)['output']['disambig']
    return {w['word']: w['analyses'][0]['analysis'] for w in disambig if w['analyses']}

def link_lemma(text, translation):
    """Existing lemma for text (one of your own if the lexicon lacks it), with translation applied when given:
    your gloss for a lexicon lemma, which only you see."""
    lemma = find_lemma(text, translation)
    if not lemma:
        lemma = new_lemma(text, translation)
        db.session.add(lemma)
    elif translation and translation != lemma.translation:
        if lemma.lemma_id >= CUSTOM_LEMMA_BASE:
            db.session.get(MyLemma, lemma.lemma_id).translation = translation
        else:
            lemma_state(lemma.lemma_id).translation = translation
    db.session.flush()
    return lemma

def calculate_completeness(sentence):
    """
    Determines if a sentence is complete based on database state.
    Complete =
    1. Sentence has a translation (and is not empty).
    2. All words are resolved (linked via WordInstance OR exact match OR unique fuzzy match).
    """
    if not sentence.translation or not sentence.translation.strip():
        return False
    if not sentence.plaintext:
        return False

    instances = {i.index for i in WordInstance.query.filter_by(sentence_id=sentence.sentence_id).all()}

    for idx, raw_token in enumerate(sentence.plaintext.split()):
        token = clean_punctuation(raw_token)
        if idx in instances or not token:
            continue
        if AnyWord.query.filter_by(plaintext=token).first():
            continue
        # Single fuzzy match -> valid; none or ambiguous -> incomplete
        if AnyWord.query.filter_by(prune=prune(token)).count() != 1:
            return False

    return True

def save_card(arabic, english, lemma_ids, target=None):
    """Adds a sentence to the deck, linking whitespace token i of `arabic` to lemma_ids[i] (None = leave unlinked).
    target: the lemma the flashcard is for."""
    sentence = Sentence(plaintext=arabic, translation=english, length=len(arabic.split()), target_lemma_id=target)
    db.session.add(sentence)
    db.session.flush()
    for index, (token, lemma_id) in enumerate(zip(arabic.split(), lemma_ids)):
        text = clean_punctuation(token)
        if not text or not lemma_id:
            continue
        word = AnyWord.query.filter_by(plaintext=text, lemma_id=lemma_id).first()
        if not word:
            word = Word(plaintext=text, lemma_id=lemma_id, prune=prune(text))
            db.session.add(word)
            db.session.flush()
        db.session.add(WordInstance(sentence_id=sentence.sentence_id, word_id=word.word_id, index=index))
    db.session.flush()
    update_sentence_completeness(sentence)
    return sentence

def update_sentence_completeness(sentence):
    sentence.complete = calculate_completeness(sentence)

def update_completeness_matching(*texts):
    """Re-checks every sentence containing any of the given words."""
    for t in texts:
        for s in Sentence.query.filter(Sentence.plaintext.like(f'%{t}%')).all():
            update_sentence_completeness(s)

# --- API ENDPOINTS ---

@main.route('/')
def home():
    return jsonify({"status": "API is running. Frontend is hosted separately."})

@main.route('/api/sentences')
def api_sentences():
    from .atlas import assign_targets  # here: atlas imports this module
    assign_targets()
    sentences = Sentence.query.all()
    return jsonify([{
        'sentence_id': s.sentence_id,
        'plaintext': s.plaintext,
        'translation': s.translation,
        'complete': s.complete,
        'length': s.length,
        'target_lemma_id': s.target_lemma_id
    } for s in sentences])

def relevant_words():
    """Words the frontend needs: yours, and lemmas' own forms matching a token in some sentence.
    Skips the ~40k own forms of unused lemmas, which would only bloat the payload."""
    prunes = {prune(clean_punctuation(t)) for (text,) in db.session.query(Sentence.plaintext) for t in text.split()}
    return db.select(AnyWord.word_id).where((AnyWord.word_id > 0) | AnyWord.prune.in_(prunes))

def lemma_json(l):
    return {'lemma_id': l.lemma_id, 'plaintext': l.plaintext, 'translation': l.translation, 'known': l.known}

@main.route('/api/words')
def api_words():
    words = AnyWord.query.filter(AnyWord.word_id.in_(relevant_words())).all()
    return jsonify([{
        'word_id': w.word_id,
        'plaintext': w.plaintext,
        'translation': w.translation,
        'lemma_id': w.lemma_id,
        'prune': w.prune
    } for w in words])

@main.route('/api/lemmas')
def api_lemmas():
    """Known lemmas plus those of the words /api/words sends; the Lemmas tab searches the rest."""
    used = db.select(AnyWord.lemma_id).where(AnyWord.word_id.in_(relevant_words()))
    return jsonify([lemma_json(l) for l in Lemma.query.filter(Lemma.known | Lemma.lemma_id.in_(used))])

BUCKWALTER = str.maketrans(dict(zip(
    "'|>&<}AbptvjHxd*rzs$SDTZEg_fqklmnhwYyFNKaui~o`{",
    "ءآأؤإئابةتثجحخدذرزسشصضطظعغـفقكلمنهوىيًٌٍَُِّْٰٱ"
)))

@main.route('/api/lemmas/search')
def search_lemmas():
    """Lemmas matching an ID, Arabic (diacritics optional), Buckwalter, or English gloss text; most frequent first."""
    q = request.args.get('q', '').strip()
    query = Lemma.query
    if q.isdigit():
        query = query.filter(Lemma.lemma_id == int(q))
    elif q:
        is_arabic = re.search(r'[؀-ۿ]', q)
        letters = bare(q if is_arabic else q.translate(BUCKWALTER))  # empty if q was only vowels/diacritics
        matches = [Lemma.bare.contains(letters)] if letters else []
        if not is_arabic:
            # Latin text is either Buckwalter or gloss; ' ' -> '_' matches the gloss's underscores (and spaces, as a LIKE wildcard)
            matches.append(Lemma.translation.ilike(f"%{q.replace(' ', '_')}%"))
        query = query.filter(db.or_(db.false(), *matches))
    return jsonify([lemma_json(l) for l in query.order_by(Lemma.lemma_id).limit(200)])

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
    text = request.get_json().get('q')
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        return jsonify({'translatedText': translate(text)})
    except Exception as e:
        print(f"Translation Error: {e}")
        return jsonify({'error': 'Translation failed', 'details': str(e)}), 500

@main.route('/suggest-words', methods=['POST'])
def suggest_words():
    """Suggests a translation and lemma for each word, lemmatized by Camelira in the context of `sentence`."""
    data = request.get_json()
    words = [w for w in map(clean_punctuation, data.get('words', [])) if w]
    suggestions = []

    try:
        analyses = lemmatize(data.get('sentence') or ' '.join(words))
    except Exception as e:
        print(f"Camelira Error: {e}")
        analyses = {}

    for word_text in words:
        try:
            analysis = analyses.get(word_text) or lemmatize(word_text).get(word_text, {})
        except Exception:
            analysis = {}
        try:
            translation = translate(word_text)
        except Exception as e:
            print(f"Translation Error: {e}")
            translation = ""

        stemgloss = re.sub(r'_\[\w+\]', '', analysis.get('stemgloss', ''))
        lemma = find_lemma(analysis.get('lex', ''), stemgloss)
        suggestions.append({
            'plaintext': word_text,
            'translation': translation,
            'lemma_plaintext': lemma.plaintext if lemma else nfc(analysis.get('lex')),
            'lemma_translation': lemma.translation if lemma else stemgloss
        })

    return jsonify(suggestions)

@main.route('/add-words', methods=['POST'])
def add_words():
    data = request.get_json()
    added_plaintexts = []

    try:
        for item in data.get('items', []):
            word_text = clean_punctuation(item.get('plaintext', ''))
            lemma_text = item.get('lemma_plaintext')

            if not word_text or not lemma_text:
                continue

            lemma = link_lemma(lemma_text, item.get('lemma_translation'))
            db.session.add(Word(
                lemma_id=lemma.lemma_id,
                plaintext=word_text,
                translation=item.get('translation'),
                prune=prune(word_text)
            ))
            added_plaintexts.append(word_text)

        db.session.flush()
        update_completeness_matching(*added_plaintexts)
        db.session.commit()
        return jsonify({'success': True, 'new_words_count': len(added_plaintexts)})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/update-word/<int(signed=True):word_id>', methods=['PUT'])
def update_word(word_id):
    data = request.get_json()
    try:
        word = db.session.get(Word, word_id)
        own_form = db.session.get(AnyWord, word_id) if word_id < 0 else None
        if own_form:  # a lemma's own form: edited, it becomes a word of yours, taking over its links
            word = Word(plaintext=own_form.plaintext, lemma_id=own_form.lemma_id, prune=own_form.prune)
            db.session.add(word)
            db.session.flush()
            WordInstance.query.filter_by(word_id=word_id).update({'word_id': word.word_id})
            word_id = word.word_id
        if not word:
            return jsonify({'error': 'Word not found'}), 404
        if not data.get('lemma_plaintext'):
            return jsonify({'error': 'Missing lemma'}), 400

        old_plaintext = word.plaintext
        word.plaintext = clean_punctuation(data.get('plaintext', ''))
        word.translation = data.get('translation')
        word.prune = prune(word.plaintext)
        word.lemma_id = link_lemma(data.get('lemma_plaintext'), data.get('lemma_translation')).lemma_id
        db.session.flush()

        update_completeness_matching(old_plaintext, word.plaintext)
        for inst in WordInstance.query.filter_by(word_id=word_id).all():
            s = Sentence.query.get(inst.sentence_id)
            if s:
                update_sentence_completeness(s)

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/delete-sentence/<int:sentence_id>', methods=['DELETE'])
def delete_sentence(sentence_id):
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence:
            return jsonify({'error': 'Sentence not found'}), 404

        WordInstance.query.filter_by(sentence_id=sentence_id).delete()
        db.session.delete(sentence)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@main.route('/api/delete-word/<int(signed=True):word_id>', methods=['DELETE'])
def delete_word(word_id):
    """Deletes a word of yours; for a lemma's own form (the lexicon's), only its links go."""
    try:
        word = db.session.get(AnyWord, word_id)
        if not word:
            return jsonify({'error': 'Word not found'}), 404

        linked = WordInstance.query.filter_by(word_id=word_id).all()
        linked_ids = [i.sentence_id for i in linked]
        for inst in linked:
            db.session.delete(inst)
        if word_id > 0:
            db.session.delete(db.session.get(Word, word_id))
        db.session.flush()

        for sid in linked_ids:
            s = Sentence.query.get(sid)
            if s:
                update_sentence_completeness(s)
        update_completeness_matching(word.plaintext)

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
        sentence.target_lemma_id = data.get('target_lemma_id', sentence.target_lemma_id)
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
    """A text to the Twilio number: a link code (see auth.phone_code) links the phone to an account; anything
    else goes into the Library of the account the phone is linked to."""
    from xml.sax.saxutils import escape
    from flask import g
    from .auth import link_phone, twilio_signature_ok, user_engine
    from .models import Account
    reply = lambda text: Response(f'<Response><Message>{escape(text)}</Message></Response>', mimetype='text/xml')
    if not twilio_signature_ok():
        return Response(status=403)
    sender, body = request.form.get('From'), (request.form.get('Body') or '').strip()
    if not sender or not body:
        return reply('Error')
    if re.fullmatch(r'\d{6}', body):
        account = link_phone(sender, body)
        return reply(f'Linked to {account.email}' if account else 'That code is wrong or expired')
    account = Account.query.filter_by(phone=sender).first()
    if not account:
        return reply("This number isn't linked to a ATLAS account")
    g.user_engine = user_engine(account.uid)
    try:
        new_sentence = Sentence(plaintext=body, translation="", complete=False, length=len(body.split()))
        db.session.add(new_sentence)
        db.session.flush()
        update_sentence_completeness(new_sentence)
        db.session.commit()
        return reply(f'Saved sentence ✅ "{body}"')
    except Exception:
        db.session.rollback()
        return reply('Error')

@main.route('/api/known-count')
def known_count():
    """How many lemmas you know: with none, the app points you to Calibrate."""
    return jsonify({'known': Lemma.query.filter_by(known=True).count()})

@main.route('/api/set-known/<int:lemma_id>', methods=['POST'])
def set_known(lemma_id):
    try:
        db.get_or_404(Lemma, lemma_id)
        lemma = lemma_state(lemma_id)
        lemma.known = bool(request.get_json()['known'])
        lemma.source = 'user'
        if lemma.known and lemma.p_learned is not None:  # your call overrides the model: known means L = 97%
            lemma.p_learned = max(lemma.p_learned, 0.97)
        elif not lemma.known:  # back to unknown: forget its review state, it'll be introduced again
            lemma.p_learned = lemma.stability = lemma.last_review = lemma.due = None
        db.session.commit()
        return jsonify({'success': True, 'known': lemma.known})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
