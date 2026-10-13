import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Bookmark, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Flame, Layers, Loader, Maximize2, Minimize2, Play, Plus,
  RotateCw, Search, Settings, Volume2
} from 'lucide-react';
import { LIBRARY_TOPICS } from './libraryData';

const API_BASE = process.env.REACT_APP_API_URL || '';
const STORAGE_KEY = 'learn-arabic.flashcards.v3';
const DAY = 86400000;

const RATINGS = [
  {
    id: 'again',
    label: 'Again',
    style: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  },
  {
    id: 'hard',
    label: 'Hard',
    style: 'border-orange-500/30 bg-orange-500/10 text-orange-300'
  },
  {
    id: 'good',
    label: 'Good',
    style: 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  },
  {
    id: 'easy',
    label: 'Easy',
    style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }
];

const extraTopic = (id, title, arabic, level, rows) => ({
  id,
  title,
  arabic,
  level,
  lessons: [{
    id: `${id}-review`,
    sentences: rows.map(([ar, en]) => ({
      arabic: ar,
      translation: en
    }))
  }]
});

const EXTRA_TOPICS = [
  extraTopic('weather', 'Nature & Weather', 'الطبيعة والطقس', 'Beginner', [
    ['الجو مشمس اليوم', 'The weather is sunny today.'],
    ['تمطر السماء الآن', 'It is raining now.'],
    ['الطقس بارد في الشتاء', 'The weather is cold in winter.'],
    ['أحب المشي في الحديقة', 'I like walking in the park.'],
    ['الجبال عالية وجميلة', 'The mountains are high and beautiful.'],
    ['البحر هادئ هذا الصباح', 'The sea is calm this morning.'],
    ['هل سيكون الجو حارا غدا؟', 'Will the weather be hot tomorrow?'],
    ['نحافظ على نظافة الشاطئ', 'We keep the beach clean.']
  ]),
  extraTopic('work-study', 'Work & Study', 'العمل والدراسة', 'Intermediate', [
    ['أعمل في مكتب قريب', 'I work in a nearby office.'],
    ['تبدأ المحاضرة في الساعة التاسعة', 'The lecture starts at nine o’clock.'],
    ['لدي اجتماع بعد الظهر', 'I have a meeting in the afternoon.'],
    ['أكتب ملاحظاتي في الدفتر', 'I write my notes in the notebook.'],
    ['هل يمكنك شرح هذا السؤال؟', 'Can you explain this question?'],
    ['سأرسل التقرير غدا', 'I will send the report tomorrow.'],
    ['نعمل معا على المشروع', 'We work together on the project.'],
    ['أنهيت واجبي قبل الموعد', 'I finished my assignment before the deadline.']
  ]),
  extraTopic('health', 'Health & Appointments', 'الصحة والمواعيد', 'Intermediate', [
    ['أريد حجز موعد', 'I would like to book an appointment.'],
    ['أين العيادة؟', 'Where is the clinic?'],
    ['لدي موعد مع الطبيب', 'I have an appointment with the doctor.'],
    ['أشعر بالتعب اليوم', 'I feel tired today.'],
    ['أحتاج إلى بعض الراحة', 'I need some rest.'],
    ['متى تفتح الصيدلية؟', 'When does the pharmacy open?'],
    ['هل يمكنني تغيير الموعد؟', 'May I change the appointment?'],
    ['أشعر بتحسن الآن', 'I feel better now.']
  ]),
  extraTopic('transport', 'Transportation', 'المواصلات', 'Beginner', [
    ['هذه الحافلة تذهب إلى المطار', 'This bus goes to the airport.'],
    ['أين يمكنني شراء التذاكر؟', 'Where can I buy tickets?'],
    ['أنتظر القطار على الرصيف', 'I am waiting for the train on the platform.'],
    ['هل هذا المقعد فارغ؟', 'Is this seat free?'],
    ['أريد النزول في المحطة القادمة', 'I would like to get off at the next stop.'],
    ['تستغرق الرحلة عشرين دقيقة', 'The journey takes twenty minutes.'],
    ['سأذهب إلى العمل بالمترو', 'I will go to work by metro.'],
    ['من فضلك، توقف هنا', 'Please stop here.']
  ])
];

const TOPICS = [...LIBRARY_TOPICS, ...EXTRA_TOPICS];

const GENERAL = {
  id: 'general',
  title: 'My Other Sentences',
  arabic: 'جملي الأخرى',
  level: 'Unclassified'
};

