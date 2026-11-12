import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Search, Plus, Check, Copy, Pencil, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Loader, ChevronDown, BookPlus, WandSparkles, ListOrdered } from 'lucide-react';
import Gloss, { formatGloss } from './Gloss';
import ProgressHero from './ProgressHero';

const API_BASE = process.env.REACT_APP_API_URL || '';
const COLS = 200; // lemmas per heatmap row, by rank
const MAX_ADD = 100;
const STATE_COLOR = { k: '#34d399', u: '#fb7185' }; // known, unknown
const post = (path, body) => fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const isTyping = (el) => el.closest?.('input, textarea, select, [contenteditable="true"]');

// A sentence's tokens with unknown words in yellow (the focused word underlined); with a dictionary, hovering a word
// shows its lemma. onWord: clicking another unknown word focuses it (learning it unlocks the sentence).
const Marked = ({ words, dictionary, onWord }) => words.map(([w, target, id, unknown], i) => {
  const text = target ? <span className="text-amber-300 border-b-2 border-amber-300/50">{w}</span>
    : unknown && onWord ? <span className="text-amber-300 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onWord(id); }}>{w}</span>
    : w;
  const entry = dictionary && id && dictionary[id];
  return (
    <React.Fragment key={i}>{i > 0 && ' '}{entry ? (
      <span className="relative group/w cursor-help rounded hover:bg-slate-800">
        {text}
        <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 hidden group-hover/w:block bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-3 py-2 text-xs text-center" dir="ltr">
          <span className="block font-arabic text-lg text-indigo-300 whitespace-nowrap" dir="rtl">{entry[0]}</span>
          <Gloss text={entry[1]} />
        </span>
      </span>
    ) : text}</React.Fragment>
  );
});

