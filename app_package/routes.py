from functools import wraps
from html import escape
import os
import unicodedata

from flask import Blueprint, Response, current_app, jsonify, request
from dotenv import load_dotenv

from .extensions import db
from .models import Sentence, Word, Root, WordInstance, Flashcard


load_dotenv()
main = Blueprint('main', __name__)


def text(value):
    if value is None:
        return ''
    if not isinstance(value, str):
        raise ValueError('Text fields must contain text.')
    if len(value) > 10000:
        raise ValueError('Please use at most 10,000 characters.')
    return unicodedata.normalize('NFC', value).strip()


def clean_punctuation(value):
    value = text(value)

    while value and unicodedata.category(value[0])[0] in 'PS':
        value = value[1:]

    while value and unicodedata.category(value[-1])[0] in 'PS':
        value = value[:-1]

    return value


def normalized(value):
    # Preserve hamza letters. Ignore vocalization only for matching.
    return ''.join(
        character
        for character in text(value)
        if character != 'ـ'
        and unicodedata.category(character) != 'Mn'
    )


def tokens(value):
    return text(value).split()


def match_word(value, words):
    value = clean_punctuation(value)

    exact = [
        word for word in words
        if text(word.plaintext) == value
    ]

    candidates = exact or [
        word for word in words
        if normalized(word.plaintext) == normalized(value)
    ]

    # Do not guess between ambiguous words.
    return candidates[0] if len(candidates) == 1 else None


def calculate_completeness(sentence):
    if not text(sentence.translation):
        return False

    if not tokens(sentence.plaintext):
        return False

    words = Word.query.all()
    by_id = {word.word_id: word for word in words}

    links = {
        instance.index: instance.word_id
        for instance in WordInstance.query.filter_by(
            sentence_id=sentence.sentence_id
        )
    }

    for index, raw in enumerate(tokens(sentence.plaintext)):
        if not clean_punctuation(raw):
            continue

        word = (
            by_id.get(links.get(index))
            or match_word(raw, words)
        )

        if word is None:
            return False

    return True


def update_sentence_completeness(sentence):
    previous = sentence.complete
    sentence.complete = calculate_completeness(sentence)
    return previous != sentence.complete


def refresh_completeness():
    db.session.flush()

    for sentence in Sentence.query.all():
        update_sentence_completeness(sentence)


def payload():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        raise ValueError('Send a JSON object.')

    return data


def required(value, label='Arabic text'):
    value = text(value)

    if not value:
        raise ValueError(f'{label} is required.')

    return value


def find(model, identifier):
    row = db.session.get(model, identifier)

    if row is None:
        raise ValueError(
            'Record no longer exists. Refresh the database.'
        )

    return row


def guarded(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        try:
            return function(*args, **kwargs)

        except ValueError as error:
            db.session.rollback()

            return jsonify(
                success=False,
                error=str(error)
            ), 400

        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                'Database operation failed: %s',
                function.__name__
            )

            return jsonify(
                success=False,
                error=(
                    'Database operation failed. The Flask terminal '
                    'contains the exact error. Your draft has not '
                    'been cleared.'
                )
            ), 500

    return wrapped


def root_for(data):
    value = text(data.get('root_plaintext'))

    if not value:
        return None

    root = Root.query.filter_by(plaintext=value).first()

    if root is None:
        root = Root(
            plaintext=value,
            translation=text(data.get('root_translation'))
        )

        db.session.add(root)
        db.session.flush()

    # Existing shared roots are edited through the Roots tab.
    return root.root_id


@main.route('/')
def home():
    return jsonify(
        status='API is running',
        database_version=2
    )


@main.route('/get-data')
@guarded
def get_data():
    row = Sentence.query.first()

    return jsonify(
        message=row.plaintext if row else 'No data found'
    )


@main.route('/api/sentences')
@guarded
def api_sentences():
    return jsonify([
        {
            'sentence_id': sentence.sentence_id,
            'plaintext': sentence.plaintext,
            'translation': sentence.translation or '',
            'complete': sentence.complete,
            'length': len(tokens(sentence.plaintext))
        }
        for sentence in Sentence.query.all()
    ])


@main.route('/api/words')
@guarded
def api_words():
    return jsonify([
        {
            'word_id': word.word_id,
            'plaintext': word.plaintext,
            'translation': word.translation or '',
            'root_id': word.root_id,
            'frequency': word.frequency or 0,
            'known': bool(word.known),
            'prune': normalized(word.plaintext)
        }
        for word in Word.query.all()
    ])


@main.route('/api/roots')
@guarded
def api_roots():
    return jsonify([
        {
            'root_id': root.root_id,
            'plaintext': root.plaintext,
            'translation': root.translation or ''
        }
        for root in Root.query.all()
    ])


@main.route('/api/word-instances')
@guarded
def api_word_instances():
    return jsonify([
        {
            'sentence_id': instance.sentence_id,
            'word_id': instance.word_id,
            'index': instance.index
        }
        for instance in WordInstance.query.all()
    ])


