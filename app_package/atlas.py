"""
Atlas: a heatmap of every lemma, word details with Tatoeba i+1 sentences, and filling the deck with them.

A sentence is i+1 for a word when that word is its only unknown lemma. Lemmas count as known when any
lemma with the same spelling is known (homographs are indistinguishable in running text).
"""
from flask import Blueprint, jsonify, request
from .extensions import db
from .models import Lemma, Sentence, TatoebaSentence, bare
from .routes import clean_punctuation, lemma_json, save_card

atlas = Blueprint('atlas', __name__)

_sentences = None  # ponytail: per-worker cache of the static Tatoeba table; restart the app after re-importing

def sentences():
    global _sentences
    if _sentences is None:
        _sentences = [(s.tatoeba_id, s.ar, s.en, s.tokens, frozenset(s.lemmas))
                      for s in TatoebaSentence.query.filter_by(unresolved=0)]
    return _sentences

def lemma_rows():
    """(lemma_id, plaintext, known, studied) by rank; studied = has spaced-repetition state (learning or known)."""
    return db.session.connection().exec_driver_sql(
        'SELECT lemma_id, plaintext, known, p_learned IS NOT NULL FROM lemma ORDER BY lemma_id').fetchall()

def known_ids(rows):
    """Lemmas a sentence can use: known ones, and ones you're learning, so new sentences keep coming while you review."""
    known_text = {p for _, p, k, studied in rows if k or studied}
    return {i for i, p, _, _ in rows if p in known_text}

def comprehensible(known):
    """{lemma_id: [sentence, ...]}: for each lemma, the sentences it is the only unknown in, shortest first."""
    out = {}
    for s in sentences():
        unknown = [l for l in s[4] if l not in known]
        if len(unknown) == 1:
            out.setdefault(unknown[0], []).append(s)
    for v in out.values():
        v.sort(key=lambda s: len(s[1]))
    return out

def in_deck():
    return {t for (t,) in db.session.query(Sentence.plaintext)}

def align(ar, tokens):
    """Lemma id for each whitespace token of `ar`, matched in order to Camelira's tokens on their bare form."""
    out, j = [], 0
    for raw in ar.split():
        word, found = bare(clean_punctuation(raw)), None
        for k in range(j, len(tokens)):
            if word and bare(tokens[k][0]) == word:
                found, j = tokens[k][1], k + 1
                break
        out.append(found)
    return out

def sentence_json(s, target, deck, known=None):
    """Words are [token, is the target, lemma id, unknown]; `unknown` needs `known` (else False)."""
    ids = align(s[1], s[3])
    return {'id': s[0], 'ar': s[1], 'en': s[2], 'in_deck': s[1] in deck,
            'words': [[w, i == target, i, known is not None and i is not None and i not in known] for w, i in zip(s[1].split(), ids)]}

def with_dictionary(payload, sentence_lists):
    """Adds {lemma_id: [lemma, gloss]} for every word in the sentences, for the popup dictionary."""
    ids = {w[2] for ss in sentence_lists for s in ss for w in s['words'] if w[2]}
    payload['dictionary'] = {l.lemma_id: [l.plaintext, l.translation] for l in Lemma.query.filter(Lemma.lemma_id.in_(ids))}
    return payload

def frontier(n, known, by_lemma, deck):
    """The top-ranked unknown lemmas that have i+1 sentences not yet in the deck, each with its options."""
    out = []
    for lemma_id in sorted(by_lemma):
        options = [s for s in by_lemma[lemma_id] if s[1] not in deck]
        if options:
            out.append((lemma_id, options))
            if len(out) >= n:
                break
    lemmas = {l.lemma_id: l for l in Lemma.query.filter(Lemma.lemma_id.in_([i for i, _ in out]))}
    return [{**lemma_json(lemmas[i]), 'sentences': [sentence_json(s, i, deck) for s in opts[:8]], 'count': len(opts)} for i, opts in out]


@atlas.route('/api/atlas')
def summary():
    """Every lemma's status as one character by rank ('k' known, 'u' unknown: anything not known),
    plus how many i+1 sentences could be added and for how many words."""
    rows = lemma_rows()
    states = ['u'] * rows[-1][0]
    for i, _, k, _ in rows:
        if k:
            states[i - 1] = 'k'
    deck = in_deck()
    by_lemma = comprehensible(known_ids(rows))
    ready = [l for l, ss in by_lemma.items() if any(s[1] not in deck for s in ss)]
    return jsonify({'states': ''.join(states), 'ready': sum(1 for ss in by_lemma.values() for s in ss if s[1] not in deck), 'words': len(ready)})

@atlas.route('/api/atlas/lemmas')
def all_lemmas():
    """Every lemma's text by rank, '|'-separated, for heatmap tooltips."""
    return '|'.join(p for _, p, _, _ in lemma_rows()), 200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=3600'}

MIN_SENTENCES = 3

@atlas.route('/api/atlas/occurrences')
def occurrences():
    """Every lemma's corpus frequency by rank, comma-separated: the progress header works out text coverage from it."""
    rows = db.session.connection().exec_driver_sql('SELECT lemma_id, occurrences FROM lemma ORDER BY lemma_id').fetchall()
    occ = [0] * rows[-1][0]
    for i, o in rows:
        occ[i - 1] = o or 0
    return ','.join(map(str, occ)), 200, {'Content-Type': 'text/plain', 'Cache-Control': 'max-age=3600'}

@atlas.route('/api/atlas/word/<int:lemma_id>')
def word(lemma_id):
    """A lemma with its Tatoeba sentences that are comprehensible given this word (i+1 if it's unknown).
    With fewer than MIN_SENTENCES of those, i+2 sentences (one other unknown word) fill up to it, the ones whose
    other unknown word is most frequent first: learning that word unlocks them."""
    lemma = db.get_or_404(Lemma, lemma_id)
    rows = lemma_rows()
    known = known_ids(rows) - {lemma_id}  # as if this word were the one new word
    deck = in_deck()
    hits, near = [], []
    for s in sentences():
        if lemma_id in s[4]:
            other = s[4] - known - {lemma_id}
            if not other:
                hits.append(s)
            elif len(other) == 1:
                near.append((min(other), len(s[1]), s))
    hits.sort(key=lambda s: len(s[1]))
    near.sort(key=lambda n: n[:2])
    sents = [sentence_json(s, lemma_id, deck, known) for s in hits[:20]]
    sents += [{**sentence_json(s, lemma_id, deck, known), 'plus': 2} for _, _, s in near[:max(0, MIN_SENTENCES - len(hits))]]
    return jsonify(with_dictionary({**lemma_json(lemma), 'sentences': sents, 'count': len(hits)}, [sents]))

@atlas.route('/api/atlas/frontier')
def frontier_route():
    """?n= top unknown words with i+1 sentences ready, best (shortest) option first, for the slider and suggestions."""
    rows = lemma_rows()
    known = known_ids(rows)
    words = frontier(min(request.args.get('n', 12, type=int), 200), known, comprehensible(known), in_deck())
    return jsonify(with_dictionary({'words': words}, [w['sentences'] for w in words]))

@atlas.route('/api/atlas/add', methods=['POST'])
def add():
    """Adds Tatoeba sentences {ids: [...]} to the deck as complete flashcards."""
    wanted = set(request.get_json()['ids'])
    deck = in_deck()
    try:
        added = 0
        for s in sentences():
            if s[0] in wanted and s[1] not in deck:
                save_card(s[1], s[2], align(s[1], s[3]))
                deck.add(s[1])
                added += 1
        db.session.commit()
        return jsonify({'success': True, 'added': added})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
