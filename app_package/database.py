import csv
import os
from collections import Counter
from .extensions import db
from .models import Lemma, Word, Sentence, nfc, prune, find_lemma, new_lemma

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
    with open(os.path.join(DATA_DIR, 'knownwords.txt'), encoding='utf-8') as f:
        known = Counter(nfc(w.strip()) for w in f.read().split(',') if w.strip())

    with open(os.path.join(DATA_DIR, 'Final_Lexicon.csv'), encoding='utf-8') as f:
        lemmas = [new_lemma(r['Lemma'], r['Gloss'], occurrences=int(r['Occurrences'])) for r in csv.DictReader(f)]

    # A lemma listed n times marks its n most frequent homographs
    for lemma in lemmas:
        lemma.known = known[lemma.plaintext] > 0
        known[lemma.plaintext] -= lemma.known

    db.session.add_all(lemmas)
    db.session.flush()
    print(f"Imported {len(lemmas)} lemmas ({sum(l.known for l in lemmas)} known).")
