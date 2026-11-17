import re
import unicodedata
from .extensions import db

# ---- The lexicon ----
# Shared: LexiconLemma, every lemma by frequency rank, in data/static.db. Yours (each account's database): LemmaState,
# what you know of a lemma (a row only once something about it changes), MyLemma, lemmas you added that the
# lexicon lacks, and Word, word forms you added. Lemma and AnyWord read them merged (views made in lexicon.py).

CUSTOM_LEMMA_BASE = 1_000_000  # your own lemmas are numbered from here, clear of the lexicon's ranks

class LexiconLemma(db.Model):
    __bind_key__ = 'static'  # data/static.db
    __tablename__ = 'lemma'
    lemma_id = db.Column(db.Integer, primary_key=True)  # frequency rank
    plaintext = db.Column(db.String, nullable=False, index=True)
    bare = db.Column(db.String, index=True)  # for search, see bare()
    prune = db.Column(db.String, index=True)  # its own form's prune(), for matching words
    translation = db.Column(db.String)
    occurrences = db.Column(db.Integer, default=0)

class LemmaState(db.Model):
    __tablename__ = 'lemma_state'
    lemma_id = db.Column(db.Integer, primary_key=True)
    known = db.Column(db.Boolean, default=False)
    source = db.Column(db.String)  # how `known` was set: None (default/import), 'user' (judged by the learner) or 'inferred' (calibration)
    # Spaced repetition (srs.py): all None until the word is first studied
    p_learned = db.Column(db.Float)  # L, the probability it's learned
    stability = db.Column(db.Float)  # S, days until recall falls to 90%
    last_review = db.Column(db.DateTime)  # UTC
    due = db.Column(db.DateTime)  # UTC
    reps = db.Column(db.Integer, default=0)
    lapses = db.Column(db.Integer, default=0)
    translation = db.Column(db.String)  # your own gloss, in place of the lexicon's

class MyLemma(db.Model):
    __tablename__ = 'my_lemma'
    lemma_id = db.Column(db.Integer, primary_key=True)  # from CUSTOM_LEMMA_BASE
    plaintext = db.Column(db.String, nullable=False, index=True)
    bare = db.Column(db.String, index=True)
    prune = db.Column(db.String, index=True)
    translation = db.Column(db.String)

class Word(db.Model):
    """A word form you added (by hand, or from a flashcard), linked to its lemma. Every lemma's own form is a
    word too, without a row here: AnyWord lists those under the id -lemma_id."""
    __tablename__ = 'word'
    word_id = db.Column(db.Integer, primary_key=True)
    lemma_id = db.Column(db.Integer)
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    prune = db.Column(db.String, index=True)

views = db.MetaData()  # read-only views, made per connection (lexicon.py), so create_all leaves them out

class Lemma(db.Model):
    """Every lemma (the lexicon's and yours), with your state and glosses. Read-only: change LemmaState."""
    __table__ = db.Table(
        'lemmas', views,
        db.Column('lemma_id', db.Integer, primary_key=True), db.Column('plaintext', db.String), db.Column('bare', db.String),
        db.Column('translation', db.String), db.Column('occurrences', db.Integer), db.Column('known', db.Boolean),
        db.Column('source', db.String), db.Column('p_learned', db.Float), db.Column('stability', db.Float),
        db.Column('last_review', db.DateTime), db.Column('due', db.DateTime), db.Column('reps', db.Integer), db.Column('lapses', db.Integer))

class AnyWord(db.Model):
    """Your words plus every lemma's own form (word_id -lemma_id). Read-only: change Word."""
    __table__ = db.Table(
        'words', views,
        db.Column('word_id', db.Integer, primary_key=True), db.Column('lemma_id', db.Integer), db.Column('plaintext', db.String),
        db.Column('translation', db.String), db.Column('prune', db.String))

class Sentence(db.Model):
    __tablename__ = 'sentence'
    sentence_id = db.Column(db.Integer, primary_key=True)
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    complete = db.Column(db.Boolean, default=False)
    length = db.Column(db.Integer)
    diac = db.Column(db.String)  # plaintext with diacritics, token for token (flashcards; filled on first use)
    target_lemma_id = db.Column(db.Integer)  # the word this flashcard is for (see atlas.assign_targets)

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

class Account(db.Model):
    """A signed-in user (Firebase Authentication). Everything they learn is in their own database, users/<uid>.db."""
    __bind_key__ = 'accounts'  # instance/accounts.db
    uid = db.Column(db.String, primary_key=True)  # Firebase user id
    email = db.Column(db.String)
    name = db.Column(db.String)
    photo = db.Column(db.String)
    phone = db.Column(db.String, unique=True)  # texts from this number (Twilio) go to this account's Library
    link_code = db.Column(db.String)  # texted from a phone to link it, until link_expires
    link_expires = db.Column(db.DateTime)
    created = db.Column(db.DateTime)

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
    lemma_id = db.Column(db.Integer)
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
    word_id = db.Column(db.Integer)  # an AnyWord: negative for a lemma's own form
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

def new_lemma(text, translation=None):
    """A lemma of your own, for one the lexicon lacks."""
    top = db.session.query(db.func.max(MyLemma.lemma_id)).scalar() or CUSTOM_LEMMA_BASE - 1
    text = nfc(text)
    return MyLemma(lemma_id=top + 1, plaintext=text, bare=bare(text), prune=prune(text), translation=translation)

def find_lemma(text, gloss=''):
    """Lexicon row for a lemma. Homographs are told apart by gloss, else the most frequent (lowest id) wins."""
    rows = Lemma.query.filter_by(plaintext=nfc(text)).order_by(Lemma.lemma_id).all()
    by_gloss = [l for l in rows if gloss and gloss in (l.translation, *(l.translation or '').split('#'))]
    return (by_gloss or rows or [None])[0]

def lemma_state(lemma_id):
    """Your state row for a lemma, made the first time something about it changes."""
    state = db.session.get(LemmaState, lemma_id)
    if state is None:
        state = LemmaState(lemma_id=lemma_id, known=False, reps=0, lapses=0)
        db.session.add(state)
    return state

def set_states(ids, **values):
    """Sets the same state fields on many lemmas at once (making their rows as needed)."""
    from sqlalchemy.dialects.sqlite import insert
    ids = list(ids)
    for k in range(0, len(ids), 2000):  # under SQLite's limit on bound values
        stmt = insert(LemmaState).values([{'lemma_id': i, **values} for i in ids[k:k + 2000]])
        db.session.execute(stmt.on_conflict_do_update(index_elements=['lemma_id'], set_={f: stmt.excluded[f] for f in values}))
