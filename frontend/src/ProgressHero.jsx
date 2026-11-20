import React, { useMemo, useState } from 'react';
import { Loader } from 'lucide-react';

// Vocabulary size by age, (age in years, words known), from the three cited studies; interpolated on log(words)
const AGES = [[1.5, 75], [2, 308], [2.5, 555], [6.6, 5925], [7.3, 6097], [8.0, 11182], [9.0, 14819], [10.0, 18812],
              [11.2, 25694], [12.8, 38029], [20, 42000], [60, 48200]];
const ADULT = 18; // the ruler's end: knowing the whole lexicon works out to about 17½
const CITATIONS = [
  <>Fenson, L., et al. (1994). Variability in early communicative development. <i>Monographs of the Society for Research in Child Development</i>, 59(5).</>,
  <>Segbers, J., &amp; Schroeder, S. (2017). How many words do children know? A corpus-based estimation of children's total vocabulary size. <i>Language Testing</i>, 34(3), 297–320.</>,
  <>Brysbaert, M., Stevens, M., Mandera, P., &amp; Keuleers, E. (2016). How many words do we know? <i>Frontiers in Psychology</i>, 7, 1116.</>,
];

const ageFor = (words) => {
  if (words <= 0) return 1;
  if (words < AGES[0][1]) return 1 + 0.5 * words / AGES[0][1];
  for (let i = 1; i < AGES.length; i++) {
    const [a0, w0] = AGES[i - 1], [a1, w1] = AGES[i];
    if (words <= w1) return a0 + (a1 - a0) * (Math.log(words) - Math.log(w0)) / (Math.log(w1) - Math.log(w0));
  }
  return 60;
};
const wordsFor = (age, max) => {  // the inverse, for dragging the ruler
  if (age <= 1.5) return Math.round(AGES[0][1] * Math.max(0, age - 1) / 0.5);
  for (let i = 1; i < AGES.length; i++) {
    const [a0, w0] = AGES[i - 1], [a1, w1] = AGES[i];
    if (age <= a1) return Math.min(max, Math.round(Math.exp(Math.log(w0) + (Math.log(w1) - Math.log(w0)) * (age - a0) / (a1 - a0))));
  }
  return max;
};
const agePhrase = (words) => {
  if (words < AGES[0][1]) return words ? 'Fewer words than an 18-month-old' : "Well, you'd be mute";
  const age = ageFor(words), r = age < 6 ? Math.round(age * 2) / 2 : Math.round(age);
  if (r >= ADULT) return 'As many words as an adult';
  const label = r < 2 ? '18-month-old' : `${Math.floor(r)}${r % 1 ? '½' : ''}-year-old`;
  return `As many words as ${/^(8|11|18)/.test(label) ? 'an' : 'a'} ${label}`;
};
// The ruler runs from age 1 to 18 on a square-root scale, so the early years get room
const pos = (age) => 100 * Math.sqrt(Math.min(1, Math.max(0, age - 1) / (ADULT - 1)));
const ageAt = (p) => 1 + (ADULT - 1) * (p / 100) ** 2;
const pct = (x) => '~' + (x < 0.1 ? (100 * x).toFixed(1) : Math.round(100 * x)) + '%';
const fmt = (n) => n.toLocaleString('en-US');

