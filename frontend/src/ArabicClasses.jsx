import React, { useEffect, useRef, useState } from 'react';

import {
  COURSE,
  STAGES,
  LETTERS,
  CONJUGATIONS,
  TOPICS
} from './arabicClassesData';

const clean = text =>
  text
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .toLowerCase();

function readProgress(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');

    const valid = list =>
      Array.isArray(list)
        ? [...new Set(
            list.filter(id =>
              COURSE.some(item => item.id === id)
            )
          )]
        : [];

    return {
      done: valid(value?.done),
      saved: valid(value?.saved),
      error: ''
    };
  } catch {
    return {
      done: [],
      saved: [],
      error:
        'Saved progress could not be read. Changes will be kept for this visit.'
    };
  }
}

function Reference({ id }) {
  const rows =
    id === 1
      ? LETTERS
      : id === 7
      ? CONJUGATIONS
      : id === 24
      ? TOPICS
      : null;

  if (!rows) return null;

  const headings =
    id === 1
      ? ['Letter', 'Name', 'Initial', 'Medial', 'Final']
      : id === 7
      ? ['Pronoun', 'Meaning', 'Present', 'Past']
      : ['Topic', 'Starter words'];

  return (
    <details className="course-reference">
      <summary>Open the reference table</summary>

      {id === 1 && (
        <p>
          Letter shapes depend on neighbouring letters.
          ا د ذ ر ز و do not join to the following letter.
        </p>
      )}

      <div className="course-table">
        <table>
          <thead>
            <tr>
              {headings.map(heading => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} dir="auto">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function LessonBody({
  item,
  completed,
  onComplete,
  onNext,
  last
}) {
  const [playing, setPlaying] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [checked, setChecked] = useState(false);

  const correct = answer === item.answer;

  function check() {
    if (answer === null) return;

    setChecked(true);

    if (correct) {
      onComplete(item.id);
    }
  }

  return (
    <div
      id={`lesson-body-${item.id}`}
      className="course-body"
    >
      <p className="course-goal">
        <strong>Your goal:</strong> {item.goal}
      </p>

      <section className="course-video">
        <div className="course-label">
          01 / RELATED VIDEO
        </div>

        <h4>{item.video[1]}</h4>

        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.video[0]}`}
            title={`${item.title}: ${item.video[1]}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            className="course-video-cover"
            onClick={() => setPlaying(true)}
          >
            <span
              className="course-play"
              aria-hidden="true"
            >
              ▶
            </span>

            <strong>Load lesson video</strong>

            <span>
              YouTube · {item.video[1]}
            </span>
          </button>
        )}

        <p>
          <a
            href={`https://www.youtube.com/watch?v=${item.video[0]}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on YouTube ↗
          </a>
        </p>

        <small>
          Related teaching resource. If playback is unavailable
          here, open YouTube. Video viewing time is additional
          to the study estimate.
        </small>
      </section>

      <section className="course-notes">
        <div className="course-label">
          02 / UNDERSTAND
        </div>

        <h4>The key ideas</h4>

        <ul>
          {item.rules.map(rule => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        <Reference id={item.id} />
      </section>

      <section>
        <div className="course-label">
          03 / SEE IT IN CONTEXT
        </div>

        <h4>Arabic examples</h4>

        {item.examples.map(([arabic, english]) => (
          <div
            className="course-example"
            key={arabic}
          >
            <p lang="ar" dir="rtl">
              {arabic}
            </p>

            <p>{english}</p>
          </div>
        ))}
      </section>

      <section className="course-practice">
        <div className="course-label">
          04 / QUICK CHECK
        </div>

        <fieldset>
          <legend>{item.question}</legend>

          {item.options.map((option, index) => (
            <label key={option}>
              <input
                type="radio"
                name={`quiz-${item.id}`}
                checked={answer === index}
                onChange={() => {
                  setAnswer(index);
                  setChecked(false);
                }}
              />

              <span dir="auto">{option}</span>
            </label>
          ))}
        </fieldset>

        <button
          className="course-primary"
          disabled={answer === null}
          onClick={check}
        >
          Check answer
        </button>

        {checked && (
          <div
            className="course-feedback"
            role="status"
          >
            <strong>
              {correct
                ? '✓ Correct. Class completed!'
                : 'Not quite. Review the explanation and try again.'}
            </strong>

            <p>{item.why}</p>
          </div>
        )}

        {completed && (
          <p className="course-complete">
            ✓ This class is saved as completed.
          </p>
        )}
      </section>

      <div className="course-next">
        <button
          className="course-primary"
          onClick={onNext}
        >
          {last
            ? 'Back to course overview ↑'
            : 'Next class ↓'}
        </button>
      </div>
    </div>
  );
}

export default function ArabicClasses({
  userId = 'guest'
}) {
  return (
    <CourseWorkspace
      key={String(userId)}
      userId={userId}
    />
  );
}

function CourseWorkspace({ userId }) {
  const storageKey =
    `learn-arabic.classes.v1.${userId}`;

  const [progress, setProgress] = useState(() =>
    readProgress(storageKey)
  );

  const [error, setError] = useState(progress.error);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [savedOnly, setSavedOnly] = useState(false);

  const headers = useRef({});
  const overview = useRef(null);

  const total = COURSE.length;

  const percent = Math.round(
    progress.done.length / total * 100
  );

  const next = COURSE.find(
    item => !progress.done.includes(item.id)
  );

  const minutes = COURSE.reduce(
    (sum, item) => sum + item.minutes,
    0
  );

  useEffect(() => {
    if (selected !== null) {
      const button = headers.current[selected];

      button?.focus({ preventScroll: true });

      button?.scrollIntoView({
        behavior: 'auto',
        block: 'start'
      });
    }
  }, [selected]);

  function persist(nextProgress) {
    setProgress(nextProgress);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          done: nextProgress.done,
          saved: nextProgress.saved
        })
      );

      setError('');
    } catch {
      setError(
        'Your browser could not save progress. Changes are available for this visit only.'
      );
    }
  }

  function complete(id) {
    if (!progress.done.includes(id)) {
      persist({
        ...progress,
        done: [...progress.done, id]
      });
    }
  }

  function bookmark(id) {
    persist({
      ...progress,
      saved: progress.saved.includes(id)
        ? progress.saved.filter(value => value !== id)
        : [...progress.saved, id]
    });
  }

  function open(id) {
    setSearch('');
    setStageFilter('all');
    setSavedOnly(false);
    setSelected(id);
  }

  function changeFilter(update) {
    setSelected(null);
    update();
  }

  const visible = COURSE.filter(item =>
    (
      stageFilter === 'all' ||
      item.stage === Number(stageFilter)
    ) &&
    (
      !savedOnly ||
      progress.saved.includes(item.id)
    ) &&
    clean(
      [
        item.title,
        item.arabic,
        item.goal,
        ...item.rules
      ].join(' ')
    ).includes(clean(search))
  );

  return (
    <section
      className="arabic-course"
      ref={overview}
      tabIndex={-1}
    >
      <style>{STYLES}</style>

      <header className="course-hero">
        <div className="course-label">
          YOUR ARABIC LEARNING PATH
        </div>

        <h1>Small steps. Strong foundations.</h1>

        <p
          lang="ar"
          dir="rtl"
          className="course-arabic-heading"
        >
          تعلّم العربية خطوة بخطوة
        </p>

        <p>
          Start with the basics, build sentences,
          then put your grammar into practice.
        </p>

        <div className="course-badges">
          <span>25 classes</span>
          <span>5 stages</span>
          <span>Videos + examples + practice</span>
        </div>
      </header>

      <div className="course-dashboard">
        <div>
          <strong>
            {progress.done.length} / {total}
          </strong>

          <span>classes completed</span>
        </div>

        <div>
          <strong>{percent}%</strong>
          <span>course progress</span>
        </div>

        <div>
          <strong>
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </strong>

          <span>estimated study · videos extra</span>
        </div>
      </div>

      <progress
        className="course-progress"
        value={progress.done.length}
        max={total}
        aria-label="Completed classes"
      />

      {error && (
        <p
          className="course-warning"
          role="status"
        >
          {error}
        </p>
      )}

      <div className="course-continue">
        <div>
          <span className="course-label">
            {next
              ? 'YOUR NEXT STEP'
              : 'FOUNDATIONS COMPLETED'}
          </span>

          <h2>
            {next
              ? `Class ${next.number}: ${next.title}`
              : 'Keep practising and revisiting your lessons.'}
          </h2>

          <p>
            {next
              ? `${next.level} · About ${next.minutes} min reading and practice, plus video`
              : 'You can review any class whenever you need.'}
          </p>
        </div>

        <button
          className="course-primary"
          onClick={() =>
            open((next || COURSE[0]).id)
          }
        >
          {next
            ? 'Continue learning ↓'
            : 'Review classes ↓'}
        </button>
      </div>

      <div className="course-filters">
        <input
          aria-label="Search classes"
          placeholder="Search classes in English or Arabic…"
          value={search}
          onChange={event =>
            changeFilter(() =>
              setSearch(event.target.value)
            )
          }
        />

        <select
          aria-label="Filter by stage"
          value={stageFilter}
          onChange={event =>
            changeFilter(() =>
              setStageFilter(event.target.value)
            )
          }
        >
          <option value="all">All stages</option>

          {STAGES.map((stage, i) => (
            <option
              value={i}
              key={stage.title}
            >
              {i + 1}. {stage.level}
            </option>
          ))}
        </select>

        <button
          aria-pressed={savedOnly}
          onClick={() =>
            changeFilter(() =>
              setSavedOnly(!savedOnly)
            )
          }
        >
          {savedOnly ? '★' : '☆'} Saved ({progress.saved.length})
        </button>
      </div>

      {STAGES.map((stage, stageIndex) => {
        const items = visible.filter(
          item => item.stage === stageIndex
        );

        if (!items.length) return null;

        const finished = stage.ids.filter(
          id => progress.done.includes(id)
        ).length;

        return (
          <section
            className="course-stage"
            key={stage.title}
            aria-labelledby={`stage-${stageIndex}`}
          >
            <header className="course-stage-header">
              <div className="course-stage-number">
                {String(stageIndex + 1).padStart(2, '0')}
              </div>

              <div>
                <span className="course-label">
                  {stage.level}
                </span>

                <h2 id={`stage-${stageIndex}`}>
                  {stage.title}
                </h2>

                <p>
                  {finished} / {stage.ids.length} completed
                  {' · '}
                  {stage.minutes.reduce((a, b) => a + b, 0)}
                  {' min estimated study + videos'}
                </p>
              </div>
            </header>

            <div className="course-list">
              {items.map(item => {
                const expanded = selected === item.id;
                const done = progress.done.includes(item.id);

                return (
                  <article
                    className={`course-class ${
                      expanded ? 'is-open' : ''
                    }`}
                    key={item.id}
                  >
                    <div className="course-class-header">
                      <h3>
                        <button
                          className="course-class-toggle"
                          ref={node => {
                            headers.current[item.id] = node;
                          }}
                          aria-expanded={expanded}
                          aria-controls={`lesson-body-${item.id}`}
                          onClick={() =>
                            setSelected(
                              expanded ? null : item.id
                            )
                          }
                        >
                          <span
                            className={`course-class-number ${
                              done ? 'is-done' : ''
                            }`}
                          >
                            {done
                              ? '✓'
                              : String(item.number).padStart(2, '0')}
                          </span>

                          <span className="course-class-info">
                            <strong>{item.title}</strong>

                            <span
                              lang="ar"
                              dir="rtl"
                            >
                              {item.arabic}
                            </span>

                            <small>
                              {item.level}
                              {' · ~'}
                              {item.minutes}
                              {' min study + video · '}
                              {done
                                ? 'Completed'
                                : 'Ready to learn'}
                            </small>
                          </span>

                          <span aria-hidden="true">
                            {expanded ? '−' : '+'}
                          </span>
                        </button>
                      </h3>

                      <button
                        className="course-bookmark"
                        aria-label={`${
                          progress.saved.includes(item.id)
                            ? 'Unsave'
                            : 'Save'
                        } ${item.title}`}
                        aria-pressed={
                          progress.saved.includes(item.id)
                        }
                        onClick={() => bookmark(item.id)}
                      >
                        {progress.saved.includes(item.id)
                          ? '★'
                          : '☆'}
                      </button>
                    </div>

                    {expanded && (
                      <LessonBody
                        key={item.id}
                        item={item}
                        completed={done}
                        onComplete={complete}
                        last={item.number === total}
                        onNext={() => {
                          const following = COURSE[item.number];

                          if (following) {
                            open(following.id);
                          } else {
                            setSelected(null);
                            overview.current?.focus();

                            overview.current?.scrollIntoView({
                              block: 'start'
                            });
                          }
                        }}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {!visible.length && (
        <div className="course-empty">
          <h2>No matching classes</h2>

          <p>
            Try another search or show all classes.
          </p>

          <button
            onClick={() => {
              setSearch('');
              setStageFilter('all');
              setSavedOnly(false);
            }}
          >
            Show all classes
          </button>
        </div>
      )}

      <footer className="course-footer">
        Progress and bookmarks are saved in this browser
        for your signed-in account. Levels are teaching stages,
        not formal certifications. Study times are estimates
        and exclude videos.
      </footer>
    </section>
  );
}

const STYLES = `
.arabic-course {
  --navy: #153047;
  --teal: #087f83;
  --tiffany: #bdebe5;
  --yellow: #f5d568;
  --line: #dce8e7;
  color: var(--navy);
  background: #fff;
  border-radius: 24px;
  padding: clamp(18px, 3vw, 38px);
  font-family: inherit;
  max-width: 1120px;
  margin: auto;
  line-height: 1.7;
}

.arabic-course * {
  box-sizing: border-box;
}

.arabic-course h1,
.arabic-course h2,
.arabic-course h3,
.arabic-course h4,
.arabic-course p {
  margin: 0;
}

.arabic-course button,
.arabic-course input,
.arabic-course select {
  font: inherit;
}

.arabic-course button {
  cursor: pointer;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--navy);
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 650;
}

.arabic-course button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.arabic-course button:focus-visible,
.arabic-course a:focus-visible,
.arabic-course input:focus-visible,
.arabic-course select:focus-visible,
.arabic-course summary:focus-visible {
  outline: 3px solid var(--teal);
  outline-offset: 4px;
}

.arabic-course .course-primary {
  background: var(--teal);
  border-color: var(--teal);
  color: #fff;
  white-space: normal;
}

.course-hero {
  background: #eefaf7;
  padding: clamp(22px, 4vw, 42px);
  border: 1px solid var(--line);
  border-radius: 20px;
  border-top: 5px solid var(--tiffany);
}

.course-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .1em;
  color: var(--teal);
  text-transform: uppercase;
}

.course-hero h1 {
  font-size: clamp(26px, 4vw, 40px);
  line-height: 1.2;
  margin: 12px 0;
}

.course-arabic-heading {
  font-size: 25px;
  text-align: left;
  margin: 12px 0 !important;
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
}

.course-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.course-badges span {
  background: #fff;
  border: 1px solid var(--line);
  padding: 5px 12px;
  border-radius: 30px;
  font-size: 12px;
}

.course-badges span:first-child {
  background: var(--yellow);
  border-color: var(--yellow);
}

.course-dashboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  padding: 25px 0 15px;
}