const cleanSpace = text => (text || '').trim().replace(/\s+/g, ' ');
const cardKey = (ar, en) => JSON.stringify([cleanSpace(ar), cleanSpace(en)]);
const tokens = text => cleanSpace(text).split(' ').filter(Boolean);

const normalize = text => (text || '')
  .normalize('NFD')
  .replace(/[\u064B-\u065F\u0640\u0670،؛؟!.,;:]/g, '')
  .trim();

const dayKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const streakOf = days => {
  const date = new Date();
  if (!days.includes(dayKey(date))) date.setDate(date.getDate() - 1);

  let count = 0;
  while (days.includes(dayKey(date))) {
    count += 1;
    date.setDate(date.getDate() - 1);
  }
  return count;
};

const durationText = ms => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const intervalFor = (previous, rating) => {
  const old = Number(previous?.interval) || 0;

  if (rating === 'again') return 60000;
  if (rating === 'hard') return Math.max(600000, Math.min(DAY, old / 2));
  if (rating === 'good') return Math.min(180 * DAY, old >= DAY ? old * 2 : DAY);

  return Math.min(180 * DAY, old >= DAY ? old * 3 : 3 * DAY);
};

const intervalText = ms =>
  ms < DAY ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / DAY)} days`;

const emptyStore = () => ({
  schedule: {},
  bookmarks: [],
  history: [],
  days: [],
  totals: { again: 0, hard: 0, good: 0, easy: 0 },
  migrated: false
});

const readStore = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return emptyStore();

    const result = emptyStore();

    result.schedule =
      value.schedule &&
      typeof value.schedule === 'object' &&
      !Array.isArray(value.schedule)
        ? value.schedule
        : {};

    result.bookmarks = Array.isArray(value.bookmarks)
      ? value.bookmarks.filter(id => typeof id === 'string')
      : [];

    result.days = Array.isArray(value.days)
      ? value.days.filter(day => typeof day === 'string')
      : [];

    result.history = Array.isArray(value.history)
      ? value.history.filter(item =>
          item &&
          typeof item.id === 'string' &&
          RATINGS.some(rating => rating.id === item.rating) &&
          Number.isFinite(item.at)
        )
      : [];

    RATINGS.forEach(rating => {
      result.totals[rating.id] =
        Math.max(0, Number(value.totals?.[rating.id]) || 0);
    });

    result.migrated = Boolean(value.migrated);
    return result;
  } catch {
    return emptyStore();
  }
};

const buildCatalog = (sentences = [], saved = []) => {
  const map = new Map();
  const savedIds = new Set(saved.map(card => card.sentence_id));

  TOPICS.forEach(topic => {
    topic.lessons.forEach(lesson => {
      lesson.sentences.forEach(item => {
        const id = cardKey(item.arabic, item.translation);

        if (map.has(id)) {
          const card = map.get(id);
          if (!card.topicIds.includes(topic.id)) {
            card.topicIds.push(topic.id);
          }
        } else {
          map.set(id, {
            id,
            plaintext: item.arabic,
            translation: item.translation,
            topicIds: [topic.id],
            dbId: null,
            inDatabaseDeck: false
          });
        }
      });
    });
  });

  const database = new Map(
    sentences.map(card => [card.sentence_id, card])
  );

  saved.forEach(card => database.set(card.sentence_id, card));

  database.forEach(item => {
    if (!item.plaintext || !item.translation) return;

    const id = cardKey(item.plaintext, item.translation);
    const eligible = Boolean(
      item.complete || savedIds.has(item.sentence_id)
    );

    if (map.has(id)) {
      Object.assign(map.get(id), {
        dbId: item.sentence_id,
        inDatabaseDeck: eligible
      });
    } else if (eligible) {
      map.set(id, {
        id,
        plaintext: item.plaintext,
        translation: item.translation,
        topicIds: ['general'],
        dbId: item.sentence_id,
        inDatabaseDeck: true
      });
    }
  });

  return [...map.values()];
};

const resolveWord = (text, index, card, words, instances) => {
  const linked = instances.find(item =>
    item.sentence_id === card.dbId && item.index === index
  );

  if (linked) {
    const match = words.find(word => word.word_id === linked.word_id);
    if (match) return match;
  }

  const plain = text.replace(/[،؛؟!.,;:]/g, '');
  const exact = words.find(word =>
    word.plaintext === plain || word.plaintext === text
  );

  if (exact) return exact;

  const matches = words.filter(word => word.prune === normalize(plain));
  return matches.length === 1 ? matches[0] : null;
};

const WordLine = ({
  card, words, instances, roots, staged, onToggle, disabled
}) => (
  <div
    dir="rtl"
    className="flex flex-wrap justify-center gap-2 font-arabic text-2xl md:text-3xl leading-loose"
  >
    {tokens(card.plaintext).map((text, index) => {
      const word = resolveWord(text, index, card, words, instances);
      const known = word ? staged[word.word_id] ?? word.known : false;
      const root = word
        ? roots.find(item => item.root_id === word.root_id)
        : null;

      if (!word) {
        return <span key={index} className="text-slate-200">{text}</span>;
      }

      return (
        <span key={index} className="relative group">
          <button
            disabled={disabled}
            onClick={event => {
              event.stopPropagation();
              onToggle(word.word_id, known);
            }}
            className={`rounded-md px-1 hover:bg-white/5 ${
              known ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {text}
          </button>
          <span
            dir="ltr"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-40 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 p-3 text-center text-xs leading-normal text-slate-300 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <span className="block text-white">
              {word.translation || 'No translation'}
            </span>
            <span className="mt-1 block font-arabic text-indigo-300">
              {root?.plaintext || ''}
            </span>
            <span className="mt-1 block">
              {root?.translation || ''}
            </span>
          </span>
        </span>
      );
    })}
  </div>
);

