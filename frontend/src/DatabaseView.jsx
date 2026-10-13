import React, {
  useCallback, useEffect, useRef, useState
} from 'react';

import {
  Database, Type, BookOpen, Search, Plus, Pencil, Copy,
  Trash2, X, Save, RefreshCw, ChevronLeft, ChevronRight,
  Languages, Link2
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || '';

const TABS = [
  {
    id: 'sentences', label: 'Sentences', singular: 'Sentence',
    key: 'sentence_id', icon: Type
  },
  {
    id: 'words', label: 'Words', singular: 'Word',
    key: 'word_id', icon: BookOpen
  },
  {
    id: 'roots', label: 'Roots', singular: 'Root',
    key: 'root_id', icon: Database
  }
];

const inputStyle =
  'w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

const buttonStyle =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';

const primaryStyle =
  `${buttonStyle} bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500`;

const normalize = value =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
    .toLowerCase();

const tokenize = value =>
  (value || '').trim().split(/\s+/).filter(Boolean);

const cleanWord = value =>
  value.replace(/[؟،؛!.,;:"()[\]{}”]/g, '');

async function request(path, method = 'GET', body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let response;

  try {
    response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      method,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    });
  } catch (err) {
    throw new Error(
      err.name === 'AbortError'
        ? 'The request timed out. Refresh to check whether it saved before trying again.'
        : 'Cannot reach Flask. Check that the backend is running.'
    );
  } finally {
    clearTimeout(timer);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      'The server did not return JSON. Check that Flask is running.'
    );
  }

  if (!response.ok || data?.success === false || data?.error) {
    throw new Error(
      data?.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

function Badge({ good, children }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-medium ${
        good
          ? 'bg-emerald-500/10 text-emerald-300'
          : 'bg-slate-800 text-slate-400'
      }`}
    >
      {children}
    </span>
  );
}

function Field({
  label, value, onChange,
  arabic = false, multiline = false, required = false
}) {
  const Tag = multiline ? 'textarea' : 'input';

  return (
    <label className="block space-y-2">
      <span className="text-xs text-slate-400">
        {label}{required ? ' *' : ''}
      </span>
      <Tag
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        dir={arabic ? 'rtl' : 'ltr'}
        rows={multiline ? 3 : undefined}
        className={`${inputStyle} ${
          arabic ? 'font-arabic text-lg leading-loose' : ''
        }`}
      />
    </label>
  );
}

export default function DatabaseView() {
  const [data, setData] = useState({
    sentences: [], words: [], roots: [], instances: []
  });

  const [tab, setTab] = useState('sentences');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const [editor, setEditor] = useState(null);
  const [initial, setInitial] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [linkIndex, setLinkIndex] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');

  const searchRef = useRef(null);
  const lock = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const results = await Promise.all([
      request('/api/sentences'),
      request('/api/words'),
      request('/api/roots'),
      request('/api/word-instances')
    ]);

    if (!results.every(Array.isArray)) {
      throw new Error('Unexpected database response.');
    }

    const [sentences, words, roots, instances] = results;

    if (alive.current) {
      setData({ sentences, words, roots, instances });
    }
  }, []);

  useEffect(() => {
    alive.current = true;

    load()
      .catch(err => {
        if (alive.current) setError(err.message);
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });

    return () => {
      alive.current = false;
    };
  }, [load]);

  useEffect(() => {
    const handler = event => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const config = TABS.find(item => item.id === tab);
  const dirty = editor && JSON.stringify(editor) !== initial;
  const existing = editor?.id != null;

  const source = existing
    ? data[editor.type].find(
        item =>
          item[TABS.find(t => t.id === editor.type).key] === editor.id
      )
    : null;

  const savedLinks =
    editor?.type === 'sentences' && existing
      ? data.instances.filter(item => item.sentence_id === editor.id)
      : [];

  const arabicChanged =
    existing &&
    editor?.type === 'sentences' &&
    editor.plaintext !== source?.plaintext;

  const canLink =
    existing && editor?.type === 'sentences' && !arabicChanged;

  const rows = [...data[tab]]
    .filter(item => {
      const root = tab === 'words'
        ? data.roots.find(r => r.root_id === item.root_id)
        : null;

      const match = normalize(
        `${item[config.key]} ${item.plaintext} ${
          item.translation || ''
        } ${root?.plaintext || ''}`
      ).includes(normalize(query.trim()));

      const status = tab === 'sentences'
        ? Boolean(item.complete)
        : Boolean(item.known);

      return match && (
        tab === 'roots' ||
        filter === 'all' ||
        status === (filter === 'yes')
      );
    })
    .sort((a, b) => b[config.key] - a[config.key]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(page, pages);

  const visible = rows.slice(
    (currentPage - 1) * size,
    currentPage * size
  );

  const safeToLeave = () =>
    !lock.current &&
    (!dirty || window.confirm('Discard your unsaved changes?'));

  const installEditor = value => {
    setEditor(value);
    setInitial(JSON.stringify(value));
    setLinkIndex(null);
    setLinkSearch('');
  };

  const open = (type, row = null, copy = false) => {
    if (!safeToLeave()) return;

    const cfg = TABS.find(item => item.id === type);

    const root = type === 'words'
      ? data.roots.find(r => r.root_id === row?.root_id)
      : null;

    installEditor({
      type,
      id: copy ? null : row?.[cfg.key] ?? null,
      plaintext: row?.plaintext || '',
      translation: row?.translation || '',
      ...(type === 'words' ? {
        root_plaintext: root?.plaintext || '',
        root_translation: root?.translation || ''
      } : {})
    });

    setTab(type);
    setError('');
    setNotice('');
  };

  const changeTab = value => {
    if (!safeToLeave()) return;

    setTab(value);
    setQuery('');
    setFilter('all');
    setPage(1);
    installEditor(null);
  };

  const update = (key, value) => {
    setEditor(previous => ({
      ...previous,
      [key]: value
    }));
  };

  const run = async (
    operation,
    success = '',
    refresh = true
  ) => {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    let committed = false;

    try {
      await operation();
      committed = true;

      if (success) setNotice(success);
      if (refresh) await load();
    } catch (err) {
      setError(
        committed
          ? 'Saved, but the table could not refresh. Click Refresh before making another change.'
          : err.message || 'Request failed.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const save = () => {
    if (!editor.plaintext.trim()) {
      setError('Enter the Arabic text first.');
      return;
    }

    const payload = {
      plaintext: editor.plaintext.trim(),
      translation: editor.translation.trim(),
      ...(editor.type === 'words' ? {
        root_plaintext: editor.root_plaintext.trim(),
        root_translation: editor.root_translation.trim()
      } : {})
    };

    run(async () => {
      if (editor.type === 'sentences') {
        await request(
          existing
            ? `/api/update-sentence/${editor.id}`
            : '/api/create-sentence',
          existing ? 'PUT' : 'POST',
          payload
        );
      } else if (editor.type === 'words') {
        await request(
          existing
            ? `/api/update-word/${editor.id}`
            : '/add-words',
          existing ? 'PUT' : 'POST',
          existing ? payload : { items: [payload] }
        );
      } else {
        await request(
          `/api/update-root/${editor.id}`,
          'PUT',
          payload
        );
      }

      installEditor(null);
      setQuery('');
      setFilter('all');
      setPage(1);
    }, 'Saved successfully. An incomplete record is still saved; it can be finished later.');
  };

  const remove = (type, row) => {
    if (!safeToLeave()) return;

    const cfg = TABS.find(item => item.id === type);

    const extra = type === 'sentences'
      ? ' Its saved flashcards and word links will also be removed.'
      : ' Links to this word will also be removed. The root will be kept.';

    if (!window.confirm(`Delete “${row.plaintext}”?${extra}`)) {
      return;
    }

    run(async () => {
      await request(
        `/api/delete-${cfg.singular.toLowerCase()}/${row[cfg.key]}`,
        'DELETE'
      );

      installEditor(null);
    }, 'Record deleted.');
  };

  const translate = () => {
    if (!editor.plaintext.trim()) {
      setError('Enter Arabic text first.');
      return;
    }

    run(async () => {
      const result = await request('/translate', 'POST', {
        q: editor.plaintext,
        source: 'ar',
        target: 'en'
      });

      if (!result.translatedText) {
        throw new Error(
          'Translation unavailable. You can enter it manually.'
        );
      }

      update('translation', result.translatedText);
    }, 'Translation added to the draft. Save when ready.', false);
  };

  const linkWord = word => run(async () => {
    await request('/api/link-word', 'POST', {
      sentence_id: editor.id,
      index: linkIndex,
      word_id: word.word_id
    });

    setLinkIndex(null);
  }, 'Word linked.');

  const unlink = index => run(async () => {
    await request('/api/unlink-word', 'POST', {
      sentence_id: editor.id,
      index
    });
  }, 'Saved link removed. Automatic matches may still appear.');

  const tokenRows = editor?.type === 'sentences'
    ? tokenize(editor.plaintext).map((text, index) => {
        const explicit = !arabicChanged
          ? savedLinks.find(item => item.index === index)
          : null;

        const exact = data.words.find(
          word => word.plaintext === cleanWord(text)
        );

        const matches = data.words.filter(
          word =>
            normalize(word.prune || word.plaintext) ===
            normalize(cleanWord(text))
        );

        const word = explicit
          ? data.words.find(
              item => item.word_id === explicit.word_id
            )
          : exact || (matches.length === 1 ? matches[0] : null);

        return {
          text,
          index,
          word,
          explicit,
          ambiguous: !word && matches.length > 1
        };
      })
    : [];

  const wordOptions = data.words
    .filter(word =>
      normalize(
        `${word.plaintext} ${word.translation || ''} ${word.word_id}`
      ).includes(normalize(linkSearch))
    )
    .slice(0, 40);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-indigo-400">
            Content workspace
          </p>
          <h1 className="text-3xl font-bold text-white">
            Database
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage Arabic sentences, words, roots and their relationships.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              ref={searchRef}
              aria-label="Search database"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${tab}…`}
              className={`${inputStyle} pl-9 max-w-[240px]`}
            />
          </div>

          <button
            disabled={busy || loading}
            onClick={() =>
              run(load, 'Database refreshed.', false)
            }
            className={buttonStyle}
            title="Refresh database"
          >
            <RefreshCw
              className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          <button
            disabled={busy || loading}
            onClick={() =>
              open(tab === 'roots' ? 'words' : tab)
            }
            className={primaryStyle}
          >
            <Plus className="w-4 h-4" />
            Add {tab === 'roots' ? 'Word' : config.singular}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Sentences', data.sentences.length],
          ['Words', data.words.length],
          ['Roots', data.roots.length],
          [
            'Complete sentences',
            data.sentences.filter(item => item.complete).length
          ]
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"
        >
          {notice}
        </div>
      )}

      <div
        className={`grid gap-5 items-start ${
          editor
            ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px]'
            : 'grid-cols-1'
        }`}
      >
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex border-b border-slate-800">
            {TABS.map(item => (
              <button
                key={item.id}
                disabled={busy}
                onClick={() => changeTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-4 text-xs ${
                  tab === item.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                  {data[item.id].length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 p-4">
            <p className="text-xs text-slate-500">
              {rows.length} matching records
            </p>

            {tab !== 'roots' && (
              <select
                aria-label="Filter status"
                value={filter}
                onChange={event => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300"
              >
                <option value="all">All statuses</option>
                <option value="yes">
                  {tab === 'sentences' ? 'Complete' : 'Known'}
                </option>
                <option value="no">
                  {tab === 'sentences' ? 'Incomplete' : 'Learning'}
                </option>
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-500">
                <tr>
                  {[
                    'ID',
                    tab === 'sentences'
                      ? 'Arabic Sentence'
                      : tab === 'words'
                        ? 'Arabic Word'
                        : 'Root',
                    'Translation',
                    ...(tab === 'sentences'
                      ? ['Length', 'Status']
                      : tab === 'words'
                        ? ['Root', 'Status']
                        : ['Words']),
                    'Actions'
                  ].map(label => (
                    <th
                      key={label}
                      className="px-4 py-3 font-medium whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/70">
                {!loading && visible.map(row => (
                  <tr
                    key={row[config.key]}
                    className={
                      editor?.type === tab &&
                      editor.id === row[config.key]
                        ? 'bg-indigo-500/15'
                        : 'hover:bg-slate-800/40'
                    }
                  >
                    <td className="p-4 text-slate-500">
                      #{row[config.key]}
                    </td>

                    <td className="p-4">
                      <button
                        disabled={busy}
                        onClick={() => open(tab, row)}
                        dir="rtl"
                        className="font-arabic text-base leading-loose text-slate-100 text-right hover:text-indigo-300"
                      >
                        {row.plaintext}
                      </button>
                    </td>

                    <td className="p-4 min-w-[140px] max-w-xs text-slate-400">
                      {row.translation || '—'}
                    </td>

                    {tab === 'sentences' && (
                      <>
                        <td className="p-4 whitespace-nowrap text-slate-400">
                          {tokenize(row.plaintext).length} words
                        </td>
                        <td className="p-4">
                          <Badge good={row.complete}>
                            {row.complete ? 'Complete' : 'Incomplete'}
                          </Badge>
                        </td>
                      </>
                    )}

                    {tab === 'words' && (
                      <>
                        <td className="p-4 font-arabic text-indigo-300">
                          {data.roots.find(
                            root => root.root_id === row.root_id
                          )?.plaintext || '—'}
                        </td>
                        <td className="p-4">
                          <Badge good={row.known}>
                            {row.known ? 'Known' : 'Learning'}
                          </Badge>
                        </td>
                      </>
                    )}

                    {tab === 'roots' && (
                      <td className="p-4 text-slate-400">
                        {data.words.filter(
                          word => word.root_id === row.root_id
                        ).length}
                      </td>
                    )}

                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          disabled={busy}
                          aria-label={`Edit ${config.singular} ${row[config.key]}`}
                          onClick={() => open(tab, row)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {tab === 'sentences' && (
                          <button
                            disabled={busy}
                            aria-label={`Copy sentence ${row.sentence_id}`}
                            onClick={() => open(tab, row, true)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {tab !== 'roots' && (
                          <button
                            disabled={busy}
                            aria-label={`Delete ${config.singular} ${row[config.key]}`}
                            onClick={() => remove(tab, row)}
                            className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && (
              <p className="p-12 text-center text-sm text-indigo-300">
                Loading database…
              </p>
            )}

            {!loading && visible.length === 0 && (
              <div className="p-12 text-center">
                <Database className="mx-auto mb-3 w-8 h-8 text-slate-600" />
                <p className="text-sm text-slate-300">
                  No matching records
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Clear your search or add a new record.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-4 text-xs text-slate-500">
            <span>
              Showing{' '}
              {rows.length ? (currentPage - 1) * size + 1 : 0}
              –{Math.min(currentPage * size, rows.length)}
              {' '}of {rows.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className={buttonStyle}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span>{currentPage} / {pages}</span>

              <button
                aria-label="Next page"
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
                className={buttonStyle}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <select
                aria-label="Rows per page"
                value={size}
                onChange={event => {
                  setSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-300"
              >
                {[10, 20, 50].map(value => (
                  <option key={value} value={value}>
                    {value} per page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {editor && (
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 xl:sticky xl:top-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div>
                <h2 className="font-semibold text-white">
                  {existing ? 'Edit' : 'Add'}{' '}
                  {TABS.find(item => item.id === editor.type).singular}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {existing ? `#${editor.id}` : 'New record'}
                  {dirty ? ' · Unsaved changes' : ''}
                </p>
              </div>

              <button
                aria-label="Close editor"
                disabled={busy}
                onClick={() => {
                  if (safeToLeave()) installEditor(null);
                }}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <fieldset
              disabled={busy || loading}
              className="p-5 space-y-5 min-w-0"
            >
              <Field
                label={`Arabic ${
                  TABS.find(item => item.id === editor.type).singular
                }`}
                value={editor.plaintext}
                onChange={value => update('plaintext', value)}
                arabic
                multiline={editor.type === 'sentences'}
                required
              />

              <div className="text-center">
                <button
                  onClick={translate}
                  className={buttonStyle}
                >
                  <Languages className="w-4 h-4" />
                  Translate
                </button>
              </div>

              <Field
                label="English translation"
                value={editor.translation}
                onChange={value => update('translation', value)}
                multiline
              />

              {editor.type === 'words' && (
                <>
                  <Field
                    label="Arabic root (optional)"
                    value={editor.root_plaintext}
                    onChange={value => update('root_plaintext', value)}
                    arabic
                  />

                  <Field
                    label="Root translation"
                    value={editor.root_translation}
                    onChange={value => update('root_translation', value)}
                  />

                  <p className="text-[11px] text-slate-500">
                    Leave the root blank if it is unknown or not applicable.
                    Existing roots are edited in the Roots tab.
                  </p>

                  {existing && (
                    <button
                      disabled={dirty}
                      className={buttonStyle}
                      onClick={() => run(
                        () => request(
                          `/api/tutor/words/${editor.id}/known`,
                          'PUT',
                          { known: !source?.known }
                        ),
                        'Word status updated.'
                      )}
                    >
                      <Badge good={source?.known}>
                        {source?.known ? 'Known' : 'Learning'}
                      </Badge>
                      Mark as {source?.known ? 'Learning' : 'Known'}
                    </button>
                  )}
                </>
              )}

              {editor.type === 'roots' && (
                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-xs font-medium text-white mb-3">
                    Words using this root
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {data.words
                      .filter(word => word.root_id === editor.id)
                      .map(word => (
                        <button
                          key={word.word_id}
                          onClick={() => open('words', word)}
                          className={`${buttonStyle} font-arabic`}
                        >
                          {word.plaintext}
                        </button>
                      ))}
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Changes apply to every word linked to this root.
                    New roots are created when you save a word.
                  </p>
                </div>
              )}

              {editor.type === 'sentences' && (
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-medium text-white">
                      Words in this sentence ({tokenRows.length})
                    </h3>

                    <button
                      onClick={() => open('words')}
                      className="text-xs text-indigo-300"
                    >
                      + Add Word
                    </button>
                  </div>

                  {!existing && (
                    <p className="text-[11px] text-slate-500">
                      Save the sentence before linking individual words.
                    </p>
                  )}

                  {arabicChanged && (
                    <p className="text-[11px] text-amber-300">
                      Save the edited Arabic text first.
                      Old word links will be cleared automatically.
                    </p>
                  )}

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {tokenRows.map(token => (
                      <div
                        key={token.index}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-600">
                            {token.index + 1}
                          </span>

                          <span
                            dir="rtl"
                            className="font-arabic text-base text-white"
                          >
                            {token.text}
                          </span>

                          <div className="flex gap-2">
                            <button
                              disabled={!canLink}
                              onClick={() => {
                                setLinkIndex(token.index);
                                setLinkSearch(cleanWord(token.text));
                              }}
                              title="Choose word link"
                              aria-label={`Link word ${token.index + 1}`}
                              className="text-indigo-300 disabled:opacity-30"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>

                            {token.explicit && (
                              <button
                                onClick={() => unlink(token.index)}
                                title="Remove saved link"
                                aria-label={`Unlink word ${token.index + 1}`}
                                className="text-rose-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-slate-400">
                          {token.word?.translation || (
                            token.ambiguous
                              ? 'Multiple matches — choose a word'
                              : token.word
                                ? 'Translation missing'
                                : 'Not saved in your vocabulary yet'
                          )}
                        </p>

                        <p className="mt-1 text-[10px] text-slate-600">
                          {token.explicit
                            ? 'Saved link'
                            : token.word
                              ? 'Automatic match'
                              : 'Can be saved without a root'}
                        </p>

                        {!token.word && (
                          <button
                            onClick={() => open('words', {
                              plaintext: cleanWord(token.text)
                            })}
                            className="mt-2 text-[10px] text-indigo-300"
                          >
                            Add this word
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {linkIndex !== null && canLink && (
                    <div className="rounded-xl border border-indigo-500/30 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-indigo-300">
                        <span>Link position {linkIndex + 1}</span>

                        <button
                          aria-label="Close word picker"
                          onClick={() => setLinkIndex(null)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <input
                        aria-label="Find word to link"
                        value={linkSearch}
                        onChange={event =>
                          setLinkSearch(event.target.value)
                        }
                        className={inputStyle}
                        placeholder="Find Arabic or English word"
                      />

                      <div className="max-h-44 overflow-y-auto space-y-1">
                        {wordOptions.map(word => (
                          <button
                            key={word.word_id}
                            onClick={() => linkWord(word)}
                            className="w-full rounded-lg bg-slate-800 p-2 text-left text-xs text-slate-300"
                          >
                            <span className="font-arabic text-indigo-200">
                              {word.plaintext}
                            </span>
                            {' '}· {word.translation || 'No translation'}
                            {' '}
                            <span className="text-slate-500">
                              #{word.word_id}
                            </span>
                          </button>
                        ))}

                        {!wordOptions.length && (
                          <p className="text-xs text-slate-500">
                            No matches. Clear the search or add the word first.
                          </p>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500">
                        Up to 40 matches. Choosing a word saves the link
                        immediately.
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Complete means a translation is saved and every word
                    is resolved. Removing a saved link does not delete
                    the word.
                  </p>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
                >
                  {error}
                </p>
              )}

              <p className="text-xs text-slate-400">
                Saving does not require automatic translation.
                Diacritics are preserved. Grammar and dictionary validity
                are not checked by this database.
              </p>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
                {existing && editor.type !== 'roots' && (
                  <button
                    onClick={() => remove(editor.type, source)}
                    className={`${buttonStyle} text-rose-300`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}

                {existing && editor.type === 'sentences' && (
                  <button
                    onClick={() => {
                      const copy = { ...editor, id: null };
                      installEditor(copy);
                      setNotice(
                        'Copy prepared. Click Confirm & Save to create it.'
                      );
                    }}
                    className={buttonStyle}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Save New
                  </button>
                )}

                <button
                  onClick={save}
                  className={primaryStyle}
                >
                  <Save className="w-3.5 h-3.5" />
                  {busy ? 'Working…' : 'Confirm & Save'}
                </button>
              </div>
            </fieldset>
          </aside>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        ⌘ / Ctrl + K to search · Changes are saved to your database ·
        Translation can also be entered manually
      </p>
    </div>
  );
}