.course-dashboard > div {
  border-right: 1px solid var(--line);
  padding: 0 12px;
}

.course-dashboard > div:last-child {
  border: 0;
}

.course-dashboard strong {
  display: block;
  font-size: 25px;
}

.course-dashboard span {
  display: block;
  font-size: 12px;
  color: #526977;
}

.course-progress {
  display: block;
  width: 100%;
  height: 9px;
  border: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #e7f0ee;
  accent-color: var(--teal);
}

.course-progress::-webkit-progress-bar {
  background: #e7f0ee;
}

.course-progress::-webkit-progress-value {
  background: var(--teal);
}

.course-progress::-moz-progress-bar {
  background: var(--teal);
}

.course-continue {
  margin: 25px 0;
  padding: 22px;
  background: #fff9df;
  border: 1px solid #eee1a7;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.course-continue h2 {
  font-size: 19px;
}

.course-continue p {
  font-size: 13px;
  margin-top: 5px;
}

.course-continue button {
  flex-shrink: 0;
}

.course-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 28px 0;
}

.course-filters input,
.course-filters select {
  background: #fff;
  color: var(--navy);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  min-width: 0;
}

.course-filters input {
  flex: 1;
  min-width: 180px;
}

.course-filters button[aria-pressed=true] {
  background: var(--tiffany);
}

