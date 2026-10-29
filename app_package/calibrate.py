"""
Calibration: finding which lemmas the learner knows without showing all ~40k.

Lemmas are ranked by ID (the spreadsheet's Score order) and cut into strata that grow x1.5,
since knowledge drops off roughly with log rank. Each stratum starts with a random page:
no unknowns -> the rest of the stratum is inferred known; any unknown -> the stratum is swept
in rank order. After a sweep, calibration only continues if the stratum was >15% known; a sweep
also ends early once it's clearly (95% confidence) under 15% known. Any stratum can also be
swept by hand later, with no early stop.
"""
import math
import random
from bisect import bisect_left, bisect_right
from flask import Blueprint, Response, jsonify, request
from .extensions import db
from .models import Lemma, CalibrationStep
from .database import mark_known
from .routes import lemma_json

calibrate = Blueprint('calibrate', __name__)

PAGE = 20
FIRST_STRATUM = 20
GROWTH = 1.5
CONTINUE_ABOVE = 0.15

def strata(last_id):
    bounds, lo, size = [], 1, FIRST_STRATUM
    while lo <= last_id:
        hi = min(last_id, lo + round(size) - 1)
        bounds.append((lo, hi))
        lo, size = hi + 1, size * GROWTH
    return bounds

def known_rate_upper(known, n, z=1.96):
    """Upper end of the 95% Wilson interval for a known rate (an all-unknown page of 20 is just above 15%)."""
    p = known / n
    return (p + z * z / (2 * n) + z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)

def group(rows):
    """Strata bounds plus the (lemma_id, known, source) rows in each; rows sorted by id."""
    bounds = strata(rows[-1][0])
    ids = [r[0] for r in rows]
    return bounds, [rows[bisect_left(ids, lo):bisect_right(ids, hi)] for lo, hi in bounds]

def next_page(groups, chosen=None, rng=random):
    """(stratum, mode, ids) to show next; mode is 'sample', 'sweep' or 'done'. `chosen` = stratum swept by hand."""
    if chosen is not None:
        ids = [r[0] for r in groups[chosen] if r[2] != 'user']
        return (chosen, 'sweep', ids[:PAGE]) if ids else (chosen, 'done', [])
    for i, g in enumerate(groups):
        unjudged = [r[0] for r in g if r[2] is None]
        if unjudged:
            judged = [r[1] for r in g if r[2] == 'user']
            if not all(judged):
                if known_rate_upper(sum(judged), len(judged)) < CONTINUE_ABOVE:
                    return i, 'done', []  # early stop: clearly under the bar, no need to finish the sweep
                return i, 'sweep', unjudged[:PAGE]
            return i, 'sample', rng.sample(unjudged, min(PAGE, len(unjudged)))
        swept = all(r[2] == 'user' for r in g)
        if swept and sum(r[1] for r in g) <= CONTINUE_ABOVE * len(g):
            return i, 'done', []
    return None, 'done', []

def rows():
    # Raw driver rows: ~3x faster than ORM rows for all ~40k lemmas
    return db.session.connection().exec_driver_sql('SELECT lemma_id, known, source FROM lemma ORDER BY lemma_id').fetchall()

def page_json(chosen=None, step=None):
    """The next page to judge, or a submitted `step` viewed again, plus history and per-stratum progress."""
    bounds, groups = group(rows())
    if step:
        stratum, mode, ids, manual, unknown = step.stratum, step.mode, step.ids, step.manual, step.unknown
    else:
        (stratum, mode, ids), manual, unknown = next_page(groups, chosen), chosen is not None, []
        if mode == 'done' and manual:  # hand sweep finished: back to the automatic flow
            (stratum, mode, ids), manual = next_page(groups), False
    lemmas = {l.lemma_id: l for l in Lemma.query.filter(Lemma.lemma_id.in_(ids))}
    return jsonify({
        'step_id': step.step_id if step else None,  # None: the next page, not yet submitted
        'steps': [i for (i,) in db.session.query(CalibrationStep.step_id).order_by(CalibrationStep.step_id)],
        'stratum': stratum,
        'mode': mode,
        'manual': manual,
        'unknown': unknown,  # as saved, for a submitted page
        'lemmas': [lemma_json(lemmas[i]) for i in ids],
        'strata': [{'lo': lo, 'hi': hi, 'size': len(g), 'known': sum(1 for r in g if r[1]),
                    'unknown': sum(1 for r in g if r[2] and not r[1])}  # judged unknown
                   for (lo, hi), g in zip(bounds, groups)],
    })

def judge(ids, unknown):
    for lemma in Lemma.query.filter(Lemma.lemma_id.in_(ids)):
        lemma.known, lemma.source = lemma.lemma_id not in unknown, 'user'

def infer_rest(stratum):
    """A clean sample page: every unjudged lemma in its stratum becomes known. Returns their prior states."""
    lo, hi = strata(db.session.query(db.func.max(Lemma.lemma_id)).scalar())[stratum]
    inferred = Lemma.query.filter(Lemma.lemma_id.between(lo, hi), Lemma.source.is_(None))
    before = {i: [k, None] for i, k in inferred.with_entities(Lemma.lemma_id, Lemma.known)}
    inferred.update({'known': True, 'source': 'inferred'}, synchronize_session=False)
    return before

@calibrate.route('/api/calibrate')
def calibrate_page():
    """?stratum=i sweeps that stratum by hand."""
    return page_json(request.args.get('stratum', type=int))

