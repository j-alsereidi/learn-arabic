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