.course-stage {
  margin: 34px 0;
}

.course-stage-header {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.course-stage-number {
  width: 49px;
  height: 49px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--navy);
  color: #fff;
  font-weight: 800;
  flex-shrink: 0;
}

.course-stage-header h2 {
  font-size: 22px;
}

.course-stage-header p {
  font-size: 12px;
  color: #526977;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.course-class {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  overflow: hidden;
}

.course-class.is-open {
  border-color: var(--teal);
  box-shadow: 0 8px 25px #1530470c;
}

.course-class-header {
  display: flex;
  align-items: center;
  padding-right: 12px;
}

.course-class-header h3 {
  flex: 1;
  min-width: 0;
}

.arabic-course .course-class-toggle {
  display: flex;
  gap: 16px;
  align-items: center;
  text-align: left;
  background: transparent;
  width: 100%;
  border: 0;
  padding: 20px;
  scroll-margin-top: 20px;
  border-radius: 0;
}

.course-class-number {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: #f1f6f5;
  border-radius: 12px;
  font-size: 14px;
}

.course-class-number.is-done {
  background: var(--tiffany);
  color: var(--teal);
}

.course-class-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.course-class-info strong {
  font-size: 17px;
}

.course-class-info > span {
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
  font-weight: 400;
  font-size: 17px;
  text-align: left;
  color: #526977;
}

