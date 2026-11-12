"""
Spaced repetition for the Flashcards page.

Each word you study gets two numbers:
  L (p_learned)  Bayesian knowledge tracing's probability that you've learned it. It sets the status:
                 learning while L < 95%, known from there; a known word drops back to learning only below 80%.
  S (stability)  days until recall falls to 90%. Recall decays as R = 0.9^(days / S), so a word is due S days
                 after its last review, when R reaches the 90% target.
R sits inside BKT's slip term: a miss long after the last review is mostly explained by forgetting, so it
shortens S a lot but barely dents L. Words never studied (L is None, e.g. known from calibration) aren't scheduled.

Cards are sentences. The card's target word gets a full observation, every other studied word in it a weaker one,
and a word you tap as missed counts as missed. New words come from deck sentences that are i+1 for them, then
from the Atlas's Tatoeba sentences (added to the deck when first shown).
"""
import math
import random
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from .extensions import db
from .models import Lemma, Review, Sentence, Setting, TatoebaDiac, TatoebaSentence, Word, WordInstance, bare
from .atlas import align, comprehensible, in_deck, known_ids, lemma_rows, sentences
from .routes import clean_punctuation, save_card
from .tatoeba_import import MAX_CHARS, SEP, camelira

srs = Blueprint('srs', __name__)

L0, T, SLIP, GUESS, CTX_GUESS, S0 = 0.1, 0.2, 0.05, 0.2, 0.45, 1.0
KNOWN_AT, DEMOTE_AT = 0.95, 0.8
MAX_NEW = 50  # the slider's top


def recall(S, days):
    return 0.9 ** (max(0.0, days) / S)

def introduce(L):
    """First sight of a word, shown with its meaning: (L, S)."""
    return L + (1 - L) * T, S0

def update(L, S, days, ok, status, target=True):
    """One graded observation `days` after the last review: (L, S, status)."""
    R = recall(S, days)
    hit, g = (1 - SLIP) * R, GUESS if target else CTX_GUESS
    post = L * hit / (L * hit + (1 - L) * g) if ok else L * (1 - hit) / (L * (1 - hit) + (1 - L) * (1 - g))
    L = post + (1 - post) * (T if target else T / 3)
    weight = 1 if target else 0.5  # passing a word in context is weaker evidence
    S = S * (1 + weight * (1 + 10 * (1 - R))) if ok else max(0.2, S * (0.35 if target else 0.6))  # spacing effect: the more forgotten, the more a success grows S
    status = 'learning' if status == 'unknown' else status
    if L >= KNOWN_AT:
        status = 'known'
    elif status == 'known' and L < DEMOTE_AT:
        status = 'learning'
    return L, S, status


def status_of(l):
    return 'known' if l.known else 'learning' if l.p_learned is not None else 'unknown'

def apply(l, role, ok, now, sentence_id):
    if role == 'intro':  # first sight, graded on whether you could tell the meaning from the sentence
        l.p_learned, l.stability = introduce(l.p_learned or L0)
        l.p_learned, l.stability, status = update(l.p_learned, l.stability, 0, ok, 'learning')
        l.reps = (l.reps or 0) + 1
    else:
        if l.p_learned is None:  # first evidence on an unstudied word (only misses get here, so it should come back soon)
            l.p_learned, l.stability, l.last_review = (0.97 if l.known else L0), S0, now
        days = (now - l.last_review).total_seconds() / 86400
        l.p_learned, l.stability, status = update(l.p_learned, l.stability, days, ok, status_of(l), role == 'target')
        l.reps = (l.reps or 0) + 1
        l.lapses = (l.lapses or 0) + (0 if ok else 1)
    l.known = status == 'known'
    l.last_review, l.due = now, now + timedelta(days=l.stability)
    db.session.add(Review(at=now, lemma_id=l.lemma_id, sentence_id=sentence_id, role=role, ok=ok))


def new_per_day():
    s = db.session.get(Setting, 'new_per_day')
    return int(s.value) if s else 5

def card(ar, en, ids, target, lemmas, sentence_id=None, tatoeba_id=None):
    """A sentence as a card: words are [token, lemma id, lemma, gloss, L or None]."""
    def word(token, i):
        l = lemmas.get(i)
        return [token, i, l.plaintext, l.translation, l.p_learned] if l else [token, None, None, None, None]
    return {'sentence_id': sentence_id, 'tatoeba_id': tatoeba_id, 'target': target, 'ar': ar, 'en': en,
            'words': [word(t, i) for t, i in zip(ar.split(), ids)]}


