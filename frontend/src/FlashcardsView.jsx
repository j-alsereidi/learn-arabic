import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Eye, Check, X, Sparkles, CalendarDays, Layers, Flame, TriangleAlert, RotateCw, Loader, GraduationCap } from 'lucide-react';
import { formatGloss } from './Gloss';

const API_BASE = process.env.REACT_APP_API_URL || '';
const TZ = new Date().getTimezoneOffset();
const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;
const firstSense = (gloss) => formatGloss(gloss).split('; ')[0];
const days = (d) => d < 1 / 24 ? 'now' : d < 1 ? Math.round(d * 24) + 'h' : d < 60 ? Math.round(d) + 'd' : d < 730 ? Math.round(d / 30) + 'mo' : (d / 365).toFixed(1) + 'y';
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ---- forecast: app_package/srs.py's model run forward (keep the two in sync) ----
const T = 0.2, SLIP = 0.05, GUESS = 0.2, KNOWN_AT = 0.95, DEMOTE_AT = 0.8, RETENTION = 0.9;
const recall = (S, d) => Math.pow(0.9, Math.max(0, d) / S);
function update(w, ok, t) {
  const R = recall(w.S, t - w.last), hit = (1 - SLIP) * R;
  const post = ok ? w.L * hit / (w.L * hit + (1 - w.L) * GUESS) : w.L * (1 - hit) / (w.L * (1 - hit) + (1 - w.L) * (1 - GUESS));
  const L = post + (1 - post) * T;
  const status = L >= KNOWN_AT ? 'known' : w.status === 'known' && L >= DEMOTE_AT ? 'known' : 'learning';
  return { L, S: ok ? w.S * (2 + 10 * (1 - R)) : Math.max(0.2, w.S * 0.35), last: t, status };
}
function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Expected reviews per day for the words you've studied so far: each due review is answered at the 90% target
// and reschedules the word, so later re-reviews count too. New words aren't included, so it tapers off as
// words settle. A backlog is spread over a week.
function forecast(states, horizon = 90, runs = 6) {
  const out = new Float64Array(horizon);
  for (let run = 0; run < runs; run++) {
    const r = rng(1000 + run);
    const ws = states.map(([L, S, last, status]) => ({ L, S, last, status, due: last + S < 0 ? r() * 7 : last + S }));
    for (let d = 0; d < horizon; d++) {
      for (const w of ws) {
        if (w.due >= d + 1) continue;
        const t = Math.max(d + 0.5, w.due), ok = r() < RETENTION;
        out[d] += (ok ? 1 : 2) / runs;  // a miss comes back once more in the same session
        Object.assign(w, update(w, ok, t)); w.due = w.last + w.S;
      }
    }
  }
  return out;
}

// ---- the number in the headline: drops in from above whenever it goes down ----
const Tick = ({ value }) => {
  const prev = useRef(value), [n, setN] = useState(0);
  useEffect(() => { if (value < prev.current) setN(k => k + 1); prev.current = value; }, [value]);
  return <span key={n} className={n ? 'fc-tick' : 'inline-block'}>{value}</span>;
};

