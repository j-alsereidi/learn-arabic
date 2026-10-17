import React, {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  LIBRARY_TOPICS,
  ALL_WORDS,
  allTopicSentences,
  normalize
} from './libraryExpansion';

import LibraryPhoto from './LibraryPhoto';

const KEY = 'learn-arabic.library.v2';

const API = (
  process.env.REACT_APP_API_URL || ''
).replace(/\/$/, '');

const sentenceKey = (lesson, index) =>
  `${lesson.id}:${index}`;

const cardKey = row =>
  JSON.stringify([
    row.arabic.trim(),
    row.translation.trim()
  ]);

const lessonDone = (lesson, state) =>
  lesson.sentences.filter(
    (_, index) =>
      state.studied[sentenceKey(lesson, index)]
  ).length;

const topicDone = (topic, state) =>
  topic.lessons.reduce(
    (sum, lesson) =>
      sum + lessonDone(lesson, state),
    0
  );

function readState() {
  try {
    const value =
      JSON.parse(localStorage.getItem(KEY) || '{}') ||
      {};

    return {
      bookmarks: Array.isArray(value.bookmarks)
        ? value.bookmarks
        : [],

      studied:
        value.studied &&
        typeof value.studied === 'object' &&
        !Array.isArray(value.studied)
          ? value.studied
          : {},

      savedWords: Array.isArray(value.savedWords)
        ? value.savedWords
        : [],

      learnedWords: Array.isArray(value.learnedWords)
        ? value.learnedWords
        : [],

      last: value.last || null,
      error: ''
    };
  } catch {
    return {
      bookmarks: [],
      studied: {},
      savedWords: [],
      learnedWords: [],
      last: null,
      error:
        'Previous progress could not be read in this browser.'
    };
  }
}