.course-class-info small {
  font-size: 11px;
  font-weight: 500;
  color: #526977;
}

.arabic-course .course-bookmark {
  padding: 7px 11px;
  font-size: 21px;
  border: 0;
  background: transparent;
}

.course-bookmark[aria-pressed=true] {
  color: #8b6500;
}

.course-body {
  padding: 0 24px 24px;
  border-top: 1px solid var(--line);
}

.course-body > section {
  margin-top: 30px;
}

.course-goal {
  padding: 18px 0;
}

.course-body h4 {
  font-size: 20px;
  margin: 5px 0 15px;
}

.course-video-cover {
  width: 100%;
  min-height: 230px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #eefaf7 !important;
  padding: 25px !important;
}

.course-video-cover > span:last-child {
  font-size: 13px;
}

.course-play {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--navy);
  color: #fff;
  font-size: 21px;
}

.course-video iframe {
  width: 100%;
  aspect-ratio: 16/9;
  display: block;
  border: 0;
  border-radius: 14px;
  background: #153047;
}

.course-video a {
  color: var(--teal);
  text-decoration: underline;
  font-weight: 700;
}

.course-video p {
  margin-top: 12px;
}

.course-video small {
  display: block;
  color: #526977;
  font-size: 12px;
  margin-top: 6px;
}