// "You know x words!": how far you've come, as an age and as text coverage. Dragging the ruler (or typing a count)
// tries other sizes, as if the next words were learned in frequency order; Reset goes back to yours.
// onCalibrate: with no known words, the subtitle sends you to Calibrate
const ProgressHero = ({ states, occ, onCalibrate }) => {
  const [trying, setTrying] = useState(null); // a vocabulary size being tried, or null for yours
  const [typed, setTyped] = useState('');
  const ready = !!(states && occ);

  // Prefix sums of corpus frequency over your known words and over the rest, both in rank order
  const model = useMemo(() => {
    if (!ready) return { mine: 0, n: 1, cover: () => 0 };
    const mineCum = [0], restCum = [0];
    let total = 0;
    for (let i = 0; i < states.length; i++) {
      const o = occ[i] || 0;
      total += o;
      if (states[i] === 'k') mineCum.push(mineCum[mineCum.length - 1] + o);
      else restCum.push(restCum[restCum.length - 1] + o);
    }
    const mine = mineCum.length - 1;
    return { mine, n: states.length, cover: (count) => (count <= mine ? mineCum[count] : mineCum[mine] + restCum[count - mine]) / (total || 1) };
  }, [ready, states, occ]);

  const count = Math.max(0, Math.min(model.n, trying ?? model.mine));
  const x = pos(ageFor(count)), goal = Math.ceil(model.n * 0.2);
  const tryCount = (c) => { setTrying(c); setTyped(String(c)); };
  const reset = () => { setTrying(null); setTyped(''); };

  return (
    <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-5 md:p-6">
    {/* laid out (invisibly) while loading, so nothing moves when it appears */}
    {!ready && <div className="absolute inset-0 grid place-items-center text-indigo-400"><Loader className="w-8 h-8 animate-spin" aria-label="Loading" /></div>}
    <section className={`text-center ${ready ? '' : 'invisible'}`} aria-hidden={!ready}>
      <h1 className="text-4xl sm:text-5xl leading-tight font-bold tracking-tight text-ink tabular-nums">
        <small className="text-[.5em] font-semibold text-slate-400 tracking-normal">{trying === null ? 'You know' : 'If you knew'}</small>{' '}
        {fmt(count)}{' '}
        <small className="text-[.5em] font-semibold text-slate-400 tracking-normal">{count === 1 ? 'word' : 'words'}{trying === null ? '!' : '...'}</small>
      </h1>
      <p className="mt-2 text-sm sm:text-base text-slate-400 inline-flex items-center gap-2.5">
        {count === 0 && trying === null
          ? <span><button onClick={onCalibrate} className="text-indigo-300 font-semibold hover:underline">Calibrate</button> to get started!</span>
          : agePhrase(count)}
        <span tabIndex={0} aria-label="Sources"
              className="group grid shrink-0 place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] border-slate-600 text-slate-400 text-xs font-bold cursor-help hover:text-ink hover:border-slate-400 focus:text-ink focus:outline-none">
          i
          <span className="hidden group-hover:block group-focus:block absolute top-24 left-1/2 -translate-x-1/2 w-[min(360px,86vw)] z-30 text-left bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed font-normal text-slate-400 shadow-2xl space-y-2">
            {CITATIONS.map((c, i) => <span key={i} className="block">{c}</span>)}
          </span>
        </span>
      </p>

      {/* The age ruler is also the control: an invisible range input covers it */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)_180px] items-center gap-1.5 lg:gap-4 max-w-[1060px] mx-auto mt-3">
        <span className="hidden lg:block" />
        <div className="vocabulary-ruler relative h-14 mx-4" style={{ touchAction: 'none' }}>
          <div className="absolute inset-x-0 top-[22px] h-1.5 rounded bg-slate-800" />
          <div className={`absolute left-0 top-[22px] h-1.5 rounded bg-indigo-500 ${trying === null ? 'transition-all duration-300' : ''}`} style={{ width: `${x}%` }} />
          {[2, 4, 6, 8, 10, 13, 18].map(a => (
            <span key={a} className="absolute top-[34px] -translate-x-1/2 text-xs text-slate-400 tabular-nums pointer-events-none before:content-[''] before:absolute before:left-1/2 before:-top-3 before:w-0.5 before:h-1.5 before:bg-slate-600 before:rounded-sm" style={{ left: `${pos(a)}%` }}>{a}</span>
          ))}
          <div className={`absolute top-3 w-[26px] h-[26px] -ml-[13px] rounded-full bg-primary shadow-[0_0_0_5px_rgb(var(--primary)/.18)] pointer-events-none ${trying === null ? 'transition-all duration-300' : ''}`} style={{ left: `${x}%` }} />
          <input type="range" min="0" max="1000" step="1" value={Math.round(x * 10)} aria-label="Try another vocabulary size"
                 onChange={(e) => tryCount(wordsFor(ageAt(+e.target.value / 10), model.n))}
                 className="absolute inset-y-0 -inset-x-[13px] w-[calc(100%+26px)] h-full m-0 opacity-0 cursor-pointer" />
        </div>
        <div className={`vocabulary-reset flex items-center justify-center lg:justify-start gap-2 ${trying === null ? 'invisible' : ''}`}>
          <input type="number" min="0" max={model.n} value={typed} aria-label="Words known"
                 onChange={(e) => { setTyped(e.target.value); if (e.target.value !== '') setTrying(Math.max(0, Math.min(model.n, Math.round(+e.target.value)))); }}
                 className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-semibold tabular-nums focus:border-indigo-400 focus:outline-none" />
          <button onClick={reset} className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-ink hover:border-slate-500">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 max-w-[640px] mx-auto mt-3 gap-0 text-sm">
        <div className="px-3">
          <b className="block text-2xl md:text-3xl font-bold tracking-tight text-ink tabular-nums">{pct(model.cover(count))}</b>
          <span className="text-slate-400">of everyday Arabic text</span>
        </div>
        <div className="px-3 border-l border-slate-700">
          <b className="block text-2xl md:text-3xl font-bold tracking-tight text-ink tabular-nums">{count < goal ? fmt(goal - count) : pct(count / model.n)}</b>
          <span className="text-slate-400">{count < goal ? 'words to 20% of the Arabic lexicon' : 'of the Arabic lexicon'}</span>
        </div>
      </div>
    </section>
    </div>
  );
};

export default ProgressHero;