@calibrate.route('/api/calibrate/steps/<int:step_id>')
def calibrate_step(step_id):
    """A submitted page, viewed again from the history."""
    return page_json(step=db.get_or_404(CalibrationStep, step_id))

@calibrate.route('/api/calibrate', methods=['POST'])
def calibrate_submit():
    """Saves the next page {stratum, mode, manual, ids, unknown} and returns the one after it."""
    data = request.get_json()
    unknown = set(data['unknown'])
    try:
        judge(data['ids'], unknown)
        inferred = infer_rest(data['stratum']) if data['mode'] == 'sample' and not unknown else {}
        db.session.add(CalibrationStep(stratum=data['stratum'], mode=data['mode'], manual=data['manual'],
                                       ids=data['ids'], unknown=list(unknown), before=inferred))
        db.session.commit()
        return page_json(data['stratum'] if data['manual'] else None)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calibrate.route('/api/calibrate/steps/<int:step_id>', methods=['PUT'])
def calibrate_edit(step_id):
    """Re-saves a submitted page with new taps {unknown}. Later pages stay as they are; only this page's
    inference follows the edit: a clean sample that gains an unknown un-infers its stratum, and vice versa."""
    step = db.get_or_404(CalibrationStep, step_id)
    unknown = set(request.get_json()['unknown'])
    try:
        judge(step.ids, unknown)
        was_clean, now_clean = (step.mode == 'sample' and not u for u in (step.unknown, unknown))
        if was_clean and not now_clean:
            # only rows still inferred; anything judged since keeps that judgment
            prior = {int(i): k for i, (k, _) in (step.before or {}).items()}
            for known in (True, False):
                Lemma.query.filter(Lemma.lemma_id.in_([i for i, k in prior.items() if bool(k) == known]),
                                   Lemma.source == 'inferred').update({'known': known, 'source': None}, synchronize_session=False)
            step.before = {}
        elif now_clean and not was_clean:
            step.before = infer_rest(step.stratum)
        step.unknown = list(unknown)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calibrate.route('/api/reset-known', methods=['POST'])
def reset_known():
    """Every lemma back to unknown and unjudged, so calibration starts over (page history included)."""
    try:
        Lemma.query.update({'known': False, 'source': None}, synchronize_session=False)
        CalibrationStep.query.delete()
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calibrate.route('/api/import-known', methods=['POST'])
def import_known():
    """Replaces all knowledge with a knownwords.txt (request body), like a fresh seed; clears page history."""
    try:
        known, not_found = mark_known(request.get_data(as_text=True))
        CalibrationStep.query.delete()
        db.session.commit()
        return jsonify({'success': True, 'known': known, 'not_found': not_found})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calibrate.route('/api/knownwords.txt')
def export_known():
    """Known lemmas in rank order, in knownwords.txt's format (a lemma known in n senses appears n times)."""
    text = ', '.join(l.plaintext for l in Lemma.query.filter_by(known=True).order_by(Lemma.lemma_id))
    return Response(text, mimetype='text/plain',  # Flask adds charset=utf-8
                    headers={'Content-Disposition': 'attachment; filename=knownwords.txt'})


if __name__ == '__main__':
    # Self-check with a simulated learner who knows ranks 1-300 and nothing past 3000 (python -m app_package.calibrate)
    rng = random.Random(0)
    state = {i: [i % 7 == 0, None] for i in range(1, 40688)}  # [known, source]; i%7 stands in for knownwords.txt marks
    truth = {i: i <= 300 or (i <= 3000 and rng.random() < 0.3) for i in state}
    knows = truth.get
    modes = []
    while True:
        bounds, groups = group([(i, k, s) for i, (k, s) in state.items()])
        stratum, mode, ids = next_page(groups, rng=rng)
        modes.append((stratum, mode))
        if mode == 'done':
            break
        for i in ids:
            state[i] = [knows(i), 'user']
        if mode == 'sample' and all(knows(i) for i in ids):
            lo, hi = bounds[stratum]
            for i in range(lo, hi + 1):
                if state[i][1] is None:
                    state[i] = [True, 'inferred']
    sampled = {s for s, m in modes if m == 'sample'}
    swept = {s for s, m in modes if m == 'sweep'}
    print(f"{len(modes) - 1} pages; sampled strata {sorted(sampled)}; swept {sorted(swept)}; ended in {modes[-1][0]}")
    print('known rate per stratum:', [round(sum(r[1] for r in g) / len(g), 2) for g in groups])
    assert all(state[i][0] and state[i][1] in ('user', 'inferred') for i in range(1, 265)), "strata 0-4 sampled clean, rest inferred known"
    assert sampled >= set(range(12)) and swept == set(range(5, 12)), "each stratum is sampled first; 5+ contain unknowns so get swept"
    assert modes[-1][0] == 11, "2269-3421 (stratum 10) is ~19% known so it goes on; 3422-5151 is 0% known so it ends there"
    lo, hi = bounds[11]
    assert sum(state[i][1] == 'user' for i in range(lo, hi + 1)) == 2 * PAGE, "early stop after 2 all-unknown pages, not 87"
    assert known_rate_upper(0, 20) > CONTINUE_ABOVE > known_rate_upper(0, 40) and known_rate_upper(3, 40) > CONTINUE_ABOVE
    print("ok")
