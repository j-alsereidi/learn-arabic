import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import FlashcardReview from './FlashcardReview';
import { LIBRARY_TOPICS } from './libraryExpansion';
import './FlashcardStudio.css';

const API = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

const keyOf = text =>
  String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.!?،؛؟]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const shuffle = items => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

function makeCatalog(saved) {
  const cards = new Map();

  const add = (ar, en, topic) => {
    if (
      typeof ar !== 'string' ||
      typeof en !== 'string' ||
      !ar.trim() ||
      !en.trim()
    ) {
      return;
    }

    const id = JSON.stringify([ar.trim(), en.trim()]);

    if (cards.has(id)) {
      const card = cards.get(id);

      if (!card.topics.includes(topic)) {
        card.topics.push(topic);
      }
    } else {
      cards.set(id, {
        id,
        arabic: ar.trim(),
        translation: en.trim(),
        topics: [topic],
      });
    }
  };

  LIBRARY_TOPICS.forEach(topic =>
    topic.lessons.forEach(lesson =>
      lesson.sentences.forEach(card =>
        add(card.arabic, card.translation, topic.id)
      )
    )
  );

  saved.forEach(card =>
    add(card.plaintext, card.translation, 'saved')
  );

  return [...cards.values()];
}

function makeQuestion(card, pool) {
  const seen = new Set([keyOf(card.translation)]);

  const wrong = shuffle(pool)
    .filter(item => {
      const key = keyOf(item.translation);

      if (
        keyOf(item.arabic) === keyOf(card.arabic) ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 3);

  return {
    ...card,
    options: shuffle([
      card.translation,
      ...wrong.map(item => item.translation),
    ]),
  };
}

export default function FlashcardEditor() {
  const [tab, setTab] = useState('quiz');
  const [saved, setSaved] = useState([]);
  const [connection, setConnection] = useState(
    'Loading saved cards…'
  );
  const [reload, setReload] = useState(0);

  const [topic, setTopic] = useState('all');
  const [size, setSize] = useState('10');
  const [screen, setScreen] = useState('setup');

  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flipped, setFlipped] = useState(false);
  const [sound, setSound] = useState(true);
  const [message, setMessage] = useState('');

  const audio = useRef(null);
  const answerLock = useRef(false);
  const heading = useRef(null);

  const catalog = useMemo(() => makeCatalog(saved), [saved]);

  const available = catalog.filter(
    card => topic === 'all' || card.topics.includes(topic)
  );

  const card = deck[index];
  const answer = card ? answers[card.id] : undefined;

  const answered = Object.keys(answers).length;

  const correct = Object.values(answers).filter(
    item => item.correct
  ).length;

  const progress = deck.length
    ? Math.round((answered / deck.length) * 100)
    : 0;

  let combo = 0;

  for (const item of Object.values(answers)) {
    combo = item.correct ? combo + 1 : 0;
  }

  useEffect(() => {
    const controller = new AbortController();

    setConnection('Loading saved cards…');

    fetch(`${API}/api/tutor/flashcards`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Sign in to load saved cards. Course cards are ready.'
              : 'Saved cards are unavailable. Course cards are ready.'
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            'Saved cards returned an unexpected response.'
          );
        }

        if (!controller.signal.aborted) {
          setSaved(data);
          setConnection('');
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setConnection(
            error.message || 'Could not load saved cards.'
          );
        }
      });

    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    heading.current?.focus();
  }, [index, screen, tab]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      if (
        audio.current &&
        audio.current.state !== 'closed'
      ) {
        audio.current.close().catch(() => {});
      }
    };
  }, []);

  function tone(kind) {
    if (!sound) return;

    try {
      const Context =
        window.AudioContext || window.webkitAudioContext;

      if (!Context) {
        setMessage(
          'Sound effects are unavailable in this browser.'
        );
        return;
      }

      if (
        !audio.current ||
        audio.current.state === 'closed'
      ) {
        audio.current = new Context();
      }

      const context = audio.current;

      context
        .resume()
        .then(() => {
          const notes =
            kind === 'finish'
              ? [523, 659, 784, 1047]
              : kind === 'correct'
                ? [659, 880]
                : [220, 174];

          notes.forEach((frequency, i) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const start = context.currentTime + i * 0.13;

            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(
              0.07,
              start + 0.015
            );
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              start + 0.18
            );

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.onended = () => {
              oscillator.disconnect();
              gain.disconnect();
            };

            oscillator.start(start);
            oscillator.stop(start + 0.2);
          });
        })
        .catch(() => {
          setMessage(
            'Your browser could not play the sound effect.'
          );
        });
    } catch {
      setMessage(
        'Sound effects are unavailable on this device.'
      );
    }
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function speak() {
    setMessage('');

    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      setMessage(
        'Arabic pronunciation is unavailable in this browser.'
      );
      return;
    }

    const voice = window.speechSynthesis
      .getVoices()
      .find(item => /^ar(?:-|_|$)/i.test(item.lang));

    if (!voice) {
      setMessage(
        'Enable an Arabic voice in your device settings, then try Listen again.'
      );
      return;
    }

    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(
      card.arabic
    );

    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;

    utterance.onerror = event => {
      if (
        !['canceled', 'interrupted'].includes(event.error)
      ) {
        setMessage(
          'Pronunciation could not play. Please try again.'
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function start(cards) {
    const selected =
      cards || shuffle(available).slice(0, Number(size));

    const questions = selected
      .map(item => makeQuestion(item, catalog))
      .filter(item => item.options.length >= 2);

    if (!questions.length) {
      setMessage(
        'At least two different translations are needed for a quiz.'
      );
      return;
    }

    stopSpeech();
    setDeck(questions);
    setAnswers({});
    setIndex(0);
    setFlipped(false);
    setMessage('');
    answerLock.current = false;
    setScreen('play');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }

  function choose(value) {
    if (!card || answer || answerLock.current) return;

    answerLock.current = true;

    const isCorrect = value === card.translation;

    setAnswers(previous => ({
      ...previous,
      [card.id]: {
        value,
        correct: isCorrect,
      },
    }));

    stopSpeech();
    setMessage('');
    tone(isCorrect ? 'correct' : 'wrong');
  }

  function move(next) {
    if (next < 0 || next >= deck.length) return;

    stopSpeech();
    setIndex(next);
    setFlipped(false);
    setMessage('');
    answerLock.current = false;
  }

  function finish() {
    if (answered !== deck.length) return;

    stopSpeech();
    setScreen('summary');
    setMessage('');
    tone('finish');
  }

  function switchTab(value) {
    if (value === tab) return;

    if (
      tab === 'review' &&
      !window.confirm(
        'Leave the review screen? Saved ratings remain, but an unfinished review session will close.'
      )
    ) {
      return;
    }

    stopSpeech();
    setMessage('');
    setTab(value);
  }

  function endQuiz() {
    if (
      window.confirm(
        'End this quiz and clear this round’s score? Saved review progress stays unchanged.'
      )
    ) {
      stopSpeech();
      setScreen('setup');
      setAnswers({});
      setMessage('');
    }
  }

  return (
    <section className="fc-studio">
      <header className="fc-hero">
        <div>
          <span className="fc-eyebrow">
            A LITTLE PRACTICE. A LOT OF PROGRESS.
          </span>

          <h1>
            Make every card count<span>.</span>
          </h1>

          <p>
            Read it. Hear it. Remember it. Your Arabic
            practice, with a playful twist.
          </p>
        </div>

        <div className="fc-mini-stack" aria-hidden="true">
          <span>أ</span>
          <span>ب</span>
          <span>ت</span>
        </div>
      </header>

      <div className="fc-toolbar">
        <div
          className="fc-tabs"
          role="group"
          aria-label="Practice mode"
        >
          <button
            aria-pressed={tab === 'quiz'}
            onClick={() => switchTab('quiz')}
          >
            ✦ Quiz Challenge
          </button>

          <button
            aria-pressed={tab === 'review'}
            onClick={() => switchTab('review')}
          >
            ▤ Spaced Review
          </button>
        </div>

        {tab === 'quiz' && (
          <button
            className="fc-btn"
            aria-pressed={sound}
            onClick={() => {
              setSound(value => !value);

              if (sound && audio.current) {
                audio.current.suspend().catch(() => {});
              }
            }}
          >
            Sound effects: {sound ? 'On' : 'Off'}
          </button>
        )}
      </div>

      {tab === 'review' ? (
        <div className="fc-classic">
          <FlashcardReview />
        </div>
      ) : (
        <>
          {message && (
            <p className="fc-notice" role="status">
              {message}
            </p>
          )}

          {screen === 'setup' && (
            <>
              <div className="fc-intro">
                <div>
                  <h2 ref={heading} tabIndex={-1}>
                    Choose your next little win
                  </h2>
                  <p>
                    Sentence-based questions • Immediate
                    feedback • No countdown pressure
                  </p>
                </div>

                <span className="fc-pill">
                  {catalog.length} sentences ready
                </span>
              </div>

              {connection && (
                <div className="fc-notice" role="status">
                  {connection}
                  <button
                    onClick={() =>
                      setReload(value => value + 1)
                    }
                  >
                    Retry saved cards
                  </button>
                </div>
              )}

              <div className="fc-setup">
                <div className="fc-topic-grid">
                  {[
                    {
                      id: 'all',
                      title: 'Mix it up',
                      arabic: 'كل المواضيع',
                    },
                    ...LIBRARY_TOPICS,
                    ...(saved.length
                      ? [
                          {
                            id: 'saved',
                            title: 'My saved cards',
                            arabic: 'بطاقاتي المحفوظة',
                          },
                        ]
                      : []),
                  ].map((item, i) => {
                    const count = catalog.filter(
                      value =>
                        item.id === 'all' ||
                        value.topics.includes(item.id)
                    ).length;

                    return (
                      <button
                        key={item.id}
                        className={`fc-topic fc-tint-${i % 4}`}
                        aria-pressed={topic === item.id}
                        onClick={() => setTopic(item.id)}
                      >
                        <span className="fc-topic-top">
                          <span>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span aria-hidden="true">
                            {topic === item.id ? '✓' : '↗'}
                          </span>
                        </span>

                        <strong lang="ar" dir="rtl">
                          {item.arabic}
                        </strong>

                        <b>{item.title}</b>
                        <small>{count} sentences</small>
                      </button>
                    );
                  })}
                </div>

                <aside className="fc-panel">
                  <span className="fc-eyebrow">
                    YOUR PRACTICE, YOUR PACE
                  </span>

                  <h2>Build your session</h2>

                  <label htmlFor="fc-size">
                    Session size
                  </label>

                  <select
                    id="fc-size"
                    value={size}
                    onChange={event =>
                      setSize(event.target.value)
                    }
                  >
                    {[5, 10, 20, 30].map(value => (
                      <option key={value} value={value}>
                        {value} cards
                      </option>
                    ))}
                  </select>

                  <div className="fc-big-number">
                    {Math.min(Number(size), available.length)}
                    <small>cards in this round</small>
                  </div>

                  <p>
                    Choose the best English meaning. Every
                    correct first answer earns 10 points.
                  </p>

                  <button
                    className="fc-btn fc-primary"
                    disabled={!available.length}
                    onClick={() => start()}
                  >
                    Let’s practise →
                  </button>

                  <p className="fc-small">
                    Quiz scores last for this open session.
                    Use Spaced Review for saved review
                    schedules and word knowledge.
                  </p>
                </aside>
              </div>
            </>
          )}

          {screen === 'play' && card && (
            <>
              <div className="fc-session-bar">
                <div>
                  <strong>Session progress</strong>
                  <p>
                    {answered} of {deck.length} answered
                  </p>
                </div>

                <div
                  className="fc-progress"
                  role="progressbar"
                  aria-label="Questions answered"
                  aria-valuemin={0}
                  aria-valuemax={deck.length}
                  aria-valuenow={answered}
                >
                  <span
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <span className="fc-pill">
                  ★ {correct * 10} points
                </span>

                <span className="fc-pill">
                  {combo} correct in a row
                </span>
              </div>

              <div className="fc-play-grid">
                <main>
                  <div className="fc-card-heading">
                    <h2 ref={heading} tabIndex={-1}>
                      Card {index + 1}
                      <span> / {deck.length}</span>
                    </h2>

                    <button
                      className="fc-btn"
                      onClick={speak}
                    >
                      ♪ Listen
                    </button>
                  </div>

                  <div
                    className={`fc-flip fc-tint-${index % 4} ${
                      flipped ? 'is-flipped' : ''
                    }`}
                  >
                    <button
                      className="fc-flip-button"
                      disabled={!answer}
                      aria-label={
                        answer
                          ? flipped
                            ? 'Show Arabic sentence'
                            : 'Show English translation'
                          : 'Answer below to unlock the translation'
                      }
                      onClick={() =>
                        setFlipped(value => !value)
                      }
                    >
                      <span
                        className="fc-face fc-front"
                        aria-hidden={flipped}
                      >
                        <span className="fc-eyebrow">
                          READ • RECALL • CONNECT
                        </span>

                        <span
                          className="fc-arabic"
                          lang="ar"
                          dir="rtl"
                        >
                          {card.arabic}
                        </span>

                        <span className="fc-card-hint">
                          {answer
                            ? 'Click to flip ↻'
                            : 'Choose the meaning below to unlock the back'}
                        </span>
                      </span>

                      <span
                        className="fc-face fc-back"
                        aria-hidden={!flipped}
                      >
                        <span className="fc-eyebrow">
                          THE MEANING
                        </span>

                        <span className="fc-translation">
                          {card.translation}
                        </span>

                        <span className="fc-card-hint">
                          Click to return to Arabic ↻
                        </span>
                      </span>
                    </button>
                  </div>

                  <fieldset className="fc-options">
                    <legend>
                      What does this sentence mean?
                    </legend>

                    {card.options.map((option, i) => {
                      const right =
                        answer && option === card.translation;

                      const wrong =
                        answer &&
                        answer.value === option &&
                        !answer.correct;

                      return (
                        <button
                          key={option}
                          disabled={Boolean(answer)}
                          className={`fc-option ${
                            right ? 'is-right' : ''
                          } ${wrong ? 'is-wrong' : ''}`}
                          onClick={() => choose(option)}
                        >
                          <span className="fc-letter">
                            {String.fromCharCode(65 + i)}
                          </span>

                          <span>{option}</span>

                          <strong>
                            {right
                              ? '✓ Correct'
                              : wrong
                                ? '✕ Your choice'
                                : ''}
                          </strong>
                        </button>
                      );
                    })}
                  </fieldset>

                  {answer && (
                    <div
                      className={`fc-feedback ${
                        answer.correct
                          ? 'is-right'
                          : 'is-wrong'
                      }`}
                      role="status"
                    >
                      <strong>
                        {answer.correct
                          ? '✓ Nice work! +10 points'
                          : 'Not quite — this is a chance to learn.'}
                      </strong>

                      <p>
                        {answer.correct
                          ? 'Read it aloud once to help it stick.'
                          : `The correct meaning is: ${card.translation}`}
                      </p>
                    </div>
                  )}

                  <div className="fc-navigation">
                    <button
                      className="fc-btn"
                      onClick={endQuiz}
                    >
                      End quiz
                    </button>

                    <button
                      className="fc-btn"
                      disabled={index === 0}
                      onClick={() => move(index - 1)}
                    >
                      ← Previous
                    </button>

                    {index < deck.length - 1 ? (
                      <button
                        className="fc-btn fc-primary"
                        disabled={!answer}
                        onClick={() => move(index + 1)}
                      >
                        Next card →
                      </button>
                    ) : (
                      <button
                        className="fc-btn fc-primary"
                        disabled={answered !== deck.length}
                        onClick={finish}
                      >
                        See my results ✦
                      </button>
                    )}
                  </div>
                </main>

                <aside className="fc-panel">
                  <span className="fc-eyebrow">
                    SMALL STEPS ADD UP
                  </span>

                  <h2>You’re building a habit.</h2>

                  <div
                    className="fc-score-ring"
                    style={{ '--progress': `${progress}%` }}
                  >
                    <span>
                      {progress}%
                      <small>completed</small>
                    </span>
                  </div>

                  <p>
                    <strong>{correct}</strong> correct ·{' '}
                    <strong>{answered - correct}</strong>{' '}
                    to practise
                  </p>

                  <p>
                    Getting something wrong is useful. You
                    can revisit those cards at the end.
                  </p>

                  <button
                    className="fc-btn"
                    onClick={endQuiz}
                  >
                    End this quiz
                  </button>
                </aside>
              </div>
            </>
          )}

          {screen === 'summary' && (
            <div className="fc-summary">
              <div
                className="fc-confetti"
                aria-hidden="true"
              >
                ✦ · ✧ · ★ · ✧ · ✦
              </div>

              <span className="fc-eyebrow">
                ONE SESSION STRONGER
              </span>

              <h2 ref={heading} tabIndex={-1}>
                {correct === deck.length
                  ? 'A perfect round!'
                  : 'Look how far you’ve come.'}
              </h2>

              <p>
                You completed {deck.length} sentence cards.
                That’s practice worth celebrating.
              </p>

              <div className="fc-results">
                <div>
                  <strong>{correct * 10}</strong>
                  <span>Points</span>
                </div>

                <div>
                  <strong>
                    {Math.round(
                      (correct / deck.length) * 100
                    )}
                    %
                  </strong>
                  <span>First-answer accuracy</span>
                </div>

                <div>
                  <strong>{deck.length - correct}</strong>
                  <span>To practise again</span>
                </div>
              </div>

              <div className="fc-summary-actions">
                {correct < deck.length && (
                  <button
                    className="fc-btn fc-primary"
                    onClick={() =>
                      start(
                        deck.filter(
                          item => !answers[item.id]?.correct
                        )
                      )
                    }
                  >
                    Practise missed cards ↻
                  </button>
                )}

                <button
                  className="fc-btn"
                  onClick={() => {
                    setScreen('setup');
                    setMessage('');
                  }}
                >
                  Choose another topic →
                </button>
              </div>

              <p className="fc-small">
                A practice score, not a language-level
                assessment. Quiz answers do not change
                your saved word knowledge.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}