@srs.route('/api/srs')
def queue():
    """Today's due reviews, up to MAX_NEW new-word cards in order, history, learning words and forecast inputs.
    ?tz= is the browser's getTimezoneOffset(), so "today" is the learner's day.
    ?practice: instead of today's reviews, a card for every word you've studied, shuffled (free practice: the
    page doesn't record these, so they don't change your schedule)."""
    practice = 'practice' in request.args
    tz = timedelta(minutes=request.args.get('tz', 0, type=int))
    now = datetime.utcnow()
    today = (now - tz).replace(hour=0, minute=0, second=0, microsecond=0) + tz  # local midnight, in UTC
    tomorrow = today + timedelta(days=1)

    # Deck sentences by their linked lemmas
    links = {}
    for sid, index, lid in (db.session.query(WordInstance.sentence_id, WordInstance.index, Word.lemma_id)
                            .join(Word, Word.word_id == WordInstance.word_id)
                            .join(Sentence, Sentence.sentence_id == WordInstance.sentence_id)
                            .filter(Sentence.complete, Word.lemma_id.isnot(None))):
        links.setdefault(sid, {})[index] = lid
    by_lemma = {}
    for sid, idx in links.items():
        for lid in idx.values():
            by_lemma.setdefault(lid, set()).add(sid)
    deck = {s.sentence_id: s for s in Sentence.query.filter(Sentence.sentence_id.in_(links))}

    # Reviews: due words that appear in a deck sentence, each with a sentence not already used today if possible
    due, used = [], set()
    for l in Lemma.query.filter(Lemma.p_learned.isnot(None) if practice else Lemma.due < tomorrow).order_by(Lemma.due):
        options = sorted(by_lemma.get(l.lemma_id, ()))
        if options:
            fresh = [s for s in options if s not in used] or options
            sid = random.choice(fresh)
            used.add(sid)
            due.append((l.lemma_id, sid))
    if practice:
        random.shuffle(due)

    # New words: the most frequent unknown words with an i+1 sentence, from the deck first, then Tatoeba
    rows = lemma_rows()
    known = known_ids(rows)
    new = {}
    for sid, idx in links.items():
        unknown = set(idx.values()) - known
        if len(unknown) == 1:
            new.setdefault(unknown.pop(), ('deck', sid))
    ready = comprehensible(known)
    deck_text = in_deck()
    for lid, opts in ready.items():
        best = next((s for s in opts if s[1] not in deck_text), None)
        if best:
            new.setdefault(lid, ('tatoeba', best))
    new = sorted(new.items())[:MAX_NEW]

    ids = {i for idx in links.values() for i in idx.values()}
    ids |= {i for _, (kind, s) in new if kind == 'tatoeba' for i in align(s[1], s[3]) if i}
    lemmas = {l.lemma_id: l for l in Lemma.query.filter(Lemma.lemma_id.in_(ids))}

    def deck_card(target, sid):
        s = deck[sid]
        return card(s.plaintext, s.translation, [links[sid].get(i) for i in range(len(s.plaintext.split()))], target, lemmas, sentence_id=sid)

    new_cards = [deck_card(lid, src) if kind == 'deck' else card(src[1], src[2], align(src[1], src[3]), lid, lemmas, tatoeba_id=src[0])
                 for lid, (kind, src) in new]

    # Heatmap: cards reviewed per local day (context words aren't separate reviews)
    history = {}
    for (at,) in db.session.query(Review.at).filter(Review.role != 'context', Review.at >= today - timedelta(days=400)):
        key = (at - tz).date().isoformat()
        history[key] = history.get(key, 0) + 1
    new_today = db.session.query(Review.lemma_id).filter(Review.role == 'intro', Review.at >= today).distinct().count()

    studied = Lemma.query.filter(Lemma.p_learned.isnot(None)).all()
    days_since = lambda l: (now - l.last_review).total_seconds() / 86400
    return jsonify({
        'due': [deck_card(lid, sid) for lid, sid in due],
        'new': new_cards,
        'newPerDay': new_per_day(),
        'newToday': new_today,
        'history': history,
        'states': [[l.p_learned, l.stability, -days_since(l), status_of(l)] for l in studied],  # forecast input
        'learning': [{'lemma_id': l.lemma_id, 'plaintext': l.plaintext, 'translation': l.translation, 'L': l.p_learned,
                      'due': (l.due - now).total_seconds() / 86400, 'reps': l.reps or 0, 'lapses': l.lapses or 0}
                     for l in sorted(studied, key=lambda l: l.due) if not l.known],
    })


@srs.route('/api/srs/review', methods=['POST'])
def review_card():
    """{target, lemmas: [ids in the card], missed: [ids], ok, intro, sentence_id | tatoeba_id}: records one card.
    Returns the new L of every word that changed and when the target is next due."""
    data = request.get_json()
    try:
        now = datetime.utcnow()
        sid = data.get('sentence_id')
        if sid is None and data.get('tatoeba_id') is not None:  # a Tatoeba sentence joins the deck when first shown
            s = next(s for s in sentences() if s[0] == data['tatoeba_id'])
            existing = Sentence.query.filter_by(plaintext=s[1]).first()
            sentence = existing or save_card(s[1], s[2], align(s[1], s[3]))
            sentence.diac = sentence.diac or (db.session.get(TatoebaDiac, s[0]) or TatoebaDiac()).diac
            sid = sentence.sentence_id
        target, missed = data['target'], set(data.get('missed', []))
        changed = {}
        for l in Lemma.query.filter(Lemma.lemma_id.in_(set(data['lemmas']) | {target})):
            if l.lemma_id == target:
                apply(l, 'intro' if data.get('intro') else 'target', bool(data['ok']) and target not in missed, now, sid)
            elif l.lemma_id in missed or l.p_learned is not None:
                apply(l, 'context', l.lemma_id not in missed, now, sid)
            else:
                continue
            changed[l.lemma_id] = {'L': l.p_learned, 'status': status_of(l)}
        db.session.commit()
        t = db.session.get(Lemma, target)
        return jsonify({'sentence_id': sid, 'changed': changed, 'next': t.stability, 'status': status_of(t)})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


