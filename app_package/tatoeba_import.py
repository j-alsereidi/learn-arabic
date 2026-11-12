"""
One-off import of Tatoeba's Arabic sentences (with English translations) for the Atlas's i+1 sentences.

    python -m app_package.tatoeba_import <folder with the unpacked Tatoeba exports> [lemmatize|load]

The folder needs ara_sentences.tsv, ara-eng_links.tsv and eng_sentences.tsv from
https://downloads.tatoeba.org/exports/per_language/ (CC BY 2.0 FR).
`lemmatize` runs every sentence through Camelira (resumable: results go to camelira.jsonl in the
same folder); `words` analyses, one by one, the words Camelira couldn't analyse in their sentence (camelira_words.jsonl);
then `load` fills the tatoeba table (in data/static.db) from those caches. With no step, all three run.
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CAMELIRA_URL = 'https://camelira.abudhabi.nyu.edu/api/disambig'
SEP = '۞'  # Camelira returns this as a lone punctuation token, so batches can be split back into sentences
MAX_CHARS = 180  # Camelira rejects requests of ~45+ words (~240 chars)
WORKERS = 2  # polite to NYU's server


def pairs(folder):
    """[(tatoeba_id, arabic, english)], one per distinct Arabic sentence that has an English translation."""
    ara = {}
    with open(os.path.join(folder, 'ara_sentences.tsv'), encoding='utf-8') as f:
        for line in f:
            i, _, text = line.rstrip('\n').split('\t', 2)
            ara[int(i)] = text.strip()
    links = {}
    with open(os.path.join(folder, 'ara-eng_links.tsv'), encoding='utf-8') as f:
        for line in f:
            a, e = map(int, line.split())
            if a in ara:
                links[a] = min(e, links.get(a, e))  # oldest translation
    wanted = set(links.values())
    eng = {}
    with open(os.path.join(folder, 'eng_sentences.tsv'), encoding='utf-8') as f:
        for line in f:
            i, _, text = line.rstrip('\n').split('\t', 2)
            if int(i) in wanted:
                eng[int(i)] = text.strip()
    out, seen = [], set()
    for a in sorted(links):
        if links[a] in eng and ara[a] not in seen and SEP not in ara[a]:
            seen.add(ara[a])
            out.append((a, ara[a], eng[links[a]]))
    return out


def camelira(text, tries=4, timeout=60):
    req = urllib.request.Request(CAMELIRA_URL, json.dumps({'dialect': 'msa', 'sentence': text}).encode(),
                                 {'Content-Type': 'application/json'})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.load(res)['output']['disambig']
        except Exception:
            time.sleep(2 ** attempt)
    return None


def lemmatize_batch(batch):
    """[(id, [[word, lex, stemgloss], ...])] for a batch of (id, arabic) sharing one Camelira request."""
    result = camelira(f' {SEP} '.join(text for _, text in batch))
    if result is None:  # a whole batch can be refused (too many words with the separators): try them one by one
        return [r for item in batch for r in lemmatize_batch([item])] if len(batch) > 1 else []
    sentences, current = [], []
    for w in result:
        if w['word'] == SEP:
            sentences.append(current); current = []
            continue
        a = w['analyses'][0]['analysis'] if w['analyses'] else {}
        current.append([w['word'], a.get('lex'), re.sub(r'_\[\w+\]', '', a.get('stemgloss', ''))])
    sentences.append(current)
    if len(sentences) != len(batch):  # a sentence held a token Camelira split oddly; redo them one by one
        return [r for item in batch for r in lemmatize_batch([item])] if len(batch) > 1 else []
    return [(i, words) for (i, _), words in zip(batch, sentences)]


def lemmatize(folder, items):
    cache = os.path.join(folder, 'camelira.jsonl')
    done = set()
    if os.path.exists(cache):
        with open(cache, encoding='utf-8') as f:
            done = {json.loads(line)['id'] for line in f}
    todo = [(i, ar) for i, ar, _ in items if i not in done]
    long = [t for t in todo if len(t[1]) > MAX_CHARS]  # too long for one request: analysed in pieces below
    todo = [t for t in todo if len(t[1]) <= MAX_CHARS]
    batches, batch, size = [], [], 0
    for item in todo:
        if batch and size + len(item[1]) + 3 > MAX_CHARS:
            batches.append(batch); batch, size = [], 0
        batch.append(item); size += len(item[1]) + 3
    if batch:
        batches.append(batch)
    print(f'{len(done)} cached, {len(todo)} to go in {len(batches)} requests', flush=True)
    start = time.time()
    with open(cache, 'a', encoding='utf-8') as out, ThreadPoolExecutor(WORKERS) as pool:
        for n, results in enumerate(pool.map(lemmatize_batch, batches), 1):
            for i, words in results:
                out.write(json.dumps({'id': i, 'words': words}, ensure_ascii=False) + '\n')
            if n % 200 == 0:
                out.flush()
                print(f'{n}/{len(batches)} requests, {time.time() - start:.0f}s', flush=True)
        for i, ar in long:
            words = []
            for chunk in chunks(ar):
                result = lemmatize_batch([(i, chunk)])
                if not result:
                    break
                words += result[0][1]
            else:
                out.write(json.dumps({'id': i, 'words': words}, ensure_ascii=False) + '\n')
        print(f'{len(long)} long sentences done in pieces', flush=True)


def chunks(text):
    """Whole words, up to MAX_CHARS at a time."""
    piece = []
    for word in text.split():
        if piece and len(' '.join(piece + [word])) > MAX_CHARS:
            yield ' '.join(piece)
            piece = []
        piece.append(word)
    if piece:
        yield ' '.join(piece)


# Words that don't need learning, so they don't stop a sentence from being i+1:
NUMBER = re.compile(r'^[0-9٠-٩۰-۹]+[مهـ]*$')  # e.g. the year ١٩٤٨م

# Names. Camelira can't analyse most of Tatoeba's names (زيري Ziri, ياني Yanni, ريمة Rima...), so an unanalysed
# word counts as a name when its consonants match a capitalised word in the English translation. Both sides are
# reduced to a rough consonant skeleton: vowels, h, w and y dropped; sounds Arabic spells differently merged.
AR_SKELETON = str.maketrans({'ب': 'b', 'ت': 't', 'ث': 't', 'ج': 'j', 'خ': 'k', 'د': 'd', 'ذ': 'd', 'ر': 'r', 'ز': 's',
                             'س': 's', 'ش': 's', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 's', 'غ': 'j', 'ف': 'f', 'ق': 'k',
                             'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n'})
EN_SKELETON = [('th', 't'), ('sh', 's'), ('ch', 'k'), ('ph', 'f'), ('ck', 'k'), ('x', 'ks'), ('ce', 's'), ('ci', 's'), ('cy', 's'), ('c', 'k'), ('q', 'k'),
               ('g', 'j'), ('z', 's'), ('v', 'f'), ('p', 'b')]
PREFIXES = ('وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك')

def collapse(skeleton):
    return re.sub(r'(.)\1+', r'\1', skeleton)

def ar_skeleton(word):
    return collapse(''.join(ch for ch in word.translate(AR_SKELETON) if ch.isascii() and ch.isalpha()))

def en_skeleton(word):
    word = ''.join(ch for ch in unicodedata.normalize('NFKD', word.lower()) if 'a' <= ch <= 'z')
    for a, b in EN_SKELETON:
        word = word.replace(a, b)
    return collapse(re.sub('[aeiouhwy]', '', word))

def is_name(word, english):
    """An unanalysed Arabic word that's a capitalised name in the translation (prefixes like و ل ال allowed)."""
    names = {}  # skeleton -> safe to match on one consonant: not the sentence's first word, or 4+ letters (Yanni)
    for k, w in enumerate(re.findall(r"[A-ZÀ-Þ][\w-]*", english)):
        names[en_skeleton(w)] = names.get(en_skeleton(w)) or k > 0 or len(w) >= 4
    for prefix in ('',) + PREFIXES:
        if word.startswith(prefix):
            sk = ar_skeleton(word[len(prefix):])
            if sk and sk in names and (len(sk) >= 2 or names[sk]):
                return True
    return False


