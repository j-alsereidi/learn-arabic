import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ArrowLeft, Check, ListX, CheckCircle2, Loader, Download, Upload, RotateCcw, X } from 'lucide-react';
import { formatGloss } from './Gloss';

const API_BASE = process.env.REACT_APP_API_URL || '';

// Pages of 20 lemmas: tap (or drag across) the unknown ones, then submit; the rest count as known.
// Submitted pages form a history to browse back and forth and re-submit. Dashed tiles = not saved yet.
// See app_package/calibrate.py.
const CalibrateView = ({ onClose, initialEntry = false, onStatus }) => {
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
  // Report only the current automatic flow, never infer completion from a history page.
  useEffect(() => {
    if (page?.step_id === null) onStatus?.(page);
  }, [page, onStatus]);

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

  if (!page) return null;  // the page is quick to load: a spinner swapping for the grid looked like a zoom

  const allUnknown = page.lemmas.length > 0 && unknown.size === page.lemmas.length;
  const saved = new Set(page.unknown);
  // Not in the database yet: everything on the next page, or a tile changed on a submitted page
  const pending = (id) => page.step_id === null || saved.has(id) !== unknown.has(id);
  const iconButton = 'p-3 rounded-xl border border-slate-800 text-slate-400 hover:text-ink hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="space-y-6 select-none">
      <header className="calibration-intro">
        {page.mode !== 'done' && <span className="setup-cue mb-3">{page.steps.length ? 'Continue calibration' : initialEntry ? 'Start here' : 'Vocabulary calibration'}</span>}
        <h1 className="page-heading">Calibrate</h1>
        <p className="page-description">Set your starting point so ATLAS can tailor your learning.</p>
        {page.mode !== 'done' && <p className="mt-5 text-base font-medium leading-relaxed text-ink max-w-3xl">Select the words you do not know. Unselected words count as known when you save.</p>}
      </header>
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
        <div className="basis-full mb-1"><p className="text-sm font-medium text-slate-300">Vocabulary ranges</p><p className="text-xs text-slate-400 mt-1">Choose a range to review its words. Green shows known words; rose shows unknown words.</p></div>
        <div className="basis-full grid grid-cols-6 sm:grid-cols-9 xl:grid-cols-[repeat(18,minmax(0,1fr))] gap-2">
          {page.strata.map((s, i) => (
            <button
              key={i}
              // a stratum with words left to judge is swept; a fully swept one opens at its first saved page
              onClick={() => { if (s.open) { sweeping.current = i; loadNext(); } else if (s.step != null) request(`/api/calibrate/steps/${s.step}`); }}
              title={`${s.lo}–${s.hi}`}
              aria-label={`Ranks ${s.lo} to ${s.hi}`}
              className="min-h-11 py-2 group"
            >
              <div className={`h-2.5 rounded-full bg-rose-500/60 overflow-hidden flex group-hover:opacity-80 transition-opacity
                ${i === page.stratum && page.mode !== 'done' ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''}`}>
                <div className="h-full bg-emerald-500/70" style={{ width: `${(100 * s.known) / s.size}%` }} />
              </div>
              <span className="block mt-2 text-[11px] leading-tight text-slate-400 tabular-nums"><span className="block">{s.lo}</span>–{s.hi}</span>
            </button>
          ))}
        </div>
        <button onClick={exportKnown} title="Export knownwords.txt" aria-label="Export knownwords.txt" className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-ink hover:bg-slate-800 transition-colors">
          <Download className="w-4 h-4" /><span>Export</span>
        </button>
        <button onClick={() => fileInput.current.click()} title="Import knownwords.txt" aria-label="Import knownwords.txt" className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-ink hover:bg-slate-800 transition-colors">
          <Upload className="w-4 h-4" /><span>Import</span>
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
          className={`flex items-center justify-center gap-2 w-32 min-h-11 px-3 py-2 rounded-lg text-sm transition-colors
            ${resetArmed ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-ink hover:bg-slate-800'}`}
        >
          <RotateCcw className="w-4 h-4" /><span className={resetArmed ? 'hidden' : ''}>Reset</span>
          {resetArmed && <span className="pr-1">Reset all?</span>}
        </button>
        <button onClick={onClose} title="Close" aria-label="Close" className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-ink hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {page.mode === 'done' ? (
        <div className="bg-panel border border-line rounded-2xl p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-ink">Your starting point is ready</h2>
          <p className="mt-3 text-muted leading-relaxed">You’ve finished this calibration. You can revisit any vocabulary range above.</p>
          <button onClick={onClose} className="inline-flex items-center justify-center gap-2 mt-6 min-h-12 px-5 rounded-xl bg-primary text-on-primary font-semibold">
            {initialEntry ? 'Continue to Atlas' : 'Return to learning'}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
        <div className="state-legend" aria-label="Calibration legend">
          <span><i className="legend-swatch bg-rose-500" aria-hidden="true" />Selected = unknown</span>
          <span><i className="legend-swatch border border-control bg-panel" aria-hidden="true" />Unselected = known when saved</span>
          <span><i className="legend-swatch border border-dashed border-control" aria-hidden="true" />Dashed border = unsaved</span>
        </div>
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
                  className={`calibration-tile w-full py-3 flex flex-col items-center justify-center rounded-xl border-2 transition-colors
                    ${pending(l.lemma_id) ? 'border-dashed' : ''}
                    ${isUnknown
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'}`}
                >
                  <span className="font-arabic text-[26px] leading-[1.8]">{l.plaintext}</span>
                  <span dir="ltr" className="mt-1 px-3 max-w-full line-clamp-2 text-xs text-slate-400">{formatGloss(l.translation)}</span>
                </button>
              </div>
            );
          })}
        </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 justify-between">
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
            className="flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-on-primary transition-colors disabled:opacity-50"
          >
            {busy ? <Loader className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}<span>Save and continue</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CalibrateView;
