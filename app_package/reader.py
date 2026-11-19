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

from flask import Blueprint, current_app, jsonify, request
from .extensions import db
from .models import Lemma, Sentence, bare, nfc
from .atlas import lemma_rows
from .routes import save_card
from .tatoeba_import import MAX_CHARS, chunks, lemmatize_batch

reader = Blueprint('reader', __name__)

# Letters and marks, Quranic ones too (not the standalone symbols ۞ ۩); keep in sync with chrome-extension/content.js
WORD = re.compile('[\u0621-\u063A\u0640-\u065F\u0670-\u06D3\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]+')
QURANIC = str.maketrans({'\u06E1': '\u0652', 'ٱ': 'ا'})  # Uthmani script's sukun, alif wasla
MARKS = re.compile('[\u0653-\u065F\u06D6-\u06ED]')  # what Camelira doesn't know: maddah left over, Quranic marks
CACHE_SIZE = 20000
_cache = OrderedDict()  # page text -> [(lex, gloss) or None per WORD], least recently used first


def plain(word):
    """A word in the script Camelira reads ('' for a run of marks alone, like a pause mark)."""
    # ponytail: a dagger alif after a tatweel is a written alif (أَعْطَيْنَـٰكَ); one on a letter stays, as Camelira reads
    # ذَٰلِكَ that way, though it then misses السَّمَٰوَٰتِ (السماوات): a word list would settle those
    return MARKS.sub('', nfc(word).translate(QURANIC).replace('ـٰ', 'ا'))


def analyse(texts):
    """For each text, (lex, stemgloss) or None (names, words Camelira can't analyse) per WORD; None for a text
    Camelira didn't answer. Long texts go in pieces; pieces share requests; answers are cached per text."""
    todo = [t for t in dict.fromkeys(texts) if t not in _cache and WORD.search(t)]
    items = [((k, j), piece) for k, t in enumerate(todo) for j, piece in enumerate(chunks(WORD.sub(lambda m: plain(m[0]), t)))]
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
            word, found = plain(word), None
            if not bare(word):
                out.append(None)
                continue
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
    """{id: [lemma, gloss, status, cards]}: status 'k' known (any same-spelled lemma known, as in Atlas), 'l' learning,
    'u' unknown; cards: a flashcard is for it (or a same-spelled lemma)."""
    rows = lemma_rows()
    known_text = {p for _, p, k, _ in rows if k}
    studied = {i for i, _, _, s in rows if s}
    carded = {p for (p,) in db.session.query(Lemma.plaintext).join(Sentence, Sentence.target_lemma_id == Lemma.lemma_id).distinct()}
    return {l.lemma_id: [l.plaintext, l.translation or '', 'k' if l.plaintext in known_text else 'l' if l.lemma_id in studied else 'u',
                         l.plaintext in carded]
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


def per_token_lemmas(arabic, analysis):
    """Lemma id per whitespace token of `arabic` (save_card links tokens): a token's is its first Arabic run's."""
    lemma_id = resolver()
    ids = [lemma_id(*a) if a else None for a in analysis]
    out, k = [], 0
    for token in arabic.split():
        n = len(WORD.findall(token))
        out.append(next((i for i in ids[k:k + n] if i), None))
        k += n
    return out


@reader.route('/api/reader/flashcard', methods=['POST'])
def flashcard():
    """{arabic, english, target}: a sentence from a web page saved as a flashcard for the target lemma."""
    data = request.get_json()
    arabic = ' '.join(data['arabic'].split())
    [analysis] = analyse([arabic])
    if analysis is None:
        return jsonify({'error': "Camelira didn't answer: try again"}), 502
    try:
        sentence = save_card(arabic, data.get('english', ''), per_token_lemmas(arabic, analysis), target=data.get('target'))
        db.session.commit()
        return jsonify({'success': True, 'sentence_id': sentence.sentence_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reader.route('/api/reader/flashcards', methods=['POST'])
def flashcards():
    """{items: [{arabic, english, target}]}: the side panel's i+1 sentences saved as flashcards. Missing English is
    translated; sentences already in the deck are skipped. Returns {added, skipped, failed: [arabic, ...]}."""
    from .routes import translate
    items = [dict(it, arabic=' '.join(it['arabic'].split())) for it in request.get_json()['items'][:50]]
    analyses = analyse([it['arabic'] for it in items])
    have = {t for (t,) in db.session.query(Sentence.plaintext).filter(Sentence.plaintext.in_([it['arabic'] for it in items]))}
    added, skipped, failed = 0, 0, []
    for it, analysis in zip(items, analyses):
        if it['arabic'] in have:
            skipped += 1
            continue
        try:
            if analysis is None:
                raise RuntimeError("Camelira didn't answer")
            english = (it.get('english') or '').strip() or translate(it['arabic'])
            save_card(it['arabic'], english, per_token_lemmas(it['arabic'], analysis), target=it.get('target'))
            db.session.commit()
            have.add(it['arabic'])
            added += 1
        except Exception as e:
            db.session.rollback()
            current_app.logger.warning('Panel flashcard failed: %s', e)
            failed.append(it['arabic'])
    return jsonify({'added': added, 'skipped': skipped, 'failed': failed})
