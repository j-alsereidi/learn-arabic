"""
The shared lexicon in each account's database. Every connection to an account database attaches data/static.db as
`shared` and makes two read-only views (models.Lemma, models.AnyWord) merging it with the account's own tables:

  lemmas  every lemma (shared.lemma, then your my_lemma) with your lemma_state: known, review state, your gloss
  words   your word forms (word), then every lemma's own form as word -lemma_id

Accounts made before the split kept a whole copy of the lexicon (a `lemma` table with the state columns, and one
`word` row per lemma for its own form); upgrade() moves what's yours out of it and drops the copy.
"""
import csv

from sqlalchemy import event, inspect

from .extensions import add_missing_columns, db
from .models import LexiconLemma, bare, nfc, prune

VIEWS = """
CREATE TEMP VIEW IF NOT EXISTS lemmas AS
SELECT l.lemma_id, l.plaintext, l.bare, COALESCE(s.translation, l.translation) AS translation, l.occurrences,
       COALESCE(s.known, 0) AS known, s.source, s.p_learned, s.stability, s.last_review, s.due,
       COALESCE(s.reps, 0) AS reps, COALESCE(s.lapses, 0) AS lapses
FROM (SELECT lemma_id, plaintext, bare, translation, occurrences FROM shared.lemma
      UNION ALL SELECT lemma_id, plaintext, bare, translation, 0 FROM main.my_lemma) AS l
LEFT JOIN main.lemma_state AS s ON s.lemma_id = l.lemma_id;

CREATE TEMP VIEW IF NOT EXISTS words AS
SELECT word_id, lemma_id, plaintext, translation, prune FROM main.word
UNION ALL SELECT -lemma_id, lemma_id, plaintext, NULL, prune FROM shared.lemma
UNION ALL SELECT -lemma_id, lemma_id, plaintext, NULL, prune FROM main.my_lemma;
"""


def attach(engine, static_path):
    """Attaches the shared lexicon to every new connection of an account database, with the views."""
    @event.listens_for(engine, 'connect')
    def connect(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute('ATTACH DATABASE ? AS shared', (static_path,))
        cursor.executescript(VIEWS)
        cursor.close()


def upgrade(engine):
    """An account database brought up to the current models, out of the old whole-lexicon layout if needed."""
    metadata = db.metadatas[None]
    metadata.create_all(engine)
    add_missing_columns(metadata, engine)
    if 'lemma' not in inspect(engine).get_table_names():
        return
    with engine.begin() as conn:
        sql = conn.exec_driver_sql
        # What you'd changed about a lexicon lemma: your state, and your gloss where it differs
        sql("""INSERT OR REPLACE INTO lemma_state (lemma_id, known, source, p_learned, stability, last_review, due, reps, lapses, translation)
               SELECT u.lemma_id, u.known, u.source, u.p_learned, u.stability, u.last_review, u.due, u.reps, u.lapses,
                      CASE WHEN COALESCE(u.translation, '') != COALESCE(s.translation, '') THEN u.translation END
               FROM main.lemma u JOIN shared.lemma s ON s.lemma_id = u.lemma_id
               WHERE u.known OR u.source IS NOT NULL OR u.p_learned IS NOT NULL OR COALESCE(u.reps, 0) > 0
                  OR COALESCE(u.translation, '') != COALESCE(s.translation, '')""")
        # Lemmas the lexicon doesn't have were added by you: they become yours, with their state
        mine = sql('SELECT lemma_id, plaintext, translation FROM main.lemma WHERE lemma_id NOT IN (SELECT lemma_id FROM shared.lemma)').fetchall()
        for lemma_id, text, translation in mine:
            sql('INSERT OR REPLACE INTO my_lemma (lemma_id, plaintext, bare, prune, translation) VALUES (?, ?, ?, ?, ?)',
                (lemma_id, nfc(text), bare(text), prune(nfc(text)), translation))
        sql("""INSERT OR REPLACE INTO lemma_state (lemma_id, known, source, p_learned, stability, last_review, due, reps, lapses)
               SELECT lemma_id, known, source, p_learned, stability, last_review, due, reps, lapses FROM main.lemma
               WHERE lemma_id NOT IN (SELECT lemma_id FROM shared.lemma)""")
        # A lemma's own form is in the views now: links to its row point to -lemma_id, and the row goes
        own = """SELECT w.word_id FROM word w JOIN main.lemma u ON u.lemma_id = w.lemma_id
                 WHERE w.plaintext = u.plaintext AND COALESCE(w.translation, '') = ''"""
        sql(f"""UPDATE word_instance SET word_id = -(SELECT lemma_id FROM word WHERE word.word_id = word_instance.word_id)
                WHERE word_id IN ({own})""")
        sql(f'DELETE FROM word WHERE word_id IN ({own})')
        sql('DROP TABLE main.lemma')
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        conn.exec_driver_sql('VACUUM')  # give back the lexicon copy's space
    print(f'Moved {engine.url.database} to the shared lexicon')


def ensure_lexicon(csv_path):
    """The shared lexicon in data/static.db, from Final_Lexicon.csv (rows in frequency order) if it's empty."""
    if db.session.query(LexiconLemma.lemma_id).first():
        return
    with open(csv_path, encoding='utf-8') as f:
        rows = [(nfc(r['Lemma']), r['Gloss'], int(r['Occurrences'])) for r in csv.DictReader(f)]
    db.session.add_all(LexiconLemma(lemma_id=i, plaintext=text, bare=bare(text), prune=prune(text), translation=gloss, occurrences=occ)
                       for i, (text, gloss, occ) in enumerate(rows, 1))
    db.session.commit()
    print(f'Loaded {len(rows)} lemmas into the shared lexicon')