function WordCard({
  word,
  state,
  toggle,
  speak
}) {
  const saved =
    state.savedWords.includes(word.id);

  const learned =
    state.learnedWords.includes(word.id);

  return (
    <article className="vl-word">
      <LibraryPhoto
        subject={word.pictureSubject}
        label={word.meaning}
      />

      <div className="vl-card-body">
        <p
          className="vl-word-arabic"
          dir="rtl"
          lang="ar"
        >
          {word.word}
        </p>

        <h3>{word.meaning}</h3>

        {word.topicTitle && (
          <p className="vl-muted">
            {word.topicTitle}
          </p>
        )}

        <div className="vl-actions">
          <button
            onClick={() => speak(word.word)}
            aria-label={`Listen to ${word.meaning}`}
          >
            Listen
          </button>

          <button
            aria-pressed={saved}
            onClick={() =>
              toggle('savedWords', word.id)
            }
          >
            {saved ? '★ Saved' : '☆ Save'}
          </button>

          <button
            aria-pressed={learned}
            onClick={() =>
              toggle('learnedWords', word.id)
            }
          >
            {learned
              ? '✓ Learned'
              : 'Mark learned'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function LibraryView() {
  const [state, setState] = useState(readState);

  const [storageError, setStorageError] =
    useState(state.error);

  const [screen, setScreen] = useState('topics');
  const [topicId, setTopicId] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [level, setLevel] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [wordFilter, setWordFilter] =
    useState('All words');

  const [limit, setLimit] = useState(12);
  const [notice, setNotice] = useState('');
  const [savedCards, setSavedCards] = useState({});
  const [saving, setSaving] = useState(false);

  const saveLock = useRef(false);
  const top = useRef(null);

  const topic = LIBRARY_TOPICS.find(
    item => item.id === topicId
  );

  const lesson = topic?.lessons.find(
    item => item.id === lessonId
  );

  const row = lesson?.sentences[index];

  const totalLessons = LIBRARY_TOPICS.reduce(
    (sum, item) => sum + item.lessons.length,
    0
  );

  const totalSentences = LIBRARY_TOPICS.reduce(
    (sum, item) =>
      sum + allTopicSentences(item).length,
    0
  );

  const studied = LIBRARY_TOPICS.reduce(
    (sum, item) => sum + topicDone(item, state),
    0
  );

  const learnedCount = ALL_WORDS.filter(
    word => state.learnedWords.includes(word.id)
  ).length;

  const resumeTopic = LIBRARY_TOPICS.find(
    item => item.id === state.last?.topicId
  );

  const resumeLesson = resumeTopic?.lessons.find(
    item => item.id === state.last?.lessonId
  );

  useEffect(() => {
    let active = true;

    fetch(`${API}/api/tutor/flashcards`, {
      credentials: 'include'
    })
      .then(response =>
        response.ok ? response.json() : []
      )
      .then(cards => {
        if (!active || !Array.isArray(cards)) {
          return;
        }

        const found = {};

        cards.forEach(card => {
          if (
            typeof card.plaintext === 'string' &&
            typeof card.translation === 'string'
          ) {
            found[
              cardKey({
                arabic: card.plaintext,
                translation: card.translation
              })
            ] = true;
          }
        });

        setSavedCards(previous => ({
          ...previous,
          ...found
        }));
      })
      .catch(() => {});

    return () => {
      active = false;
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

  useEffect(() => {
    setLimit(12);
  }, [
    query,
    category,
    level,
    savedOnly,
    wordFilter,
    screen
  ]);

  useEffect(() => {
    top.current?.scrollIntoView({
      block: 'start'
    });
  }, [topicId, lessonId, screen]);

  function persist(next) {
    setState(next);

    try {
      const { error, ...data } = next;

      localStorage.setItem(
        KEY,
        JSON.stringify(data)
      );

      setStorageError('');
    } catch {
      setStorageError(
        'Browser storage is unavailable. Progress is kept for this visit only.'
      );
    }
  }

  function toggle(field, id) {
    persist({
      ...state,

      [field]: state[field].includes(id)
        ? state[field].filter(value => value !== id)
        : [...state[field], id]
    });
  }

  function stopAudio() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function speak(text) {
    setNotice('');

    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      setNotice(
        'Audio is not supported in this browser.'
      );

      return;
    }

    const voice = window.speechSynthesis
      .getVoices()
      .find(item =>
        /^ar(?:-|_|$)/i.test(item.lang)
      );

    if (!voice) {
      setNotice(
        'No Arabic voice is available on this device. Enable an Arabic voice in your device settings, then try again.'
      );

      return;
    }

    stopAudio();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;

    utterance.onerror = event => {
      if (
        !['canceled', 'interrupted'].includes(
          event.error
        )
      ) {
        setNotice(
          'Audio could not play on this device.'
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function openTopic(item) {
    stopAudio();
    setTopicId(item.id);
    setLessonId(null);
    setNotice('');
  }

  function openLesson(
    item,
    section,
    requestedIndex
  ) {
    const first = section.sentences.findIndex(
      (_, i) =>
        !state.studied[sentenceKey(section, i)]
    );

    const position =
      Number.isInteger(requestedIndex)
        ? Math.max(
            0,
            Math.min(
              requestedIndex,
              section.sentences.length - 1
            )
          )
        : Math.max(0, first);

    stopAudio();
    setTopicId(item.id);
    setLessonId(section.id);
    setIndex(position);
    setRevealed(false);
    setNotice('');

    persist({
      ...state,

      last: {
        topicId: item.id,
        lessonId: section.id,
        index: position
      }
    });
  }

  function navigate(position) {
    stopAudio();
    setIndex(position);
    setRevealed(false);
    setNotice('');

    persist({
      ...state,

      last: {
        topicId,
        lessonId,
        index: position
      }
    });
  }

  function markStudied() {
    const nextStudied = {
      ...state.studied,
      [sentenceKey(lesson, index)]: true
    };

    const following = lesson.sentences.findIndex(
      (_, i) =>
        i > index &&
        !nextStudied[sentenceKey(lesson, i)]
    );

    const remaining = lesson.sentences.findIndex(
      (_, i) =>
        !nextStudied[sentenceKey(lesson, i)]
    );

    const position =
      following >= 0
        ? following
        : remaining >= 0
        ? remaining
        : index;

    persist({
      ...state,
      studied: nextStudied,

      last: {
        topicId,
        lessonId,
        index: position
      }
    });

    stopAudio();
    setIndex(position);
    setRevealed(remaining < 0);

    setNotice(
      remaining < 0
        ? '✓ Lesson complete. You can review it or open the next lesson.'
        : 'Sentence marked as studied.'
    );
  }

  async function saveCard(item) {
    const key = cardKey(item);

    if (
      saveLock.current ||
      savedCards[key]
    ) {
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setNotice('');

    try {
      const response = await fetch(
        `${API}/api/tutor/flashcards`,
        {
          method: 'POST',
          credentials: 'include',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(item)
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
          'Could not save. Check your login and Flask server.'
        );
      }

      setSavedCards(previous => ({
        ...previous,
        [key]: true
      }));

      setNotice('✓ Saved to Flashcards.');
    } catch (error) {
      setNotice(
        error.message ||
        'Could not connect to the server.'
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function copy(item) {
    try {
      await navigator.clipboard.writeText(
        `${item.arabic}\n${item.translation}`
      );

      setNotice('Copied Arabic and English.');
    } catch {
      setNotice(
        'Copy is unavailable. You can select the sentence and copy it manually.'
      );
    }
  }

  function clearFilters() {
    setQuery('');
    setCategory('All');
    setLevel('All');
    setSavedOnly(false);
    setWordFilter('All words');
  }

  const filteredTopics = LIBRARY_TOPICS.filter(
    item =>
      (
        category === 'All' ||
        item.category === category ||
        item.tags?.includes(category)
      ) &&
      (
        level === 'All' ||
        item.level === level
      ) &&
      (
        !savedOnly ||
        state.bookmarks.includes(item.id)
      ) &&
      normalize(
        [
          item.title,
          item.arabic,

          ...item.lessons.flatMap(section => [
            section.title,

            ...section.vocabulary.flatMap(word => [
              word.word,
              word.meaning
            ]),

            ...section.sentences.flatMap(sentence => [
              sentence.arabic,
              sentence.translation
            ])
          ])
        ].join(' ')
      ).includes(normalize(query))
  );

  const topicIds = new Set(
    LIBRARY_TOPICS.filter(
      item =>
        category === 'All' ||
        item.category === category ||
        item.tags?.includes(category)
    ).map(item => item.id)
  );

  const filteredWords = ALL_WORDS.filter(
    word =>
      topicIds.has(word.topicId) &&
      (
        level === 'All' ||
        word.level === level
      ) &&
      (
        !savedOnly ||
        state.savedWords.includes(word.id)
      ) &&
      (
        wordFilter === 'All words' ||
        (
          wordFilter === 'Learned'
            ? state.learnedWords.includes(word.id)
            : !state.learnedWords.includes(word.id)
        )
      ) &&
      normalize(
        `${word.word} ${word.meaning} ${word.topicTitle}`
      ).includes(normalize(query))
  );

  return (
    <section
      className="visual-library"
      ref={top}
    >
      <style>{STYLES}</style>

      <header className="vl-header">
        <span className="vl-eyebrow">
          YOUR ARABIC COLLECTION
        </span>

        <h1>Learn through everyday life.</h1>

        <p>
          Explore a topic, discover its words,
          and practise complete sentences.
        </p>
      </header>

      {storageError && (
        <p
          className="vl-notice"
          role="alert"
        >
          {storageError}
        </p>
      )}

      {notice && (
        <p
          className="vl-notice"
          role="status"
        >
          {notice}
        </p>
      )}

      {lesson && row ? (
        <>
          <button
            className="vl-back"
            onClick={() => {
              stopAudio();
              setLessonId(null);
              setNotice('');
            }}
          >
            ← Back to {topic.title}
          </button>

          <div className="vl-section-heading">
            <div>
              <span className="vl-eyebrow">
                {topic.title}
              </span>

              <h2>{lesson.title}</h2>
            </div>

            <span className="vl-badge">
              {topic.level}
            </span>
          </div>

          <p>
            {lessonDone(lesson, state)}
            {' / '}
            {lesson.sentences.length}
            {' sentences studied'}
          </p>

          <progress
            max={lesson.sentences.length}
            value={lessonDone(lesson, state)}
            aria-label="Lesson progress"
          />

          <article className="vl-study-card">
            <span className="vl-eyebrow">
              SENTENCE {index + 1}
              {' / '}
              {lesson.sentences.length}
            </span>

            <p
              className="vl-sentence"
              lang="ar"
              dir="rtl"
            >
              {row.arabic}
            </p>

            {revealed ? (
              <p className="vl-translation">
                {row.translation}
              </p>
            ) : (
              <button
                onClick={() => setRevealed(true)}
              >
                Reveal translation
              </button>
            )}

            <div className="vl-actions vl-center">
              <button
                onClick={() => speak(row.arabic)}
              >
                Listen
              </button>

              <button onClick={() => copy(row)}>
                Copy
              </button>

              <button
                disabled={
                  saving ||
                  Boolean(savedCards[cardKey(row)])
                }
                onClick={() => saveCard(row)}
              >
                {savedCards[cardKey(row)]
                  ? '✓ Saved to Flashcards'
                  : saving
                  ? 'Saving…'
                  : '+ Save sentence to Flashcards'}
              </button>
            </div>
          </article>

          <div className="vl-navigation">
            <button
              disabled={index === 0}
              onClick={() => navigate(index - 1)}
            >
              ← Previous
            </button>

            <button
              className="vl-primary"
              onClick={markStudied}
            >
              ✓ Studied — continue
            </button>

            <button
              disabled={
                index === lesson.sentences.length - 1
              }
              onClick={() => navigate(index + 1)}
            >
              Next →
            </button>
          </div>

          {lessonDone(lesson, state) ===
            lesson.sentences.length && (
            <div className="vl-success">
              <strong>✓ Lesson completed</strong>

              {topic.lessons[
                topic.lessons.indexOf(lesson) + 1
              ] && (
                <button
                  onClick={() =>
                    openLesson(
                      topic,
                      topic.lessons[
                        topic.lessons.indexOf(lesson) + 1
                      ]
                    )
                  }
                >
                  Open next lesson →
                </button>
              )}
            </div>
          )}

          <p className="vl-study-note">
            {lesson.note}
          </p>

          <h2>Words in this lesson</h2>

          <div className="vl-word-grid">
            {lesson.vocabulary.map(word => (
              <WordCard
                key={word.id}
                word={word}
                state={state}
                toggle={toggle}
                speak={speak}
              />
            ))}
          </div>
        </>
      ) : topic ? (
        <>
          <button
            className="vl-back"
            onClick={() => {
              setTopicId(null);
              setNotice('');
            }}
          >
            ← All topics
          </button>

          <div className="vl-topic-intro">
            <LibraryPhoto
              subject={topic.imageSubject}
              src={topic.image}
              label={topic.title}
            />

            <div>
              <span className="vl-badge">
                {topic.level}
              </span>

              <h2>{topic.title}</h2>

              <p
                className="vl-arabic"
                lang="ar"
                dir="rtl"
              >
                {topic.arabic}
              </p>

              <p>{topic.description}</p>

              <ul>
                {topic.goals.map(goal => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>

              <button
                aria-pressed={
                  state.bookmarks.includes(topic.id)
                }
                onClick={() =>
                  toggle('bookmarks', topic.id)
                }
              >
                {state.bookmarks.includes(topic.id)
                  ? '★ Topic saved'
                  : '☆ Save topic'}
              </button>
            </div>
          </div>

          <h2>Your study sessions</h2>

          <div className="vl-sessions">
            {topic.lessons.map((section, i) => (
              <button
                key={section.id}
                onClick={() =>
                  openLesson(topic, section)
                }
              >
                <span className="vl-session-number">
                  {i + 1}
                </span>

                <span>
                  <strong>{section.title}</strong>

                  <small>
                    {section.sentences.length}
                    {' sentences · '}
                    {section.vocabulary.length}
                    {' words · ~'}
                    {section.sentences.length * 2}
                    {' min study'}
                  </small>
                </span>

                <span>
                  {lessonDone(section, state) ===
                  section.sentences.length
                    ? '✓ Complete'
                    : `${lessonDone(section, state)}/${section.sentences.length}`}
                </span>
              </button>
            ))}
          </div>

          <h2>Picture vocabulary</h2>

          <p className="vl-muted">
            Pictures illustrate a word or its context.
            Abstract words use related scenes.
          </p>

          <div className="vl-word-grid">
            {topic.lessons
              .flatMap(section => section.vocabulary)
              .map(word => (
                <WordCard
                  key={word.id}
                  word={word}
                  state={state}
                  toggle={toggle}
                  speak={speak}
                />
              ))}
          </div>
        </>
      ) : (
        <>
          <div className="vl-stats">
            <div>
              <strong>{LIBRARY_TOPICS.length}</strong>
              <span>topics</span>
            </div>

            <div>
              <strong>{totalLessons}</strong>
              <span>study sessions</span>
            </div>

            <div>
              <strong>{ALL_WORDS.length}</strong>
              <span>vocabulary entries</span>
            </div>

            <div>
              <strong>
                {studied}/{totalSentences}
              </strong>

              <span>sentences studied</span>
            </div>
          </div>

          {resumeTopic && resumeLesson && (
            <div className="vl-resume">
              <div>
                <span className="vl-eyebrow">
                  PICK UP WHERE YOU LEFT OFF
                </span>

                <h2>{resumeTopic.title}</h2>

                <p>{resumeLesson.title}</p>
              </div>

              <button
                className="vl-primary"
                onClick={() =>
                  openLesson(
                    resumeTopic,
                    resumeLesson,
                    state.last.index
                  )
                }
              >
                Resume session →
              </button>
            </div>
          )}

          <div
            className="vl-tabs"
            aria-label="Library view"
          >
            {['topics', 'words'].map(value => (
              <button
                key={value}
                aria-pressed={screen === value}
                onClick={() => {
                  setScreen(value);
                  setSavedOnly(false);
                  setNotice('');
                }}
              >
                {value === 'topics'
                  ? 'Explore topics'
                  : 'Picture dictionary'}
              </button>
            ))}
          </div>

          <div className="vl-filters">
            <input
              value={query}
              onChange={event =>
                setQuery(event.target.value)
              }
              placeholder="Search Arabic or English…"
              aria-label="Search the library"
            />

            <select
              value={category}
              onChange={event =>
                setCategory(event.target.value)
              }
              aria-label="Category"
            >
              <option>All</option>

              {[
                ...new Set(
                  LIBRARY_TOPICS.map(
                    item => item.category
                  )
                )
              ].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>

            <select
              value={level}
              onChange={event =>
                setLevel(event.target.value)
              }
              aria-label="Level"
            >
              {[
                'All',
                'Beginner',
                'Intermediate',
                'Advanced'
              ].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>

            {screen === 'words' && (
              <select
                value={wordFilter}
                onChange={event =>
                  setWordFilter(event.target.value)
                }
                aria-label="Word progress"
              >
                {[
                  'All words',
                  'New words',
                  'Learned'
                ].map(value => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}

            <button
              aria-pressed={savedOnly}
              onClick={() =>
                setSavedOnly(!savedOnly)
              }
            >
              {savedOnly
                ? '★ Saved only'
                : '☆ Saved only'}
            </button>

            <button onClick={clearFilters}>
              Reset filters
            </button>
          </div>

          {screen === 'topics' ? (
            <>
              <p className="vl-muted">
                {filteredTopics.length} topics found
              </p>

              <div className="vl-topic-grid">
                {filteredTopics.map(item => (
                  <article
                    className="vl-topic"
                    key={item.id}
                  >
                    <LibraryPhoto
                      subject={item.imageSubject}
                      src={item.image}
                      label={item.title}
                    />

                    <div className="vl-card-body">
                      <div className="vl-topic-top">
                        <span className="vl-badge">
                          {item.level}
                        </span>

                        <button
                          aria-label={`Save ${item.title}`}
                          aria-pressed={
                            state.bookmarks.includes(item.id)
                          }
                          onClick={() =>
                            toggle('bookmarks', item.id)
                          }
                        >
                          {state.bookmarks.includes(item.id)
                            ? '★'
                            : '☆'}
                        </button>
                      </div>

                      <h2>{item.title}</h2>

                      <p
                        className="vl-arabic"
                        lang="ar"
                        dir="rtl"
                      >
                        {item.arabic}
                      </p>

                      <p className="vl-muted">
                        {item.lessons.length}
                        {' sessions · '}
                        {allTopicSentences(item).length}
                        {' sentences'}
                      </p>

                      <progress
                        value={topicDone(item, state)}
                        max={allTopicSentences(item).length}
                        aria-label={`${item.title} progress`}
                      />

                      <button
                        className="vl-primary vl-full"
                        onClick={() => openTopic(item)}
                      >
                        Explore topic →
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {!filteredTopics.length && (
                <p className="vl-empty">
                  No matching topics. Try another
                  search or reset the filters.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="vl-muted">
                {filteredWords.length}
                {' vocabulary entries found · '}
                {learnedCount}
                {' learned. A word can appear in more than one topic.'}
              </p>

              <div className="vl-word-grid">
                {filteredWords
                  .slice(0, limit)
                  .map(word => (
                    <WordCard
                      key={word.id}
                      word={word}
                      state={state}
                      toggle={toggle}
                      speak={speak}
                    />
                  ))}
              </div>

              {limit < filteredWords.length && (
                <button
                  className="vl-load"
                  onClick={() =>
                    setLimit(value => value + 12)
                  }
                >
                  Show 12 more words ↓
                </button>
              )}

              {!filteredWords.length && (
                <p className="vl-empty">
                  No matching words. Try another
                  search or reset the filters.
                </p>
              )}
            </>
          )}
        </>
      )}

      <footer className="vl-footer">
        Library progress and favourites are saved in
        this browser. “Learned” here tracks Library
        practice only; it does not update the AI Tutor’s
        known-word list. Sentence flashcards are saved
        through your existing server. Photos require
        internet access.
      </footer>
    </section>
  );
}

const STYLES = `
.visual-library {
  --ink: #17324a;
  --teal: #087f83;
  --pale: #eaf8f5;
  --line: #dce8e7;
  --yellow: #fff4cb;
  background: white;
  color: var(--ink);
  padding: clamp(16px, 3vw, 32px);
  border-radius: 22px;
  font-family: inherit;
  line-height: 1.65;
}

.visual-library * {
  box-sizing: border-box;
}

.visual-library h1,
.visual-library h2,
.visual-library h3,
.visual-library p,
.visual-library figure {
  margin: 0;
}

.visual-library h2 {
  font-size: 23px;
  margin: 18px 0 12px;
}

.visual-library h3 {
  font-size: 17px;
}

.visual-library button,
.visual-library input,
.visual-library select {
  font: inherit;
}

.visual-library button {
  border: 1px solid var(--line);
  background: white;
  color: var(--ink);
  padding: 10px 14px;
  border-radius: 11px;
  cursor: pointer;
  font-weight: 600;
}

.visual-library button:hover {
  border-color: var(--teal);
}

.visual-library button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.visual-library button[aria-pressed=true] {
  background: var(--pale);
  border-color: var(--teal);
}

.visual-library button:focus-visible,
.visual-library input:focus-visible,
.visual-library select:focus-visible,
.visual-library a:focus-visible {
  outline: 3px solid #087f83;
  outline-offset: 3px;
}

.visual-library .vl-primary {
  background: var(--teal);
  border-color: var(--teal);
  color: white;
}

.vl-full {
  width: 100%;
  margin-top: 16px;
}

.vl-header {
  background: var(--pale);
  padding: 28px;
  border-radius: 18px;
  border-top: 5px solid #a9e6dd;
}

.vl-header h1 {
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.2;
  margin: 10px 0 14px;
}

.vl-eyebrow {
  color: var(--teal);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .1em;
}

.vl-muted {
  color: #536b7a;
  font-size: 13px;
}

.vl-arabic {
  font-size: 23px;
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
  margin: 8px 0 !important;
  text-align: left;
}

.vl-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 24px 0;
}

.vl-stats > div {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 13px;
}

.vl-stats strong {
  display: block;
  font-size: 26px;
}

.vl-stats span {
  display: block;
  font-size: 12px;
  color: #536b7a;
}

.vl-resume {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  background: var(--yellow);
  border-radius: 14px;
  margin: 20px 0;
}

.vl-resume h2 {
  margin: 3px 0;
}

.vl-tabs {
  display: flex;
  gap: 8px;
  margin: 24px 0 14px;
}

.vl-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.vl-filters input,
.vl-filters select {
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 11px;
  background: white;
  color: var(--ink);
  min-width: 0;
}

.vl-filters input {
  flex: 1;
  min-width: 210px;
}

.vl-topic-grid,
.vl-word-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin: 18px 0;
}

.vl-topic,
.vl-word {
  border: 1px solid var(--line);
  border-radius: 17px;
  overflow: hidden;
  background: white;
  box-shadow: 0 5px 20px #17324a05;
}

.vl-card-body {
  padding: 18px;
}

.vl-topic h2 {
  font-size: 20px;
  margin: 8px 0;
}

.vl-topic-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.vl-topic-top button {
  padding: 4px 10px;
  font-size: 22px;
  border: 0;
}

.vl-badge {
  display: inline-block;
  border-radius: 20px;
  background: var(--pale);
  color: var(--teal);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
}

.vl-image-area {
  height: 185px;
  background: #edf6f3;
  overflow: hidden;
}

.vl-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vl-photo figcaption {
  font-size: 10px;
  color: #526977;
  padding: 5px 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.vl-photo a {
  color: inherit;
  text-decoration: underline;
}

.vl-photo-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  text-align: center;
  color: #536b7a;
  font-size: 12px;
}

.vl-photo-placeholder > span:first-child {
  font-size: 35px;
  color: var(--teal);
}

.vl-photo-placeholder button {
  font-size: 11px;
  padding: 5px 10px;
}

.vl-word-arabic {
  font-size: 31px;
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
  line-height: 1.8;
}

.vl-word h3 {
  margin: 3px 0 7px;
}

.vl-actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 15px;
}

.vl-actions button {
  font-size: 12px;
  padding: 8px 10px;
}

.vl-center {
  justify-content: center;
}

.visual-library progress {
  display: block;
  width: 100%;
  height: 7px;
  margin: 15px 0;
  border: 0;
  border-radius: 9px;
  overflow: hidden;
  accent-color: var(--teal);
  background: #e7f0ed;
}

.visual-library progress::-webkit-progress-bar {
  background: #e7f0ed;
}

.visual-library progress::-webkit-progress-value {
  background: var(--teal);
}

.visual-library progress::-moz-progress-bar {
  background: var(--teal);
}

.vl-back {
  margin: 22px 0;
}

.vl-topic-intro {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1.2fr);
  gap: 28px;
  align-items: start;
}

.vl-topic-intro .vl-image-area {
  height: 280px;
  border-radius: 15px;
}

.vl-topic-intro ul {
  padding-left: 20px;
}

.vl-sessions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 18px 0 30px;
}

.vl-sessions > button {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  padding: 18px;
}

.vl-sessions > button > span:nth-child(2) {
  flex: 1;
}

.vl-sessions strong,
.vl-sessions small {
  display: block;
}

.vl-sessions small {
  font-size: 12px;
  color: #536b7a;
  margin-top: 4px;
}

.vl-session-number {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--pale);
  color: var(--teal);
  flex-shrink: 0;
}

.vl-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.vl-study-card {
  padding: 32px 24px;
  border: 1px solid var(--line);
  border-radius: 20px;
  text-align: center;
  margin: 24px 0;
  background: #fbfefd;
}

.vl-sentence {
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
  font-size: clamp(26px, 4vw, 39px);
  line-height: 2;
  margin: 24px 0 !important;
}

.vl-translation {
  font-size: 19px;
  margin: 20px 0 !important;
}

.vl-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.vl-study-note {
  background: var(--pale);
  padding: 18px;
  border-radius: 12px;
  margin: 24px 0 !important;
}

.vl-success {
  background: var(--pale);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  margin: 20px 0;
}

.vl-notice {
  background: var(--yellow);
  padding: 14px;
  border-radius: 12px;
  margin: 16px 0 !important;
}

.vl-load {
  display: block;
  margin: 22px auto;
}

.vl-empty {
  text-align: center;
  padding: 35px;
}

.vl-footer {
  font-size: 12px;
  color: #536b7a;
  border-top: 1px solid var(--line);
  padding-top: 20px;
  margin-top: 30px;
}

@media (max-width: 1050px) {
  .vl-topic-grid,
  .vl-word-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .vl-topic-grid,
  .vl-word-grid {
    grid-template-columns: 1fr;
  }

  .vl-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .vl-topic-intro {
    grid-template-columns: 1fr;
  }

  .vl-resume {
    align-items: stretch;
    flex-direction: column;
  }

  .vl-filters input {
    flex-basis: 100%;
  }

  .vl-filters select {
    flex: 1;
  }

  .vl-sessions > button {
    gap: 10px;
    padding: 13px;
  }

  .vl-sessions > button > span:last-child {
    font-size: 11px;
  }

  .vl-image-area {
    height: 210px;
  }

  .vl-success {
    align-items: stretch;
    flex-direction: column;
  }

  .vl-header {
    padding: 22px;
  }
}
`;