// ---- Heatmap: every lemma by rank, on a canvas with its own pan/zoom camera ----
const Heatmap = ({ states, texts, focus, centerOn, onPick }) => {
  const wrap = useRef(null), canvas = useRef(null);
  const cam = useRef({ s: 0, x: 0, y: 0 }), size = useRef({ w: 0, h: 0 });
  const pointers = useRef(new Map()), gesture = useRef(null), frame = useRef(0);
  const [tip, setTip] = useState(null);
  const n = states.length, rows = Math.ceil(n / COLS);

  const clamp = useCallback(() => {
    const c = cam.current, { w, h } = size.current;
    c.s = Math.min(Math.max(c.s, w / COLS), 48); // fits the width at most zoomed out
    const cw = COLS * c.s, ch = rows * c.s;
    c.x = cw <= w ? (w - cw) / 2 : Math.min(0, Math.max(w - cw, c.x));
    c.y = ch <= h ? 0 : Math.min(0, Math.max(h - ch, c.y));
  }, [rows]);

  const draw = useCallback(() => {
    const cv = canvas.current; if (!cv || !size.current.w) return;
    const { w, h } = size.current, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { s, x, y } = cam.current, gap = s >= 6 ? Math.max(1, s * 0.12) : 0, pad = gap ? 0 : 0.5;
    const c0 = Math.max(0, Math.floor(-x / s)), c1 = Math.min(COLS - 1, Math.floor((w - x) / s));
    const r0 = Math.max(0, Math.floor(-y / s)), r1 = Math.min(rows - 1, Math.floor((h - y) / s));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * COLS + c; if (i >= n) break;
        ctx.fillStyle = states[i] === 'k' ? STATE_COLOR.k : STATE_COLOR.u;
        ctx.fillRect(x + c * s + gap / 2, y + r * s + gap / 2, s - gap + pad, s - gap + pad);
      }
    }
    if (focus) {
      const i = focus - 1, cx = x + (i % COLS + 0.5) * s, cy = y + (Math.floor(i / COLS) + 0.5) * s, r = Math.max(s / 2 + 3, 8);
      ctx.lineWidth = 5; ctx.strokeStyle = '#020617'; ctx.strokeRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fbbf24'; ctx.strokeRect(cx - r, cy - r, 2 * r, 2 * r);
    }
  }, [states, focus, n, rows]);
  const redraw = useCallback(() => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(draw); }, [draw]);

  // Size and draw before the first paint, so the map appears at its final zoom instead of settling into it
  useLayoutEffect(() => {
    size.current = { w: wrap.current.clientWidth, h: wrap.current.clientHeight };
    cam.current.s = size.current.w / COLS;
    clamp(); draw();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(redraw, [redraw]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const w = wrap.current.clientWidth, h = wrap.current.clientHeight;
      if (w === size.current.w && h === size.current.h) return;
      const fitted = cam.current.s <= size.current.w / COLS + 1e-6; // stay fitted if it was
      size.current = { w, h };
      if (fitted) cam.current.s = w / COLS;
      clamp(); redraw();
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [clamp, redraw]);

  // Search and suggestions centre the word (zooming in); arrow keys just keep it in view
  useEffect(() => {
    if (!centerOn) return;
    const c = cam.current, i = centerOn.id - 1, { w, h } = size.current;
    const col = i % COLS, row = Math.floor(i / COLS);
    if (centerOn.follow) {
      const m = 2 * c.s, cx = c.x + col * c.s, cy = c.y + row * c.s;
      if (cx < m) c.x += m - cx; else if (cx + c.s > w - m) c.x -= cx + c.s - (w - m);
      if (cy < m) c.y += m - cy; else if (cy + c.s > h - m) c.y -= cy + c.s - (h - m);
    } else {
      c.s = Math.max(c.s, 14);
      c.x = w / 2 - (col + 0.5) * c.s; c.y = h / 2 - (row + 0.5) * c.s;
    }
    clamp(); redraw();
  }, [centerOn, clamp, redraw]);

  const zoomAt = (px, py, factor) => {
    const c = cam.current, s0 = c.s;
    c.s = s0 * factor; clamp();
    const k = c.s / s0; c.x = px - (px - c.x) * k; c.y = py - (py - c.y) * k;
    clamp(); redraw();
  };
  const at = (e) => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hit = ({ x, y }) => {
    const c = cam.current, col = Math.floor((x - c.x) / c.s), row = Math.floor((y - c.y) / c.s), i = row * COLS + col;
    return col >= 0 && col < COLS && row >= 0 && i < n ? i + 1 : null;
  };

  // The wheel scrolls the page; only Ctrl/⌘ + wheel (also how trackpad pinches arrive) zooms the map
  useEffect(() => {
    const cv = canvas.current;
    const onWheel = (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const p = at(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01)); } };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  });

  // Pointer events: one finger/mouse pans, two fingers pinch-zoom, a tap without movement picks a word
  const startPan = (p) => { gesture.current = { type: 'pan', p0: p, cam0: { ...cam.current }, moved: false }; };
  const onPointerDown = (e) => {
    try { canvas.current.setPointerCapture(e.pointerId); } catch { /* not a live pointer; the gesture still works without capture */ }
    pointers.current.set(e.pointerId, at(e));
    setTip(null);
    if (pointers.current.size === 1) startPan(at(e));
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam0: { ...cam.current } };
    }
  };
  const onPointerMove = (e) => {
    const p = at(e);
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { const id = hit(p); setTip(t => (t?.id === id ? t : id && { id, x: p.x, y: p.y })); }
      return;
    }
    pointers.current.set(e.pointerId, p);
    const g = gesture.current, c = cam.current;
    if (g?.type === 'pan') {
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (g.moved) { c.x = g.cam0.x + dx; c.y = g.cam0.y + dy; clamp(); redraw(); }
    } else if (g?.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(Math.max(g.cam0.s * Math.hypot(a.x - b.x, a.y - b.y) / g.d0, size.current.w / COLS), 48);
      c.s = s; c.x = m.x - (g.m0.x - g.cam0.x) * (s / g.cam0.s); c.y = m.y - (g.m0.y - g.cam0.y) * (s / g.cam0.s);
      clamp(); redraw();
    }
  };
  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g?.type === 'pan' && !g.moved && pointers.current.size === 0) { const id = hit(at(e)); if (id) onPick(id); }
    if (pointers.current.size === 1) startPan([...pointers.current.values()][0]); // lifting one pinch finger keeps panning
    if (!pointers.current.size) gesture.current = null;
  };

  const zoomButton = (label, Icon, fn) => (
    <button onClick={fn} aria-label={label} title={label} className="w-9 h-9 grid place-items-center rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white">
      <Icon className="w-4 h-4" />
    </button>
  );
  const center = () => ({ x: size.current.w / 2, y: size.current.h / 2 });

  return (
    <div ref={wrap} className="relative h-[55vh] lg:h-[560px] rounded-xl overflow-hidden bg-slate-950">
      <canvas
        ref={canvas}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onPointerLeave={() => setTip(null)}
      />
      {tip && (
        <div className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs shadow-xl"
             style={{ left: Math.min(tip.x + 14, size.current.w - 140), top: Math.min(tip.y + 14, size.current.h - 60) }}>
          {texts && <div className="font-arabic text-lg text-white" dir="rtl">{texts[tip.id - 1]}</div>}
          <span className="text-slate-500">#{tip.id.toLocaleString()}</span>
        </div>
      )}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        {zoomButton('Zoom in', ZoomIn, () => { const p = center(); zoomAt(p.x, p.y, 1.6); })}
        {zoomButton('Zoom out', ZoomOut, () => { const p = center(); zoomAt(p.x, p.y, 1 / 1.6); })}
        {zoomButton('Fit', Maximize2, () => { cam.current = { s: 0, x: 0, y: 0 }; clamp(); redraw(); })}
      </div>
    </div>
  );
};