const FlashcardEditor = () => {
  const [catalog, setCatalog] = useState(() => buildCatalog());
  const [words, setWords] = useState([]);
  const [roots, setRoots] = useState([]);
  const [instances, setInstances] = useState([]);
  const [store, setStore] = useState(readStore);

  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [error, setError] = useState('');
  const [audioError, setAudioError] = useState('');

  const [view, setView] = useState('setup');
  const [focus, setFocus] = useState(false);
  const [topicId, setTopicId] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('20');
  const [mode, setMode] = useState('due');
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);

  const [session, setSession] = useState([]);
  const [ratings, setRatings] = useState({});
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [staged, setStaged] = useState({});
  const [busy, setBusy] = useState(false);

  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [sideTab, setSideTab] = useState('session');
  const [reload, setReload] = useState(0);

  const lock = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setConnectionError('');

      try {
        const responses = await Promise.all([
          '/api/sentences',
          '/api/words',
          '/api/roots',
          '/api/word-instances',
          '/api/tutor/flashcards'
        ].map(path => fetch(`${API_BASE}${path}`)));

        if (!responses.every(response => response.ok)) {
          throw new Error(
            'Database unavailable. Course cards still work. Start Flask to load and save your database cards.'
          );
        }

        const [s, w, r, i, f] = await Promise.all(
          responses.map(response => response.json())
        );

        if (![s, w, r, i, f].every(Array.isArray)) {
          throw new Error('The database returned invalid data.');
        }

        if (cancelled) return;

        const nextCatalog = buildCatalog(s, f);
        setCatalog(nextCatalog);
        setWords(w);
        setRoots(r);
        setInstances(i);

        setStore(previous => {
          if (previous.migrated) return previous;

          try {
            const old = JSON.parse(
              localStorage.getItem('learn-arabic.flashcards.v2') || '{}'
            );

            const next = {
              ...previous,
              schedule: { ...previous.schedule },
              bookmarks: [...previous.bookmarks],
              history: [...previous.history],
              days: [...previous.days],
              totals: { ...previous.totals },
              migrated: true
            };

            const idMap = new Map(
              nextCatalog
                .filter(card => card.dbId != null)
                .map(card => [card.dbId, card.id])
            );

            idMap.forEach((id, dbId) => {
              if (old?.schedule?.[dbId] && !next.schedule[id]) {
                next.schedule[id] = old.schedule[dbId];
              }
              if (
                old?.bookmarks?.includes(dbId) &&
                !next.bookmarks.includes(id)
              ) {
                next.bookmarks.push(id);
              }
            });

            if (Array.isArray(old?.history)) {
              old.history.forEach(item => {
                if (
                  idMap.has(item?.id) &&
                  ['easy', 'hard'].includes(item.rating) &&
                  Number.isFinite(item.at)
                ) {
                  next.history.push({
                    ...item,
                    id: idMap.get(item.id)
                  });
                }
              });
            }

            if (Array.isArray(old?.days)) {
              next.days = [...new Set([
                ...next.days,
                ...old.days.filter(day => typeof day === 'string')
              ])];
            }

            ['easy', 'hard'].forEach(key => {
              next.totals[key] += Math.max(
                0,
                Number(old?.totals?.[key]) || 0
              );
            });

            next.history = next.history.slice(-500);
            return next;
          } catch {
            return { ...previous, migrated: true };
          }
        });
      } catch (err) {
        if (!cancelled) {
          setConnectionError(
            err.message ||
            'Could not connect to Flask. Course cards are available.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setStorageError('');
    } catch {
      setStorageError(
        'Your browser could not save review progress. Keep this page open.'
      );
    }
  }, [store]);

  useEffect(() => {
    if (view === 'summary') return undefined;

    const timer = setInterval(
      () => setNow(Date.now()),
      view === 'review' ? 1000 : 10000
    );

    return () => clearInterval(timer);
  }, [view]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const card = session[index];

  const topic = card
    ? TOPICS.find(item =>
        item.id === (
          topicId !== 'all' && card.topicIds.includes(topicId)
            ? topicId
            : card.topicIds[0]
        )
      ) || GENERAL
    : GENERAL;

  const counts = Object.fromEntries(
    RATINGS.map(rating => [
      rating.id,
      Object.values(ratings).filter(value => value === rating.id).length
    ])
  );

  const reviewed = Object.keys(ratings).length;
  const progress = session.length
    ? Math.round(reviewed / session.length * 100)
    : 0;

  const totalReviews = Object.values(store.totals)
    .reduce((sum, value) => sum + value, 0);

  const streak = streakOf(store.days);
  const elapsed = view === 'summary'
    ? endedAt - startedAt
    : now - startedAt;

  const dueCount = catalog.filter(item =>
    (Number(store.schedule[item.id]?.due) || 0) <= Date.now()
  ).length;

  const candidates = useMemo(() => catalog.filter(item =>
    (topicId === 'all' || item.topicIds.includes(topicId)) &&
    (!onlyBookmarks || store.bookmarks.includes(item.id)) &&
    (
      !query.trim() ||
      `${item.plaintext} ${item.translation}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    )
  ), [catalog, topicId, onlyBookmarks, query, store.bookmarks]);

  const available = candidates.filter(item =>
    mode === 'all' ||
    (Number(store.schedule[item.id]?.due) || 0) <= Date.now()
  );

  const availableTopics = [...TOPICS, GENERAL].filter(item =>
    catalog.some(value => value.topicIds.includes(item.id))
  );

  const hasWordChanges = Object.keys(staged).length > 0;

  const stopAudio = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const resetCard = () => {
    stopAudio();
    setFlipped(false);
    setStaged({});
    setError('');
    setAudioError('');
  };

  const startSession = override => {
    if (lock.current || loading) return;

    const selected = override || [...available].sort((a, b) =>
      (Number(store.schedule[a.id]?.due) || 0) -
      (Number(store.schedule[b.id]?.due) || 0)
    );

    const deck = override
      ? selected
      : selected.slice(0, limit === 'all' ? selected.length : Number(limit));

    if (!deck.length) return;

    setSession(deck);
    setRatings({});
    setIndex(0);
    setStartedAt(Date.now());
    setNow(Date.now());
    setEndedAt(0);
    setView('review');
    resetCard();
  };

  const move = next => {
    if (
      lock.current ||
      hasWordChanges ||
      next < 0 ||
      next >= session.length
    ) return;

    setIndex(next);
    resetCard();
  };

  const openSetup = () => {
    if (lock.current || hasWordChanges) return;

    stopAudio();
    setView('setup');
    setFocus(false);
    setError('');
    setAudioError('');
  };

  const toggleBookmark = () => {
    if (!card) return;

    setStore(previous => ({
      ...previous,
      bookmarks: previous.bookmarks.includes(card.id)
        ? previous.bookmarks.filter(id => id !== card.id)
        : [...previous.bookmarks, card.id]
    }));
  };

  const speak = () => {
    setAudioError('');

    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      setAudioError('This browser does not support speech playback.');
      return;
    }

    const voice = window.speechSynthesis
      .getVoices()
      .find(item => /^ar(?:-|_|$)/i.test(item.lang));

    if (!voice) {
      setAudioError(
        'No Arabic voice is available. Enable an Arabic voice in your device settings, then try again.'
      );
      return;
    }

    stopAudio();

    const utterance = new SpeechSynthesisUtterance(card.plaintext);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;

    utterance.onerror = event => {
      if (!['canceled', 'interrupted'].includes(event.error)) {
        setAudioError('Audio playback failed on this device.');
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const saveWords = async () => {
    if (lock.current || !hasWordChanges) return;

    lock.current = true;
    setBusy(true);
    setError('');

    try {
      for (const [id, known] of Object.entries(staged)) {
        const response = await fetch(
          `${API_BASE}/api/tutor/words/${id}/known`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ known })
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || 'Could not save word changes. Try again.'
          );
        }

        setWords(previous => previous.map(word =>
          word.word_id === Number(id)
            ? { ...word, known: result.new_known }
            : word
        ));

        setStaged(previous => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
      }
    } catch (err) {
      setError(err.message || 'Could not save word changes.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const saveCard = async () => {
    if (lock.current || !card || card.inDatabaseDeck) return;

    lock.current = true;
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/tutor/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arabic: card.plaintext,
          translation: card.translation
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save this card.');
      }

      const update = item => item.id === card.id
        ? {
            ...item,
            dbId: result.sentence_id,
            inDatabaseDeck: true
          }
        : item;

      setCatalog(previous => previous.map(update));
      setSession(previous => previous.map(update));
    } catch (err) {
      setError(err.message || 'Could not save. Check that Flask is running.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const rate = rating => {
    if (
      !card ||
      lock.current ||
      hasWordChanges ||
      !flipped ||
      ratings[card.id]
    ) return;

    lock.current = true;

    const at = Date.now();
    const day = dayKey(new Date(at));

    setStore(previous => {
      const interval = intervalFor(previous.schedule[card.id], rating);

      return {
        ...previous,
        schedule: {
          ...previous.schedule,
          [card.id]: { rating, interval, due: at + interval }
        },
        history: [
          ...previous.history,
          { id: card.id, rating, at }
        ].slice(-500),
        days: previous.days.includes(day)
          ? previous.days
          : [...previous.days, day],
        totals: {
          ...previous.totals,
          [rating]: previous.totals[rating] + 1
        }
      };
    });

    const nextRatings = { ...ratings, [card.id]: rating };
    setRatings(nextRatings);
    resetCard();

    if (Object.keys(nextRatings).length === session.length) {
      setEndedAt(at);
      setView('summary');
    } else {
      for (let offset = 1; offset <= session.length; offset += 1) {
        const next = (index + offset) % session.length;
        if (!nextRatings[session[next].id]) {
          setIndex(next);
          break;
        }
      }
    }
  };

  useEffect(() => {
    if (!busy) lock.current = false;
  }, [index, ratings, view, busy]);

  useEffect(() => {
    if (view !== 'review') return undefined;

    const handle = event => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        lock.current ||
        /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)
      ) return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped(value => !value);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(index + 1);
      } else if (event.key.toLowerCase() === 'f') {
        setFocus(value => !value);
      } else if (['1', '2', '3', '4'].includes(event.key)) {
        rate(RATINGS[Number(event.key) - 1].id);
      }
    };

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });

  const summaryTiles = values => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {values.map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
        >
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  );

  const levelStyle = value =>
    value === 'Beginner'
      ? 'text-emerald-300 bg-emerald-500/10'
      : value === 'Intermediate'
        ? 'text-sky-300 bg-sky-500/10'
        : 'text-violet-300 bg-violet-500/10';

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 mb-2">
            Learn in context
          </p>
          <h1 className="text-3xl font-bold text-white">Flashcards</h1>
          <p className="text-sm text-slate-400 mt-2">
            Build confidence with meaningful Arabic sentences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'review' && (
            <button
              onClick={() => setFocus(value => !value)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
            >
              {focus
                ? <Minimize2 className="w-4 h-4" />
                : <Maximize2 className="w-4 h-4" />}
              {focus ? 'Exit Focus' : 'Focus Mode'}
            </button>
          )}

          {view !== 'setup' && (
            <button
              disabled={busy || hasWordChanges}
              onClick={openSetup}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
            >
              <Settings className="w-4 h-4" />
              Session Setup
            </button>
          )}
        </div>
      </header>

      {storageError && (
        <p role="alert" className="text-sm text-amber-300">{storageError}</p>
      )}

      {connectionError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          {connectionError}
          <button
            onClick={() => setReload(value => value + 1)}
            disabled={loading}
            className="ml-3 underline"
          >
            Reconnect
          </button>
        </div>
      )}

      {view === 'setup' && (
        <>
          {summaryTiles([
            ['Available sentences', catalog.length],
            ['Due now', dueCount],
            ['Study streak', `${streak} days`],
            ['Total reviews', totalReviews]
          ])}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Choose your topic
                </h2>
                <span className="text-xs text-slate-500">
                  {availableTopics.length} topics
                </span>
              </div>

              <button
                onClick={() => setTopicId('all')}
                className={`w-full rounded-xl border p-4 text-left text-sm ${
                  topicId === 'all'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                    : 'border-slate-800 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  All Topics
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableTopics.map(item => {
                  const count = catalog.filter(value =>
                    value.topicIds.includes(item.id)
                  ).length;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setTopicId(item.id)}
                      className={`relative rounded-xl border p-4 text-left transition-colors ${
                        topicId === item.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950/30 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-indigo-400" />
                        <span
                          className={`text-[9px] px-2 py-1 rounded-md ${levelStyle(item.level)}`}
                        >
                          {item.level}
                        </span>
                      </div>
                      <p
                        className="font-arabic text-base text-white"
                        dir="rtl"
                      >
                        {item.arabic}
                      </p>
                      <h3 className="text-xs text-slate-300 mt-1">
                        {item.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-3">
                        {count} sentences
                      </p>
                      {topicId === item.id && (
                        <Check className="absolute bottom-4 right-3 w-4 h-4 text-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-5 xl:sticky xl:top-0">
              <h2 className="text-lg font-semibold text-white">
                Build your session
              </h2>

              <div>
                <label
                  htmlFor="review-mode"
                  className="block text-xs text-slate-400 mb-2"
                >
                  Review mode
                </label>
                <select
                  id="review-mode"
                  value={mode}
                  onChange={event => setMode(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200"
                >
                  <option value="due">Due cards only</option>
                  <option value="all">Practise all cards</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="session-size"
                  className="block text-xs text-slate-400 mb-2"
                >
                  Session size
                </label>
                <select
                  id="session-size"
                  value={limit}
                  onChange={event => setLimit(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200"
                >
                  <option value="10">10 cards</option>
                  <option value="20">20 cards</option>
                  <option value="all">All matching cards</option>
                </select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  aria-label="Search sentences"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search sentences..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-3 text-xs text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyBookmarks}
                  onChange={event => setOnlyBookmarks(event.target.checked)}
                  className="accent-indigo-500"
                />
                Bookmarked cards only
              </label>

              <div className="rounded-xl bg-slate-950/50 p-4">
                <p className="text-xs text-slate-400">Cards in this session</p>
                <p className="text-3xl text-white font-semibold mt-1">
                  {Math.min(
                    available.length,
                    limit === 'all' ? available.length : Number(limit)
                  )}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {available.length} matching cards available
                </p>
              </div>

              <button
                disabled={loading || available.length === 0}
                onClick={() => startSession()}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                {loading
                  ? <Loader className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4" />}
                {loading ? 'Loading your data...' : 'Start Session'}
              </button>

              {!available.length && (
                <p className="text-xs text-slate-400">
                  Try “Practise all cards,” another topic, or clear your filters.
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-slate-500">
                Course sentences are ready to practise. Use Save to Database
                on a card to add it to your saved project deck.
              </p>
            </aside>
          </div>
        </>
      )}

      {view === 'review' && card && (
        <div
          className={`grid gap-5 items-start ${
            focus
              ? 'grid-cols-1 max-w-4xl mx-auto'
              : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px]'
          }`}
        >
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-wrap items-center gap-4">
              <span className="text-xs font-medium text-white">
                Session Progress
              </span>
              <div className="flex-1 min-w-[80px] h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">
                {reviewed} / {session.length}
              </span>
              <span className="flex items-center gap-1 text-xs text-orange-300">
                <Flame className="w-4 h-4" />
                {streak} days
              </span>
              <span className="text-xs text-slate-500">
                {durationText(elapsed)}
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <button
                aria-label="Previous card"
                disabled={busy || hasWordChanges || index === 0}
                onClick={() => move(index - 1)}
                className="shrink-0 rounded-full border border-slate-700 p-2 text-slate-400 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div
                role="button"
                tabIndex={0}
                aria-label="Flip flashcard"
                onClick={() => {
                  if (!lock.current) setFlipped(value => !value);
                }}
                className="relative flex-1 min-w-0 min-h-[360px] md:min-h-[390px] rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-6 md:p-9 shadow-2xl cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-300">
                    {flipped ? 'Translation & Vocabulary' : 'Arabic Sentence'}
                  </span>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {index + 1} / {session.length}
                    </span>
                    <button
                      aria-label="Bookmark card"
                      aria-pressed={store.bookmarks.includes(card.id)}
                      onClick={event => {
                        event.stopPropagation();
                        toggleBookmark();
                      }}
                      className="rounded-lg border border-slate-700 p-2 text-indigo-300"
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          store.bookmarks.includes(card.id)
                            ? 'fill-indigo-400'
                            : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div
                  key={`${card.id}-${flipped}`}
                  className="flashcard-content flex flex-col justify-center min-h-[240px] gap-6 py-6"
                >
                  {flipped ? (
                    <>
                      <WordLine
                        card={card}
                        words={words}
                        roots={roots}
                        instances={instances}
                        staged={staged}
                        disabled={busy}
                        onToggle={(id, known) =>
                          setStaged(previous => ({
                            ...previous,
                            [id]: !known
                          }))
                        }
                      />
                      <p className="text-center text-lg md:text-xl text-indigo-100 leading-relaxed">
                        {card.translation}
                      </p>
                    </>
                  ) : (
                    <p
                      dir="rtl"
                      className="text-center font-arabic text-3xl md:text-4xl leading-loose text-white"
                    >
                      {card.plaintext}
                    </p>
                  )}

                  <button
                    aria-label="Listen to Arabic"
                    onClick={event => {
                      event.stopPropagation();
                      speak();
                    }}
                    className="mx-auto rounded-full bg-indigo-500/10 p-3 text-indigo-300 hover:bg-indigo-500/20"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <RotateCw className="w-3 h-3" />
                  Click or press Space to flip
                </p>
              </div>

              <button
                aria-label="Next card"
                disabled={
                  busy ||
                  hasWordChanges ||
                  index === session.length - 1
                }
                onClick={() => move(index + 1)}
                className="shrink-0 rounded-full border border-slate-700 p-2 text-slate-400 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {audioError && (
              <p role="alert" className="text-xs text-amber-300">
                {audioError}
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm text-rose-300">{error}</p>
            )}

            {flipped && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <p className="text-xs text-slate-400">
                    Click a coloured word to change its knowledge status.
                  </p>
                  <button
                    onClick={saveCard}
                    disabled={busy || card.inDatabaseDeck}
                    className="flex items-center gap-1.5 text-xs text-indigo-300 disabled:opacity-50"
                  >
                    {card.inDatabaseDeck
                      ? <Check className="w-4 h-4" />
                      : <Plus className="w-4 h-4" />}
                    {card.inDatabaseDeck
                      ? 'In Database Deck'
                      : 'Save to Database'}
                  </button>
                </div>

                {hasWordChanges && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      disabled={busy}
                      onClick={saveWords}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white"
                    >
                      {busy ? 'Saving...' : 'Save Word Changes'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setStaged({})}
                      className="text-xs text-slate-400"
                    >
                      Discard Changes
                    </button>
                    <span className="text-[10px] text-slate-500">
                      Save or discard before continuing.
                    </span>
                  </div>
                )}

                <p className="mt-2 text-[10px] text-slate-500">
                  Green: known · Amber: learning · White: not matched in
                  your word database.
                </p>
              </div>
            )}

            {ratings[card.id] ? (
              <p className="text-center text-sm text-slate-400">
                Reviewed as {ratings[card.id]} in this session.
              </p>
            ) : !flipped ? (
              <p className="text-center text-sm text-slate-500">
                Recall the meaning, then flip the card to rate your recall.
              </p>
            ) : (
              <div>
                <p className="mb-3 text-center text-xs text-slate-400">
                  How well did you remember this sentence?
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {RATINGS.map((rating, ratingIndex) => (
                    <button
                      key={rating.id}
                      disabled={busy || hasWordChanges}
                      onClick={() => rate(rating.id)}
                      className={`rounded-xl border p-3 text-center transition-transform hover:-translate-y-0.5 disabled:opacity-40 ${rating.style}`}
                    >
                      <span className="block text-sm font-semibold">
                        {rating.label}
                      </span>
                      <span className="block text-[10px] mt-1">
                        {intervalText(
                          intervalFor(store.schedule[card.id], rating.id)
                        )}
                      </span>
                      <span className="block text-[9px] opacity-50 mt-1">
                        {ratingIndex + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div>
                <p className="text-[10px] text-slate-500">Words</p>
                <p className="mt-1 text-sm text-white">
                  {tokens(card.plaintext).length}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Level</p>
                <p className="mt-1 text-sm text-white">{topic.level}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Topic</p>
                <p className="mt-1 text-sm text-indigo-300">{topic.title}</p>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-500">
              Space: flip · ← / →: navigate · 1–4: rate after reveal · F: focus
            </p>
          </section>

          {!focus && (
            <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex border-b border-slate-800">
                {['session', 'statistics'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSideTab(tab)}
                    className={`flex-1 py-3 text-xs ${
                      sideTab === tab
                        ? 'border-b-2 border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {tab === 'session' ? 'This Session' : 'Statistics'}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-5">
                {sideTab === 'session' ? (
                  <>
                    <div className="flex items-center gap-4 rounded-xl bg-slate-950/40 p-4">
                      <div
                        className="h-20 w-20 shrink-0 rounded-full p-1.5"
                        style={{
                          background: `conic-gradient(#6366f1 ${progress}%, #1e293b 0)`
                        }}
                      >
                        <div className="flex h-full items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-white">
                          {progress}%
                        </div>
                      </div>
                      <div className="space-y-2 text-xs text-slate-400">
                        <p>{reviewed} reviewed</p>
                        <p>{session.length - reviewed} remaining</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {RATINGS.map(rating => (
                        <div
                          key={rating.id}
                          className={`rounded-lg border p-3 text-xs ${rating.style}`}
                        >
                          <span className="text-lg font-semibold mr-2">
                            {counts[rating.id]}
                          </span>
                          {rating.label}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-[10px] text-slate-500 mb-2">
                        CURRENT TOPIC
                      </p>
                      <p dir="rtl" className="font-arabic text-lg text-white">
                        {topic.arabic}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {topic.title}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {[
                      ['Total reviews', totalReviews],
                      ['Study days', store.days.length],
                      ['Current streak', `${streak} days`],
                      ...RATINGS.map(rating => [
                        rating.label,
                        store.totals[rating.id]
                      ])
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-xs text-white mb-3">
                    Recent Sentences
                  </h3>
                  <div className="space-y-3">
                    {store.history.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Your reviews appear here.
                      </p>
                    )}

                    {store.history.slice(-5).reverse().map((item, itemIndex) => {
                      const recentCard = catalog.find(value =>
                        value.id === item.id
                      );
                      if (!recentCard) return null;

                      return (
                        <div
                          key={`${item.at}-${itemIndex}`}
                          className="flex items-start gap-2"
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 mt-1 shrink-0 ${
                              ['good', 'easy'].includes(item.rating)
                                ? 'text-emerald-400'
                                : 'text-orange-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <p
                              dir="rtl"
                              className="font-arabic text-xs text-slate-200"
                            >
                              {recentCard.plaintext}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              {recentCard.translation}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {view === 'summary' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-3xl border border-indigo-500/20 bg-slate-900 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Session complete</h2>
            <p className="text-sm text-slate-400 mt-2">
              You reviewed {reviewed} sentences. Keep practising the ones
              that need more attention.
            </p>
          </div>

          {summaryTiles([
            ['Reviewed', reviewed],
            ['Study time', durationText(elapsed)],
            ['Again + Hard', counts.again + counts.hard],
            ['Streak', `${streak} days`]
          ])}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {RATINGS.map(rating => (
              <div
                key={rating.id}
                className={`rounded-xl border p-4 text-center ${rating.style}`}
              >
                <p className="text-2xl font-semibold">{counts[rating.id]}</p>
                <p className="text-xs mt-1">{rating.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {counts.again + counts.hard > 0 && (
              <button
                onClick={() => startSession(
                  session.filter(item =>
                    ['again', 'hard'].includes(ratings[item.id])
                  )
                )}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white"
              >
                Review Difficult Cards
              </button>
            )}
            <button
              onClick={openSetup}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-200"
            >
              New Session
            </button>
          </div>

          <p className="text-center text-xs text-slate-500">
            Sentence ratings update review dates. Word knowledge changes
            only when you explicitly save word changes.
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-500">
        Review progress, bookmarks and schedules are stored in this browser.
        Word knowledge and saved database cards use Flask. Audio uses your
        device’s available Arabic voices.
      </p>

      <style>{`
        @keyframes flashcardReveal {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .flashcard-content {
          animation: flashcardReveal 180ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .flashcard-content { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default FlashcardEditor;