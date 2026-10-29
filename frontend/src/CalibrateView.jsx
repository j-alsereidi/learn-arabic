import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, Check, ListX, CheckCircle2, Loader, Download, Upload, RotateCcw } from 'lucide-react';
import { formatGloss } from './Gloss';

const API_BASE = process.env.REACT_APP_API_URL || '';

// Pages of 20 lemmas: tap (or drag across) the unknown ones, then submit; the rest count as known.
// Submitted pages form a history to browse back and forth and re-submit. Dashed tiles = not saved yet.
// See app_package/calibrate.py.
const CalibrateView = ({ onClose }) => {
  const [page, setPage] = useState(null); // {step_id, steps, stratum, mode, manual, unknown, lemmas, strata}
  const [unknown, setUnknown] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [painting, setPainting] = useState(null); // drag-to-mark: true = marking unknown, false = marking known
  const sweeping = useRef(null); // stratum being swept by hand, so the next unsubmitted page continues it

  const request = useCallback(async (path, options) => {
    setBusy(true);
    try {
      const data = await fetch(`${API_BASE}${path}`, options).then(r => r.json());
      if (data.step_id === null) sweeping.current = data.manual ? data.stratum : null;
      setPage(data);
      setUnknown(new Set(data.unknown));
    } finally {
      setBusy(false);
    }
  }, []);

  const loadNext = useCallback(() => request(`/api/calibrate${sweeping.current == null ? '' : `?stratum=${sweeping.current}`}`), [request]);
  useEffect(() => { loadNext(); }, [loadNext]);

  // page.step_id is null on the next (unsubmitted) page, which sits after the last submitted one
  const position = page ? (page.step_id === null ? page.steps.length : page.steps.indexOf(page.step_id)) : 0;
  const view = (i) => i < page.steps.length ? request(`/api/calibrate/steps/${page.steps[i]}`) : loadNext();
  const back = () => { if (!busy && position > 0) view(position - 1); };
  const forward = () => { if (!busy && page.step_id !== null) view(position + 1); };

  const submit = async () => {
    if (busy || !page || page.mode === 'done') return;
    const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (page.step_id === null) {
      return request('/api/calibrate', json('POST', {
        stratum: page.stratum, mode: page.mode, manual: page.manual,
        ids: page.lemmas.map(l => l.lemma_id), unknown: [...unknown]
      }));
    }
    setBusy(true);
    await fetch(`${API_BASE}/api/calibrate/steps/${page.step_id}`, json('PUT', { unknown: [...unknown] }));
    setBusy(false);
    view(position + 1);
  };

  // Two clicks: the first arms the button (like the Delete buttons), the second resets
  const [resetArmed, setResetArmed] = useState(false);
  const reset = async () => {
    if (!resetArmed) return setResetArmed(true);
    setResetArmed(false);
    await fetch(`${API_BASE}/api/reset-known`, { method: 'POST' });
    sweeping.current = null;
    loadNext();
  };

  // Fetched rather than a plain link: the dev server answers link clicks with index.html,
  // and browsers ignore `download` on links to another origin (the API in production).
  const exportKnown = async () => {
    const blob = await fetch(`${API_BASE}/api/knownwords.txt`).then(r => r.blob());
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'knownwords.txt' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  const fileInput = useRef(null);
  const [notFound, setNotFound] = useState([]); // imported words matching no lemma; hover the count to see them
  const importKnown = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // so picking the same file again still fires onChange
    if (!file) return;
    const res = await fetch(`${API_BASE}/api/import-known`, { method: 'POST', body: await file.text() }).then(r => r.json());
    setNotFound(res.not_found || []);
    sweeping.current = null;
    loadNext();
  };

  const mark = (id, isUnknown) => setUnknown(prev => {
    const nextSet = new Set(prev);
    isUnknown ? nextSet.add(id) : nextSet.delete(id);
    return nextSet;
  });

  useEffect(() => {
    const stop = () => setPainting(null);
    // preventDefault: Enter on a focused tile would otherwise also toggle it
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); back(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
    };
    window.addEventListener('mouseup', stop);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('keydown', onKey); };
  });

  if (!page) {
    return <div className="flex justify-center p-16 text-indigo-400"><Loader className="w-8 h-8 animate-spin" /></div>;
  }

  const allUnknown = page.lemmas.length > 0 && unknown.size === page.lemmas.length;
  const saved = new Set(page.unknown);
  // Not in the database yet: everything on the next page, or a tile changed on a submitted page
  const pending = (id) => page.step_id === null || saved.has(id) !== unknown.has(id);
  const iconButton = 'p-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      <div className="flex items-center gap-4">
        <div className="flex-1 flex gap-1">
          {page.strata.map((s, i) => (
            <button
              key={i}
              onClick={() => { sweeping.current = i; loadNext(); }}
              title={`${s.lo}–${s.hi}`}
              aria-label={`Sweep ranks ${s.lo} to ${s.hi}`}
              className="flex-1 py-2 group"
            >
              <div className={`h-2.5 rounded-full bg-slate-800 overflow-hidden flex group-hover:bg-slate-700 transition-colors
                ${i === page.stratum && page.mode !== 'done' ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''}`}>
                <div className="h-full bg-emerald-500/70" style={{ width: `${(100 * s.known) / s.size}%` }} />
                <div className="h-full bg-rose-500/60" style={{ width: `${(100 * s.unknown) / s.size}%` }} />
              </div>
            </button>
          ))}
        </div>
        <button onClick={exportKnown} title="Export knownwords.txt" aria-label="Export knownwords.txt" className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <Download className="w-5 h-5" />
        </button>
        <button onClick={() => fileInput.current.click()} title="Import knownwords.txt" aria-label="Import knownwords.txt" className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <Upload className="w-5 h-5" />
        </button>
        <input ref={fileInput} type="file" accept=".txt,text/plain" onChange={importKnown} className="hidden" />
        {notFound.length > 0 && (
          <span title={notFound.join(', ')} className="text-xs text-rose-400 whitespace-nowrap">−{notFound.length}</span>
        )}
        <button
          onClick={reset}
          onMouseLeave={() => setResetArmed(false)}
          title="Reset all to unknown"
          aria-label="Reset all to unknown"
          className={`flex items-center gap-1.5 p-1.5 rounded-md text-sm transition-colors
            ${resetArmed ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
        >
          <RotateCcw className="w-5 h-5" />
          {resetArmed && <span className="pr-1">Reset all?</span>}
        </button>
        <button onClick={onClose} title="Close" aria-label="Close" className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {page.mode === 'done' ? (
        <div className="flex justify-center py-24">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3" dir="rtl">
          {page.lemmas.map(l => {
            const isUnknown = unknown.has(l.lemma_id);
            return (
              <div key={l.lemma_id}>
                <button
                  title={formatGloss(l.translation)}
                  onMouseDown={() => { setPainting(!isUnknown); mark(l.lemma_id, !isUnknown); }}
                  onMouseEnter={() => painting !== null && mark(l.lemma_id, painting)}
                  onClick={(e) => e.detail === 0 && mark(l.lemma_id, !isUnknown)} // keyboard (Space); mouse is handled on press
                  aria-pressed={isUnknown}
                  className={`w-full h-28 flex flex-col items-center justify-center rounded-xl border-2 transition-colors
                    ${pending(l.lemma_id) ? 'border-dashed' : ''}
                    ${isUnknown
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'}`}
                >
                  <span className="font-arabic text-3xl">{l.plaintext}</span>
                  <span dir="ltr" className="mt-1 px-3 max-w-full line-clamp-2 text-xs text-slate-400">{formatGloss(l.translation)}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <div className="flex gap-2">
          <button onClick={back} disabled={position === 0 || busy} title="Previous page" aria-label="Previous page" className={iconButton}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={forward} disabled={page.step_id === null || busy} title="Next page" aria-label="Next page" className={iconButton}>
            <ArrowRight className="w-5 h-5" />
          </button>
          {page.mode !== 'done' && (
            <button
              onClick={() => setUnknown(allUnknown ? new Set() : new Set(page.lemmas.map(l => l.lemma_id)))}
              title="Mark all unknown"
              aria-label="Mark all unknown"
              className={allUnknown ? 'p-3 rounded-xl border border-rose-500/50 text-rose-300 bg-rose-500/15 transition-colors' : iconButton}
            >
              <ListX className="w-5 h-5" />
            </button>
          )}
        </div>
        {page.mode !== 'done' && (
          <button
            onClick={submit}
            disabled={busy}
            title="Save and continue"
            aria-label="Save and continue"
            className="px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {busy ? <Loader className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default CalibrateView;
