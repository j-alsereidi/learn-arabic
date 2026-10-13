import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { createPortal } from 'react-dom';

import {
  GraduationCap,
  Plus,
  History as HistoryIcon,
  Search,
  X,
  Copy,
  BookmarkPlus,
  Send,
  Volume2,
  Check,
  MessageCircle,
  Loader,
  AlertCircle
} from 'lucide-react';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
const STORAGE_KEY = 'learn-arabic.tutor.v1';

const makeId = () =>
  window.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeWord = (text = '') =>
  text
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
    .replace(/[^\p{L}]/gu, '');

const blankChat = () => ({
  id: makeId(),
  title: 'New chat',
  updatedAt: new Date().toISOString(),
  messages: []
});

function validSentence(sentence) {
  return (
    sentence &&
    typeof sentence.arabic === 'string' &&
    typeof sentence.translation === 'string' &&
    (
      sentence.words === undefined ||
      (
        Array.isArray(sentence.words) &&
        sentence.words.every(
          word => word && typeof word.text === 'string'
        )
      )
    )
  );
}

function validMessage(message) {
  if (!message || typeof message.id !== 'string') {
    return false;
  }

  if (message.role === 'user') {
    return typeof message.content === 'string';
  }

  return (
    message.role === 'assistant' &&
    typeof message.intro === 'string' &&
    Array.isArray(message.sentences) &&
    message.sentences.every(validSentence)
  );
}

