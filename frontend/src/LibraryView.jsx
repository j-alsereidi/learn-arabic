import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  Search,
  Bookmark,
  BookOpen,
  Play,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Plus,
  Loader,
  CheckCircle2,
  Layers,
  Volume2
} from 'lucide-react';

import {
  LIBRARY_TOPICS,
  allTopicSentences
} from './libraryData';

const API_BASE = process.env.REACT_APP_API_URL || '';
const STORAGE_KEY = 'learn-arabic.library.v2';

const CATEGORIES = [
  'All',
  'Dialogues',
  'Vocabulary',
  'Grammar',
  'Culture',
  'Daily Life',
  'Travel',
  'Food'
];

const LEGACY = {
  greetings: ['السلام عليكم', 'كيف حالك؟', 'اسمي مريم'],
  home: ['هذا بيتي', 'الباب مفتوح', 'الكتاب على الطاولة'],
  food: [
    'أريد كوب ماء',
    'أحب القهوة العربية',
    'الحساب من فضلك'
  ],
  airport: [
    'أين بوابة المغادرة؟',
    'متى تقلع الطائرة؟',
    'هذا جواز سفري'
  ],
  city: ['أين المكتبة؟', 'المسجد قريب', 'المدينة جميلة'],
  shopping: [
    'كم سعر هذا الكتاب؟',
    'هل لديكم مقاس أكبر؟',
    'أريد شراء هذه الحقيبة'
  ],
  culture: [
    'تشتهر الإمارات بكرم الضيافة',
    'تقدم القهوة العربية للضيوف',
    'يحافظ الناس على تراثهم الثقافي'
  ],
  grammar: [
    'أنا طالب',
    'البيت كبير',
    'اللغة العربية جميلة'
  ]
};

const keyOf = (lesson, index) => `${lesson.id}:${index}`;

const cardKey = item =>
  JSON.stringify([
    item.arabic.trim(),
    item.translation.trim()
  ]);

const countStudied = (lesson, state) =>
  lesson.sentences.filter(
    (_, index) => state.studied[keyOf(lesson, index)]
  ).length;

const topicCount = (topic, state) =>
  topic.lessons.reduce(
    (sum, lesson) => sum + countStudied(lesson, state),
    0
  );

const percent = (done, total) =>
  total ? Math.round((done / total) * 100) : 0;

const readState = () => {
  const empty = {
    bookmarks: [],
    studied: {}
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const value = JSON.parse(saved);

      return {
        bookmarks: Array.isArray(value?.bookmarks)
          ? value.bookmarks
          : [],
        studied:
          value?.studied &&
          typeof value.studied === 'object' &&
          !Array.isArray(value.studied)
            ? value.studied
            : {}
      };
    }

    const old = JSON.parse(
      localStorage.getItem('learn-arabic.library.v1') ||
        '{}'
    );

    const studied = {};

    LIBRARY_TOPICS.forEach(topic => {
      topic.lessons.forEach(lesson => {
        lesson.sentences.forEach((item, index) => {
          const oldIndex = (
            LEGACY[topic.id] || []
          ).indexOf(item.arabic);

          if (
            oldIndex >= 0 &&
            old?.studied?.[`${topic.id}:${oldIndex}`]
          ) {
            studied[keyOf(lesson, index)] = true;
          }
        });
      });
    });

    return {
      bookmarks: Array.isArray(old?.bookmarks)
        ? old.bookmarks
        : [],
      studied
    };
  } catch {
    return empty;
  }
};

const Level = ({ value }) => (
  <span
    className={`
      inline-flex rounded-md border px-2 py-1
      text-[10px] font-medium
      ${
        value === 'Beginner'
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : value === 'Intermediate'
            ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
            : 'border-violet-500/20 bg-violet-500/10 text-violet-300'
      }
    `}
  >
    {value}
  </span>
);

const Progress = ({ done, total }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
    <div
      className="h-full rounded-full bg-indigo-500 transition-all"
      style={{
        width: `${percent(done, total)}%`
      }}
    />
  </div>
);