def save_sentence(sentence, data):
    arabic = required(
        data.get('plaintext', sentence.plaintext)
    )

    # Changing any text invalidates old positional links.
    if sentence.sentence_id and sentence.plaintext != arabic:
        WordInstance.query.filter_by(
            sentence_id=sentence.sentence_id
        ).delete(synchronize_session=False)

    sentence.plaintext = arabic
    sentence.translation = text(
        data.get('translation', sentence.translation)
    )
    sentence.length = len(tokens(arabic))

    db.session.add(sentence)
    db.session.flush()

    update_sentence_completeness(sentence)

    for card in Flashcard.query.filter_by(
        sentence_id=sentence.sentence_id
    ):
        card.plaintext = arabic
        card.translation = sentence.translation

    db.session.commit()

    return jsonify(
        success=True,
        sentence_id=sentence.sentence_id,
        complete=sentence.complete
    )


@main.route('/api/create-sentence', methods=['POST'])
@guarded
def create_sentence():
    data = payload()
    arabic = required(data.get('plaintext'))
    translation = text(data.get('translation'))

    existing = Sentence.query.filter_by(
        plaintext=arabic,
        translation=translation
    ).first()

    if existing:
        return jsonify(
            success=True,
            sentence_id=existing.sentence_id,
            existing=True
        )

    return save_sentence(Sentence(), data)


@main.route(
    '/api/update-sentence/<int:sentence_id>',
    methods=['PUT']
)
@guarded
def update_sentence(sentence_id):
    return save_sentence(
        find(Sentence, sentence_id),
        payload()
    )


@main.route(
    '/api/delete-sentence/<int:sentence_id>',
    methods=['DELETE']
)
@guarded
def delete_sentence(sentence_id):
    sentence = find(Sentence, sentence_id)

    Flashcard.query.filter_by(
        sentence_id=sentence_id
    ).delete(synchronize_session=False)

    WordInstance.query.filter_by(
        sentence_id=sentence_id
    ).delete(synchronize_session=False)

    db.session.delete(sentence)
    db.session.commit()

    return jsonify(success=True)


@main.route('/add-words', methods=['POST'])
@guarded
def add_words():
    items = payload().get('items')

    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise ValueError('Send between 1 and 100 words.')

    count = 0
    roots_before = Root.query.count()

    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Each word must be an object.')

        arabic = required(
            clean_punctuation(item.get('plaintext'))
        )
        translation = text(item.get('translation'))
        root_id = root_for(item)

        exists = Word.query.filter_by(
            plaintext=arabic,
            translation=translation,
            root_id=root_id
        ).first()

        if exists:
            continue

        db.session.add(Word(
            plaintext=arabic,
            translation=translation,
            root_id=root_id,
            prune=normalized(arabic),
            frequency=0,
            known=False
        ))

        db.session.flush()
        count += 1

    refresh_completeness()

    roots_added = Root.query.count() - roots_before

    db.session.commit()

    return jsonify(
        success=True,
        new_words_count=count,
        new_roots_count=roots_added
    )


@main.route(
    '/api/update-word/<int:word_id>',
    methods=['PUT']
)
@guarded
def update_word(word_id):
    word = find(Word, word_id)
    data = payload()

    arabic = required(
        clean_punctuation(
            data.get('plaintext', word.plaintext)
        )
    )

    if arabic != word.plaintext:
        WordInstance.query.filter_by(
            word_id=word_id
        ).delete(synchronize_session=False)

    word.plaintext = arabic
    word.translation = text(
        data.get('translation', word.translation)
    )
    word.prune = normalized(arabic)

    if 'root_plaintext' in data:
        word.root_id = root_for(data)

    refresh_completeness()
    db.session.commit()

    return jsonify(success=True)


@main.route(
    '/api/delete-word/<int:word_id>',
    methods=['DELETE']
)
@guarded
def delete_word(word_id):
    word = find(Word, word_id)

    # Remove foreign-key references before deleting the word.
    WordInstance.query.filter_by(
        word_id=word_id
    ).delete(synchronize_session=False)

    db.session.delete(word)

    refresh_completeness()
    db.session.commit()

    return jsonify(
        success=True,
        deleted_root=False
    )


@main.route(
    '/api/update-root/<int:root_id>',
    methods=['PUT']
)
@guarded
def update_root(root_id):
    root = find(Root, root_id)
    data = payload()

    root.plaintext = required(
        data.get('plaintext', root.plaintext),
        'Root'
    )

    root.translation = text(
        data.get('translation', root.translation)
    )

    db.session.commit()

    return jsonify(success=True)