def blocking_words(folder, items):
    """Words Camelira couldn't analyse in their sentence that aren't names or numbers."""
    english = {i: en for i, _, en in items}
    words = set()
    with open(os.path.join(folder, 'camelira.jsonl'), encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            for w, _, g in row['words']:
                if g == 'NO_ANALYSIS' and re.search(r'[ء-ي]', w) and not NUMBER.match(w) and not is_name(w, english.get(row['id'], '')):
                    words.add(w)
    return words


def analyse_words(folder, items):
    """Second pass: each blocking word analysed on its own; if that fails too and it starts with أ, without it
    (the question prefix Camelira misses: أيمكنك -> يمكنك). Context-free, so sometimes wrong, but a wrong lemma
    is usually one you don't know, which keeps the sentence out as before."""
    cache = os.path.join(folder, 'camelira_words.jsonl')
    done = set()
    if os.path.exists(cache):
        with open(cache, encoding='utf-8') as f:
            done = {json.loads(line)['word'] for line in f}
    todo = sorted(blocking_words(folder, items) - done)
    print(f'{len(done)} words cached, {len(todo)} to analyse', flush=True)

    def run(words):  # {word: (lex, gloss)}, failures as (None, 'NO_ANALYSIS')
        batches, batch, size = [], [], 0
        for w in words:
            if batch and size + len(w) + 3 > MAX_CHARS:
                batches.append(batch); batch, size = [], 0
            batch.append((w, w)); size += len(w) + 3
        if batch:
            batches.append(batch)
        out = {}
        with ThreadPoolExecutor(WORKERS) as pool:
            for results in pool.map(lemmatize_batch, batches):
                for w, tokens in results:
                    first = next((t for t in tokens if re.search(r'[ء-ي]', t[0])), None)
                    out[w] = (first[1], first[2]) if first and first[2] != 'NO_ANALYSIS' else (None, 'NO_ANALYSIS')
        return out

    found = run(todo)
    retry = {w: w[1:] for w in todo if found.get(w, (None,))[0] is None and w.startswith('أ') and len(w) > 2}
    for w, (lex, gloss) in run(sorted(set(retry.values()))).items():
        for original in [o for o, stripped in retry.items() if stripped == w]:
            if lex:
                found[original] = (lex, gloss)
    with open(cache, 'a', encoding='utf-8') as f:
        for w in todo:
            lex, gloss = found.get(w, (None, 'NO_ANALYSIS'))
            f.write(json.dumps({'word': w, 'lex': lex, 'gloss': gloss}, ensure_ascii=False) + '\n')
    print(f'{sum(1 for w in todo if found.get(w, (None,))[0])} of {len(todo)} words analysed on their own', flush=True)


def load(folder, items):
    from . import create_app
    from .extensions import db
    from .models import Lemma, TatoebaSentence, nfc
    app = create_app()
    with app.app_context():
        by_text = {}
        for lemma_id, text, gloss in db.session.query(Lemma.lemma_id, Lemma.plaintext, Lemma.translation).order_by(Lemma.lemma_id):
            by_text.setdefault(text, []).append((lemma_id, gloss or ''))

        def lemma_id(lex, gloss):  # same rule as models.find_lemma: gloss decides between homographs, else most frequent
            rows = by_text.get(nfc(lex), [])
            match = [i for i, g in rows if gloss and gloss in (g, *g.split('#'))]
            return (match or [i for i, _ in rows] or [None])[0]

        cached = {}
        with open(os.path.join(folder, 'camelira.jsonl'), encoding='utf-8') as f:
            for line in f:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:  # half-written last line while lemmatize is still running
                    continue
                cached[row['id']] = row['words']
        alone = {}  # word -> (lex, gloss) from the `words` step
        words_cache = os.path.join(folder, 'camelira_words.jsonl')
        if os.path.exists(words_cache):
            with open(words_cache, encoding='utf-8') as f:
                for line in f:
                    row = json.loads(line)
                    if row['lex']:
                        alone[row['word']] = (row['lex'], row['gloss'])
        for words in cached.values():
            for t in words:
                if t[2] == 'NO_ANALYSIS' and t[0] in alone:
                    t[1], t[2] = alone[t[0]]
        TatoebaSentence.query.delete()
        rows = []
        for i, ar, en in items:
            if i not in cached:
                continue
            tokens = [[w, lemma_id(lex, g) if lex and re.search(r'[؀-ۿ]', w) else None] for w, lex, g in cached[i]]
            lemmas = sorted({t[1] for t in tokens if t[1]})
            # Arabic words without a lemma, except numbers and names (which need no learning)
            unresolved = sum(1 for (w, _, g), t in zip(cached[i], tokens)
                             if re.search(r'[ء-ي]', w) and not t[1] and not NUMBER.match(w)
                             and not (g == 'NO_ANALYSIS' and is_name(w, en)))
            rows.append({'tatoeba_id': i, 'ar': ar, 'en': en, 'tokens': tokens, 'lemmas': lemmas, 'unresolved': unresolved})
        db.session.execute(db.insert(TatoebaSentence), rows)
        db.session.commit()
        engine = db.engines['static']
        if engine.dialect.name == 'sqlite':
            with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
                conn.exec_driver_sql('VACUUM')  # data/static.db is committed: keep it compact
        print(f'loaded {len(rows)} sentences ({sum(1 for r in rows if not r["unresolved"])} fully resolved)')


if __name__ == '__main__':
    folder, step = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'all')
    items = pairs(folder)
    print(f'{len(items)} Arabic sentences with English translations', flush=True)
    if step in ('lemmatize', 'all'):
        lemmatize(folder, items)
    if step in ('words', 'all'):
        analyse_words(folder, items)
    if step in ('load', 'all'):
        load(folder, items)