// ---- One Tatoeba sentence: click to select it for the Create flashcard button ----
const SentenceRow = ({ s, selected, onSelect, dictionary, onWord }) => {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(s.ar); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div
      role="button" tabIndex={0} data-sentence aria-pressed={selected} onClick={onSelect}
      className={`my-2 p-3 rounded-xl border grid grid-cols-[1fr_auto] gap-x-3 items-center cursor-pointer transition-colors
        ${selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-700'}`}
    >
      <div>
        <div className="font-arabic text-xl leading-relaxed text-slate-100" dir="rtl"><Marked words={s.words} dictionary={dictionary} onWord={onWord} /></div>
        <div className="text-sm text-slate-400">{s.en}</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={copy} aria-label="Copy" title="Copy" className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
        {s.in_deck && <Check className="w-4 h-4 text-emerald-400" aria-label="In your deck" />}
      </div>
    </div>
  );
};

// ---- Search (ID, Arabic, Buckwalter, English), as in the Library ----
const SearchBox = ({ onPick }) => {
  const [q, setQ] = useState(''), [hits, setHits] = useState([]), [open, setOpen] = useState(false);
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const data = await fetch(`${API_BASE}/api/lemmas/search?q=${encodeURIComponent(q)}`).then(r => r.json());
      if (!stale) { setHits(data.slice(0, 8)); setOpen(true); }
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);
  const pick = (id) => { setOpen(false); onPick(id); };
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
      <input
        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0].lemma_id); if (e.key === 'Escape') setOpen(false); }}
        placeholder="ID, عربي, Buckwalter, English"
        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
      />
      {open && hits.length > 0 && (
        <div className="absolute z-30 mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {hits.map(h => (
            <button key={h.lemma_id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.lemma_id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800">
              <span className={`w-2.5 h-2.5 rounded-sm ${h.known ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="text-xs text-slate-500 w-14">#{h.lemma_id}</span>
              <span className="flex-1 text-sm text-slate-400 truncate">{formatGloss(h.translation)}</span>
              <span className="font-arabic text-xl text-slate-100">{h.plaintext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AtlasView = ({ onCalibrate }) => {
  const [summary, setSummary] = useState(null); // {states, ready, words}
  const [texts, setTexts] = useState(null);
  const [occ, setOcc] = useState(null); // corpus frequency by rank, for the progress header
  const [focus, setFocus] = useState(null);  // highlighted on the map
  const [detailId, setDetailId] = useState(null);  // whose details load: held arrow keys only move `focus`
  const [centerOn, setCenterOn] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(null); // sentence id the Create flashcard button adds
  const [frontier, setFrontier] = useState({ words: [], dictionary: {} });
  const [count, setCount] = useState(10);
  const [choice, setChoice] = useState({}); // lemma_id -> chosen sentence index (Edit)
  const [editing, setEditing] = useState(null); // the words being edited: the auto-create batch, or one suggestion
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const mapRef = useRef(null), detailRef = useRef(null), autoRef = useRef(null), latest = useRef(null);

  const loadSummary = useCallback(async () => {
    const [s, f] = await Promise.all([
      fetch(`${API_BASE}/api/atlas`).then(r => r.json()),
      fetch(`${API_BASE}/api/atlas/frontier?n=${MAX_ADD}`).then(r => r.json()),
    ]);
    setSummary(s); setFrontier(f);
    setCount(c => Math.max(1, Math.min(c, s.words, MAX_ADD)));
  }, []);
  const loadDetail = useCallback(async (id) => {
    latest.current = id;
    const d = id ? await fetch(`${API_BASE}/api/atlas/word/${id}`).then(r => r.json()) : null;
    if (latest.current !== id) return; // another word was asked for meanwhile
    setDetail(d);
    setSelected(sel => (d && d.sentences.some(s => s.id === sel && !s.in_deck) ? sel : d?.sentences.find(s => !s.in_deck)?.id ?? null));
  }, []);

  useEffect(() => {
    loadSummary();
    fetch(`${API_BASE}/api/atlas/lemmas`).then(r => r.text()).then(t => setTexts(t.split('|'))); // tooltips, loaded after first paint
    fetch(`${API_BASE}/api/atlas/occurrences`).then(r => r.text()).then(t => setOcc(t.split(',').map(Number)));
  }, [loadSummary]);
  useEffect(() => { loadDetail(detailId); }, [detailId, loadDetail]);

  const refresh = () => Promise.all([loadSummary(), loadDetail(detailId)]);
  const focusWord = (id, center = true) => { setFocus(id); setDetailId(id); if (center) setCenterOn({ id, at: Date.now() }); };
  const jumpToAuto = () => { autoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(f => f + 1); };
  const addSentences = async (ids) => {
    setBusy(true);
    try { await post('/api/atlas/add', { ids }); setChoice({}); await refresh(); } finally { setBusy(false); }
  };
  const setKnown = async (id, known) => { await post(`/api/set-known/${id}`, { known }); await refresh(); };
  const chosen = (w) => w.sentences[Math.min(choice[w.lemma_id] || 0, w.sentences.length - 1)];
  const words = frontier.words, batch = words.slice(0, count);
  const loading = focus && detail?.lemma_id !== focus;
  const selectedSentence = detail?.sentences.find(s => s.id === selected);
  const canCreate = selectedSentence && !selectedSentence.in_deck && !busy;

  // Arrow keys walk the heatmap by rank (→ next, ↓ one row on), Ctrl+←/→ to the previous/next unknown word;
  // the word's details load when the key is released. 1-3 pick a sentence; Enter creates the selected flashcard.
  const keys = useRef(null), keyUp = useRef(null), pending = useRef(null);  // pending: where the held key has got to
  keys.current = (e) => {
    if (!summary || editing || isTyping(e.target)) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step) {
      e.preventDefault();
      let id = Math.min(summary.states.length, Math.max(1, (focus || 1 - step) + step));
      if ((e.ctrlKey || e.metaKey) && Math.abs(step) === 1) {
        id = focus;
        for (let j = (focus || 0) + step; j >= 1 && j <= summary.states.length; j += step) if (summary.states[j - 1] === 'u') { id = j; break; }
        if (!id) return;
      }
      pending.current = id;
      setFocus(id); setCenterOn({ id, follow: true, at: Date.now() });
    } else if (['1', '2', '3'].includes(e.key) && detail && !loading) {
      const s = detail.sentences[+e.key - 1];
      if (s) setSelected(s.id);
    } else if (e.key === 'Enter' && canCreate && (!e.target.closest?.('button, a, [role="button"]') || e.target.dataset?.sentence !== undefined)) {
      e.preventDefault();
      addSentences([selected]);
    }
  };
  keyUp.current = (e) => { if (e.key.startsWith('Arrow') && pending.current != null) { setDetailId(pending.current); pending.current = null; } };
  useEffect(() => {
    const onKey = (e) => keys.current(e), onKeyUp = (e) => keyUp.current(e);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const maxN = summary ? Math.min(summary.words, MAX_ADD) : 0;
  const glosses = detail ? [...new Set((detail.translation || '').split('#').map(formatGloss).filter(Boolean))] : [];
  const detailKnown = detail && summary?.states[detail.lemma_id - 1] === 'k';

  return (
    <div className="space-y-6">
      <div className="pt-2 pb-6"><ProgressHero states={summary?.states} occ={occ} onCalibrate={onCalibrate} /></div>
      <SearchBox onPick={(id) => focusWord(id)} />

      <div ref={mapRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 scroll-mt-4">
        <div className="relative">
          {summary
            ? <Heatmap states={summary.states} texts={texts} focus={focus} centerOn={centerOn} onPick={(id) => focusWord(id, false)} />
            : <div className="h-[55vh] lg:h-[560px] rounded-xl bg-slate-950 grid place-items-center text-indigo-400"><Loader className="w-8 h-8 animate-spin" aria-label="Loading" /></div>}
          {/* Phones: the details sit below the map, so name the tapped word and offer a jump to them */}
          {detail && !loading && (
            <button onClick={() => detailRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="lg:hidden absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl">
              <span className="font-arabic text-lg text-amber-300">{detail.plaintext}</span>
              <span className="text-xs text-slate-500">#{detail.lemma_id}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            {[['k', 'known'], ['u', 'unknown']].map(([s, label]) => (
              <span key={s} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATE_COLOR[s] }} />{label}</span>
            ))}
          </div>
        </div>

        <aside ref={detailRef} className="bg-slate-900 border border-slate-800 rounded-xl lg:h-[560px] flex flex-col scroll-mt-4">
          {loading ? (
            <div className="flex-1 grid place-items-center py-16 text-indigo-400"><Loader className="w-7 h-7 animate-spin" aria-label="Loading" /></div>
          ) : !detail ? (
            <div className="p-6 space-y-4 text-slate-300 leading-relaxed">
              <h2 className="text-lg font-semibold text-white">Welcome to your Arabic Language Atlas.</h2>
              <p>This heatmap updates as your Arabic vocabulary grows. Explore the entire Arabic lexicon, or {/* a span, not a <button>: buttons are always inline-block, so the phrase couldn't wrap like text */}<span role="button" tabIndex={0} onClick={jumpToAuto}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToAuto(); } }}
                 className="text-indigo-300 font-semibold cursor-pointer hover:underline">automatically add comprehensible flashcards</span> to your deck.</p>
              <p>There are <b className="text-amber-300">{summary ? summary.ready.toLocaleString() : '…'}</b> comprehensible sentences ready to be added to your deck right now.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-mono text-slate-500 mt-2">#{detail.lemma_id.toLocaleString()}</span>
                  <div className="font-arabic text-5xl leading-tight text-white text-right" dir="rtl">{detail.plaintext}</div>
                  <button onClick={() => { setFocus(null); setDetailId(null); }} aria-label="Close" className="p-1.5 -mr-2 rounded-md text-slate-500 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 my-4">
                  <button onClick={() => setKnown(detail.lemma_id, true)}
                          className={`py-2 rounded-lg text-sm font-medium border ${detailKnown ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>Known</button>
                  <button onClick={() => setKnown(detail.lemma_id, false)}
                          className={`py-2 rounded-lg text-sm font-medium border ${!detailKnown ? 'bg-rose-500/15 border-rose-500/50 text-rose-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>Unknown</button>
                </div>
                <ul className="space-y-1.5 mb-4 text-slate-200 text-base list-disc pl-5 marker:text-slate-600">
                  {glosses.map(g => <li key={g}>{g}</li>)}
                </ul>
                {detail.sentences.map(s => (
                  <SentenceRow key={s.id} s={s} selected={s.id === selected} onSelect={() => setSelected(s.id)} dictionary={detail.dictionary} onWord={focusWord} />
                ))}
                {detail.sentences.length === 0 && <p className="py-6 text-center text-slate-400">Learn more vocabulary to unlock comprehensible sentences for this word!</p>}
                {detail.sentences.length > 0 && <p className="py-2 text-[11px] text-slate-600">Tatoeba · CC BY 2.0 FR</p>}
              </div>
              {detail.sentences.length > 0 && (
                <div className="p-4 border-t border-slate-800">
                  <button onClick={() => addSentences([selected])} disabled={!canCreate}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:hover:bg-indigo-600">
                    {busy ? <Loader className="w-4 h-4 animate-spin" /> : selectedSentence?.in_deck ? <Check className="w-4 h-4" /> : <BookPlus className="w-4 h-4" />}
                    Create flashcard
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Add N comprehensible sentences, one per top unknown word */}
      <div ref={autoRef} key={flash} className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${flash ? 'atlas-flash' : ''}`}>
        <style>{`
          .atlas-flash { animation: atlas-flash 1.8s ease-out; }
          @keyframes atlas-flash { 0%, 45% { border-color: #818cf8; box-shadow: 0 0 0 4px rgba(129, 140, 248, .45); } }
          @media (prefers-reduced-motion: reduce) { .atlas-flash { animation: none; border-color: #818cf8; } }
        `}</style>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <WandSparkles className="w-4 h-4 text-indigo-400" />Auto-create flashcards
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <input type="range" min={1} max={Math.max(1, maxN)} value={count} disabled={!maxN} onChange={(e) => setCount(+e.target.value)}
                 aria-label="Number of sentences" className="flex-1 min-w-[160px] accent-indigo-500" />
          <input type="number" min={1} max={maxN} value={count} disabled={!maxN} aria-label="Number of sentences"
                 onChange={(e) => setCount(Math.max(1, Math.min(maxN, +e.target.value || 1)))}
                 className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center text-slate-200" />
          <button onClick={() => setEditing(batch)} disabled={!maxN} aria-label="Edit" title="Edit"
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 disabled:opacity-40">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => addSentences(batch.map(w => chosen(w).id))} disabled={!maxN || busy}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
            {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {count}
          </button>
        </div>
      </div>

      {/* Next most common words: click a card to show it on the map and pick its sentence */}
      <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3"><ListOrdered className="w-4 h-4 text-indigo-400" />Next most common words</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {words.slice(0, 12).map(w => (
          <div key={w.lemma_id} role="button" tabIndex={0}
               onClick={() => { focusWord(w.lemma_id); mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); e.currentTarget.click(); } }}
               className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${w.lemma_id === focus ? 'border-amber-400/60' : 'border-slate-800 hover:border-slate-700'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-base font-semibold text-indigo-300 leading-none pt-0.5">#{w.lemma_id}</span>
                <span className="font-arabic text-2xl text-amber-300 leading-snug" dir="rtl">{w.plaintext}</span>
              </div>
              <div className="text-sm text-slate-300 truncate">{formatGloss(w.translation)}</div>
              <div className="text-xs text-slate-500 mt-0.5"><b className="text-slate-300">{w.count}</b> i+1 {w.count === 1 ? 'card' : 'cards'} found</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); addSentences([chosen(w).id]); }} aria-label="Add 1st flashcard" title="Add 1st flashcard" className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"><BookPlus className="w-5 h-5" /></button>
            <button onClick={(e) => { e.stopPropagation(); setKnown(w.lemma_id, true); }} aria-label="Mark known" title="Mark known" className="p-2 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800"><Check className="w-5 h-5" /></button>
          </div>
        ))}
      </div>
      </div>

      {/* Edit: the sentence chosen for each word, swappable; hover a word for its dictionary entry */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
             onClick={(e) => e.target === e.currentTarget && setEditing(null)}
             onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-300"><WandSparkles className="w-4 h-4 text-indigo-400" />{editing.length}</span>
              <button onClick={() => setEditing(null)} aria-label="Close" className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-4 pb-16 space-y-2">
              {editing.map(w => {
                const k = Math.min(choice[w.lemma_id] || 0, w.sentences.length - 1), s = w.sentences[k], many = w.sentences.length > 1;
                const swap = (d) => setChoice(c => ({ ...c, [w.lemma_id]: (k + d + w.sentences.length) % w.sentences.length }));
                return (
                  <div key={w.lemma_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 rounded-xl border border-slate-800">
                    <span className="font-arabic text-lg text-amber-300 w-20 text-center" dir="rtl">{w.plaintext}</span>
                    <div className="min-w-0">
                      <div className="font-arabic text-lg leading-relaxed text-slate-100" dir="rtl"><Marked words={s.words} dictionary={frontier.dictionary} /></div>
                      <div className="text-xs text-slate-400">{s.en}</div>
                    </div>
                    <div className={`flex items-center gap-1 ${many ? '' : 'invisible'}`}>
                      <button onClick={() => swap(-1)} aria-label="Previous option" className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-[11px] text-slate-500 w-8 text-center">{k + 1}/{w.sentences.length}</span>
                      <button onClick={() => swap(1)} aria-label="Next option" className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button onClick={async () => { await addSentences(editing.map(w => chosen(w).id)); setEditing(null); }} disabled={busy}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
                {busy ? <Loader className="w-4 h-4 animate-spin" /> : <BookPlus className="w-4 h-4" />} {editing.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtlasView;
