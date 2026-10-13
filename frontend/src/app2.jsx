import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Home,
  Library,
  LayoutGrid,
  GraduationCap,
  Database,
  ArrowRight,
  ArrowLeft,
  LogOut,
  Eye,
  EyeOff,
} from 'lucide-react';

import ArabicClasses from './ArabicClasses';
import LibraryView from './LibraryView';
import FlashcardEditor from './FlashcardEditor';
import TutorView from './TutorView';
import DatabaseView from './DatabaseView';

const navigation = [
  {
    id: 'home',
    label: 'Overview',
    icon: Home,
    description: 'Your learning workspace.',
  },
  {
    id: 'classes',
    label: 'Arabic Classes',
    icon: BookOpen,
    description: 'Learn the basics with 25 lessons, examples and practice.',
  },
  {
    id: 'library',
    label: 'Library',
    icon: Library,
    description: 'Explore topics and useful Arabic sentences.',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    icon: LayoutGrid,
    description: 'Practice sentence cards at your own pace.',
  },
  {
    id: 'tutor',
    label: 'AI Tutor',
    icon: GraduationCap,
    description: 'Ask questions and practice Arabic in conversation.',
  },
  {
    id: 'database',
    label: 'Database',
    icon: Database,
    description: 'Organize sentences, words and Arabic roots.',
  },
];

const emptyForm = {
  username: '',
  email: '',
  identity: '',
  password: '',
  confirm: '',
};

async function accountRequest(endpoint, values) {
  let response;

  try {
    response = await fetch(`/api/auth/${endpoint}`, {
      method: values === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers:
        values === undefined
          ? {}
          : { 'Content-Type': 'application/json' },
      body: values === undefined ? undefined : JSON.stringify(values),
    });
  } catch {
    throw new Error(
      'Cannot connect to the server. Make sure Flask is running.'
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      'The account server is unavailable. Check Flask and the frontend proxy.'
    );
  }

  if (!response.ok) {
    throw new Error(result.error || 'Please try again.');
  }

  return result;
}