HARAKAT = re.compile('[ً-ْ]')

def diacritize(texts):
    """Each text with Camelira's diacritized words swapped in, keeping its whitespace tokens and punctuation
    (None where Camelira didn't answer)."""
    batches, batch, size = [], [], 0
    for i, t in enumerate(texts):
        if batch and size + len(t) + 3 > MAX_CHARS:
            batches.append(batch); batch, size = [], 0
        batch.append(i); size += len(t) + 3
    if batch:
        batches.append(batch)

    def run(batch):  # [(i, [(word, diac)])]
        result = camelira(f' {SEP} '.join(texts[i] for i in batch), tries=2, timeout=15)
        if result is None:
            return [(i, None) for i in batch]
        out, cur = [], []
        for w in result:
            if w['word'] == SEP:
                out.append(cur); cur = []
            else:
                cur.append((w['word'], w['analyses'][0]['analysis'].get('diac') if w['analyses'] else None))
        out.append(cur)
        if len(out) != len(batch):  # split oddly: one by one
            return [r for i in batch for r in run([i])] if len(batch) > 1 else [(batch[0], None)]
        return list(zip(batch, out))

    result = [None] * len(texts)
    with ThreadPoolExecutor(4) as pool:
        for part in pool.map(run, batches):
            for i, words in part:
                if words is None:
                    continue
                tokens, j = [], 0
                for raw in texts[i].split():
                    core, diac = clean_punctuation(raw), None
                    for k in range(j, len(words)):
                        if core and bare(words[k][0]) == bare(core):
                            diac, j = words[k][1], k + 1
                            break
                    tokens.append(raw.replace(core, diac, 1) if diac and core in raw else raw)
                result[i] = ' '.join(tokens)
    return result

@srs.route('/api/srs/diac', methods=['POST'])
def diac():
    """{cards: [{sentence_id | tatoeba_id}]} -> {'s12' | 't345': diacritized text}, computed once and stored."""
    items = []  # (key, plain text, the row that keeps its diacritics)
    for c in request.get_json()['cards']:
        if c.get('sentence_id') is not None:
            s = db.session.get(Sentence, c['sentence_id'])
            if s:
                items.append(('s%d' % s.sentence_id, s.plaintext, s))
        elif c.get('tatoeba_id') is not None:
            t = db.session.get(TatoebaSentence, c['tatoeba_id'])
            if t:
                items.append(('t%d' % t.tatoeba_id, t.ar, db.session.get(TatoebaDiac, t.tatoeba_id) or TatoebaDiac(tatoeba_id=t.tatoeba_id)))
    todo = [(text, row) for _, text, row in items if not row.diac]
    for text, row in todo:  # typed with diacritics already (about one per word, e.g. Library sentences): keep them
        if len(HARAKAT.findall(text)) >= len(text.split()):
            row.diac = text
    todo = [(text, row) for text, row in todo if not row.diac]
    if todo:
        try:
            for (_, row), diac in zip(todo, diacritize([text for text, _ in todo])):
                row.diac = diac  # None if Camelira didn't answer: plain text this time, tried again next time
        except Exception as e:
            print(f'Diacritizing failed: {e}')
    for _, _, row in items:
        if row.diac:
            db.session.add(row)  # new cache rows; a no-op for rows already saved
    db.session.commit()
    return jsonify({key: row.diac for key, _, row in items if row.diac})


@srs.route('/api/srs/settings', methods=['POST'])
def settings():
    n = max(0, min(MAX_NEW, int(request.get_json()['newPerDay'])))
    s = db.session.get(Setting, 'new_per_day') or Setting(key='new_per_day')
    s.value = str(n)
    db.session.add(s)
    db.session.commit()
    return jsonify({'newPerDay': n})


if __name__ == '__main__':  # python -m app_package.srs: the model's behaviour, as asserts
    L, S = introduce(L0)
    status, t, history = 'learning', 0.0, []
    for _ in range(3):  # correct on each due date
        t += S
        L, S, status = update(L, S, S, True, status)
        history.append(status)
    assert history == ['learning', 'learning', 'known'] and round(t) == 13, (history, t)
    L1, S1, s1 = update(0.97, 120, 150, False, 'known')  # a lapse after a long break: still known, shorter interval
    assert s1 == 'known' and S1 < 120, (L1, S1, s1)
    L2, S2, s2 = update(L1, S1, S1, False, s1)  # a second lapse in a row: back to learning
    assert s2 == 'learning', (L2, s2)
    assert math.isclose(recall(10, 10), 0.9)
    print('ok')