function readChats() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || 'null'
    );

    const chats = Array.isArray(data?.chats)
      ? data.chats.filter(
          chat =>
            chat &&
            typeof chat.id === 'string' &&
            typeof chat.title === 'string' &&
            Array.isArray(chat.messages) &&
            chat.messages.every(validMessage)
        )
      : [];

    if (chats.length) {
      return {
        chats,
        activeId: chats.some(chat => chat.id === data.activeId)
          ? data.activeId
          : chats[0].id
      };
    }
  } catch (_) {
    // Start with a new chat if saved data cannot be read.
  }

  const chat = blankChat();

  return {
    chats: [chat],
    activeId: chat.id
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  let data;

  try {
    data = await response.json();
  } catch (_) {
    throw new Error(
      'Cannot reach the API. Check that Flask is running on port 5001.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

function conversationHistory(messages) {
  return messages.map(message => ({
    role: message.role,
    content:
      message.role === 'user'
        ? message.content
        : [
            message.intro,
            ...message.sentences.map(
              sentence =>
                `${sentence.arabic}\n${sentence.translation}`
            )
          ]
            .filter(Boolean)
            .join('\n')
  }));
}

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg ' +
  'border border-slate-700 px-3 py-2 text-sm text-slate-300 ' +
  'hover:bg-slate-800 hover:text-white disabled:opacity-40 ' +
  'disabled:cursor-not-allowed transition';

export default function TutorView() {
  const [session, setSession] = useState(readChats);

  const [historyOpen, setHistoryOpen] = useState(
    () => window.innerWidth >= 1024
  );

  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [pendingChat, setPendingChat] = useState(null);
  const [errors, setErrors] = useState({});
  const [storageError, setStorageError] = useState('');
  const [status, setStatus] = useState(null);

  const [dictionaryData, setDictionaryData] = useState({
    words: [],
    roots: [],
    loaded: false
  });

  const [lookupError, setLookupError] = useState('');
  const [popup, setPopup] = useState(null);
  const [copied, setCopied] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  const bottomRef = useRef(null);
  const popupRef = useRef(null);
  const requestRef = useRef(null);
  const copyTimer = useRef(null);
  const liveRef = useRef(true);
  const dictionaryRequest = useRef(0);

  const active =
    session.chats.find(chat => chat.id === session.activeId) ||
    session.chats[0];

  const busy = pendingChat === active.id;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setStorageError('');
    } catch (_) {
      setStorageError(
        'Conversation history could not be saved in this browser.'
      );
    }
  }, [session]);

  const loadDictionary = useCallback(async () => {
    const sequence = ++dictionaryRequest.current;

    try {
      const [words, roots] = await Promise.all([
        api('/api/words'),
        api('/api/roots')
      ]);

      if (!Array.isArray(words) || !Array.isArray(roots)) {
        throw new Error('Invalid dictionary data.');
      }

      if (
        liveRef.current &&
        sequence === dictionaryRequest.current
      ) {
        setDictionaryData({
          words,
          roots,
          loaded: true
        });

        setLookupError('');
      }
    } catch (_) {
      if (
        liveRef.current &&
        sequence === dictionaryRequest.current
      ) {
        setLookupError('Dictionary data could not load.');
      }
    }
  }, []);

  useEffect(() => {
    liveRef.current = true;
    let cancelled = false;

    loadDictionary();

    api('/api/tutor/status')
      .then(data => {
        if (!cancelled) {
          setStatus(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            message:
              'Cannot reach Flask. Start the backend and refresh.'
          });
        }
      });

    const onFocus = () => loadDictionary();

    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      liveRef.current = false;
      requestRef.current?.abort();
      clearTimeout(copyTimer.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadDictionary]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [active.id, active.messages.length, busy]);

  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    const close = event => {
      if (
        !popupRef.current?.contains(event.target) &&
        !event.target.closest?.('[data-tutor-word]')
      ) {
        setPopup(null);
      }
    };

    const escape = event => {
      if (event.key === 'Escape') {
        setPopup(null);
      }
    };

    const reposition = () => setPopup(null);

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', reposition);

    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', reposition);
    };
  }, [popup]);

  const updateChat = (id, update) => {
    setSession(previous => ({
      ...previous,
      chats: previous.chats.map(chat =>
        chat.id === id ? update(chat) : chat
      )
    }));
  };

  const filtered = useMemo(
    () =>
      session.chats
        .filter(
          chat =>
            chat.messages.length ||
            chat.id === session.activeId
        )
        .filter(chat => {
          const firstMessage =
            chat.messages.find(
              message => message.role === 'user'
            )?.content || '';

          return `${chat.title} ${firstMessage}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
        })
        .sort((a, b) =>
          (b.updatedAt || '').localeCompare(a.updatedAt || '')
        ),
    [session, search]
  );

  const newChat = () => {
    setSession(previous => {
      const empty = previous.chats.find(
        chat =>
          !chat.messages.length &&
          chat.id !== pendingChat
      );

      const chat = empty || blankChat();

      return {
        chats: empty
          ? previous.chats
          : [chat, ...previous.chats],
        activeId: chat.id
      };
    });

    setInput('');
    setPopup(null);
    setNotice('');
    setSearch('');

    if (window.innerWidth < 1024) {
      setHistoryOpen(false);
    }
  };

  const selectChat = id => {
    setSession(previous => ({
      ...previous,
      activeId: id
    }));

    setInput('');
    setPopup(null);
    setNotice('');

    if (window.innerWidth < 1024) {
      setHistoryOpen(false);
    }
  };

  async function sendMessage(event, retry = false) {
    event?.preventDefault();

    if (requestRef.current) {
      return;
    }

    const id = active.id;
    const failed = errors[id];
    const text = retry ? failed?.text : input.trim();

    if (!text || text.length > 4000) {
      return;
    }

    const messages = retry
      ? active.messages
      : [
          ...active.messages,
          {
            id: makeId(),
            role: 'user',
            content: text
          }
        ];

    const history = conversationHistory(
      messages.slice(0, -1)
    ).slice(-20);

    if (!retry) {
      updateChat(id, chat => ({
        ...chat,
        title: chat.messages.length
          ? chat.title
          : text.slice(0, 45),
        updatedAt: new Date().toISOString(),
        messages
      }));

      setInput('');
    }

    setErrors(previous => ({
      ...previous,
      [id]: null
    }));

    setNotice('');
    setPopup(null);
    setPendingChat(id);

    const controller = new AbortController();
    requestRef.current = controller;

    const timer = setTimeout(
      () => controller.abort(),
      95000
    );

    try {
      const data = await api('/api/tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history
        })
      });

      if (
        !Array.isArray(data.sentences) ||
        typeof data.intro !== 'string' ||
        !data.sentences.every(validSentence)
      ) {
        throw new Error('Invalid tutor response.');
      }

      if (!liveRef.current) {
        return;
      }

      updateChat(id, chat => ({
        ...chat,
        updatedAt: new Date().toISOString(),
        messages: [
          ...chat.messages,
          {
            id: makeId(),
            role: 'assistant',
            intro: data.intro,
            sentences: data.sentences,
            bootstrap: data.bootstrap
          }
        ]
      }));
    } catch (error) {
      if (liveRef.current) {
        setErrors(previous => ({
          ...previous,
          [id]: {
            text,
            message:
              error.name === 'AbortError'
                ? 'The tutor took too long. Try again.'
                : error.message
          }
        }));
      }
    } finally {
      clearTimeout(timer);

      if (requestRef.current === controller) {
        requestRef.current = null;
      }

      if (liveRef.current) {
        setPendingChat(null);
      }
    }
  }

  const detailsFor = word => {
    const candidates = dictionaryData.words.filter(
      item =>
        normalizeWord(item.plaintext) ===
        normalizeWord(word.text)
    );

    const match =
      dictionaryData.words.find(
        item => item.word_id === word.word_id
      ) ||
      (candidates.length === 1 ? candidates[0] : null);

    const root = match
      ? dictionaryData.roots.find(
          item => item.root_id === match.root_id
        )
      : null;

    const state = match
      ? match.known
        ? 'known'
        : 'unknown'
      : dictionaryData.loaded
        ? normalizeWord(word.text)
          ? 'unknown'
          : 'normal'
        : word.state;

    return {
      ...word,
      state,
      meaning: match?.translation || word.meaning || '',
      root: root?.plaintext || word.root || '',
      source: match
        ? 'database'
        : word.source || 'ai'
    };
  };

  const openWord = (event, word) => {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const width = Math.min(
      272,
      window.innerWidth - 24
    );

    const left = Math.max(
      12,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - 12
      )
    );

    const above = rect.top > 280;

    setPopup({
      word: detailsFor(word),
      width,
      left,
      top: above
        ? Math.max(12, rect.top - 260)
        : Math.min(
            rect.bottom + 10,
            window.innerHeight - 260
          )
    });
  };

  const speak = text => {
    if (!('speechSynthesis' in window)) {
      setNotice(
        'Pronunciation is unavailable in this browser.'
      );
      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = 'ar-AE';
    utterance.rate = 0.85;

    const voice = window.speechSynthesis
      .getVoices()
      .find(item => item.lang.startsWith('ar'));

    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const copySentence = async (sentence, key) => {
    try {
      await navigator.clipboard.writeText(
        `${sentence.arabic}\n${sentence.translation}`
      );

      setCopied(key);
      clearTimeout(copyTimer.current);

      copyTimer.current = setTimeout(
        () => setCopied(null),
        1600
      );
    } catch (_) {
      setNotice(
        'Copy failed. You can select and copy the sentence directly.'
      );
    }
  };

  const saveSentence = async (sentence, key) => {
    if (saving[key] || saved[key]) {
      return;
    }

    setSaving(previous => ({
      ...previous,
      [key]: true
    }));

    setNotice('');

    try {
      await api('/api/tutor/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          arabic: sentence.arabic,
          translation: sentence.translation
        })
      });

      if (liveRef.current) {
        setSaved(previous => ({
          ...previous,
          [key]: true
        }));
      }
    } catch (error) {
      if (liveRef.current) {
        setNotice(error.message);
      }
    } finally {
      if (liveRef.current) {
        setSaving(previous => ({
          ...previous,
          [key]: false
        }));
      }
    }
  };

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      {historyOpen && (
        <aside className="absolute inset-y-0 left-0 z-30 flex w-72 max-w-[85%] flex-col border-r border-slate-800 bg-slate-900 lg:static lg:shrink-0">
          <div className="border-b border-slate-800 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Conversations
              </h2>

              <button
                className={buttonClass}
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
              >
                <X size={16} />
              </button>
            </div>

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-white hover:bg-indigo-500"
              onClick={newChat}
            >
              <Plus size={18} />
              New Chat
            </button>

            <div className="relative mt-4">
              <Search
                size={16}
                className="absolute left-3 top-3 text-slate-500"
              />

              <input
                aria-label="Search conversations"
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
                placeholder="Search conversations…"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
            {filtered.map(chat => (
              <button
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                aria-current={
                  chat.id === active.id
                    ? 'true'
                    : undefined
                }
                className={`w-full rounded-xl border p-3 text-left transition ${
                  chat.id === active.id
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-transparent hover:bg-slate-800'
                }`}
              >
                <div className="flex gap-2">
                  <MessageCircle
                    size={18}
                    className="mt-1 shrink-0 text-slate-400"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {chat.title}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {chat.messages.find(
                        message =>
                          message.role === 'user'
                      )?.content || 'New conversation'}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {Number.isNaN(
                        Date.parse(chat.updatedAt)
                      )
                        ? ''
                        : new Date(
                            chat.updatedAt
                          ).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric'
                            }
                          )}
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {!filtered.length && (
              <p className="p-3 text-sm text-slate-500">
                No conversations
              </p>
            )}
          </div>
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap
              className="text-indigo-400"
              size={26}
            />

            <h1 className="text-lg font-bold text-white">
              AI Tutor
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              className={buttonClass}
              onClick={newChat}
              aria-label="New chat"
            >
              <Plus size={16} />

              <span className="hidden sm:inline">
                New Chat
              </span>
            </button>

            <button
              className={buttonClass}
              onClick={() =>
                setHistoryOpen(open => !open)
              }
              aria-expanded={historyOpen}
            >
              <HistoryIcon size={16} />

              <span className="hidden sm:inline">
                History
              </span>
            </button>
          </div>
        </header>

        {(
          status?.configured === false ||
          storageError ||
          lookupError
        ) && (
          <div
            role="status"
            className="border-b border-slate-800 px-4 py-2 text-xs text-amber-300"
          >
            {status?.configured === false
              ? status.message
              : storageError || lookupError}
          </div>
        )}

        <div
          className="custom-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-6"
          onScroll={() => setPopup(null)}
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {!active.messages.length && (
              <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-slate-500">
                <GraduationCap
                  size={40}
                  className="text-indigo-400"
                />

                <p>
                  What would you like to practise?
                </p>
              </div>
            )}

            {active.messages.map(message =>
              message.role === 'user' ? (
                <div
                  key={message.id}
                  className="flex justify-end"
                >
                  <div
                    dir="auto"
                    className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-indigo-600 px-5 py-3 text-white"
                  >
                    {message.content}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="flex items-start gap-3"
                >
                  <GraduationCap
                    size={22}
                    className="mt-3 hidden shrink-0 text-indigo-400 sm:block"
                  />

                  <div className="min-w-0 max-w-full space-y-3">
                    {message.intro && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                        {message.intro}
                      </p>
                    )}

                    {message.sentences.map(
                      (sentence, index) => {
                        const key =
                          `${message.id}-${index}`;

                        const words =
                          sentence.words ||
                          sentence.arabic
                            .split(/\s+/)
                            .map(text => ({
                              text,
                              state: 'unknown'
                            }));

                        return (
                          <div
                            key={key}
                            className="rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900 px-5 py-4"
                          >
                            <div
                              dir="rtl"
                              className="font-arabic text-right text-3xl leading-loose"
                            >
                              {words.map(
                                (word, wordIndex) => {
                                  const details =
                                    detailsFor(word);

                                  const colour =
                                    details.state === 'known'
                                      ? 'text-emerald-300'
                                      : details.state === 'normal'
                                        ? 'text-slate-100'
                                        : 'text-rose-300';

                                  return (
                                    <React.Fragment
                                      key={wordIndex}
                                    >
                                      <button
                                        data-tutor-word
                                        type="button"
                                        onClick={event =>
                                          openWord(
                                            event,
                                            word
                                          )
                                        }
                                        aria-label={
                                          `Look up ${word.text}`
                                        }
                                        className={
                                          `rounded px-1 hover:bg-indigo-500/15 ${colour}`
                                        }
                                      >
                                        {word.text}
                                      </button>
                                      {' '}
                                    </React.Fragment>
                                  );
                                }
                              )}
                            </div>

                            <p className="mt-2 text-base text-slate-400">
                              {sentence.translation}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                className={buttonClass}
                                aria-label="Play Arabic sentence"
                                onClick={() =>
                                  speak(sentence.arabic)
                                }
                              >
                                <Volume2 size={16} />
                              </button>

                              <button
                                className={buttonClass}
                                onClick={() =>
                                  copySentence(
                                    sentence,
                                    key
                                  )
                                }
                              >
                                {copied === key ? (
                                  <Check size={16} />
                                ) : (
                                  <Copy size={16} />
                                )}

                                {copied === key
                                  ? 'Copied'
                                  : 'Copy'}
                              </button>

                              <button
                                className={buttonClass}
                                disabled={
                                  saving[key] ||
                                  saved[key]
                                }
                                onClick={() =>
                                  saveSentence(
                                    sentence,
                                    key
                                  )
                                }
                              >
                                {saving[key] ? (
                                  <Loader
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : saved[key] ? (
                                  <Check size={16} />
                                ) : (
                                  <BookmarkPlus
                                    size={16}
                                  />
                                )}

                                {saved[key]
                                  ? 'Saved'
                                  : 'Create Flashcard'}
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-slate-400"
              >
                <Loader
                  size={16}
                  className="animate-spin"
                />
                Thinking…
              </div>
            )}

            {errors[active.id] && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 p-3 text-sm text-rose-300"
              >
                <div className="flex gap-2">
                  <AlertCircle
                    size={18}
                    className="shrink-0"
                  />

                  {errors[active.id].message}
                </div>

                <button
                  className={`${buttonClass} mt-3`}
                  disabled={Boolean(pendingChat)}
                  onClick={event =>
                    sendMessage(event, true)
                  }
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-800 p-4">
          {notice && (
            <p
              role="status"
              className="mb-3 text-sm text-amber-300"
            >
              {notice}
            </p>
          )}

          <form
            onSubmit={sendMessage}
            className="mx-auto flex max-w-3xl items-end gap-3"
          >
            <textarea
              rows={2}
              maxLength={4000}
              value={input}
              onChange={event =>
                setInput(event.target.value)
              }
              dir="auto"
              aria-label="Message the tutor"
              onKeyDown={event => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              placeholder="Type a message…"
              className="max-h-40 min-w-0 flex-1 resize-y rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              disabled={
                !input.trim() ||
                Boolean(pendingChat)
              }
              aria-label="Send message"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </section>

      {popup &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label={
              `Dictionary: ${popup.word.text}`
            }
            style={{
              position: 'fixed',
              zIndex: 1000,
              left: popup.left,
              top: Math.max(12, popup.top),
              width: popup.width
            }}
            className="max-h-[240px] overflow-y-auto rounded-2xl border border-indigo-500/50 bg-slate-900 p-4 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  dir="rtl"
                  className="font-arabic text-2xl text-white"
                >
                  {popup.word.text}
                </p>

                {popup.word.transliteration && (
                  <p className="mt-1 text-sm text-slate-400">
                    {popup.word.transliteration}
                  </p>
                )}
              </div>

              <div className="flex gap-1">
                <button
                  className="p-1.5 text-slate-300"
                  aria-label="Play word pronunciation"
                  onClick={() =>
                    speak(popup.word.text)
                  }
                >
                  <Volume2 size={16} />
                </button>

                <button
                  className="p-1.5 text-slate-400"
                  aria-label="Close dictionary"
                  onClick={() => setPopup(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="mt-3 text-slate-100">
              {popup.word.meaning ||
                'Meaning unavailable'}
            </p>

            {popup.word.root && (
              <div className="mt-3 flex justify-between border-t border-slate-700 pt-3">
                <span className="text-sm text-slate-500">
                  Root
                </span>

                <span
                  dir="rtl"
                  className="font-arabic text-lg text-white"
                >
                  {popup.word.root}
                </span>
              </div>
            )}

            {popup.word.source !== 'database' && (
              <p className="mt-3 text-xs text-slate-500">
                AI suggestion
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}