@main.route('/api/link-word', methods=['POST'])
@guarded
def link_word_instance():
    data = payload()

    sentence = find(Sentence, data.get('sentence_id'))
    word = find(Word, data.get('word_id'))
    index = data.get('index')

    if (
        type(index) is not int
        or not 0 <= index < len(tokens(sentence.plaintext))
    ):
        raise ValueError('Invalid word position.')

    instance = WordInstance.query.filter_by(
        sentence_id=sentence.sentence_id,
        index=index
    ).first()

    if instance is None:
        instance = WordInstance(
            sentence_id=sentence.sentence_id,
            index=index
        )
        db.session.add(instance)

    instance.word_id = word.word_id

    db.session.flush()
    update_sentence_completeness(sentence)
    db.session.commit()

    return jsonify(success=True)


@main.route('/api/unlink-word', methods=['POST'])
@guarded
def unlink_word_instance():
    data = payload()

    sentence = find(Sentence, data.get('sentence_id'))
    index = data.get('index')

    if type(index) is not int or index < 0:
        raise ValueError('Invalid word position.')

    WordInstance.query.filter_by(
        sentence_id=sentence.sentence_id,
        index=index
    ).delete(synchronize_session=False)

    db.session.flush()
    update_sentence_completeness(sentence)
    db.session.commit()

    return jsonify(success=True)


@main.route('/translate', methods=['POST'])
@guarded
def translate_text():
    data = payload()
    value = required(data.get('q'))

    if len(value) > 4500:
        raise ValueError(
            'Translate at most 4,500 characters at a time.'
        )

    if (
        data.get('source', 'ar') != 'ar'
        or data.get('target', 'en') != 'en'
    ):
        raise ValueError(
            'This translator supports Arabic to English.'
        )

    # Use an exact saved translation if one exists.
    for model in (Sentence, Word):
        matches = {
            row.translation.strip()
            for row in model.query.filter_by(plaintext=value)
            if row.translation and row.translation.strip()
        }

        if len(matches) == 1:
            return jsonify(
                translatedText=matches.pop(),
                source='saved database translation'
            )

    try:
        from deep_translator import GoogleTranslator

        translated = GoogleTranslator(
            source='ar',
            target='en'
        ).translate(value)

        if (
            not isinstance(translated, str)
            or not translated.strip()
        ):
            raise RuntimeError('Empty translation')

        return jsonify(
            translatedText=translated.strip(),
            source='automatic translation; review before saving'
        )

    except Exception as error:
        current_app.logger.exception(
            'External translation failed'
        )

        return jsonify(
            error=(
                'Automatic translation is unavailable. '
                'You can still save this text without a translation, '
                'or enter one yourself.'
            ),
            code='TRANSLATION_UNAVAILABLE',
            reason=type(error).__name__
        ), 503


@main.route('/suggest-words', methods=['POST'])
@main.route('/suggest-words-isri', methods=['POST'])
@guarded
def suggest_words():
    values = payload().get('words')

    if not isinstance(values, list) or len(values) > 100:
        raise ValueError('Send a list of up to 100 words.')

    words = Word.query.all()
    result = []

    for raw in values:
        value = clean_punctuation(raw)

        if not value:
            continue

        word = match_word(value, words)

        root = (
            db.session.get(Root, word.root_id)
            if word and word.root_id
            else None
        )

        result.append({
            'plaintext': value,
            'translation': word.translation if word else '',
            'root_plaintext': root.plaintext if root else '',
            'root_translation': root.translation if root else '',
            'source': 'database' if word else 'needs review'
        })

    return jsonify(result)


@main.route(
    '/api/toggle-known/<int:word_id>',
    methods=['POST']
)
@guarded
def toggle_known(word_id):
    word = find(Word, word_id)
    word.known = not word.known

    db.session.commit()

    return jsonify(
        success=True,
        new_known=word.known
    )


@main.route('/api/twilio/webhook', methods=['POST'])
@guarded
def twilio_webhook():
    value = required(request.form.get('Body'))

    sentence = Sentence(
        plaintext=value,
        translation='',
        length=len(tokens(value)),
        complete=False
    )

    db.session.add(sentence)
    db.session.commit()

    return Response(
        f'<Response><Message>Saved: {escape(value)}</Message></Response>',
        mimetype='text/xml'
    )


@main.route('/api/llm/openai', methods=['POST'])
@guarded
def api_llm_openai():
    from .communications import openai_response

    return jsonify(
        openai_response(
            known_words=payload().get('known_words', [])
        )
    )


@main.route('/api/llm/gemini', methods=['POST'])
@guarded
def api_llm_gemini():
    from .communications import gemini_response

    return jsonify(
        gemini_response(
            known_words=payload().get('known_words', [])
        )
    )


@main.route('/env-vars')
def env_vars_endpoint():
    return jsonify(
        OPENAI_API_KEY_CONFIGURED=bool(
            os.getenv('OPENAI_API_KEY')
        ),
        GEMINI_API_KEY_CONFIGURED=bool(
            os.getenv('GEMINI_API_KEY')
        )
    )


from .tutor_routes import register_tutor_routes

register_tutor_routes(main, calculate_completeness)