"""
The browser extension's API (chrome-extension/): lemmatize the Arabic on any web page through Camelira, and save a
sentence from a page as a flashcard. A "word" is a run of Arabic letters (WORD below); the extension finds the
same runs on the page and pairs them with these results by order. Translation and known/unknown toggles use the
existing /translate and /api/set-known routes.
"""
import re
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from flask import Blueprint, jsonify, request
from .extensions import db
from .models import Lemma, bare, nfc
from .atlas import lemma_rows
from .routes import save_card
from .tatoeba_import import MAX_CHARS, chunks, lemmatize_batch

reader = Blueprint('reader', __name__)

WORD = re.compile('[ء-غـ-ْٰ-ۓ]+')  # keep in sync with chrome-extension/content.js
CACHE_SIZE = 20000
_cache = OrderedDict()  # page text -> [(lex, gloss) or None per WORD], least recently used first


def analyse(texts):
    """For each text, (lex, stemgloss) or None (names, words Camelira can't analyse) per WORD; None for a text
    Camelira didn't answer. Long texts go in pieces; pieces share requests; answers are cached per text."""
    todo = [t for t in dict.fromkeys(texts) if t not in _cache and WORD.search(t)]
    items = [((k, j), piece) for k, t in enumerate(todo) for j, piece in enumerate(chunks(t))]
    batches, batch, size = [], [], 0
    for item in items:
        if batch and size + len(item[1]) + 3 > MAX_CHARS:
            batches.append(batch); batch, size = [], 0
        batch.append(item); size += len(item[1]) + 3
    if batch:
        batches.append(batch)
    pieces = {}
    with ThreadPoolExecutor(2) as pool:  # Camelira works one request at a time; a page is waiting: short timeouts
        for result in pool.map(partial(lemmatize_batch, tries=2, timeout=20), batches):
            pieces.update(result)
    for k, t in enumerate(todo):
        n = sum(1 for key in pieces if key[0] == k)
        if n != sum(1 for key, _ in items if key[0] == k):
            continue  # a piece failed: not cached, so it's retried next time
        tokens = [tok for j in range(n) for tok in pieces[(k, j)]]
        out, i = [], 0
        for word in WORD.findall(t):  # pair each Arabic run with the next Camelira token of the same bare form
            found = None
            for j in range(i, len(tokens)):
                if bare(tokens[j][0]) == bare(word):
                    found, i = tokens[j], j + 1
                    break
            out.append((found[1], found[2]) if found and found[1] and found[2] != 'NO_ANALYSIS' else None)
        _cache[t] = out
        if len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    for t in texts:
        if t in _cache:
            _cache.move_to_end(t)
    return [_cache.get(t, [] if not WORD.search(t) else None) for t in texts]


def resolver():
    """lemma_id(lex, gloss): Camelira's lemma to the lexicon's, the same rule as models.find_lemma."""
    by_text = {}
    for lemma_id, text, gloss in db.session.query(Lemma.lemma_id, Lemma.plaintext, Lemma.translation).order_by(Lemma.lemma_id):
        by_text.setdefault(text, []).append((lemma_id, gloss or ''))

    def lemma_id(lex, gloss):
        rows = by_text.get(nfc(lex), [])
        match = [i for i, g in rows if gloss and gloss in (g, *g.split('#'))]
        return (match or [i for i, _ in rows] or [None])[0]
    return lemma_id


def lemma_info(ids):
    """{id: [lemma, gloss, status]}: 'k' known (any same-spelled lemma known, as in the Atlas), 'l' learning, 'u' unknown."""
    rows = lemma_rows()
    known_text = {p for _, p, k, _ in rows if k}
    studied = {i for i, _, _, s in rows if s}
    return {l.lemma_id: [l.plaintext, l.translation or '', 'k' if l.plaintext in known_text else 'l' if l.lemma_id in studied else 'u']
            for l in Lemma.query.filter(Lemma.lemma_id.in_(ids))}


@reader.route('/api/reader/analyze', methods=['POST'])
def analyze():
    """{texts: [...]} (a page's paragraphs) -> {words: [[lemma id or null per Arabic word] per text, or null if
    Camelira didn't answer], lemmas: {id: [lemma, gloss, status]}}."""
    texts = request.get_json()['texts'][:100]
    analyses = analyse(texts)
    lemma_id = resolver()
    words = [None if an is None else [lemma_id(*a) if a else None for a in an] for an in analyses]
    ids = {i for ws in words if ws for i in ws if i}
    return jsonify({'words': words, 'lemmas': lemma_info(ids)})


@reader.route('/api/reader/flashcard', methods=['POST'])
def flashcard():
    """{arabic, english, target}: a sentence from a web page saved as a flashcard for the target lemma."""
    data = request.get_json()
    arabic = ' '.join(data['arabic'].split())
    [analysis] = analyse([arabic])
    if analysis is None:
        return jsonify({'error': "Camelira didn't answer: try again"}), 502
    lemma_id = resolver()
    ids = [lemma_id(*a) if a else None for a in analysis]
    per_token, k = [], 0
    for token in arabic.split():  # save_card links whitespace tokens; a token's lemma is its first Arabic run's
        n = len(WORD.findall(token))
        per_token.append(next((i for i in ids[k:k + n] if i), None))
        k += n
    try:
        sentence = save_card(arabic, data.get('english', ''), per_token, target=data.get('target'))
        db.session.commit()
        return jsonify({'success': True, 'sentence_id': sentence.sentence_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