.course-notes ul {
  margin: 0;
  padding-left: 23px;
}

.course-notes li {
  margin-bottom: 12px;
}

.course-example {
  border: 1px solid var(--line);
  border-left: 4px solid var(--tiffany);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 12px;
}

.course-example p:first-child {
  font-family: 'Noto Sans Arabic', Tahoma, sans-serif;
  font-size: 25px;
  line-height: 2;
}

.course-example p:last-child {
  font-size: 14px;
  color: #526977;
  margin-top: 7px;
}

.course-reference {
  margin-top: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
}

.course-reference summary {
  cursor: pointer;
  font-weight: 700;
}

.course-reference p {
  font-size: 13px;
  margin: 10px 0;
}

.course-table {
  overflow-x: auto;
  margin-top: 15px;
}

.course-table table {
  width: 100%;
  border-collapse: collapse;
  min-width: 430px;
}

.course-table th,
.course-table td {
  border-bottom: 1px solid var(--line);
  padding: 10px;
  text-align: left;
}

.course-table th {
  background: #eefaf7;
  font-size: 12px;
}

.course-table td {
  font-size: 15px;
}

.course-practice {
  background: #f5faf9;
  border: 1px solid var(--line);
  padding: 22px;
  border-radius: 16px;
}

.course-practice fieldset {
  border: 0;
  padding: 0;
  margin: 12px 0 18px;
  min-width: 0;
}

.course-practice legend {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 15px;
}

.course-practice label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 10px;
  margin: 8px 0;
  cursor: pointer;
}

.course-practice input {
  accent-color: var(--teal);
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.course-feedback {
  padding: 15px;
  background: #fff9df;
  border-radius: 10px;
  margin-top: 16px;
}

.course-feedback p {
  margin-top: 6px;
}

.course-complete {
  color: var(--teal);
  font-weight: 700;
  margin-top: 15px !important;
}

.course-next {
  text-align: right;
  margin-top: 24px;
}

.course-warning {
  padding: 12px;
  background: #fff4cc;
  border-radius: 10px;
  margin-top: 15px !important;
}

.course-empty {
  text-align: center;
  padding: 40px 10px;
}

.course-empty button {
  margin-top: 15px;
}

.course-footer {
  border-top: 1px solid var(--line);
  padding-top: 20px;
  font-size: 12px;
  color: #526977;
}

@media (max-width: 650px) {
  .course-continue {
    align-items: stretch;
    flex-direction: column;
  }

  .course-dashboard {
    gap: 4px;
  }

  .course-dashboard > div {
    padding: 0 6px;
  }

  .course-dashboard strong {
    font-size: 19px;
  }

  .course-dashboard span {
    font-size: 10px;
  }

  .course-filters input {
    flex-basis: 100%;
  }

  .course-filters select {
    flex: 1;
  }

  .course-stage-header h2 {
    font-size: 19px;
  }

  .arabic-course .course-class-toggle {
    padding: 15px 10px;
    gap: 10px;
  }

  .course-class-number {
    width: 30px;
    height: 30px;
  }

  .course-class-info strong {
    font-size: 15px;
  }

  .course-class-header {
    padding-right: 4px;
  }

  .course-body {
    padding: 0 14px 18px;
  }

  .course-practice {
    padding: 15px;
  }

  .course-example p:first-child {
    font-size: 23px;
  }

  .course-video-cover {
    min-height: 180px;
  }

  .course-next button {
    width: 100%;
  }
}
`;
