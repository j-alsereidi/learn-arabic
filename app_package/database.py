import csv
import os
import re
from collections import Counter
from .extensions import db
from .models import Lemma, Word, Sentence, nfc, prune, bare, find_lemma, new_lemma

DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (sentence, translation, [(word, translation, lemma)])
EXAMPLES = [
    ("ذهب الولد إلى المدرسة", "The boy went to school", [
        ("ذهب", "went", "ذَهَب"), ("الولد", "the boy", "وَلَد"),
        ("إلى", "to", "إِلَى"), ("المدرسة", "the school", "مَدْرَسَة"),
    ]),
    ("قرأت كتابا جديدا في البيت", "I read a new book at home", [
        ("قرأت", "I read", "قَرَأ"), ("كتابا", "a book", "كِتاب"), ("جديدا", "new", "جَدِيد"),
        ("في", "in", "فِي"), ("البيت", "the house", "بَيْت"),
    ]),
    ("شربت الشاي مع صديقي", "I drank tea with my friend", [
        ("شربت", "I drank", "شَرِب"), ("الشاي", "the tea", "شاي"),
        ("مع", "with", "مَع"), ("صديقي", "my friend", "صَدِيق"),
    ]),
]

def seed_database():
    if not Lemma.query.first():
        import_lexicon()
    if not Sentence.query.first():
        for text, translation, words in EXAMPLES:
            db.session.add(Sentence(plaintext=text, translation=translation, complete=True, length=len(text.split())))
            for word, word_trans, lemma in words:
                db.session.add(Word(plaintext=word, translation=word_trans, prune=prune(word), lemma_id=find_lemma(lemma).lemma_id))
        print(f"Seeded {len(EXAMPLES)} example sentences.")
    db.session.commit()

def import_lexicon():
    """Loads Final_Lexicon.csv (rows in frequency order) and marks the lemmas in knownwords.txt as known."""
    with open(os.path.join(DATA_DIR, 'Final_Lexicon.csv'), encoding='utf-8') as f:
        lemmas = [new_lemma(r['Lemma'], r['Gloss'], occurrences=int(r['Occurrences'])) for r in csv.DictReader(f)]
    db.session.add_all(lemmas)
    db.session.flush()

    with open(os.path.join(DATA_DIR, 'knownwords.txt'), encoding='utf-8') as f:
        known, _ = mark_known(f.read())
    print(f"Imported {len(lemmas)} lemmas ({known} known).")

def mark_known(text):
    """Makes the lemmas listed in a knownwords.txt-style text known and every other lemma unknown and unjudged.
    Words may be separated by commas (Latin or Arabic) or new lines; a lemma listed n times marks its n most
    frequent homographs. Returns (lemmas marked known, listed words matching no lemma)."""
    wanted = Counter(nfc(w.strip()) for w in re.split(r'[,،\n]', text.lstrip('﻿')) if w.strip())
    ids = []
    for lemma_id, plaintext in (db.session.query(Lemma.lemma_id, Lemma.plaintext)
                                .filter(Lemma.plaintext.in_(wanted)).order_by(Lemma.lemma_id)):
        if wanted[plaintext] > 0:
            wanted[plaintext] -= 1
            ids.append(lemma_id)
    # Words without (or with different) diacritics: match on the bare form instead, most frequent lemmas first
    leftover, chosen = Counter(), set(ids)
    for w, n in wanted.items():
        leftover[bare(w)] += max(n, 0)
    for lemma_id, lemma_bare in (db.session.query(Lemma.lemma_id, Lemma.bare)
                                 .filter(Lemma.bare.in_([b for b, n in leftover.items() if n > 0])).order_by(Lemma.lemma_id)):
        if leftover[lemma_bare] > 0 and lemma_id not in chosen:
            leftover[lemma_bare] -= 1
            ids.append(lemma_id)
            chosen.add(lemma_id)
    not_found = [w for w, n in wanted.items() if n > 0 and leftover[bare(w)] > 0]
    Lemma.query.update({'known': False, 'source': None}, synchronize_session=False)
    Lemma.query.filter(Lemma.lemma_id.in_(ids)).update({'known': True}, synchronize_session=False)
    return len(ids), not_found