// ---- calendar heatmap: past reviews in green, the forecast in indigo ----
const PAST = ['#1f8a57', '#27ad6c', '#34d399', '#86efac'], FUTURE = ['#1c2350', '#2c3577', '#4a52b8', '#818cf8'];
const Heatmap = ({ past, future }) => {
  const ref = useRef(null), [width, setWidth] = useState(800), [tip, setTip] = useState(null);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const cell = 12, gap = 3, step = cell + gap, left = 22, top = 18;
  const fit = Math.max(16, Math.min(40, Math.floor((width - left) / 17)));
  const ahead = Math.min(12, Math.round(fit / 3)), back = fit - ahead - 1, weeks = back + ahead + 1;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7, start = -(back * 7 + dow);  // Monday-first columns
  const dateAt = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d; };
  const all = [...Object.values(past), ...future].filter(v => v >= 0.5).sort((a, b) => a - b);
  const top90 = all[Math.floor(all.length * 0.9)] || 1;
  const shade = (v, pal) => pal[Math.min(3, Math.floor(4 * v / (top90 + 1)))];
  const cells = [], months = [];
  let lastMonth = -1, lastLabel = -9;
  for (let w = 0; w < weeks; w++) {
    const first = dateAt(start + w * 7);
    if (first.getMonth() !== lastMonth) {
      lastMonth = first.getMonth();
      if (w < weeks - 2 && w - lastLabel >= 3) { lastLabel = w; months.push([w, first.toLocaleString('en', { month: 'short' })]); }
    }
    for (let d = 0; d < 7; d++) {
      const off = start + w * 7 + d;
      if (off > ahead * 7 + (6 - dow)) continue;
      const v = off < 0 ? past[localDay(dateAt(off))] || 0 : future[off] || 0;
      const fill = off < 0 ? (v ? shade(v, PAST) : '#111a2e') : (v >= 0.5 ? shade(v, FUTURE) : '#111a2e');
      cells.push(<rect key={off} x={left + w * step} y={top + d * step} width={cell} height={cell} rx={3} fill={fill}
        stroke={off === 0 ? '#fff' : undefined} strokeWidth={1.5} data-off={off} data-v={v} />);
    }
  }
  const onMove = (e) => {
    const off = e.target.dataset?.off;
    if (off === undefined) return setTip(null);
    const o = +off, v = Math.round(+e.target.dataset.v);
    const date = dateAt(o).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
    setTip({ x: e.clientX, y: e.clientY, date, text: o < 0 ? (v ? `${v} reviews` : 'No reviews') : o === 0 ? `Today: ${v} cards` : `Forecast: ≈ ${v} reviews` });
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${left + weeks * step} ${top + 7 * step}`} className="block w-full h-auto" role="img" aria-label="Review heatmap">
        {months.map(([w, m]) => <text key={w} x={left + w * step} y={11} fill="#55627a" fontSize={10}>{m}</text>)}
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, d) => <text key={d} x={4} y={top + d * step + 10} fill="#55627a" fontSize={10}>{l}</text>)}
        {cells}
      </svg>
      {tip && (
        <div className="fixed z-50 pointer-events-none bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs shadow-xl"
             style={{ left: Math.min(tip.x + 12, window.innerWidth - 180), top: tip.y + 14 }}>
          <b className="text-slate-200">{tip.date}</b><br /><span className="text-slate-400">{tip.text}</span>
        </div>
      )}
    </div>
  );
};

function streaks(history) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const has = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return !!history[localDay(d)]; };
  let current = 0;
  for (let off = has(0) ? 0 : -1; has(off); off--) current++;
  let longest = 0, run = 0;
  for (let off = -400; off <= 0; off++) { run = has(off) ? run + 1 : 0; longest = Math.max(longest, run); }
  return { current, longest, total: Object.values(history).reduce((a, b) => a + b, 0) };
}

// ---- the review session: a pure step from one state to the next ----
const newLeft = (s) => Math.max(0, Math.min(s.newPerDay - s.newToday, s.newCards.length) - s.newShown);
function pick(s) {  // a new word after every two reviews, or whenever reviews run out
  const fresh = { flipped: false, missed: new Set(), busy: false, error: false };
  if (s.requeue) s = { ...s, requeue: null, reviews: [...s.reviews.slice(0, 2), s.requeue, ...s.reviews.slice(2)] };  // a miss comes back a few cards later
  if (newLeft(s) > 0 && (s.reviews.length === 0 || s.done % 3 === 2))
    return { ...s, ...fresh, cur: { card: s.newCards[s.newShown], isNew: true }, newShown: s.newShown + 1 };
  if (s.reviews.length) return { ...s, ...fresh, cur: { card: s.reviews[0], isNew: false }, reviews: s.reviews.slice(1) };
  return { ...s, ...fresh, cur: null };
}

// onTutor: go to the Tutor (offered once today's cards are done)
const FlashcardsView = ({ onTutor }) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [s, setS] = useState(null);
  const ref = useRef(s); ref.current = s;
  const [swipe, setSwipe] = useState(() => window.matchMedia('(max-width: 767px), (pointer: coarse)').matches);
  const cardRef = useRef(null), drag = useRef(null), saveTimer = useRef(null);
  const [draftNew, setDraftNew] = useState(null);  // the slider while it's held: only the heatmap follows it
  const [diac, setDiac] = useState({});  // card key -> diacritized sentence
  const [diacReady, setDiacReady] = useState(false);
  const [practiceState, setPracticeState] = useState(null); // free practice once you're done: null, 'loading', or 'none' to practise
  const keyOf = (c) => c.tatoeba_id != null ? `t${c.tatoeba_id}` : `s${c.sentence_id}`;
  const diacOf = (c) => c.diac ?? diac[keyOf(c)];
  const fetchDiac = (cards) => cards.length ? fetch(`${API_BASE}/api/srs/diac`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards: cards.map(c => ({ sentence_id: c.sentence_id, tatoeba_id: c.tatoeba_id })) }),
  }).then(r => r.json()).then(d => setDiac(p => ({ ...p, ...d }))).catch(err => console.error('Diacritics failed:', err)) : Promise.resolve();

  // History, learning words and forecast inputs; doneAtLoad keeps this session's cards from being counted twice
  const refresh = () => fetch(`${API_BASE}/api/srs?tz=${TZ}`).then(r => r.json()).then(d => setData({ ...d, doneAtLoad: ref.current?.done ?? 0 }));

  useEffect(() => {
    fetch(`${API_BASE}/api/srs?tz=${TZ}`).then(r => r.json()).then(d => {
      setData({ ...d, doneAtLoad: 0 });
      setS(pick({ reviews: d.due, newCards: d.new, newShown: 0, newPerDay: d.newPerDay, newToday: d.newToday, done: 0 }));
      // diacritics for today's cards (computed once per sentence, then stored); wait briefly so the first card doesn't change
      const today = [...d.due, ...d.new.slice(0, Math.max(0, d.newPerDay - d.newToday))];
      Promise.race([fetchDiac(today), new Promise(r => setTimeout(r, 3000))]).then(() => setDiacReady(true));
    }).catch(() => setFailed(true));
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const onChange = (e) => setSwipe(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const grade = async (ok) => {
    const st = ref.current;
    if (!st?.cur || st.busy) return;
    const { card, isNew } = st.cur;
    const missedIds = [...st.missed].map(i => card.words[i][1]).filter(Boolean);
    setS(p => ({ ...p, busy: true, flipped: true, error: false }));
    const dir = ok ? 1 : -1, el = cardRef.current;
    const fling = () => {  // right for correct, left for missed (a swipe has already thrown it); the next card slides in from the other side
      if (el && !swipe) {
        el.style.transition = 'transform .15s ease-out, opacity .15s ease-out';
        el.style.transform = `translateX(${dir * 120}%) rotate(${dir * 5}deg)`;
        el.style.opacity = 0;
      }
    };
    if (st.practice) {  // free practice: nothing recorded, nothing comes back
      fling();
      return setTimeout(() => setS(p => pick({ ...p, done: p.done + 1, enter: dir > 0 ? 'l' : 'r' })), 150);
    }
    let res;
    try {
      const r = await fetch(`${API_BASE}/api/srs/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: card.target, lemmas: card.words.map(w => w[1]).filter(Boolean), missed: missedIds, ok, intro: isNew,
                               sentence_id: card.sentence_id, tatoeba_id: card.tatoeba_id }),
      });
      res = await r.json();
      if (!r.ok) throw new Error(res.error);
    } catch (e) {
      console.error('Review not saved:', e);
      if (cardRef.current) cardRef.current.style.transform = '';
      return setS(p => ({ ...p, busy: false, error: true }));
    }
    const targetOk = ok && !missedIds.includes(card.target);
    setS(p => ({ ...p, requeue: targetOk ? null : { ...card, sentence_id: res.sentence_id, tatoeba_id: null, diac: diacOf(card) } }));
    fling();
    setTimeout(() => {
      setS(p => pick({ ...p, done: p.done + 1, enter: dir > 0 ? 'l' : 'r' }));
      refresh().catch(err => console.error('Refresh failed:', err));
    }, 150);
  };

  const flip = () => setS(p => p.busy ? p : { ...p, flipped: !p.flipped });
  const toggleWord = (i) => setS(p => {
    if (p.busy || !p.cur || !p.flipped || !p.cur.card.words[i][1]) return p;
    const missed = new Set(p.missed);
    missed.has(i) ? missed.delete(i) : missed.add(i);
    return { ...p, missed };
  });

  useEffect(() => {
    const onKey = (e) => {
      const st = ref.current;
      if (!st?.cur || st.busy || swipe || e.target.closest?.('input, textarea, select')) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); flip(); }
      else if (!st.flipped) { if (k === 'Enter') { e.preventDefault(); flip(); } }
      else if (['1', 'ArrowLeft'].includes(k)) grade(false);
      else if (['2', 'ArrowRight', 'Enter'].includes(k)) { e.preventDefault(); grade(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });  // re-bound each render, so `swipe` and `grade` are current

  // Done for today: free practice over every card, which records nothing (your schedule stays as it is)
  const startPractice = async () => {
    setPracticeState('loading');
    try {
      const d = await fetch(`${API_BASE}/api/srs?tz=${TZ}&practice`).then(r => r.json());
      if (!d.due.length) return setPracticeState('none');
      await Promise.race([fetchDiac(d.due), new Promise(r => setTimeout(r, 3000))]);
      setS(p => pick({ ...p, reviews: d.due, practice: true, practiceFrom: p.done }));
      setPracticeState(null);
    } catch (err) {
      console.error('Practice failed:', err);
      setPracticeState(null);
    }
  };

  const commitNew = (n) => {  // on release: the queue, the headline and the saved setting follow the slider
    setDraftNew(null);
    if (n === s.newPerDay) return;
    fetchDiac(s.newCards.slice(0, Math.max(0, n - s.newToday)).filter(c => !diac[keyOf(c)]));
    setS(p => { const q = { ...p, newPerDay: n }; return q.cur ? q : pick(q); });  // raising it after finishing starts the extra words
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => fetch(`${API_BASE}/api/srs/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPerDay: n }),
    }).catch(err => console.error('Setting not saved:', err)), 400);
  };

  const sliderNew = draftNew ?? s?.newPerDay;
  const future = useMemo(() => data ? Array.from(forecast(data.states)) : [], [data]);
  const stats = useMemo(() => data ? streaks(data.history) : null, [data]);
  const [showAll, setShowAll] = useState(false);

  if (failed) return <p className="text-center text-slate-400 mt-20">Couldn't load your flashcards.</p>;
  if (!s) return <div className="flex justify-center py-32 text-indigo-400"><Loader className="w-8 h-8 animate-spin" aria-label="Loading" /></div>;

  const left = newLeft(s), remaining = (s.cur ? 1 : 0) + s.reviews.length + left;
  const todayKey = localDay(new Date());
  const doneSince = (s.practice ? s.practiceFrom : s.done) - data.doneAtLoad;  // reviews this session the loaded history doesn't include yet (practice doesn't count)
  const heatFuture = [...future]; heatFuture[0] = (data.history[todayKey] || 0) + doneSince + (s.practice ? 0 : remaining);
  const cur = s.cur, card = cur?.card, canGrade = cur && s.flipped;
  const diacTokens = card && diacOf(card)?.split(' ');
  const target = card?.words.find(w => w[1] === card.target);

  // ---- swipe (phones): drag the card sideways to grade, tap to flip ----
  const onDown = (e) => {
    if (!swipe || s.busy) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, moved: false, word: e.target.closest('[data-i]') };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    d.dx = e.clientX - d.x;
    if (Math.abs(d.dx) > 6 || Math.abs(e.clientY - d.y) > 6) d.moved = true;
    const x = canGrade ? d.dx : d.dx * 0.2;
    cardRef.current.style.transition = 'none';
    cardRef.current.style.transform = `translateX(${x}px) rotate(${x / 25}deg)`;
    cardRef.current.style.setProperty('--ok', canGrade ? Math.max(0, d.dx / 100) : 0);
    cardRef.current.style.setProperty('--miss', canGrade ? Math.max(0, -d.dx / 100) : 0);
  };
  const onUp = (e) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const el = cardRef.current;
    el.style.transition = '';
    el.style.setProperty('--ok', 0); el.style.setProperty('--miss', 0);
    if (canGrade && Math.abs(d.dx) > 90) {
      el.style.transform = `translateX(${Math.sign(d.dx) * 600}px) rotate(${Math.sign(d.dx) * 20}deg)`;
      return grade(d.dx > 0);
    }
    el.style.transform = '';
    if (!d.moved && e.type === 'pointerup') d.word ? toggleWord(+d.word.dataset.i) : flip();
  };

  // Front: just the sentence (a click anywhere flips it). Back: hover a word for its dictionary entry, click it to mark it missed.
  const words = (back) => card.words.map(([tok, id, lemma, gloss], i) => (
    <span key={i} data-i={back ? i : undefined}
      onClick={back ? (e) => { if (!swipe && id) { e.stopPropagation(); toggleWord(i); } } : undefined}
      className={`group/w relative px-1 rounded-lg transition-colors ${back && id ? 'cursor-pointer hover:bg-slate-800/60' : ''}
        ${back && s.missed.has(i) ? 'text-rose-400 bg-rose-500/10' : id === card.target ? 'text-amber-300' : 'text-white'}`}>
      {diacTokens?.[i] ?? tok}
      {back && lemma && !s.busy && (
        <span dir="ltr" className={`${s.missed.has(i) ? '' : 'hidden group-hover/w:block'} absolute top-full left-1/2 -translate-x-1/2 mt-1 z-10 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 whitespace-nowrap shadow-xl font-sans leading-snug`}>
          <span className="block font-arabic text-lg text-center">{lemma}</span>{firstSense(gloss)}
        </span>
      )}
    </span>
  ));
  const face = 'fc-face bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl flex flex-col justify-center gap-5 px-4 md:px-8 pt-12 pb-8 ' + (swipe ? 'min-h-[420px]' : 'min-h-[360px]');
  const sentenceClass = `font-arabic flex flex-wrap justify-center gap-x-3 gap-y-1 leading-[1.9] ${swipe ? 'text-[32px]' : 'text-4xl md:text-5xl'}`;
  const glossLine = target && <div className="text-center text-amber-300 text-lg min-h-[1.75rem]">{target[2]} · {firstSense(target[3])}</div>;

  const learning = data.learning;
  return (
    <div className="max-w-6xl mx-auto" style={{ overflowX: 'clip' }}>
      <style>{`
        .fc-tick { display: inline-block; animation: fc-tick .4s cubic-bezier(.2,.8,.3,1.25); }
        @keyframes fc-tick { from { transform: translateY(-.45em); opacity: 0; } }
        .fc-flip { display: grid; transition: transform .5s; transform-style: preserve-3d; }
        .fc-flip.flipped { transform: rotateY(180deg); }
        .fc-face { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .fc-back { transform: rotateY(180deg); }
        .fc-flip:not(.flipped) .fc-back, .fc-flip.flipped .fc-face:not(.fc-back) { pointer-events: none; }  /* a hidden face can still catch clicks */
        .fc-card { --ok: 0; --miss: 0; transition: transform .25s; }
        .fc-enter-l { animation: fc-in-l .15s ease-out; }
        .fc-enter-r { animation: fc-in-r .15s ease-out; }
        @keyframes fc-in-l { from { transform: translateX(-120%); opacity: 0; } }
        @keyframes fc-in-r { from { transform: translateX(120%); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .fc-tick, .fc-enter-l, .fc-enter-r { animation: none; } .fc-flip, .fc-card { transition: none; } }
        .fc-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-width: 150px; padding: .75rem 1.1rem; border-width: 1px; border-radius: .75rem; transition: background-color .15s; }
      `}</style>

      <header className="text-center mt-2 mb-9">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white tabular-nums">
          {remaining ? <><Tick value={remaining} /> {plural(remaining, 'card')} {s.practice ? 'to practise' : 'due today'}</> : 'All done for today'}
        </h1>
        {left > 0 && <p className="mt-4 text-2xl md:text-3xl text-slate-400">You'll learn <Tick value={left} /> new {plural(left, 'word')}</p>}
      </header>

      {!cur && diacReady && (
        <div className="flex flex-wrap justify-center gap-3 -mt-2 mb-10">
          <button onClick={onTutor} className="fc-btn bg-indigo-600 hover:bg-indigo-500 border-indigo-600 text-white font-semibold">
            <GraduationCap className="w-5 h-5" />Chat with your comprehensible tutor!
          </button>
          {data.states.length > 0 && practiceState !== 'none' && (
            <button onClick={startPractice} disabled={practiceState === 'loading'} className="fc-btn border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-60">
              {practiceState === 'loading' ? <Loader className="w-5 h-5 animate-spin" /> : <RotateCw className="w-5 h-5" />}Continue reviewing
            </button>
          )}
        </div>
      )}

      {cur && !diacReady && <div className="flex justify-center py-24 text-indigo-400"><Loader className="w-8 h-8 animate-spin" aria-label="Loading" /></div>}
      {cur && diacReady && (
        <section className="max-w-3xl mx-auto mb-10 select-none">
          <div className="h-[3px] bg-slate-800 rounded mb-3.5 overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${100 * s.done / (s.done + remaining)}%` }} />
          </div>
          <div key={s.done} ref={cardRef} className={`fc-card relative ${s.done && s.enter ? 'fc-enter-' + s.enter : ''}`} style={{ perspective: 1400, touchAction: swipe ? 'pan-y' : undefined }}
               onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
               onClick={() => { if (!swipe) flip(); }}>
            <div className={`fc-flip cursor-pointer ${s.flipped ? 'flipped' : ''}`}>
              <div className={face}>
                {cur.isNew && <span className="absolute top-4 left-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 text-amber-300 text-xs"><Sparkles className="w-3.5 h-3.5" />New word</span>}
                <div dir="rtl" className={sentenceClass}>{words(false)}</div>
              </div>
              <div className={`${face} fc-back`}>
                <div dir="rtl" className={sentenceClass}>{words(true)}</div>
                {glossLine}
                <div className="text-center text-slate-400 text-lg">{card.en}</div>
              </div>
            </div>
            {swipe && <>
              <span className="absolute top-5 right-5 px-2.5 py-1 border-2 border-emerald-400 text-emerald-400 rounded-lg font-extrabold tracking-widest rotate-[8deg] pointer-events-none" style={{ opacity: 'var(--ok)' }}>KNEW IT</span>
              <span className="absolute top-5 left-5 px-2.5 py-1 border-2 border-rose-400 text-rose-400 rounded-lg font-extrabold tracking-widest -rotate-[8deg] pointer-events-none" style={{ opacity: 'var(--miss)' }}>MISSED</span>
            </>}
          </div>

          {swipe ? (
            <div className="flex justify-between items-center mt-4 mx-2 text-slate-600">
              {s.flipped ? <><X className="w-6 h-6 text-rose-400" /><Check className="w-6 h-6 text-emerald-400" /></>
                : <><span /><Eye className="w-6 h-6" /><span /></>}
            </div>
          ) : (
            <div className="flex gap-2.5 justify-center mt-5 flex-wrap">
              {!s.flipped ? <button onClick={flip} title="Space" className="fc-btn bg-indigo-600 hover:bg-indigo-500 border-indigo-600 text-white font-semibold"><Eye className="w-5 h-5" />Reveal</button>
                : <>
                  <button onClick={() => grade(false)} title="1 or ←" className="fc-btn border-rose-400/40 text-rose-400 hover:bg-rose-500/10"><X className="w-5 h-5" />Missed</button>
                  <button onClick={() => grade(true)} title="2 or →" className="fc-btn border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/10"><Check className="w-5 h-5" />Correct</button>
                </>}
            </div>
          )}
          {s.error && <p className="text-center text-rose-400 text-sm mt-3">That review wasn't saved. Try again.</p>}
        </section>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><CalendarDays className="w-4 h-4" />Reviews</h2>
          <label className="flex items-center gap-2.5 text-amber-300" title="New words per day">
            <Sparkles className="w-4 h-4" />
            <input type="range" min="0" max="50" value={sliderNew} onChange={(e) => setDraftNew(+e.target.value)}
                   onPointerUp={(e) => commitNew(+e.target.value)} onKeyUp={(e) => commitNew(+e.target.value)} onBlur={(e) => commitNew(+e.target.value)}
                   aria-label="New words per day" className="w-40 accent-amber-400" />
            <span className="min-w-[2ch] text-right font-bold text-slate-100 tabular-nums">{sliderNew}</span>
          </label>
        </div>
        <Heatmap past={data.history} future={heatFuture} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[[`${stats.current} ${plural(stats.current, 'day')}`, 'current streak', true], [`${stats.longest} ${plural(stats.longest, 'day')}`, 'longest streak'], [(stats.total + doneSince).toLocaleString('en-US'), 'total reviews']].map(([v, label, flame]) => (
            <div key={label} className="bg-slate-800/50 rounded-xl px-3 py-2.5">
              <b className="flex items-center gap-1 text-lg text-slate-100 tabular-nums">{flame && <Flame className="w-4 h-4 text-amber-400" />}{v}</b>
              <small className="text-slate-500 text-xs">{label}</small>
            </div>
          ))}
        </div>
      </div>

      {learning.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3"><Layers className="w-4 h-4" />Learning</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 px-2.5 font-semibold">Rank</th><th className="py-2 px-2.5 font-semibold">Word</th><th className="py-2 px-2.5 font-semibold">Meaning</th>
                <th className="py-2 px-2.5 font-semibold">Learned</th><th className="py-2 px-2.5 font-semibold text-right">Due</th><th className="py-2 px-2.5 font-semibold text-right">Reviews</th><th />
              </tr></thead>
              <tbody>
                {learning.slice(0, showAll ? learning.length : 10).map(w => (
                  <tr key={w.lemma_id} className="border-b border-slate-800">
                    <td className="py-2 px-2.5 font-mono text-xs text-slate-500">#{w.lemma_id}</td>
                    <td className="py-2 px-2.5 font-arabic text-xl" dir="rtl">{w.plaintext}</td>
                    <td className="py-2 px-2.5 text-slate-400">{firstSense(w.translation)}</td>
                    <td className="py-2 px-2.5"><div className="w-[90px] h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full" style={{ width: `${w.L * 100}%`, background: w.L >= KNOWN_AT ? '#34d399' : '#fbbf24' }} /></div></td>
                    <td className={`py-2 px-2.5 text-right tabular-nums ${w.due <= 0 ? 'text-indigo-300' : ''}`}>{w.due <= 0 ? 'now' : 'in ' + days(w.due)}</td>
                    <td className="py-2 px-2.5 text-right tabular-nums text-slate-500">{w.reps}</td>
                    <td className="py-2 px-2.5">{w.lapses >= 4 && <span className="inline-flex items-center gap-1 text-xs text-amber-300" title={`Missed ${w.lapses} times`}><TriangleAlert className="w-3.5 h-3.5" />leech</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {learning.length > 10 && (
            <button onClick={() => setShowAll(v => !v)} className="mt-3 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
              {showAll ? 'Show fewer' : `Show all ${learning.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FlashcardsView;