const Cover = ({ topic, large = false }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [topic.image]);

  return (
    <div
      className={`
        relative overflow-hidden bg-gradient-to-br
        ${topic.accent}
        ${large ? 'h-44' : 'h-36'}
      `}
    >
      {!failed && (
        <img
          src={topic.image}
          alt={topic.title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="h-12 w-12 text-white/60" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

      <span className="absolute bottom-3 left-4 text-[10px] uppercase tracking-widest text-white/90">
        {topic.category}
      </span>
    </div>
  );
};

const LibraryView = () => {
  const [state, setState] = useState(readState);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [level, setLevel] = useState('All levels');
  const [onlySaved, setOnlySaved] = useState(false);

  const [selectedId, setSelectedId] = useState(
    LIBRARY_TOPICS[0].id
  );

  const [panel, setPanel] = useState('lessons');
  const [active, setActive] = useState(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const [savedCards, setSavedCards] = useState({});
  const [saving, setSaving] = useState(null);
  const saveLock = useRef(false);

  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [audioError, setAudioError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      setStorageError('');
    } catch {
      setStorageError(
        'Your browser could not save your progress. Keep this page open.'
      );
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/tutor/flashcards`)
      .then(response =>
        response.ok ? response.json() : []
      )
      .then(cards => {
        if (!cancelled && Array.isArray(cards)) {
          const known = {};

          cards.forEach(card => {
            if (
              typeof card.plaintext === 'string' &&
              typeof card.translation === 'string'
            ) {
              known[
                cardKey({
                  arabic: card.plaintext,
                  translation: card.translation
                })
              ] = true;
            }
          });

          setSavedCards(previous => ({
            ...previous,
            ...known
          }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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

  const filtered = useMemo(
    () =>
      LIBRARY_TOPICS.filter(topic => {
        const text = `
          ${topic.title}
          ${topic.arabic}
          ${topic.description}
          ${topic.lessons
            .map(item => `${item.title} ${item.arabic}`)
            .join(' ')}
        `.toLowerCase();

        return (
          (
            !query.trim() ||
            text.includes(query.trim().toLowerCase())
          ) &&
          (
            category === 'All' ||
            topic.category === category ||
            topic.tags.includes(category)
          ) &&
          (
            level === 'All levels' ||
            topic.level === level
          ) &&
          (
            !onlySaved ||
            state.bookmarks.includes(topic.id)
          )
        );
      }),
    [
      query,
      category,
      level,
      onlySaved,
      state.bookmarks
    ]
  );

  const selected =
    filtered.find(topic => topic.id === selectedId) ||
    filtered[0];

  const activeTopic = active
    ? LIBRARY_TOPICS.find(
        topic => topic.id === active.topicId
      )
    : null;

  const activeLesson = activeTopic?.lessons.find(
    lesson => lesson.id === active.lessonId
  );

  const totalLessons = LIBRARY_TOPICS.reduce(
    (sum, topic) => sum + topic.lessons.length,
    0
  );

  const completedLessons = LIBRARY_TOPICS.reduce(
    (sum, topic) =>
      sum +
      topic.lessons.filter(
        lesson =>
          countStudied(lesson, state) ===
          lesson.sentences.length
      ).length,
    0
  );

  const totalSentences = LIBRARY_TOPICS.reduce(
    (sum, topic) =>
      sum + allTopicSentences(topic).length,
    0
  );

  const toggleBookmark = topic => {
    setState(previous => ({
      ...previous,
      bookmarks: previous.bookmarks.includes(topic.id)
        ? previous.bookmarks.filter(
            id => id !== topic.id
          )
        : [...previous.bookmarks, topic.id]
    }));
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const openLesson = (topic, lesson) => {
    const first = lesson.sentences.findIndex(
      (_, itemIndex) =>
        !state.studied[keyOf(lesson, itemIndex)]
    );

    stopAudio();
    setSelectedId(topic.id);

    setActive({
      topicId: topic.id,
      lessonId: lesson.id
    });

    setIndex(first < 0 ? 0 : first);
    setRevealed(false);
    setFinished(false);
    setError('');
    setAudioError('');
  };

  const startTopic = topic => {
    const nextLesson =
      topic.lessons.find(
        lesson =>
          countStudied(lesson, state) <
          lesson.sentences.length
      ) || topic.lessons[0];

    openLesson(topic, nextLesson);
  };

  const closeLesson = () => {
    stopAudio();
    setActive(null);
    setError('');
    setAudioError('');
  };

  const move = next => {
    stopAudio();
    setIndex(next);
    setRevealed(false);
    setAudioError('');
    setError('');
  };

  const markStudied = () => {
    const nextStudied = {
      ...state.studied,
      [keyOf(activeLesson, index)]: true
    };

    setState(previous => ({
      ...previous,
      studied: {
        ...previous.studied,
        [keyOf(activeLesson, index)]: true
      }
    }));

    const allDone = activeLesson.sentences.every(
      (_, itemIndex) =>
        nextStudied[keyOf(activeLesson, itemIndex)]
    );

    if (allDone) {
      stopAudio();
      setFinished(true);
      return;
    }

    const next = activeLesson.sentences.findIndex(
      (_, itemIndex) =>
        itemIndex > index &&
        !nextStudied[keyOf(activeLesson, itemIndex)]
    );

    move(
      next >= 0
        ? next
        : activeLesson.sentences.findIndex(
            (_, itemIndex) =>
              !nextStudied[keyOf(activeLesson, itemIndex)]
          )
    );
  };

  const saveCard = async item => {
    const key = cardKey(item);

    if (saveLock.current || savedCards[key]) return;

    saveLock.current = true;
    setSaving(key);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE}/api/tutor/flashcards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Could not save the flashcard.'
        );
      }

      setSavedCards(previous => ({
        ...previous,
        [key]: true
      }));
    } catch (err) {
      setError(
        err.message ||
          'Could not save. Check that Flask is running.'
      );
    } finally {
      saveLock.current = false;
      setSaving(null);
    }
  };

  const saveButton = item => (
    <button
      onClick={() => saveCard(item)}
      disabled={
        Boolean(saving) || savedCards[cardKey(item)]
      }
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
    >
      {saving === cardKey(item) ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : savedCards[cardKey(item)] ? (
        <Check className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}

      {saving === cardKey(item)
        ? 'Saving...'
        : savedCards[cardKey(item)]
          ? 'Saved to Flashcards'
          : 'Save to Flashcards'}
    </button>
  );

  const speak = text => {
    setAudioError('');

    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      setAudioError(
        'Audio is not supported in this browser.'
      );
      return;
    }

    const voice = window.speechSynthesis
      .getVoices()
      .find(item => /^ar(?:-|_|$)/i.test(item.lang));

    if (!voice) {
      setAudioError(
        'No Arabic voice is available. Try again shortly or enable an Arabic voice in your device settings.'
      );
      return;
    }

    stopAudio();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;

    utterance.onerror = event => {
      if (
        !['canceled', 'interrupted'].includes(event.error)
      ) {
        setAudioError(
          'The Arabic audio could not play on this device.'
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  if (activeLesson) {
    const item = activeLesson.sentences[index];
    const done = countStudied(activeLesson, state);

    const nextLesson =
      activeTopic.lessons[
        activeTopic.lessons.findIndex(
          lesson => lesson.id === activeLesson.id
        ) + 1
      ];

    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <button
          onClick={closeLesson}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </button>

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-indigo-400">
              {activeTopic.title}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-white">
              {activeLesson.title}
            </h1>

            <p
              className="mt-2 font-arabic text-lg text-slate-400"
              dir="rtl"
            >
              {activeLesson.arabic}
            </p>
          </div>

          <Level value={activeTopic.level} />
        </header>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Lesson progress</span>
            <span>
              {done} / {activeLesson.sentences.length} studied
            </span>
          </div>

          <Progress
            done={done}
            total={activeLesson.sentences.length}
          />
        </div>

        {storageError && (
          <p role="alert" className="text-sm text-amber-300">
            {storageError}
          </p>
        )}

        {finished ? (
          <div className="rounded-3xl border border-emerald-500/20 bg-slate-900 p-10 text-center space-y-5">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />

            <h2 className="text-2xl font-semibold text-white">
              Lesson complete
            </h2>

            <p className="text-slate-400">
              You studied all {activeLesson.sentences.length}{' '}
              sentences in {activeLesson.title}.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={closeLesson}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300"
              >
                View Lessons
              </button>

              {nextLesson && (
                <button
                  onClick={() =>
                    openLesson(activeTopic, nextLesson)
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-500"
                >
                  Next Lesson
                </button>
              )}

              <button
                onClick={() => {
                  setFinished(false);
                  move(0);
                }}
                className="px-4 py-3 text-sm text-indigo-300"
              >
                Review Again
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-5 items-start">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-10 text-center space-y-7">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    Sentence {index + 1} of{' '}
                    {activeLesson.sentences.length}
                  </span>

                  {state.studied[
                    keyOf(activeLesson, index)
                  ] && (
                    <span className="text-emerald-400">
                      Studied
                    </span>
                  )}
                </div>

                <p
                  className="font-arabic text-3xl md:text-4xl leading-loose text-white"
                  dir="rtl"
                >
                  {item.arabic}
                </p>

                <button
                  onClick={() => speak(item.arabic)}
                  className="mx-auto flex items-center gap-2 rounded-full bg-indigo-500/10 px-4 py-2 text-xs text-indigo-300"
                >
                  <Volume2 className="h-4 w-4" />
                  Listen
                </button>

                {revealed ? (
                  <p className="text-lg text-indigo-100 leading-relaxed">
                    {item.translation}
                  </p>
                ) : (
                  <button
                    onClick={() => setRevealed(true)}
                    className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Show Translation
                  </button>
                )}

                <div>{saveButton(item)}</div>
              </div>

              {audioError && (
                <p
                  role="alert"
                  className="text-xs text-amber-300"
                >
                  {audioError}
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm text-rose-300">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  disabled={index === 0}
                  onClick={() => move(index - 1)}
                  className="flex items-center gap-1 text-sm text-slate-400 disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>

                <button
                  onClick={markStudied}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-500"
                >
                  <Check className="h-4 w-4" />
                  Studied — Continue
                </button>

                <button
                  disabled={
                    index === activeLesson.sentences.length - 1
                  }
                  onClick={() => move(index + 1)}
                  className="flex items-center gap-1 text-sm text-slate-400 disabled:opacity-30"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {activeLesson.sentences.map(
                  (_, itemIndex) => (
                    <button
                      key={itemIndex}
                      aria-label={`Go to sentence ${itemIndex + 1}`}
                      aria-current={
                        index === itemIndex ? 'step' : undefined
                      }
                      onClick={() => move(itemIndex)}
                      className={`
                        h-8 w-8 rounded-lg text-xs border
                        ${
                          index === itemIndex
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : state.studied[
                                  keyOf(activeLesson, itemIndex)
                                ]
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                              : 'border-slate-800 text-slate-500'
                        }
                      `}
                    >
                      {itemIndex + 1}
                    </button>
                  )
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-sm font-semibold text-white mb-3">
                  Study Note
                </h2>

                <p className="text-sm text-slate-400 leading-relaxed">
                  {activeLesson.note}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-sm font-semibold text-white mb-4">
                  Key Vocabulary
                </h2>

                <div className="space-y-3">
                  {activeLesson.vocabulary.map(word => (
                    <div
                      key={word.word}
                      className="border-b border-slate-800 pb-3 last:border-0 last:pb-0"
                    >
                      <p
                        className="font-arabic text-xl text-indigo-200"
                        dir="rtl"
                      >
                        {word.word}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {word.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Your studied progress is saved in this browser.
          Saved flashcards are stored in your project database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-indigo-400 mb-2">
            Your learning collection
          </p>

          <h1 className="text-3xl font-bold text-white">
            Library
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Explore topics, follow structured lessons,
            and build your Arabic.
          </p>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />

          <input
            aria-label="Search topics and lessons"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search topics or lessons..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-9 text-sm text-white outline-none focus:border-indigo-500"
          />

          {query && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-3 top-3.5 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-5 text-xs text-slate-500">
        <span>{LIBRARY_TOPICS.length} topics</span>
        <span>{totalLessons} lessons</span>
        <span>{totalSentences} sentences</span>

        <span className="text-emerald-400">
          {completedLessons} lessons completed
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(item => (
          <button
            key={item}
            onClick={() => {
              setCategory(item);
              setPanel('lessons');
            }}
            className={`
              rounded-lg border px-3 py-2 text-xs font-medium
              ${
                category === item
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }
            `}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <select
            aria-label="Difficulty level"
            value={level}
            onChange={event => setLevel(event.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300"
          >
            {[
              'All levels',
              'Beginner',
              'Intermediate',
              'Advanced'
            ].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <button
            aria-pressed={onlySaved}
            onClick={() => setOnlySaved(value => !value)}
            className={`
              flex items-center gap-2 rounded-lg
              border px-3 py-2 text-xs
              ${
                onlySaved
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-slate-800 text-slate-400'
              }
            `}
          >
            <Bookmark className="h-3.5 w-3.5" />
            Saved Topics
          </button>
        </div>

        <span className="text-xs text-slate-500">
          {filtered.length} topics shown
        </span>
      </div>

      {storageError && (
        <p role="alert" className="text-sm text-amber-300">
          {storageError}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filtered.map(topic => {
            const total = allTopicSentences(topic).length;
            const done = topicCount(topic, state);
            const bookmarked =
              state.bookmarks.includes(topic.id);

            return (
              <article
                key={topic.id}
                className={`
                  relative overflow-hidden rounded-2xl
                  border bg-slate-900 transition-colors
                  ${
                    selected?.id === topic.id
                      ? 'border-indigo-500 ring-1 ring-indigo-500/20'
                      : 'border-slate-800 hover:border-slate-600'
                  }
                `}
              >
                <button
                  aria-label={`${
                    bookmarked ? 'Unsave' : 'Save'
                  } ${topic.title}`}
                  aria-pressed={bookmarked}
                  onClick={() => toggleBookmark(topic)}
                  className="absolute right-3 top-3 z-10 rounded-lg bg-slate-950/60 p-2 text-white"
                >
                  <Bookmark
                    className={`h-4 w-4 ${
                      bookmarked
                        ? 'fill-indigo-400 text-indigo-300'
                        : ''
                    }`}
                  />
                </button>

                <button
                  onClick={() => {
                    setSelectedId(topic.id);
                    setPanel('lessons');
                    setError('');
                  }}
                  aria-pressed={selected?.id === topic.id}
                  className="w-full text-left"
                >
                  <Cover topic={topic} />

                  <div className="space-y-3 p-4">
                    <div>
                      <h2
                        className="font-arabic text-lg text-white"
                        dir="rtl"
                      >
                        {topic.arabic}
                      </h2>

                      <p className="mt-1 text-sm text-slate-400">
                        {topic.title}
                      </p>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>
                        {topic.lessons.length} lessons ·{' '}
                        {total} sentences
                      </span>

                      <span>{percent(done, total)}%</span>
                    </div>

                    <Progress done={done} total={total} />
                    <Level value={topic.level} />
                  </div>
                </button>
              </article>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
              <Search className="mx-auto mb-4 h-8 w-8 text-slate-600" />

              <p>No matching topics.</p>

              <button
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                  setLevel('All levels');
                  setOnlySaved(false);
                }}
                className="mt-4 text-sm text-indigo-400"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {selected && (
          <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 xl:sticky xl:top-0 xl:max-h-[calc(100vh-64px)] xl:overflow-y-auto custom-scrollbar">
            <Cover topic={selected} large />

            <div className="space-y-5 p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h2
                    className="font-arabic text-2xl text-white"
                    dir="rtl"
                  >
                    {selected.arabic}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    {selected.title}
                  </p>
                </div>

                <button
                  aria-label="Save selected topic"
                  aria-pressed={state.bookmarks.includes(
                    selected.id
                  )}
                  onClick={() => toggleBookmark(selected)}
                  className="self-start p-1 text-indigo-300"
                >
                  <Bookmark
                    className={`h-5 w-5 ${
                      state.bookmarks.includes(selected.id)
                        ? 'fill-indigo-400'
                        : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Level value={selected.level} />

                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Layers className="h-3 w-3" />
                  {selected.lessons.length} lessons
                </span>

                <span className="text-xs text-slate-500">
                  {allTopicSentences(selected).length} sentences
                </span>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  Description
                </h3>

                <p className="text-sm leading-relaxed text-slate-400">
                  {selected.description}
                </p>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-white">
                  What you'll learn
                </h3>

                <ul className="space-y-2">
                  {selected.goals.map(goal => (
                    <li
                      key={goal}
                      className="flex gap-2 text-xs text-slate-400"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400" />
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => startTopic(selected)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <Play className="h-4 w-4" />

                {topicCount(selected, state) ===
                allTopicSentences(selected).length
                  ? 'Review Topic'
                  : topicCount(selected, state) > 0
                    ? 'Continue Learning'
                    : 'Start Learning'}
              </button>

              <div className="flex border-b border-slate-800">
                {['lessons', 'sentences'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setPanel(tab);
                      setError('');
                    }}
                    className={`
                      flex-1 pb-3 text-xs font-medium
                      ${
                        panel === tab
                          ? 'border-b-2 border-indigo-500 text-indigo-300'
                          : 'text-slate-500'
                      }
                    `}
                  >
                    {tab === 'lessons'
                      ? 'Lessons'
                      : `All Sentences (${
                          allTopicSentences(selected).length
                        })`}
                  </button>
                ))}
              </div>

              {panel === 'lessons' ? (
                <div className="space-y-3">
                  {selected.lessons.map(
                    (lesson, lessonIndex) => {
                      const done = countStudied(lesson, state);
                      const total = lesson.sentences.length;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            openLesson(selected, lesson)
                          }
                          className="w-full rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left hover:border-indigo-500/40"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`
                                flex h-7 w-7 shrink-0
                                items-center justify-center
                                rounded-lg text-xs
                                ${
                                  done === total
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-indigo-500/10 text-indigo-300'
                                }
                              `}
                            >
                              {done === total ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                lessonIndex + 1
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm text-slate-200">
                                {lesson.title}
                              </h4>

                              <p
                                className="mt-1 font-arabic text-xs text-slate-500"
                                dir="rtl"
                              >
                                {lesson.arabic}
                              </p>

                              <div className="my-2 flex justify-between text-[10px] text-slate-500">
                                <span>{total} sentences</span>

                                <span>
                                  {done === total
                                    ? 'Completed'
                                    : `${done}/${total} studied`}
                                </span>
                              </div>

                              <Progress
                                done={done}
                                total={total}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {selected.lessons.map(lesson => (
                    <section
                      key={lesson.id}
                      className="space-y-3"
                    >
                      <h4 className="text-xs font-semibold text-indigo-300">
                        {lesson.title}
                      </h4>

                      {lesson.sentences.map(
                        (item, itemIndex) => (
                          <div
                            key={keyOf(lesson, itemIndex)}
                            className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
                          >
                            <p
                              className="font-arabic text-xl leading-relaxed text-white"
                              dir="rtl"
                            >
                              {item.arabic}
                            </p>

                            <p className="text-xs leading-relaxed text-slate-400">
                              {item.translation}
                            </p>

                            {saveButton(item)}
                          </div>
                        )
                      )}
                    </section>
                  ))}
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="text-sm text-rose-300"
                >
                  {error}
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default LibraryView;