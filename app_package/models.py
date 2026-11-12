import re
import unicodedata
from .extensions import db

class Lemma(db.Model):
    __tablename__ = 'lemma'
    lemma_id = db.Column(db.Integer, primary_key=True)
    plaintext = db.Column(db.String, nullable=False, index=True)
    bare = db.Column(db.String, index=True)  # for search, see bare()
    translation = db.Column(db.String)
    occurrences = db.Column(db.Integer, default=0)
    known = db.Column(db.Boolean, default=False)
    source = db.Column(db.String)  # how `known` was set: None (default/import), 'user' (judged by the learner) or 'inferred' (calibration)
    # Spaced repetition (srs.py): all None until the word is first studied
    p_learned = db.Column(db.Float)  # L, the probability it's learned
    stability = db.Column(db.Float)  # S, days until recall falls to 90%
    last_review = db.Column(db.DateTime)  # UTC
    due = db.Column(db.DateTime)  # UTC
    reps = db.Column(db.Integer, default=0)
    lapses = db.Column(db.Integer, default=0)
    words = db.relationship('Word', backref='lemma', lazy=True)

class Word(db.Model):
    __tablename__ = 'word'
    word_id = db.Column(db.Integer, primary_key=True)
    lemma_id = db.Column(db.Integer, db.ForeignKey('lemma.lemma_id'))
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    prune = db.Column(db.String, index=True)

class Sentence(db.Model):
    __tablename__ = 'sentence'
    sentence_id = db.Column(db.Integer, primary_key=True)
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    complete = db.Column(db.Boolean, default=False)
    length = db.Column(db.Integer)
    diac = db.Column(db.String)  # plaintext with diacritics, token for token (flashcards; filled on first use)

class CalibrationStep(db.Model):
    """One submitted calibration page, kept so it can be viewed and re-judged later."""
    __tablename__ = 'calibration_step'
    step_id = db.Column(db.Integer, primary_key=True)
    stratum = db.Column(db.Integer)
    mode = db.Column(db.String)
    manual = db.Column(db.Boolean)  # part of a hand sweep
    ids = db.Column(db.JSON)  # lemma ids in display order
    unknown = db.Column(db.JSON)
    before = db.Column(db.JSON)  # {lemma_id: [known, source]} of the lemmas this page inferred, before it did

class TatoebaSentence(db.Model):
    """Tatoeba sentence (CC BY 2.0 FR) with its English translation, lemmatized once by tatoeba_import."""
    __bind_key__ = 'static'  # data/static.db
    __tablename__ = 'tatoeba'
    tatoeba_id = db.Column(db.Integer, primary_key=True)
    ar = db.Column(db.String, nullable=False)
    en = db.Column(db.String)
    tokens = db.Column(db.JSON)  # [[word as Camelira tokenized it, lemma_id or null], ...]
    lemmas = db.Column(db.JSON)  # distinct lemma ids in the sentence
    unresolved = db.Column(db.Integer, default=0)  # Arabic words with no lexicon lemma (names etc.): never i+1

class TatoebaDiac(db.Model):
    """A Tatoeba sentence with diacritics, token for token, cached on first use (here, not in data/static.db,
    which nothing writes at runtime)."""
    __tablename__ = 'tatoeba_diac'
    tatoeba_id = db.Column(db.Integer, primary_key=True)
    diac = db.Column(db.String)

class Review(db.Model):
    """One word judged in a flashcard review: the log the heatmap counts and the model could be refitted from."""
    __tablename__ = 'review'
    review_id = db.Column(db.Integer, primary_key=True)
    at = db.Column(db.DateTime, index=True)  # UTC
    lemma_id = db.Column(db.Integer, db.ForeignKey('lemma.lemma_id'))
    sentence_id = db.Column(db.Integer)
    role = db.Column(db.String)  # 'intro' (first sight), 'target' (the card's word) or 'context'
    ok = db.Column(db.Boolean)

class Setting(db.Model):
    __tablename__ = 'setting'
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String)

class WordInstance(db.Model):
    __tablename__ = 'word_instance'
    sentence_id = db.Column(db.Integer, db.ForeignKey('sentence.sentence_id'), primary_key=True)
    word_id = db.Column(db.Integer, db.ForeignKey('word.word_id'))
    index = db.Column(db.Integer, primary_key=True)


def nfc(text):
    """Canonical diacritic order, so lemmas from Camelira and the lexicon compare equal."""
    return unicodedata.normalize('NFC', text or '')

def prune(text):
    """Diacritic-free form for fuzzy matching. Mirrors stripDiacritics in the frontend (NFD also drops hamza seats)."""
    return re.sub(r'[ً-ٟـٰ]', '', unicodedata.normalize('NFD', text))

def bare(text):
    """Search form of a lemma: no diacritics, hamza seats or alif wasla."""
    return prune(nfc(text)).replace('ٱ', 'ا')

def new_lemma(text, translation=None, **fields):
    """A lemma plus the word for its own form, since every lemma is also a word."""
    lemma = Lemma(plaintext=nfc(text), bare=bare(text), translation=translation, **fields)
    lemma.words.append(Word(plaintext=lemma.plaintext, prune=prune(lemma.plaintext)))
    return lemma

def find_lemma(text, gloss=''):
    """Lexicon row for a lemma. Homographs are told apart by gloss, else the most frequent (lowest id) wins."""
    rows = Lemma.query.filter_by(plaintext=nfc(text)).order_by(Lemma.lemma_id).all()
    by_gloss = [l for l in rows if gloss and gloss in (l.translation, *(l.translation or '').split('#'))]
    return (by_gloss or rows or [None])[0]
