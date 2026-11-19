// Flashcard Studio Reader: finds the Arabic on the page, has the server lemmatize it, and colours each word by
// what you know (green known, amber learning, red unknown). Hover a word for its dictionary entry; click it to
// switch known/unknown; Ctrl+drag across words to make a flashcard; Ctrl+←/→ walk the unknown words. A side panel
// shows how much of the page you know, its unknown words, and its i+1 sentences to add as flashcards.
(() => {
  if (window.__fsrLoaded) return;
  window.__fsrLoaded = true;

  // Letters and marks, Quranic ones too (not the standalone symbols ۞ ۩); keep in sync with app_package/reader.py
  const WORD = /[ء-غـ-ٰٟ-ۓۖ-ۜ۟-۪ۨ-ۭ]+/g;
  const HAS_LETTER = /[ء-غف-ي]/;
  const SKIP = 'script, style, noscript, textarea, input, select, code, pre, svg, .fsr-w, #fsr-host, .sr-only, [class*="visuallyHidden"]';
  // Text per request. Camelira takes ~1 s per 180 characters and doesn't go faster in parallel, so small requests
  // colour the page top-down as it goes, rather than all at once at the end.
  const BATCH_CHARS = 350;
  const lemmas = new Map(); // lemma id -> {text, gloss, status: 'k' | 'l' | 'u', cards: has a flashcard for it}

  // ---- server, through the background worker ----
  const api = (path, body) => new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: 'api', path, body }, (r) =>
      r && r.ok ? resolve(r.data) : reject(Object.assign(new Error((r && r.error) || chrome.runtime.lastError?.message || 'No answer'),
        { signedOut: !!(r && r.signedOut) }))));
  const openAtlas = (id) => chrome.runtime.sendMessage({ type: 'atlas', id });
  const openSite = () => chrome.runtime.sendMessage({ type: 'site' });

  // ---- glosses, as the website formats them (frontend/src/Gloss.jsx) ----
  const formatGloss = (gloss) => {
    const parts = (gloss || '').split('#');
    const plain = parts.filter((p) => !p.includes('+'));
    const senses = (plain.length ? plain : parts).map((p) => p.replace(/\[[^\]]*\]/g, '').replace(/_/g, ' ')
      .replace(/;/g, ', ').replace(/^[\s+]+|[\s+]+$/g, '').replace(/\s+/g, ' '));
    return [...new Set(senses)].filter(Boolean).join('; ');
  };
  const firstSense = (gloss) => formatGloss(gloss).split(/[;,]/)[0];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- our UI: in a shadow root, so the page's styles can't reach it (icons: lucide, as on the website) ----
  const ICON = {
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M12 7v6M9 10h6"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    close: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/>',
    open: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
  const STATUS = { k: ['known', '#34d399'], l: ['learning', '#fbbf24'], u: ['unknown', '#fb7185'] };
  const KEYS = [
    ['Click', 'Mark known/unknown'], ['Ctrl + drag', 'Select words'], ['Ctrl + ← →', 'Next / previous unknown word'],
    ['Enter', "Toggle highlighted word's status"], ['Ctrl + Enter', 'Show word on Atlas'], ['Esc', 'Clear'],
  ];
  // The website's fonts (Tailwind's sans and mono stacks, Noto Sans Arabic) and colours (Tailwind slate and indigo)
  const SANS = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
  const ARABIC = '"Noto Sans Arabic", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  const host = document.createElement('div');
  host.id = 'fsr-host';
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  const ui = host.attachShadow({ mode: 'open' });
  ui.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { position: fixed; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.5); font: 14px/1.5 ${SANS}; }
    .ar { font-family: ${ARABIC}; direction: rtl; }
    svg { width: 16px; height: 16px; flex: none; }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    button:disabled { opacity: .5; cursor: default; }
    .icon-btn { padding: 6px; border-radius: 6px; color: #64748b; }
    .icon-btn:hover { color: #fff; background: #1e293b; }
    .spin { width: 14px; height: 14px; border: 2px solid #334155; border-top-color: #818cf8; border-radius: 50%; animation: spin .8s linear infinite; flex: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* numbers: the new value drops in from above when it goes down, rises from below when it goes up (as on Flashcards) */
    .num { display: inline-block; }
    .tick-down { animation: tick-down .4s cubic-bezier(.2,.8,.3,1.25); }
    .tick-up { animation: tick-up .4s cubic-bezier(.2,.8,.3,1.25); }
    @keyframes tick-down { from { transform: translateY(-.45em); opacity: 0; } }
    @keyframes tick-up { from { transform: translateY(.45em); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .tick-down, .tick-up { animation: none; } }
    [hidden] { display: none !important; }

    /* collapsed: the percentage, top right */
    #tab { position: fixed; top: 12px; right: 12px; padding: 6px 12px; border-radius: 9999px; background: #4f46e5; color: #fff;
      font: 700 14px/1.25 ${SANS}; font-variant-numeric: tabular-nums; cursor: pointer; overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(49,46,129,.3); display: inline-flex; align-items: center; gap: 6px; }
    #tab:hover { background: #6366f1; }

    /* the side panel */
    #side { position: fixed; top: 0; right: 0; bottom: 0; width: min(360px, 100vw); display: flex; flex-direction: column;
      background: #0f172a; color: #e2e8f0; border-left: 1px solid #1e293b; box-shadow: -16px 0 40px rgba(0,0,0,.35); font: 14px/1.5 ${SANS}; }
    #side header { display: flex; align-items: center; gap: 4px; padding: 12px 12px 0; }
    #side .me { padding: 0; border-radius: 9999px; width: 32px; height: 32px; overflow: hidden; justify-content: center;
      background: #1e293b; color: #94a3b8; box-shadow: 0 0 0 2px #1e293b; }
    #side .me:hover { box-shadow: 0 0 0 2px #475569; color: #fff; }
    #side .me img { width: 100%; height: 100%; object-fit: cover; }
    #side .me .initial { width: 100%; height: 100%; display: grid; place-items: center; background: #4f46e5; color: #fff; font-size: 14px; font-weight: 600; }
    #side .grow { flex: 1; }
    #side .help.on { color: #fff; background: #1e293b; }
    .score { padding: 4px 20px 16px; }
    .score .pct { font-size: 48px; line-height: 1; font-weight: 700; letter-spacing: -.025em; color: #fff; font-variant-numeric: tabular-nums; overflow: hidden; display: inline-block; }
    .score .cap { color: #94a3b8; margin-left: 6px; }
    .score .bar { height: 6px; border-radius: 9999px; background: #1e293b; overflow: hidden; margin-top: 10px; }
    .score .bar i { display: block; height: 100%; background: #6366f1; border-radius: 9999px; transition: width .5s ease; }
    .keys { margin: 0 12px 12px; padding: 4px 12px; background: #020617; border: 1px solid #1e293b; border-radius: 12px; font-size: 12px; }
    .keys div { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #0f172a; }
    .keys div:last-child { border: 0; }
    .keys span { color: #cbd5e1; }
    kbd { font: 600 11px/1 ${MONO}; color: #e2e8f0; background: #1e293b; border: 1px solid #334155;
      border-bottom-width: 2px; border-radius: 6px; padding: 4px 6px; white-space: nowrap; }
    .body { flex: 1; overflow-y: auto; padding: 0 12px 12px; border-top: 1px solid #1e293b; }
    .body::-webkit-scrollbar { width: 8px; } .body::-webkit-scrollbar-track { background: #0f172a; }
    .body::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; } .body::-webkit-scrollbar-thumb:hover { background: #475569; }
    h3 { display: flex; align-items: center; gap: 8px; margin: 16px 4px 10px; font-size: 12px; font-weight: 600; letter-spacing: .05em;
      text-transform: uppercase; color: #64748b; }
    h3 .n { color: #94a3b8; font-variant-numeric: tabular-nums; }
    h3 .grow { flex: 1; }
    h3 .done { padding: 2px 10px; border-radius: 9999px; background: #1e293b; color: #cbd5e1; letter-spacing: 0; text-transform: none; font-weight: 600; }
    h3 .done:hover { background: #334155; color: #fff; }
    h3 .more { padding: 2px; border-radius: 6px; color: #64748b; }
    h3 .more:hover { color: #fff; background: #1e293b; }
    h3 .more svg { transition: transform .2s; }
    h3 .more.open svg { transform: rotate(180deg); }
    /* collapsed, the chips show their first row, and the second fading out */
    .chips { display: flex; flex-wrap: wrap; gap: 6px; direction: rtl; }
    .chips.folded { max-height: 66px; overflow: hidden; -webkit-mask-image: linear-gradient(#000 38px, transparent 66px); mask-image: linear-gradient(#000 38px, transparent 66px); }
    .chip { padding: 2px 10px; border-radius: 8px; background: #020617; border: 1px solid #1e293b; color: #fb7185;
      font: 18px/1.75 ${ARABIC}; transition: border-color .15s, color .15s; }
    .chip:hover { border-color: #475569; }
    .chip.known { color: #6ee7b7; border-color: rgba(52,211,153,.35); background: rgba(52,211,153,.06); }
    .chip.focus { outline: 2px solid #6366f1; outline-offset: 1px; border-color: #6366f1; }
    .empty { color: #475569; padding: 4px; }
    .cover { margin: 16px 4px 0; color: #94a3b8; font-size: 12px; }
    .cover b { color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
    .cover + h3 { margin-top: 10px; }
    .item { position: relative; padding: 10px 12px; border-radius: 12px; border: 1px solid #1e293b; background: #020617; cursor: pointer; margin-bottom: 8px; }
    .item:hover { border-color: #334155; }
    .item.staged { border-color: #6366f1; background: rgba(99,102,241,.1); }
    .item .s { font-family: ${ARABIC}; direction: rtl; font-size: 18px; line-height: 1.8; padding-left: 28px; }
    .item .s [data-lemma] { border-radius: 4px; }
    .item .s [data-lemma]:hover { background: rgba(99,102,241,.2); }
    .item .s b { color: #fbbf24; font-weight: 500; }
    .item .en { color: #94a3b8; font-size: 14px; margin-top: 2px; }
    .item .edit { position: absolute; top: 8px; left: 6px; }
    .item.editing { cursor: default; }
    .item textarea { width: 100%; resize: vertical; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 12px;
      padding: 8px 12px; font: 14px/1.5 ${SANS}; margin-top: 6px; }
    .item textarea.ar-in { font: 18px/1.6 ${ARABIC}; }
    .item textarea:focus { outline: none; border-color: #6366f1; }
    .item .row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
    .item .row .grow { flex: 1; }
    .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; font-size: 12px; font-weight: 500; }
    .btn:hover { background: #1e293b; color: #fff; }
    .btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; font-weight: 600; }
    .btn.primary:hover { background: #6366f1; }
    #side footer { padding: 12px; border-top: 1px solid #1e293b; }
    #side .add { width: 100%; justify-content: center; padding: 10px; border-radius: 12px; background: #4f46e5; color: #fff; font-weight: 600; font-size: 14px;
      box-shadow: 0 10px 15px -3px rgba(49,46,129,.2); }
    #side .add:hover:not(:disabled) { background: #6366f1; }

    /* the popup dictionary, as on the website */
    #pop { position: fixed; background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 8px; padding: 8px;
      min-width: 120px; max-width: 320px; text-align: center; font: 12px/1.5 ${SANS}; box-shadow: 0 20px 25px -5px rgba(0,0,0,.4); }
    #pop::after { content: ''; position: absolute; left: var(--arrow, 50%); transform: translateX(-50%); border: 4px solid transparent; }
    #pop.above::after { top: 100%; border-top-color: #1e293b; }
    #pop.below::after { bottom: 100%; border-bottom-color: #1e293b; }
    #pop .lemma { font: 700 16px/1.5 ${ARABIC}; color: #818cf8; margin-bottom: 2px; }
    #pop .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
    #pop .rank { font-family: ${MONO}; color: #64748b; }
    #pop .atlas { padding: 3px; border-radius: 6px; color: #94a3b8; }
    #pop .atlas:hover { color: #fff; background: #334155; }
    #pop i { color: #64748b; }
    #card { width: min(460px, calc(100vw - 24px)); padding: 14px; }
    #card .close { position: absolute; top: 8px; left: 8px; padding: 4px; border-radius: 6px; color: #64748b; }
    #card .close:hover { color: #fff; background: #1e293b; }
    #card .words { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; font-size: 22px; line-height: 1.8; padding: 4px 18px 0; }
    #card .chip { display: inline; padding: 0 5px; border-radius: 6px; cursor: pointer; color: #e2e8f0; border: 0; background: none; font: inherit; }
    #card .chip:hover { background: #1e293b; }
    #card .chip.none { color: #64748b; cursor: default; }
    #card .chip.target { color: #fbbf24; background: rgba(251,191,36,.12); }
    #card .meaning { text-align: center; color: #fbbf24; min-height: 20px; margin: 2px 0 8px; }
    #card textarea { width: 100%; height: 64px; resize: vertical; background: #020617; color: #e2e8f0; border: 1px solid #334155;
      border-radius: 12px; padding: 8px 12px; font: 14px/1.5 ${SANS}; }
    #card textarea:focus { outline: none; border-color: #6366f1; }
    #card .actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; }
    #card .translate { padding: 7px 12px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; }
    #card .translate:hover { background: #1e293b; }
    #card .create { padding: 7px 14px; border-radius: 8px; background: #4f46e5; color: #fff; font-weight: 600; }
    #card .create:hover { background: #6366f1; }
    #card .msg { text-align: center; font-size: 12px; margin-top: 8px; min-height: 18px; color: #94a3b8; }
    #card .msg.bad { color: #fb7185; } #card .msg.ok { color: #34d399; }
    #load { right: 16px; bottom: 16px; padding: 7px 12px; display: flex; align-items: center; gap: 8px; border-radius: 9999px; font-size: 12px; color: #cbd5e1; }
    :host(.open) #load { right: 376px; }
    #load.bad { color: #fb7185; } #load.bad .spin { display: none; }
    #load.link { cursor: pointer; } #load.link:hover { color: #fda4af; }
  </style>
  <aside id="side" hidden>
    <header>
      <button class="me" title="Flashcard Studio"></button>
      <span class="grow"></span>
      <button class="icon-btn help" title="Controls" aria-label="Controls">${icon('help')}</button>
      <button class="icon-btn collapse" title="Collapse" aria-label="Collapse">${icon('close')}</button>
    </header>
    <div class="score"><span class="pct"><span class="num">–</span></span><span class="cap">known</span><div class="bar"><i style="width:0"></i></div></div>
    <div class="keys" hidden>${KEYS.map(([k, what]) => `<div><span>${what}</span><kbd>${k}</kbd></div>`).join('')}</div>
    <div class="body">
      <p class="cover"></p>
      <h3>Unknown words <span class="n unknown-n"></span><span class="grow"></span><button class="done">Done</button>
        <button class="more" title="Show all" aria-label="Show all">${icon('chevron')}</button></h3>
      <div class="chips folded"></div>
      <h3>Comprehensible sentences <span class="n iplus-n"></span></h3>
      <div class="list"></div>
    </div>
    <footer><button class="add">${icon('book')}<span></span></button></footer>
  </aside>
  <button id="tab" hidden></button>
  <div id="pop" hidden></div>
  <div id="card" class="panel" hidden></div>
  <div id="load" class="panel" hidden><span class="spin"></span><span class="text"></span></div>`;
  const $ = (sel) => ui.querySelector(sel);

  // ---- finding and wrapping the Arabic ----
  function textNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.__fsr || !HAS_LETTER.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const el = node.parentElement;
        if (!el || el.closest(SKIP) || el.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  // quran.com draws verses in glyph fonts (QCF), so a word's text there is a glyph code; its API has the Arabic.
  // node.__ar holds a text node's Arabic when that differs from its text.
  const textOf = (n) => n.__ar ?? n.nodeValue;
  const wordText = (span) => span.firstChild?.__ar ?? span.textContent;
  const verses = new Map(); // '108:1' -> Promise of {position: Arabic} (words only, not the verse-end marks)
  const verse = (key) => {
    if (!verses.has(key)) {
      verses.set(key, fetch(`https://api.quran.com/api/v4/verses/by_key/${key}?words=true&word_fields=text_uthmani`)
        .then((r) => r.json()).then((d) => Object.fromEntries(d.verse.words.filter((w) => w.char_type_name === 'word').map((w) => [w.position, w.text_uthmani])))
        .catch(() => { verses.delete(key); return {}; }));
    }
    return verses.get(key);
  };
  async function glyphs() {
    const found = [];
    for (const el of document.querySelectorAll('[data-word-location] [data-quran-render-target="qcf"]')) {
      const node = el.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE || node.__fsr || el.closest('.fsr-w')) continue;
      node.__fsr = true;
      found.push([node, el.closest('[data-word-location]').dataset.wordLocation.split(':')]);
    }
    const ready = [];
    await Promise.all(found.map(async ([node, [ch, v, pos]]) => {
      const text = (await verse(`${ch}:${v}`))[pos];
      if (text && node.isConnected) { node.__ar = text; ready.push(node); }
    }));
    if (running) enqueue(ready);
  }
  // A word's sentence and lemmatizing context: its block element, or on quran.com its verse
  const blockOf = (node) => node.parentElement.closest('[data-word-location]')?.parentElement || node.parentElement.closest(BLOCK);

  const paint = (span) => {
    const l = lemmas.get(+span.dataset.lemma);
    span.classList.remove('fsr-k', 'fsr-l', 'fsr-u');
    if (l) span.classList.add(`fsr-${l.status}`);
  };

  function wrap(node, ids) {
    if (!node.isConnected) return;
    if (node.__ar) { // a glyph word: the span goes around the node as it is
      const span = document.createElement('span');
      span.className = 'fsr-w';
      const id = ids.find(Boolean);
      if (id) span.dataset.lemma = id;
      paint(span);
      node.replaceWith(span);
      span.append(node);
      return;
    }
    const text = node.nodeValue, frag = document.createDocumentFragment();
    let last = 0, k = 0;
    for (const m of text.matchAll(WORD)) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const span = document.createElement('span');
      span.className = 'fsr-w';
      span.textContent = m[0];
      const id = ids[k++];
      if (id) span.dataset.lemma = id;
      paint(span);
      frag.append(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }

  // A queue of paragraphs, lemmatized in batches with a progress pill. Text nodes are grouped by their block
  // element and sent as one text, so the disambiguator sees whole sentences even when a page puts every word in
  // its own element. Joined with spaces, so each node's words line up with the ids that come back.
  const BLOCK = 'p, div, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption, caption, article, section, body';
  const queue = [];
  let busy = false, total = 0, done = 0, failed = 0, signedOut = false, generation = 0, running = false;
  function enqueue(nodes) {
    if (!nodes.length) return;
    const blocks = new Map();
    for (const n of nodes) {
      n.__fsr = true;
      const block = blockOf(n);
      if (!blocks.has(block)) blocks.set(block, []);
      blocks.get(block).push(n);
    }
    queue.push(...blocks.values());
    total += nodes.length;
    if (!busy) pump();
  }
  function progress() {
    const load = $('#load');
    if (busy) {
      load.className = 'panel';
      load.querySelector('.text').textContent = `Lemmatizing ${Math.round((100 * done) / Math.max(1, total))}%`;
      load.hidden = false;
    } else if (signedOut) {
      load.className = 'panel bad link';
      load.querySelector('.text').textContent = 'Sign in to Flashcard Studio to see your words';
      load.hidden = false;
    } else if (failed) {
      load.className = 'panel bad';
      load.querySelector('.text').textContent = `${failed} ${failed === 1 ? 'part' : 'parts'} of the page couldn't be lemmatized`;
      load.hidden = false;
      failed = 0; // said once; new text failing later says so again
      setTimeout(() => { if (!busy) load.hidden = true; }, 6000);
    } else load.hidden = true;
  }
  async function pump() {
    busy = true;
    const gen = generation;
    progress();
    while (queue.length) {
      // About BATCH_CHARS of text per request (the server lemmatizes a request's pieces in parallel)
      const batch = [];
      for (let chars = 0; queue.length && chars < BATCH_CHARS && batch.length < 100;) {
        const group = queue.shift().filter((n) => n.isConnected);
        if (group.length) { batch.push(group); chars += group.reduce((s, n) => s + textOf(n).length, 0); }
      }
      const count = batch.reduce((s, g) => s + g.length, 0);
      if (batch.length) {
        const retry = (group) => { failed += group.length; }; // Rescan tries them again
        try {
          const r = await api('/api/reader/analyze', { texts: batch.map((g) => g.map(textOf).join(' ')) });
          if (gen !== generation) break; // a rescan started over meanwhile
          for (const [id, [text, gloss, status, cards]] of Object.entries(r.lemmas)) lemmas.set(+id, { text, gloss, status, cards });
          batch.forEach((group, k) => {
            const ids = r.words[k];
            if (!ids) return retry(group);
            let at = 0;
            for (const n of group) {
              const words = (textOf(n).match(WORD) || []).length;
              wrap(n, ids.slice(at, at + words));
              at += words;
            }
          });
        } catch (err) {
          console.warn('[Flashcard Studio Reader]', err.message);
          batch.forEach(retry);
          if (err.signedOut) { signedOut = true; queue.length = 0; } // nothing will work until then
        }
      }
      if (gen !== generation) break;
      done += count;
      progress();
      refresh();
    }
    busy = false;
    total = done = 0;
    if (running) progress();
    if (gen !== generation && queue.length) pump();
  }

  function scan() {
    failed = 0; signedOut = false;
    enqueue(textNodes(document.body));
    glyphs();
  }

  // Undo our colouring: the page's text as it was, nothing queued, our state cleared
  function reset() {
    generation++;
    queue.length = 0;
    closeCard(); setFocus(null);
    const parents = new Set();
    document.querySelectorAll('.fsr-w').forEach((span) => {
      parents.add(span.parentNode);
      span.replaceWith(span.firstChild?.__ar ? span.firstChild : span.textContent);
    });
    parents.forEach((p) => p && p.normalize());
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); // failed parts get another try
    while (walker.nextNode()) walker.currentNode.__fsr = false;
    lemmas.clear();
    shownUnknown = []; items.clear(); chipFocus = null;
  }

  // Rescan: start over, so statuses come fresh (after signing in, say)
  function rescan() {
    if (!running) return;
    reset();
    loadAccount();
    scan();
  }

  // New text on dynamic pages (infinite scroll, single-page apps)
  let scanTimer = null;
  const observer = new MutationObserver((mutations) => {
    if (mutations.every((m) => host.contains(m.target) || m.target.closest?.('.fsr-w'))) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { enqueue(textNodes(document.body)); glyphs(); }, 1000);
  });

  // ---- dictionary popup ----
  let popFor = null, popHide = null, pinned = false;
  function place(panel, rect, gap = 8) {
    panel.hidden = false;
    const { width, height } = panel.getBoundingClientRect();
    let top = rect.top - height - gap;
    const above = top >= 8;
    if (!above) top = rect.bottom + gap;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${left}px`;
    panel.classList.toggle('above', above);
    panel.classList.toggle('below', !above);
    panel.style.setProperty('--arrow', `${Math.min(width - 10, Math.max(10, rect.left + rect.width / 2 - left))}px`);
  }
  function showPop(span) { // span: a page word, or a chip or word in the panel
    const id = +span.dataset.lemma, l = lemmas.get(id);
    if (!l) return;
    clearTimeout(popHide);
    popFor = span;
    const [label, colour] = STATUS[l.status];
    $('#pop').innerHTML = `<div class="lemma">${esc(l.text)}</div><div class="gloss">${esc(formatGloss(l.gloss)) || '<i>No translation</i>'}</div>
      <div class="row"><span class="rank">#${id.toLocaleString()}</span><span style="color:${colour}">${label}</span>
      <button class="atlas" title="Show on Atlas" aria-label="Show on Atlas">${icon('map')}</button></div>`;
    $('#pop .atlas').onclick = () => openAtlas(id);
    place($('#pop'), span.getBoundingClientRect());
  }
  function hidePop(now) {
    clearTimeout(popHide);
    if (now) { $('#pop').hidden = true; popFor = null; return; }
    popHide = setTimeout(() => { if (!pinned) { $('#pop').hidden = true; popFor = null; } }, 250);
  }
  $('#load').addEventListener('click', () => {  // signed out: sign in, then rescan this page from the popup
    if (signedOut) { openSite(); $('#load').hidden = true; }
  });
  $('#pop').addEventListener('mouseenter', () => clearTimeout(popHide));
  $('#pop').addEventListener('mouseleave', () => hidePop());

  // ---- known/unknown ----
  async function setKnown(id, known) {
    const l = lemmas.get(id);
    if (!l || l.status === 'l') return; // learning words are the flashcards' business
    try {
      await api(`/api/set-known/${id}`, { known });
    } catch (err) {
      console.warn('[Flashcard Studio Reader]', err.message);
      return;
    }
    for (const other of lemmas.values()) if (other.text === l.text && other.status !== 'l') other.status = known ? 'k' : 'u';
    document.querySelectorAll('.fsr-w[data-lemma]').forEach(paint);
    refresh();
    if (popFor) setTimeout(() => popFor && showPop(popFor.isConnected ? popFor : ui.querySelector(`[data-lemma="${popFor.dataset.lemma}"]`) || popFor), 40);
  }
  const hasCards = (id) => { // a flashcard for it was just made: for every lemma spelled the same
    const text = lemmas.get(id)?.text;
    for (const l of lemmas.values()) if (l.text === text) l.cards = true;
    refresh();
  };
  const toggle = (span) => {
    const l = lemmas.get(+span.dataset.lemma);
    if (l) setKnown(+span.dataset.lemma, l.status !== 'k');
  };

  // ---- the side panel ----
  let settings = { showScore: true }, panelOpen = false, shownUnknown = [], editing = null, adding = false, chipFocus = null, folded = true;
  const items = new Map(); // i+1 sentence text -> {arabic, english, target, staged, added, edited}
  const MIN_WORDS = 3, MAX_WORDS = 30; // ponytail: shorter "sentences" are headings and labels, longer ones too much for a card
  const END = /[.!?؟؛…\n]/;

  // How much of the page you know: known words over words with a lemma (names and the like don't count)
  function score() {
    let known = 0, all = 0;
    document.querySelectorAll('.fsr-w[data-lemma]').forEach((w) => {
      const l = lemmas.get(+w.dataset.lemma);
      if (l) { all++; if (l.status === 'k') known++; }
    });
    return all ? Math.round((100 * known) / all) : null;
  }

  // A number swapped in with the website's tick (FlashcardsView's Tick): the new value drops in from above when it
  // goes down and rises from below when it goes up
  function tick(el, value, suffix = '%') {
    const from = el.__value;
    el.__value = value;
    if (from === value) return;
    el.innerHTML = `<span class="num">${value}${suffix}</span>`;
    if (from !== undefined) el.firstChild.classList.add(value < from ? 'tick-down' : 'tick-up');
  }

  // The page's sentences, in order: Arabic words and what's between them, cut at sentence-ending punctuation
  // and at block boundaries. Sentences with text we couldn't lemmatize, or Latin letters, are left out.
  function pageSentences() {
    const out = [];
    let cur = null, curBlock = null;
    const flush = () => { if (cur && cur.parts.some(([, w]) => w)) out.push(cur); cur = null; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const el = n.parentElement;
        return !el || el.closest('script, style, noscript, textarea, input, select, code, pre, svg, #fsr-host') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const n = walker.currentNode, span = n.parentElement.closest('.fsr-w'), block = blockOf(n);
      if (block !== curBlock) { flush(); curBlock = block; }
      if (span) {
        cur = cur || { parts: [], bad: false };
        cur.parts.push([textOf(n), span.dataset.lemma ? +span.dataset.lemma : 0]);
        if (n.__ar) cur.parts.push([' ', null]); // glyph words have no spaces between them
        continue;
      }
      if (n.parentElement.closest('[data-quran-render-target]')) { flush(); continue; } // a verse-end mark
      if (!cur) continue; // text before a sentence's first Arabic word
      const m = n.nodeValue.match(END);
      const piece = m ? n.nodeValue.slice(0, m.index + 1) : n.nodeValue;
      if (HAS_LETTER.test(piece) || /[A-Za-z]/.test(piece)) cur.bad = true;
      cur.parts.push([piece, null]);
      if (m) flush();
    }
    flush();
    return out.filter((s) => !s.bad);
  }

  // Sentences with exactly one unknown word (learning words count as known, as on Atlas)
  function iPlusOne() {
    const found = new Map();
    for (const s of pageSentences()) {
      const words = s.parts.filter(([, w]) => w !== null);
      if (words.length < MIN_WORDS || words.length > MAX_WORDS) continue;
      const unknown = new Set(words.filter(([, id]) => id && lemmas.get(id)?.status === 'u').map(([, id]) => id));
      if (unknown.size !== 1) continue;
      const text = s.parts.map(([t]) => t).join('').replace(/\s+/g, ' ').trim();
      if (!found.has(text)) found.set(text, { text, parts: s.parts, target: [...unknown][0] });
    }
    return [...found.values()].sort((a, b) => a.target - b.target); // by rank, as the unknown words
  }

  function renderAccount(session) {
    const me = $('#side .me'), user = session?.user;
    me.innerHTML = user?.photo ? `<img src="${esc(user.photo)}" alt="" referrerpolicy="no-referrer">`
      : user ? `<span class="initial">${esc((user.name || user.email || '?')[0].toUpperCase())}</span>` : icon('user');
    me.title = user ? `${user.name || user.email} · Atlas` : 'Flashcard Studio';
    me.onclick = () => (user ? openAtlas() : openSite());
  }
  const loadAccount = () => api('/api/auth/me').then(renderAccount, () => renderAccount(null));

  let refreshTimer = 0; // a timer, not requestAnimationFrame, which waits while the tab is in the background
  const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(render, 30); };

  function render() {
    const hasWords = !!document.querySelector('.fsr-w[data-lemma]');
    host.classList.toggle('open', hasWords && panelOpen);
    $('#side').hidden = !hasWords || !panelOpen;
    $('#tab').hidden = !hasWords || panelOpen;
    if (!hasWords) return;

    const pct = score() ?? 0;
    if (settings.showScore) {
      if (!$('#tab .pct')) $('#tab').innerHTML = '<span class="pct"></span>';
      tick($('#tab .pct'), pct);
    } else if (!$('#tab svg')) $('#tab').innerHTML = icon('open');
    $('#tab').title = 'Open the panel';
    $('.score').hidden = !settings.showScore;
    tick($('.score .pct'), pct);
    $('.score .bar i').style.width = `${pct}%`;

    // Unknown words: the page's, most frequent first; ones you mark known stay (green) until Done
    const seen = new Set(shownUnknown.map((id) => lemmas.get(id)?.text));
    const fresh = [...new Set([...document.querySelectorAll('.fsr-w.fsr-u[data-lemma]')].map((w) => +w.dataset.lemma))]
      .filter((id) => !seen.has(lemmas.get(id)?.text) && seen.add(lemmas.get(id)?.text));
    shownUnknown = [...shownUnknown, ...fresh].sort((a, b) => a - b);
    $('.chips').innerHTML = shownUnknown.length
      ? shownUnknown.map((id) => `<button class="chip${lemmas.get(id).status === 'u' ? '' : ' known'}${id === chipFocus ? ' focus' : ''}" data-lemma="${id}">${esc(lemmas.get(id).text)}</button>`).join('')
      : '<div class="empty">None</div>';
    const chips = $('.chips');
    chips.classList.toggle('folded', folded);
    $('.more').hidden = chips.scrollHeight <= 48; // one row: nothing to unfold
    $('.more').classList.toggle('open', !folded);
    const unknown = shownUnknown.filter((id) => lemmas.get(id)?.status === 'u');
    $('.unknown-n').textContent = unknown.length;
    const carded = unknown.filter((id) => lemmas.get(id).cards).length;
    $('.cover').hidden = !unknown.length;
    $('.cover').innerHTML = `You have flashcards for <b>${carded}/${unknown.length}</b> of the unknown words on this page.`;
    $('.done').hidden = !shownUnknown.some((id) => lemmas.get(id)?.status !== 'u');

    if (editing === null) renderSentences();
  }

  function renderSentences() {
    const found = iPlusOne();
    for (const s of found) if (!items.has(s.text)) items.set(s.text, { arabic: s.text, english: '', target: s.target, staged: true, added: false, edited: false });
    const list = found.filter((s) => !items.get(s.text).added);
    $('.iplus-n').textContent = list.length;
    $('.list').innerHTML = list.length ? list.map((s, k) => {
      const it = items.get(s.text);
      if (editing === s.text) {
        return `<div class="item editing${it.staged ? ' staged' : ''}" data-k="${k}">
          <textarea class="ar-in" dir="rtl" rows="2">${esc(it.arabic)}</textarea>
          <textarea class="en-in" rows="2" placeholder="Translation">${esc(it.english)}</textarea>
          <div class="row"><button class="btn tr">${icon('down')}Translate</button><span class="grow"></span>
            <button class="btn cancel">Cancel</button><button class="btn primary save">${icon('check')}Save</button></div></div>`;
      }
      const sentence = it.edited ? esc(it.arabic)
        : s.parts.map(([t, id]) => (id === s.target ? `<b data-lemma="${id}">${esc(t)}</b>` : id ? `<span data-lemma="${id}">${esc(t)}</span>` : esc(t))).join('');
      return `<div class="item${it.staged ? ' staged' : ''}" data-k="${k}">
        <button class="icon-btn edit" title="Edit" aria-label="Edit">${icon('pencil')}</button>
        <div class="s">${sentence}</div>${it.english ? `<div class="en">${esc(it.english)}</div>` : ''}</div>`;
    }).join('') : '<div class="empty">None</div>';
    $('.list').__found = list;
    const staged = list.filter((s) => items.get(s.text).staged).length;
    const add = $('.add');
    if (!adding) add.querySelector('span').textContent = `Add ${staged} ${staged === 1 ? 'flashcard' : 'flashcards'}`;
    add.disabled = adding || !staged;
  }

  // Panel events
  ui.addEventListener('mouseover', (e) => {
    const el = e.target.closest('#side [data-lemma]');
    if (el && !pinned) showPop(el);
  });
  ui.addEventListener('mouseout', (e) => { if (e.target.closest('#side [data-lemma]') && !pinned) hidePop(); });
  document.addEventListener('mousedown', (e) => {
    if (chipFocus !== null && !e.composedPath().some((n) => n.classList?.contains('chip'))) focusChip(null);
  }, true);
  $('#tab').onclick = () => setPanel(true);
  $('#side .collapse').onclick = () => setPanel(false);
  $('#side .help').onclick = (e) => { $('.keys').hidden = !$('.keys').hidden; e.currentTarget.classList.toggle('on', !$('.keys').hidden); };
  $('.chips').onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const id = +chip.dataset.lemma;
    focusChip(id);
    setKnown(id, lemmas.get(id)?.status === 'u');
  };
  $('.more').onclick = () => { folded = !folded; refresh(); };

  // Unknown words by keyboard, once you've clicked one: arrows move (← is next, as the words run right to left),
  // Enter switches known/unknown, Esc stops
  function focusChip(id) {
    chipFocus = id;
    ui.querySelectorAll('.chip.focus').forEach((c) => c.classList.remove('focus'));
    const chip = id && ui.querySelector(`.chip[data-lemma="${id}"]`);
    if (!chip) { pinned = false; hidePop(true); return; }
    if (folded && chip.offsetTop - chip.parentElement.offsetTop > 40) { folded = false; refresh(); setTimeout(() => focusChip(id), 50); return; }
    chip.classList.add('focus');
    chip.scrollIntoView({ block: 'nearest' });
    pinned = true;
    showPop(chip);
  }
  function moveChip(key) {
    const chips = [...ui.querySelectorAll('.chip')], k = chips.findIndex((c) => +c.dataset.lemma === chipFocus);
    if (k < 0) return;
    let next = null;
    if (key === 'ArrowLeft' || key === 'ArrowRight') next = chips[k + (key === 'ArrowLeft' ? 1 : -1)];
    else { // the nearest chip in the row above or below
      const r = chips[k].getBoundingClientRect(), x = r.left + r.width / 2, down = key === 'ArrowDown';
      const rows = chips.filter((c) => (down ? c.getBoundingClientRect().top > r.bottom - 4 : c.getBoundingClientRect().bottom < r.top + 4));
      const rowTop = down ? Math.min(...rows.map((c) => c.getBoundingClientRect().top)) : Math.max(...rows.map((c) => c.getBoundingClientRect().top));
      next = rows.filter((c) => Math.abs(c.getBoundingClientRect().top - rowTop) < 4)
        .sort((a, b) => Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - x) - Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - x))[0];
    }
    if (next) focusChip(+next.dataset.lemma);
  }
  $('.done').onclick = () => { shownUnknown = shownUnknown.filter((id) => lemmas.get(id)?.status === 'u'); refresh(); };
  $('.list').onclick = async (e) => {
    const el = e.target.closest('.item');
    if (!el) return;
    const s = $('.list').__found[+el.dataset.k], it = items.get(s.text);
    if (e.target.closest('.edit')) { editing = s.text; renderSentences(); $('.list .ar-in')?.focus(); return; }
    if (editing === s.text) {
      if (e.target.closest('.cancel')) { editing = null; refresh(); }
      else if (e.target.closest('.save')) {
        const arabic = $('.list .ar-in').value.replace(/\s+/g, ' ').trim();
        it.edited = it.edited || arabic !== it.arabic;
        it.arabic = arabic || it.arabic;
        it.english = $('.list .en-in').value.trim();
        editing = null; refresh();
      } else if (e.target.closest('.tr')) {
        const button = e.target.closest('.tr');
        button.disabled = true;
        try { $('.list .en-in').value = (await api('/translate', { q: $('.list .ar-in').value })).translatedText || ''; }
        catch (err) { console.warn('[Flashcard Studio Reader]', err.message); }
        button.disabled = false;
      }
      return;
    }
    it.staged = !it.staged;
    renderSentences();
  };
  $('.add').onclick = async () => {
    const staged = $('.list').__found.map((s) => items.get(s.text)).filter((it) => it.staged && !it.added);
    if (!staged.length) return;
    const add = $('.add'), label = add.querySelector('span');
    adding = true; add.disabled = true; label.textContent = `Adding ${staged.length}…`;
    try {
      const r = await api('/api/reader/flashcards', { items: staged.map(({ arabic, english, target }) => ({ arabic, english, target })) });
      const failed = new Set(r.failed);
      staged.forEach((it) => { if (!failed.has(it.arabic)) { it.added = true; hasCards(it.target); } });
      label.textContent = `Added ${r.added}${r.failed.length ? ` · ${r.failed.length} failed` : ''}`;
    } catch (err) { label.textContent = err.message; }
    setTimeout(() => { adding = false; refresh(); }, 1600);
  };

  function setPanel(open) {
    panelOpen = open;
    chrome.storage.local.set({ panelOpen: open });
    refresh();
  }

  // ---- keyboard focus: Ctrl+←/→ walk the unknown words ----
  let focused = null;
  function setFocus(span) {
    if (focused) focused.classList.remove('fsr-focus');
    focused = span;
    if (!span) { pinned = false; hidePop(true); return; }
    span.classList.add('fsr-focus');
    const r = span.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) span.scrollIntoView({ block: 'center' });
    pinned = true;
    showPop(span);
  }
  function step(dir) {
    const words = [...document.querySelectorAll('.fsr-w')];
    if (!words.length) return false;
    let i = focused ? words.indexOf(focused) : -1;
    if (i < 0) { // start from the first word on screen
      const onScreen = words.findIndex((w) => w.getBoundingClientRect().bottom > 0);
      i = dir > 0 ? Math.max(onScreen, 0) - 1 : Math.max(onScreen, 0) + 1;
    }
    for (let j = i + dir; j >= 0 && j < words.length; j += dir) {
      if (words[j].classList.contains('fsr-u')) { setFocus(words[j]); return true; }
    }
    return false;
  }

  // ---- Ctrl+drag selection -> flashcard ----
  let dragging = false, anchor = null, current = null, selection = [], swallowClick = false;
  function selectRange() {
    const words = [...document.querySelectorAll('.fsr-w')];
    const a = words.indexOf(anchor), b = words.indexOf(current);
    selection.forEach((w) => w.classList.remove('fsr-sel'));
    selection = words.slice(Math.min(a, b), Math.max(a, b) + 1);
    selection.forEach((w) => w.classList.add('fsr-sel'));
  }
  function clearSelection() {
    selection.forEach((w) => w.classList.remove('fsr-sel'));
    selection = [];
  }

  function openCard(words) {
    const range = document.createRange();
    range.setStartBefore(words[0]);
    range.setEndAfter(words[words.length - 1]);
    const arabic = (words.some((w) => w.firstChild?.__ar) ? words.map(wordText).join(' ') : range.toString()).replace(/\s+/g, ' ').trim();
    const withLemma = words.filter((w) => lemmas.get(+w.dataset.lemma));
    let target = withLemma.find((w) => lemmas.get(+w.dataset.lemma).status === 'u') || withLemma[0] || null;

    const card = $('#card');
    card.innerHTML = `<button class="close" title="Close (Esc)" aria-label="Close">${icon('x')}</button>
      <div class="words ar">${words.map((w, k) => `<span class="chip${w.dataset.lemma && lemmas.get(+w.dataset.lemma) ? '' : ' none'}" data-k="${k}">${esc(wordText(w))}</span>`).join(' ')}</div>
      <div class="meaning"></div>
      <textarea placeholder="Translation" dir="auto"></textarea>
      <div class="actions">
        <button class="translate">${icon('down')}Translate</button>
        <button class="create">${icon('book')}Create flashcard</button>
      </div>
      <div class="msg"></div>`;
    const english = card.querySelector('textarea'), create = card.querySelector('.create'), msg = card.querySelector('.msg');
    const renderCard = () => {
      card.querySelectorAll('.chip').forEach((c) => c.classList.toggle('target', words[+c.dataset.k] === target));
      const l = target && lemmas.get(+target.dataset.lemma);
      card.querySelector('.meaning').innerHTML = l ? `<span class="ar">${esc(l.text)}</span> · ${esc(firstSense(l.gloss))}` : 'Choose the word this flashcard is for';
      create.disabled = !target || !english.value.trim();
    };
    card.querySelectorAll('.chip:not(.none)').forEach((c) => { c.onclick = () => { target = words[+c.dataset.k]; renderCard(); }; });
    english.oninput = renderCard;
    card.querySelector('.close').onclick = closeCard;
    card.querySelector('.translate').onclick = async (e) => {
      const button = e.currentTarget;
      button.disabled = true; msg.className = 'msg'; msg.textContent = 'Translating…';
      try {
        english.value = (await api('/translate', { q: arabic })).translatedText || '';
        msg.textContent = '';
      } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; }
      button.disabled = false; renderCard();
    };
    create.onclick = async () => {
      create.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
      try {
        await api('/api/reader/flashcard', { arabic, english: english.value.trim(), target: +target.dataset.lemma });
        hasCards(+target.dataset.lemma);
        msg.className = 'msg ok'; msg.innerHTML = `${icon('check')} Flashcard added`;
        setTimeout(closeCard, 1200);
      } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; renderCard(); }
    };
    renderCard();
    place(card, range.getBoundingClientRect(), 12);
    english.focus({ preventScroll: true });
  }
  function closeCard() {
    $('#card').hidden = true;
    clearSelection();
  }

  // ---- page events (capture phase, so the page doesn't act on our clicks first) ----
  const wordAt = (e) => (e.target instanceof Element ? e.target.closest('.fsr-w') : null);
  const inOurUi = (e) => e.composedPath().includes(host);

  document.addEventListener('mousedown', (e) => {
    const w = wordAt(e);
    if (!w || e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); // no native text selection, no link handling
    dragging = true; anchor = current = w;
    document.documentElement.classList.add('fsr-dragging');
    hidePop(true); $('#card').hidden = true; setFocus(null);
    selectRange();
  }, true);

  document.addEventListener('mouseover', (e) => {
    const w = wordAt(e);
    if (dragging) { if (w && w !== current) { current = w; selectRange(); } return; }
    if (w && w.dataset.lemma && !pinned) showPop(w);
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (!dragging && wordAt(e) && !pinned) hidePop();
  }, true);

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.documentElement.classList.remove('fsr-dragging');
    swallowClick = true; // the click that ends a drag isn't a known/unknown switch
    if (selection.length) openCard(selection);
  }, true);

  document.addEventListener('click', (e) => {
    const w = wordAt(e);
    if (!w) return;
    e.preventDefault(); // a word inside a link switches, it doesn't navigate
    e.stopPropagation();
    if (swallowClick || e.ctrlKey || e.metaKey) { swallowClick = false; return; }
    toggle(w);
  }, true);

  document.addEventListener('keydown', (e) => {
    const t = e.composedPath()[0];
    const typing = t instanceof Element && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (chipFocus !== null && !typing) {
      if (/^Arrow/.test(e.key)) moveChip(e.key);
      else if (e.key === 'Enter') setKnown(chipFocus, lemmas.get(chipFocus)?.status === 'u');
      else if (e.key === 'Escape') focusChip(null);
      else return;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      if (!$('#card').hidden || focused || selection.length) { closeCard(); setFocus(null); }
      return;
    }
    if (typing || inOurUi(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // Arabic reads right to left: ← is the next word, → the previous one
      if (step(e.key === 'ArrowLeft' ? 1 : -1)) { e.preventDefault(); e.stopPropagation(); }
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault(); e.stopPropagation();
      if (ctrl) openAtlas(+focused.dataset.lemma);
      else toggle(focused);
    }
  }, true);

  window.addEventListener('scroll', () => { if (!pinned) hidePop(true); }, { passive: true });

  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'rescan') rescan(); });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.showScore) { settings.showScore = changes.showScore.newValue; $('#tab').innerHTML = ''; refresh(); }
    if (changes.enabled) changes.enabled.newValue ? start() : stop();
  });

  // ---- on and off (the popup's switch, live) ----
  function start() {
    chrome.storage.sync.get({ enabled: true, showScore: true, server: 'https://sdp.jasem.dev' }, ({ enabled, showScore, server }) => {
      // Not on Flashcard Studio itself, which already shows what you know its own way
      if (running || !enabled || !document.body || server.startsWith(location.origin)) return;
      running = true;
      settings.showScore = showScore;
      document.documentElement.appendChild(host);
      if (!document.getElementById('fsr-font')) {
        document.head.append(Object.assign(document.createElement('link'), {
          id: 'fsr-font', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap' }));
      }
      chrome.storage.local.get({ panelOpen: false }, (s) => { panelOpen = s.panelOpen; refresh(); });
      loadAccount();
      scan();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  }
  function stop() {
    if (!running) return;
    running = false;
    observer.disconnect();
    clearTimeout(scanTimer);
    reset();
    host.remove();
  }
  start();
})();
