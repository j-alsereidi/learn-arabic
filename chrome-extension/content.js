// Flashcard Studio Reader: finds the Arabic on the page, has the server lemmatize it, and colours each word by
// what you know (green known, amber learning, red unknown). Hover a word for its dictionary entry; click it to
// switch known/unknown; Ctrl+drag across words to make a flashcard; Ctrl+←/→ walk the unknown words.
(() => {
  if (window.__fsrLoaded) return;
  window.__fsrLoaded = true;

  const WORD = /[ء-غـ-ْٰ-ۓ]+/g;  // keep in sync with app_package/reader.py
  const HAS_LETTER = /[ء-غف-ي]/;
  const SKIP = 'script, style, noscript, textarea, input, select, code, pre, svg, .fsr-w, #fsr-host';
  // Text per request. Camelira takes ~1 s per 180 characters and doesn't go faster in parallel, so small requests
  // colour the page top-down as it goes, rather than all at once at the end.
  const BATCH_CHARS = 350;
  const lemmas = new Map(); // lemma id -> {text, gloss, status: 'k' | 'l' | 'u'}

  // ---- server, through the background worker ----
  const api = (path, body) => new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: 'api', path, body }, (r) =>
      r && r.ok ? resolve(r.data) : reject(Object.assign(new Error((r && r.error) || chrome.runtime.lastError?.message || 'No answer'),
        { signedOut: !!(r && r.signedOut) }))));
  const openAtlas = (id) => chrome.runtime.sendMessage({ type: 'atlas', id });

  // ---- glosses, as the website formats them (frontend/src/Gloss.jsx) ----
  const formatGloss = (gloss) => {
    const parts = (gloss || '').split('#');
    const plain = parts.filter((p) => !p.includes('+'));
    const senses = (plain.length ? plain : parts).map((p) => p.replace(/\[[^\]]*\]/g, '').replace(/_/g, ' ')
      .replace(/;/g, ', ').replace(/^[\s+]+|[\s+]+$/g, '').replace(/\s+/g, ' '));
    return [...new Set(senses)].filter(Boolean).join('; ');
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- popups: in a shadow root, so the page's styles can't reach them ----
  const ICON = {
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M12 7v6M9 10h6"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
  const STATUS = { k: ['known', '#34d399'], l: ['learning', '#fbbf24'], u: ['unknown', '#fb7185'] };

  const host = document.createElement('div');
  host.id = 'fsr-host';
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  const ui = host.attachShadow({ mode: 'open' });
  ui.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { position: fixed; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0,0,0,.45); font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .ar { font-family: "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; }
    svg { width: 16px; height: 16px; flex: none; }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    #pop { padding: 10px 12px; min-width: 150px; max-width: 280px; text-align: center; }
    #pop .lemma { font-size: 24px; line-height: 1.3; color: #a5b4fc; }
    #pop .gloss { color: #cbd5e1; margin-top: 2px; }
    #pop .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; font-size: 12px; }
    #pop .rank { font-family: ui-monospace, Consolas, monospace; color: #64748b; }
    #pop .atlas { padding: 4px; border-radius: 6px; color: #94a3b8; }
    #pop .atlas:hover { color: #fff; background: #1e293b; }
    #card { width: min(460px, calc(100vw - 24px)); padding: 14px; }
    #card .close { position: absolute; top: 8px; left: 8px; padding: 4px; border-radius: 6px; color: #64748b; }
    #card .close:hover { color: #fff; background: #1e293b; }
    #card .words { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; font-size: 22px; line-height: 1.8; padding: 4px 18px 0; }
    #card .chip { padding: 0 5px; border-radius: 6px; cursor: pointer; color: #e2e8f0; }
    #card .chip:hover { background: #1e293b; }
    #card .chip.none { color: #64748b; cursor: default; }
    #card .chip.target { color: #fbbf24; background: rgba(251,191,36,.12); }
    #card .meaning { text-align: center; color: #fbbf24; min-height: 20px; margin: 2px 0 8px; }
    #card textarea { width: 100%; height: 64px; resize: vertical; background: #020617; color: #e2e8f0; border: 1px solid #334155;
      border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; }
    #card textarea:focus { outline: none; border-color: #818cf8; }
    #card .actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; }
    #card .translate { padding: 7px 12px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; }
    #card .translate:hover { background: #1e293b; }
    #card .create { padding: 7px 14px; border-radius: 8px; background: #4f46e5; color: #fff; font-weight: 600; }
    #card .create:hover { background: #6366f1; }
    #card button:disabled { opacity: .45; cursor: default; }
    #card .msg { text-align: center; font-size: 12px; margin-top: 8px; min-height: 18px; color: #94a3b8; }
    #card .msg.bad { color: #fb7185; } #card .msg.ok { color: #34d399; }
    #load { right: 16px; bottom: 16px; padding: 7px 12px; display: flex; align-items: center; gap: 8px; border-radius: 999px; font-size: 12px; color: #cbd5e1; }
    #load .spin { width: 14px; height: 14px; border: 2px solid #334155; border-top-color: #818cf8; border-radius: 50%; animation: spin .8s linear infinite; }
    #load.bad { color: #fb7185; } #load.bad .spin { display: none; }
    #load.link { cursor: pointer; } #load.link:hover { color: #fda4af; }
    @keyframes spin { to { transform: rotate(360deg); } }
    [hidden] { display: none !important; }
  </style>
  <div id="pop" class="panel" hidden></div>
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

  const paint = (span) => {
    const l = lemmas.get(+span.dataset.lemma);
    span.classList.remove('fsr-k', 'fsr-l', 'fsr-u');
    if (l) span.classList.add(`fsr-${l.status}`);
  };

  function wrap(node, ids) {
    if (!node.isConnected) return;
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
  let busy = false, total = 0, done = 0, failed = 0, signedOut = false;
  function enqueue(nodes) {
    if (!nodes.length) return;
    const blocks = new Map();
    for (const n of nodes) {
      n.__fsr = true;
      const block = n.parentElement.closest(BLOCK);
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
      setTimeout(() => { if (!busy) load.hidden = true; }, 6000);
    } else load.hidden = true;
  }
  async function pump() {
    busy = true;
    progress();
    while (queue.length) {
      // About BATCH_CHARS of text per request (the server lemmatizes a request's pieces in parallel)
      const batch = [];
      for (let chars = 0; queue.length && chars < BATCH_CHARS && batch.length < 100;) {
        const group = queue.shift().filter((n) => n.isConnected);
        if (group.length) { batch.push(group); chars += group.reduce((s, n) => s + n.nodeValue.length, 0); }
      }
      const count = batch.reduce((s, g) => s + g.length, 0);
      if (batch.length) {
        const retry = (group) => { failed += group.length; group.forEach((n) => { n.__fsr = false; }); }; // next rescan
        try {
          const r = await api('/api/reader/analyze', { texts: batch.map((g) => g.map((n) => n.nodeValue).join(' ')) });
          for (const [id, [text, gloss, status]] of Object.entries(r.lemmas)) lemmas.set(+id, { text, gloss, status });
          batch.forEach((group, k) => {
            const ids = r.words[k];
            if (!ids) return retry(group);
            let at = 0;
            for (const n of group) {
              const words = (n.nodeValue.match(WORD) || []).length;
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
      done += count;
      progress();
    }
    busy = false;
    progress();
    total = done = 0;
  }

  function scan() {
    failed = 0; signedOut = false;
    enqueue(textNodes(document.body));
  }

  // New text on dynamic pages (infinite scroll, single-page apps)
  let scanTimer = null;
  const observer = new MutationObserver((mutations) => {
    if (mutations.every((m) => host.contains(m.target) || m.target.closest?.('.fsr-w'))) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => enqueue(textNodes(document.body)), 1000);
  });

  // ---- dictionary popup ----
  let popFor = null, popHide = null, pinned = false;
  function place(panel, rect, gap = 8) {
    panel.hidden = false;
    const { width, height } = panel.getBoundingClientRect();
    let top = rect.top - height - gap;
    if (top < 8) top = rect.bottom + gap;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${left}px`;
  }
  function showPop(span) {
    const id = +span.dataset.lemma, l = lemmas.get(id);
    if (!l) return;
    clearTimeout(popHide);
    popFor = span;
    const [label, colour] = STATUS[l.status];
    $('#pop').innerHTML = `<div class="lemma ar">${esc(l.text)}</div><div class="gloss">${esc(formatGloss(l.gloss)) || '<i>No translation</i>'}</div>
      <div class="row"><span class="rank">#${id.toLocaleString()}</span><span style="color:${colour}">${label}</span>
      <button class="atlas" title="Show on the Atlas" aria-label="Show on the Atlas">${icon('map')}</button></div>`;
    $('#pop .atlas').onclick = () => openAtlas(id);
    place($('#pop'), span.getBoundingClientRect());
  }
  function hidePop(now) {
    clearTimeout(popHide);
    if (now) { $('#pop').hidden = true; popFor = null; return; }
    popHide = setTimeout(() => { if (!pinned) { $('#pop').hidden = true; popFor = null; } }, 250);
  }
  $('#load').addEventListener('click', () => {  // signed out: sign in, then rescan this page from the popup
    if (signedOut) { chrome.runtime.sendMessage({ type: 'site' }); $('#load').hidden = true; }
  });
  $('#pop').addEventListener('mouseenter', () => clearTimeout(popHide));
  $('#pop').addEventListener('mouseleave', () => hidePop());

  // ---- known/unknown ----
  async function toggle(span) {
    const id = +span.dataset.lemma, l = lemmas.get(id);
    if (!l || l.status === 'l') return; // learning words are the flashcards' business
    const known = l.status !== 'k';
    try {
      await api(`/api/set-known/${id}`, { known });
    } catch (err) {
      console.warn('[Flashcard Studio Reader]', err.message);
      return;
    }
    for (const other of lemmas.values()) if (other.text === l.text && other.status !== 'l') other.status = known ? 'k' : 'u';
    document.querySelectorAll('.fsr-w[data-lemma]').forEach(paint);
    if (popFor) showPop(popFor);
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
    const arabic = range.toString().replace(/\s+/g, ' ').trim();
    const withLemma = words.filter((w) => lemmas.get(+w.dataset.lemma));
    let target = withLemma.find((w) => lemmas.get(+w.dataset.lemma).status === 'u') || withLemma[0] || null;

    const card = $('#card');
    card.innerHTML = `<button class="close" title="Close (Esc)" aria-label="Close">${icon('x')}</button>
      <div class="words ar">${words.map((w, k) => `<span class="chip${w.dataset.lemma && lemmas.get(+w.dataset.lemma) ? '' : ' none'}" data-k="${k}">${esc(w.textContent)}</span>`).join(' ')}</div>
      <div class="meaning"></div>
      <textarea placeholder="Translation" dir="auto"></textarea>
      <div class="actions">
        <button class="translate">${icon('down')}Translate</button>
        <button class="create">${icon('book')}Create flashcard</button>
      </div>
      <div class="msg"></div>`;
    const english = card.querySelector('textarea'), create = card.querySelector('.create'), msg = card.querySelector('.msg');
    const render = () => {
      card.querySelectorAll('.chip').forEach((c) => c.classList.toggle('target', words[+c.dataset.k] === target));
      const l = target && lemmas.get(+target.dataset.lemma);
      card.querySelector('.meaning').innerHTML = l ? `<span class="ar">${esc(l.text)}</span> · ${esc(formatGloss(l.gloss).split('; ')[0])}` : 'Choose the word this flashcard is for';
      create.disabled = !target || !english.value.trim();
    };
    card.querySelectorAll('.chip:not(.none)').forEach((c) => { c.onclick = () => { target = words[+c.dataset.k]; render(); }; });
    english.oninput = render;
    card.querySelector('.close').onclick = closeCard;
    card.querySelector('.translate').onclick = async (e) => {
      const button = e.currentTarget;
      button.disabled = true; msg.className = 'msg'; msg.textContent = 'Translating…';
      try {
        english.value = (await api('/translate', { q: arabic })).translatedText || '';
        msg.textContent = '';
      } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; }
      button.disabled = false; render();
    };
    create.onclick = async () => {
      create.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
      try {
        await api('/api/reader/flashcard', { arabic, english: english.value.trim(), target: +target.dataset.lemma });
        msg.className = 'msg ok'; msg.innerHTML = `${icon('check')} Flashcard added`;
        setTimeout(closeCard, 1200);
      } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; render(); }
    };
    render();
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

  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'rescan') scan(); });

  // ---- start ----
  chrome.storage.sync.get({ enabled: true, server: 'https://sdp.jasem.dev' }, ({ enabled, server }) => {
    // Not on Flashcard Studio itself, which already shows what you know its own way
    if (!enabled || !document.body || server.startsWith(location.origin)) return;
    document.documentElement.appendChild(host);
    scan();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