function Brand() {
  return (
    <span className="studio-brand">
      <span className="studio-logo">
        <BookOpen size={23} />
      </span>

      <span>
        Flashcard <span className="brand-light">Studio</span>
      </span>
    </span>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(() =>
    window.location.hash.startsWith('#reset=') ? 'reset' : 'home'
  );

  const [resetToken] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get('reset') || ''
  );

  const [currentView, setCurrentView] = useState('home');
  const [form, setForm] = useState(emptyForm);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetAvailable, setResetAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    accountRequest('session')
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        setResetAvailable(result.password_reset_available);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    const checkSession = () => {
      accountRequest('session')
        .then((result) => {
          if (active && !result.user) {
            setUser(null);
            setPage('login');
            setMessage('Your session ended. Please sign in again.');
          }
        })
        .catch(() => {});
    };

    window.addEventListener('focus', checkSession);
    const timer = window.setInterval(checkSession, 60000);

    return () => {
      active = false;
      window.removeEventListener('focus', checkSession);
      window.clearInterval(timer);
    };
  }, [user]);

  function openPage(nextPage) {
    setPage(nextPage);
    setError('');
    setMessage('');
    setForm(emptyForm);
    setShowPassword(false);
  }

  function openView(view) {
    setCurrentView(view);
    setError('');
    setMessage('');
  }

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (
      (page === 'register' || page === 'reset') &&
      form.password !== form.confirm
    ) {
      setError('Your passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      if (page === 'forgot') {
        const result = await accountRequest('forgot-password', {
          email: form.email,
        });

        setMessage(result.message);
      } else if (page === 'reset') {
        const result = await accountRequest('reset-password', {
          token: resetToken,
          password: form.password,
        });

        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );

        setUser(null);
        openPage('login');
        setMessage(result.message);
      } else {
        const result = await accountRequest(
          page === 'register' ? 'register' : 'login',
          page === 'register'
            ? {
                username: form.username,
                email: form.email,
                password: form.password,
              }
            : {
                identity: form.identity,
                password: form.password,
                remember,
              }
        );

        setUser(result.user);
        setCurrentView('home');
        setPage('home');
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');

    try {
      await accountRequest('logout', {});
      setUser(null);
      openPage('home');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const alerts = (
    <>
      {error && (
        <div className="studio-alert" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="studio-message" role="status">
          {message}
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="studio-loading">
        <style>{styles}</style>
        <Brand />
        <p>Opening your learning space…</p>
      </div>
    );
  }

  if (user && page !== 'reset') {
    return (
      <div className="studio-app">
        <style>{styles}</style>

        <aside className="studio-sidebar">
          <Brand />

          <p className="nav-caption">YOUR WORKSPACE</p>

          <nav aria-label="Main navigation">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={currentView === id ? 'selected' : ''}
                aria-current={currentView === id ? 'page' : undefined}
                onClick={() => openView(id)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="studio-account">
            <span className="account-avatar">
              {user.username.charAt(0).toUpperCase()}
            </span>

            <div className="account-details">
              <strong>{user.username}</strong>
              <small>Learning account</small>
            </div>

            <button
              disabled={busy}
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={19} />
            </button>
          </div>
        </aside>

        <main className="studio-main">
          <header className="workspace-header">
            <span>
              LEARN /{' '}
              {navigation
                .find((item) => item.id === currentView)
                .label.toUpperCase()}
            </span>

            <span className="studio-badge">Arabic learning</span>
          </header>

          {alerts}

          {currentView === 'home' ? (
            <div className="studio-overview">
              <p className="studio-eyebrow">YOUR NEXT CHAPTER</p>
              <h1>Welcome, {user.username}.</h1>

              <p className="studio-muted">
                Make a little space for Arabic today.
              </p>

              <section className="welcome-banner">
                <div>
                  <p className="studio-eyebrow">
                    START WITH THE FOUNDATIONS
                  </p>

                  <h2>
                    Understand the language.
                    <br />
                    Build your confidence.
                  </h2>

                  <button
                    className="studio-primary"
                    onClick={() => openView('classes')}
                  >
                    Explore Arabic classes
                    <ArrowRight size={18} />
                  </button>
                </div>

                <div className="welcome-arabic">
                  <span lang="ar" dir="rtl">
                    أَهْلًا وَسَهْلًا
                  </span>
                  <small>Welcome to your learning space</small>
                </div>
              </section>

              <h2 className="section-heading">Choose where to begin</h2>

              <div className="workspace-grid">
                {navigation
                  .filter((item) => item.id !== 'home')
                  .map(({ id, label, description, icon: Icon }) => (
                    <button
                      className="workspace-card"
                      key={id}
                      onClick={() => openView(id)}
                    >
                      <span className="feature-icon">
                        <Icon size={24} />
                      </span>

                      <h3>{label}</h3>
                      <p>{description}</p>

                      <span className="card-link">
                        Open {label}
                        <ArrowRight size={17} />
                      </span>
                    </button>
                  ))}
              </div>

              <p className="workspace-note">
                Class progress is saved for your account in this browser.
                The project’s existing learning database remains shared.
              </p>
            </div>
          ) : currentView === 'classes' ? (
            <ArabicClasses userId={user.id} />
          ) : (
            <div className="learning-content" key={currentView}>
              {currentView === 'library' && <LibraryView />}
              {currentView === 'flashcards' && <FlashcardEditor />}
              {currentView === 'tutor' && <TutorView />}
              {currentView === 'database' && <DatabaseView />}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="studio-public">
      <style>{styles}</style>

      <header className="public-header">
        <button
          className="brand-button"
          onClick={() => openPage('home')}
          aria-label="Home"
          disabled={busy}
        >
          <Brand />
        </button>

        <div className="header-actions">
          <button
            className="studio-link"
            onClick={() => openPage('login')}
            disabled={busy}
          >
            Sign in
          </button>

          <button
            className="studio-primary small-button"
            onClick={() => openPage('register')}
            disabled={busy}
          >
            Create account
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {page === 'home' ? (
        <main>
          <section className="studio-hero">
            <div>
              <p className="studio-eyebrow">
                A FRESH WAY TO LEARN ARABIC
              </p>

              <h1>
                A little practice.
                <br />
                A world of <span>meaning.</span>
              </h1>

              <p className="hero-description">
                Learn the foundations, explore useful sentences and
                practice Arabic one step at a time.
              </p>

              <div className="hero-actions">
                <button
                  className="studio-primary"
                  onClick={() => openPage('register')}
                >
                  Begin your journey
                  <ArrowRight size={18} />
                </button>

                <button
                  className="studio-link"
                  onClick={() => openPage('login')}
                >
                  I already have an account
                </button>
              </div>

              <p className="hero-footnote">
                Guided classes · Sentence practice · Your own pace
              </p>
            </div>

            <div className="hero-art">
              <p className="studio-eyebrow">A MOMENT OF ARABIC</p>

              <div className="example-card">
                <span className="studio-badge">
                  Everyday expressions
                </span>

                <p className="example-arabic" lang="ar" dir="rtl">
                  كُلُّ يَوْمٍ فُرْصَةٌ جَدِيدَةٌ
                </p>

                <div className="example-divider" />

                <h3>Every day is a new opportunity.</h3>

                <p className="studio-muted">
                  One sentence. A new beginning.
                </p>
              </div>

              <div className="art-caption">
                <span className="yellow-star">✦</span>
                <span>
                  Learn with context.
                  <br />
                  <strong>Remember with meaning.</strong>
                </span>
              </div>
            </div>
          </section>

          <section className="public-features">
            <p className="studio-eyebrow">A PLACE FOR YOUR PRACTICE</p>

            <h2>Clear steps. Connected learning.</h2>

            <div className="features-grid">
              {[
                {
                  icon: BookOpen,
                  title: 'Learn the foundations',
                  text: 'Explore 25 introductory classes with examples and practice.',
                },
                {
                  icon: Library,
                  title: 'Find your topic',
                  text: 'Discover sentence collections built around everyday life.',
                },
                {
                  icon: LayoutGrid,
                  title: 'Practice with context',
                  text: 'Review sentence flashcards and reveal meaning as you go.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span className="feature-icon">
                    <Icon size={24} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            {alerts}
          </section>
        </main>
      ) : (
        <main className="auth-layout">
          <section className="auth-story">
            <p className="studio-eyebrow">FLASHCARD STUDIO</p>

            <h1>
              Your next word.
              <br />
              Your next possibility.
            </h1>

            <p>
              A calm space to explore Arabic, practice with purpose and
              keep learning.
            </p>

            <div className="story-arabic">
              <span lang="ar" dir="rtl">
                رِحْلَةُ التَّعَلُّمِ
              </span>
              <small>The journey of learning</small>
            </div>
          </section>

          <section className="auth-panel">
            <button
              className="back-button"
              onClick={() => openPage('home')}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Back to home
            </button>

            <p className="studio-eyebrow">YOUR LEARNING ACCOUNT</p>

            <h2>
              {
                {
                  login: 'Welcome back.',
                  register: 'Start something good.',
                  forgot: 'Forgot your password?',
                  reset: 'Choose a new password.',
                }[page]
              }
            </h2>

            <p className="studio-muted">
              {
                {
                  login: 'Sign in to open your learning workspace.',
                  register: 'Create an account and begin exploring Arabic.',
                  forgot: 'Enter the email used for your account.',
                  reset: 'Choose a password with at least 12 characters.',
                }[page]
              }
            </p>

            {alerts}

            <form onSubmit={submitForm}>
              {page === 'register' && (
                <label className="auth-field">
                  Username
                  <input
                    name="username"
                    value={form.username}
                    onChange={updateForm}
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_]{3,30}"
                    placeholder="e.g. arabic_learner"
                  />
                  <small>
                    3–30 English letters, numbers or underscores.
                  </small>
                </label>
              )}

              {(page === 'register' || page === 'forgot') && (
                <label className="auth-field">
                  Email address
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateForm}
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                </label>
              )}

              {page === 'login' && (
                <label className="auth-field">
                  Username or email
                  <input
                    name="identity"
                    value={form.identity}
                    onChange={updateForm}
                    autoComplete="username"
                    required
                    maxLength={254}
                    placeholder="Enter your username or email"
                  />
                </label>
              )}

              {page !== 'forgot' && (
                <label className="auth-field">
                  {page === 'reset' ? 'New password' : 'Password'}

                  <span className="password-input">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={updateForm}
                      autoComplete={
                        page === 'login'
                          ? 'current-password'
                          : 'new-password'
                      }
                      required
                      minLength={page === 'login' ? 1 : 12}
                      maxLength={128}
                      placeholder={
                        page === 'login'
                          ? 'Enter your password'
                          : 'At least 12 characters'
                      }
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </span>
                </label>
              )}

              {(page === 'register' || page === 'reset') && (
                <label className="auth-field">
                  Confirm password
                  <input
                    name="confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={updateForm}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    placeholder="Enter your password again"
                  />
                </label>
              )}

              {page === 'login' && (
                <div className="form-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) =>
                        setRemember(event.target.checked)
                      }
                    />
                    Remember me for 30 days
                  </label>

                  <button
                    className="studio-link"
                    type="button"
                    onClick={() => openPage('forgot')}
                    disabled={busy}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {page === 'forgot' && !resetAvailable && (
                <div className="studio-alert">
                  Email recovery is not configured yet. The project
                  administrator needs to connect the email service.
                </div>
              )}

              <button
                className="studio-primary submit-button"
                disabled={
                  busy || (page === 'forgot' && !resetAvailable)
                }
              >
                {busy
                  ? 'Please wait…'
                  : {
                      login: 'Sign in',
                      register: 'Create account',
                      forgot: 'Send reset link',
                      reset: 'Save new password',
                    }[page]}

                <ArrowRight size={18} />
              </button>
            </form>

            <p className="auth-switch">
              {page === 'login' ? (
                <>
                  New here?{' '}
                  <button
                    className="studio-link"
                    onClick={() => openPage('register')}
                    disabled={busy}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="studio-link"
                    onClick={() => openPage('login')}
                    disabled={busy}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </section>
        </main>
      )}

      <footer className="studio-footer">
        <Brand />
        <span>A little Arabic, every day.</span>
      </footer>
    </div>
  );
}

const styles = `
:root {
  --studio-navy: #132c43;
  --studio-teal: #087f7b;
  --studio-tiffany: #81d8d0;
  --studio-yellow: #f5d66f;
  --studio-muted: #5d7180;
  --studio-line: #dce8e8;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: white;
  color: #132c43;
  font-family: 'Segoe UI', Arial, sans-serif;
}
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
button:disabled { opacity: .55; cursor: not-allowed; }
button:focus-visible, input:focus-visible, a:focus-visible {
  outline: 3px solid #087f7b;
  outline-offset: 3px;
}
.studio-public, .studio-app {
  min-height: 100vh;
  background: white;
  color: #132c43;
  text-align: left;
}
.studio-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 750;
  color: #132c43;
  white-space: nowrap;
}
.brand-light { font-weight: 400; }
.studio-logo {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #81d8d0;
}
.brand-button { border: 0; padding: 0; background: none; }
.public-header {
  max-width: 1240px;
  margin: auto;
  padding: 25px 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.header-actions, .hero-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.studio-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 0;
  border-radius: 10px;
  padding: 15px 22px;
  background: #087f7b;
  color: white;
  font-weight: 650;
}
.studio-primary:hover { background: #066b68; }
.small-button { padding: 11px 16px; font-size: 13px; }
.studio-link {
  border: 0;
  padding: 0;
  background: none;
  color: #087f7b;
  font-weight: 650;
}
.studio-link:hover { text-decoration: underline; }
.studio-eyebrow {
  margin: 0 0 20px;
  color: #087f7b;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.7px;
}
.studio-hero {
  max-width: 1240px;
  margin: auto;
  padding: 70px 35px 85px;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 60px;
  align-items: center;
}
.studio-hero h1 {
  font-size: clamp(38px, 4.4vw, 60px);
  line-height: 1.13;
  letter-spacing: -2px;
  font-weight: 750;
  margin: 0 0 25px;
}
.studio-hero h1 span {
  color: #087f7b;
  text-decoration: underline;
  text-decoration-color: #f5d66f;
  text-decoration-thickness: 6px;
  text-underline-offset: 8px;
}
.hero-description {
  max-width: 480px;
  color: #5d7180;
  font-size: 16px;
  line-height: 1.85;
  margin-bottom: 28px;
}
.hero-actions { flex-wrap: wrap; font-size: 13px; }
.hero-footnote { margin-top: 22px; font-size: 12px; color: #5d7180; }
.hero-art { padding: 28px; background: #e8f6f3; border-radius: 30px; }
.example-card {
  padding: 28px 22px;
  border: 1px solid #dce8e8;
  border-radius: 20px;
  background: white;
  text-align: center;
  transform: rotate(-2deg);
  box-shadow: 0 15px 30px #132c4308;
}
.studio-badge {
  display: inline-block;
  padding: 7px 12px;
  border-radius: 50px;
  background: #e6f5ef;
  color: #087f7b;
  font-size: 11px;
  font-weight: 650;
}
.example-arabic {
  font-family: Tahoma, Arial, sans-serif;
  font-size: 30px;
  line-height: 2;
  margin: 30px 0;
}
.example-divider { width: 65%; height: 1px; margin: 0 auto 23px; background: #dce8e8; }
.example-card h3 { font-size: 15px; font-weight: 600; }
.studio-muted { color: #5d7180; font-size: 14px; line-height: 1.7; }
.example-card .studio-muted { font-size: 11px; }
.art-caption { display: flex; align-items: center; gap: 13px; margin-top: 25px; font-size: 12px; line-height: 1.7; }
.yellow-star { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; background: #f5d66f; font-size: 25px; }
.public-features { padding: 50px max(35px, calc((100vw - 1170px) / 2)) 60px; background: #f3f9f8; }
.public-features h2 { font-size: 28px; font-weight: 700; letter-spacing: -.7px; margin: 0 0 30px; }
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.features-grid article { background: white; border: 1px solid #dce8e8; padding: 25px; border-radius: 16px; }
.feature-icon { width: 45px; height: 45px; display: grid; place-items: center; border-radius: 12px; background: #e4f5ef; color: #087f7b; }
.features-grid h3 { font-size: 18px; font-weight: 650; margin: 22px 0 12px; }
.features-grid p, .workspace-card p { font-size: 14px; line-height: 1.8; color: #5d7180; }
.studio-footer { max-width: 1240px; margin: auto; padding: 27px 35px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.studio-footer > span { color: #5d7180; font-size: 12px; }
.auth-layout {
  max-width: 1080px;
  margin: 25px auto 60px;
  border: 1px solid #dce8e8;
  border-radius: 23px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.auth-story { padding: 45px; background: #e5f5ef; display: flex; flex-direction: column; justify-content: center; }
.auth-story h1 { font-size: 36px; font-weight: 750; line-height: 1.2; letter-spacing: -1px; margin: 0 0 20px; }
.auth-story > p:not(.studio-eyebrow) { color: #5d7180; font-size: 14px; line-height: 1.9; }
.story-arabic { font-size: 38px; text-align: center; margin: 50px 0; }
.story-arabic small { display: block; color: #5d7180; font-size: 12px; margin-top: 15px; }
.auth-panel { padding: 35px 40px; }
.auth-panel h2 { font-size: 28px; font-weight: 700; margin: 0 0 10px; letter-spacing: -.7px; }
.auth-panel .studio-eyebrow { margin-bottom: 12px; }
.back-button { display: flex; align-items: center; gap: 7px; border: 0; background: none; color: #5d7180; padding: 0; font-size: 12px; margin-bottom: 30px; }
.auth-field { display: flex; flex-direction: column; gap: 8px; font-size: 13px; font-weight: 650; margin-top: 19px; }
.auth-field input { width: 100%; min-width: 0; border: 1px solid #cadad8; border-radius: 9px; padding: 13px; background: white; color: #132c43; font-weight: 400; }
.auth-field small { color: #5d7180; font-size: 11px; font-weight: 400; }
.password-input { display: flex; position: relative; }
.password-input input { padding-right: 45px; }
.password-input button { position: absolute; right: 8px; top: 0; bottom: 0; display: grid; place-items: center; border: 0; background: none; color: #5d7180; padding: 7px; }
.form-options { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 20px; font-size: 11px; }
.form-options label { display: flex; align-items: center; gap: 7px; }
.form-options input { accent-color: #087f7b; }
.submit-button { width: 100%; margin-top: 24px; }
.auth-switch { text-align: center; font-size: 12px; color: #5d7180; margin-top: 25px; }
.studio-alert, .studio-message { margin: 18px 0; padding: 13px; border: 1px solid #f5d66f; border-radius: 9px; background: #fff7da; color: #132c43; font-size: 13px; line-height: 1.7; }
.studio-message { background: #e8f6ef; border-color: #a3d5c9; }
.studio-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; color: #5d7180; }
.studio-app { display: flex; }
.studio-sidebar {
  width: 235px;
  flex-shrink: 0;
  height: 100vh;
  position: sticky;
  top: 0;
  padding: 28px 20px;
  border-right: 1px solid #dce8e8;
  display: flex;
  flex-direction: column;
  background: white;
}
.studio-sidebar .studio-brand { font-size: 15px; gap: 8px; }
.studio-sidebar .studio-logo { width: 35px; height: 35px; }
.nav-caption { color: #5d7180; font-size: 10px; letter-spacing: 1.5px; margin: 44px 12px 15px; }
.studio-sidebar nav { display: flex; flex-direction: column; gap: 7px; }
.studio-sidebar nav button { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border: 0; border-radius: 10px; background: none; color: #5d7180; text-align: left; font-size: 14px; }
.studio-sidebar nav button:hover { background: #f3f9f8; }
.studio-sidebar nav button.selected { background: #def3ec; color: #086b64; font-weight: 700; }
.studio-account { display: flex; align-items: center; gap: 9px; border-top: 1px solid #dce8e8; padding-top: 20px; margin-top: auto; }
.account-avatar { flex-shrink: 0; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #f5d66f; font-weight: 700; }
.account-details { min-width: 0; }
.account-details strong { display: block; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.account-details small { display: block; font-size: 10px; color: #5d7180; margin-top: 4px; }
.studio-account button { border: 0; background: none; color: #5d7180; padding: 6px; margin-left: auto; }
.studio-main { flex: 1; min-width: 0; padding: 0 35px 40px; background: #f8fbfa; }
.workspace-header { height: 80px; border-bottom: 1px solid #dce8e8; display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 32px; }
.workspace-header > span:first-child { font-size: 10px; letter-spacing: 1.3px; color: #5d7180; }
.studio-overview { max-width: 1150px; margin: auto; }
.studio-overview > h1 { font-size: 32px; font-weight: 750; margin: 0; letter-spacing: -1px; }
.studio-overview > .studio-eyebrow { margin-bottom: 12px; }
.welcome-banner { margin-top: 27px; padding: 32px; display: flex; align-items: center; justify-content: space-between; gap: 25px; background: #e2f3ec; border: 1px solid #d4e9df; border-radius: 18px; }
.welcome-banner h2 { margin: 0 0 23px; font-size: 27px; font-weight: 700; line-height: 1.3; }
.welcome-banner .studio-eyebrow { font-size: 9px; margin-bottom: 13px; }
.welcome-arabic { font-size: 36px; text-align: center; }
.welcome-arabic small { display: block; font-size: 11px; margin-top: 15px; color: #5d7180; }
.section-heading { margin: 30px 0 20px; font-size: 20px; font-weight: 650; }
.workspace-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.workspace-card { background: white; border: 1px solid #dce8e8; border-radius: 15px; padding: 24px; text-align: left; color: #132c43; }
.workspace-card:hover { border-color: #81d8d0; box-shadow: 0 8px 25px #132c4308; }
.workspace-card h3 { font-size: 18px; font-weight: 650; margin: 19px 0 10px; }
.card-link { display: flex; align-items: center; gap: 9px; color: #087f7b; font-size: 12px; font-weight: 650; margin-top: 21px; }
.workspace-note { font-size: 11px; line-height: 1.7; color: #5d7180; margin-top: 24px; }

/* Light theme for existing learning pages */
.learning-content { color: #132c43; }
.learning-content [class*="bg-slate-"],
.learning-content [class*="bg-gray-"] { background-color: white !important; }
.learning-content [class*="border-slate-"],
.learning-content [class*="border-gray-"] { border-color: #dce8e8 !important; }
.learning-content [class*="text-slate-"],
.learning-content [class*="text-gray-"] { color: #5d7180 !important; }
.learning-content .text-white,
.learning-content [class*="text-slate-100"],
.learning-content [class*="text-slate-200"],
.learning-content [class*="text-slate-800"],
.learning-content [class*="text-slate-900"] { color: #132c43 !important; }
.learning-content [class*="text-indigo-"],
.learning-content [class*="text-purple-"],
.learning-content [class*="text-violet-"],
.learning-content [class*="text-blue-"],
.learning-content [class*="text-cyan-"],
.learning-content [class*="text-emerald-"],
.learning-content [class*="text-green-"] { color: #087f7b !important; }
.learning-content [class*="bg-indigo-"],
.learning-content [class*="bg-purple-"],
.learning-content [class*="bg-violet-"],
.learning-content [class*="bg-blue-"],
.learning-content [class*="bg-cyan-"],
.learning-content [class*="bg-emerald-"],
.learning-content [class*="bg-green-"] { background-color: #e0f2eb !important; }
.learning-content button[class~="bg-indigo-600"],
.learning-content button[class~="bg-indigo-500"],
.learning-content button[class~="bg-blue-600"],
.learning-content button[class~="bg-emerald-600"] {
  background-color: #087f7b !important;
  color: white !important;
}
.learning-content [class*="bg-yellow-"],
.learning-content [class*="bg-amber-"],
.learning-content [class*="bg-orange-"],
.learning-content [class*="bg-red-"],
.learning-content [class*="bg-rose-"] { background-color: #fff3cd !important; }
.learning-content [class*="text-yellow-"],
.learning-content [class*="text-amber-"],
.learning-content [class*="text-orange-"],
.learning-content [class*="text-red-"],
.learning-content [class*="text-rose-"] { color: #775c12 !important; }
.learning-content [class*="border-indigo-"],
.learning-content [class*="border-purple-"],
.learning-content [class*="border-emerald-"] { border-color: #89cfc0 !important; }
.learning-content [class*="bg-gradient-"] {
  background-image: linear-gradient(135deg, #e7f6ef, #fffdf2) !important;
}
.learning-content input,
.learning-content textarea,
.learning-content select {
  background: white !important;
  color: #132c43 !important;
  color-scheme: light;
}
.learning-content [class*="bg-black/"] { background-color: #132c4380 !important; }

/* Keep Library photographs visible */
.learning-content div.relative.overflow-hidden:has(> img)
  > div.absolute.inset-0.bg-gradient-to-t {
  background-color: transparent !important;
  background-image: linear-gradient(
    to top,
    rgba(19,44,67,.72),
    rgba(19,44,67,.15) 45%,
    transparent 75%
  ) !important;
  pointer-events: none;
}
.learning-content div.relative.overflow-hidden:has(> img)
  > span.absolute {
  color: white !important;
  z-index: 2;
}

/* Tutor words remain text, not filled buttons */
.learning-content button[data-tutor-word] {
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  padding: 2px 4px !important;
}
.learning-content button[data-tutor-word][class*="text-emerald"] {
  color: #087f7b !important;
}
.learning-content button[data-tutor-word][class*="text-rose"] {
  color: #132c43 !important;
  text-decoration: underline;
  text-decoration-color: #f5d66f;
  text-decoration-thickness: 3px;
  text-underline-offset: 7px;
}
.learning-content button[data-tutor-word]:hover {
  background: #e4f5ef !important;
}
.font-arabic { font-family: 'Noto Sans Arabic', Tahoma, Arial, sans-serif; }

@media (max-width: 1000px) {
  .studio-hero { gap: 30px; }
  .auth-layout { margin-left: 22px; margin-right: 22px; }
  .auth-story, .auth-panel { padding: 30px; }
  .studio-sidebar { width: 205px; padding: 24px 14px; }
  .studio-main { padding-left: 22px; padding-right: 22px; }
  .welcome-arabic { font-size: 28px; }
}
@media (max-width: 740px) {
  .public-header { padding: 20px 16px; }
  .studio-brand { font-size: 14px; }
  .header-actions { gap: 12px; }
  .header-actions .studio-link { font-size: 12px; }
  .small-button { font-size: 11px; padding: 11px; }
  .small-button svg { display: none; }
  .studio-hero { grid-template-columns: 1fr; padding: 35px 22px 45px; gap: 35px; }
  .studio-hero h1 { font-size: 42px; }
  .hero-description { font-size: 15px; }
  .hero-art { width: 100%; max-width: 470px; margin: auto; }
  .public-features { padding: 35px 22px; }
  .public-features h2 { font-size: 25px; }
  .features-grid { grid-template-columns: 1fr; }
  .studio-footer { padding: 22px; flex-wrap: wrap; }
  .auth-layout { display: block; margin: 12px 16px 35px; }
  .auth-story { display: none; }
  .auth-panel { padding: 28px 23px; }
  .studio-app { display: block; }
  .studio-sidebar {
    width: 100%;
    height: auto;
    position: static;
    padding: 17px 16px 8px;
    border-right: 0;
    border-bottom: 1px solid #dce8e8;
    display: grid;
    grid-template-columns: 1fr auto;
  }
  .nav-caption { display: none; }
  .studio-sidebar nav {
    grid-column: 1 / -1;
    grid-row: 2;
    flex-direction: row;
    margin-top: 17px;
    gap: 3px;
    overflow-x: auto;
  }
  .studio-sidebar nav button {
    flex: 1;
    flex-direction: column;
    gap: 5px;
    padding: 10px 7px;
    font-size: 10px;
    white-space: nowrap;
  }
  .studio-account { border: 0; margin: 0; padding: 0; }
  .account-details { display: none; }
  .studio-main { padding: 0 17px 30px; }
  .workspace-header { height: 62px; margin-bottom: 25px; }
  .studio-overview > h1 { font-size: 27px; }
  .welcome-banner { flex-direction: column; align-items: flex-start; padding: 25px; }
  .welcome-banner h2 { font-size: 24px; }
  .welcome-arabic { align-self: center; margin-top: 10px; }
  .workspace-grid { grid-template-columns: 1fr; }
  .learning-content { overflow-x: auto; }
}
`;
