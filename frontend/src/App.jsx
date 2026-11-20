import React, { useState, useRef, useEffect, useCallback } from 'react';
import LibraryView from './LibraryView';
import FlashcardsView from './FlashcardsView';
import TutorView from './TutorView';
import AtlasView from './AtlasView';
import CalibrateView from './CalibrateView';
import AppearanceControl from './AppearanceControl';
import { calibrationEntry } from './calibrationEntry';
import { SignInDialog, SignInButton, AccountMenu } from './AccountView';
import { currentSession, startGuest } from './auth';
import logo from './logo.png';
import {
  Library,
  GraduationCap,
  LayoutGrid,
  Map as MapIcon,
  Gauge
} from 'lucide-react';

// Calibration comes first; all learning views remain directly accessible.
const VIEWS = [
  { id: 'atlas', label: 'Atlas', icon: MapIcon },
  { id: 'flashcards', label: 'Flashcards', icon: LayoutGrid },
  { id: 'tutor', label: 'Tutor', icon: GraduationCap },
  { id: 'library', label: 'Library', icon: Library },
];
const CALIBRATE = { id: 'calibrate', label: 'Calibrate', icon: Gauge };

// ?atlas=<lemma id> (the browser extension's Atlas button) opens Atlas on that word; ?atlas alone, Atlas
const params = new URLSearchParams(window.location.search);
const linkedWord = Number(params.get('atlas')) || null, linkedAtlas = params.has('atlas');
if (linkedAtlas) window.history.replaceState(null, '', window.location.pathname);  // a reload opens the app normally

const App = () => {
  const [user, setUser] = useState(undefined); // undefined: checking; null: a guest (data for this browser session only)
  const [signingIn, setSigningIn] = useState(false); // the sign-in dialog, over the app
  const [currentView, setCurrentView] = useState(linkedAtlas ? 'atlas' : 'library');
  const [tutorAlert, setTutorAlert] = useState(false); // a tutor reply arrived while you were on another page
  const [libraryFocus, setLibraryFocus] = useState(null); // a sentence to open in the Library (the Tutor's "view flashcard")
  const [atlasFocus, setAtlasFocus] = useState(linkedWord); // a word to open Atlas on (from Flashcards or a link), or 'auto': its auto-create tool
  const [setupStatus, setSetupStatus] = useState(null);
  const [initialCalibration, setInitialCalibration] = useState(false);
  const entryDecided = useRef(linkedAtlas);
  const tutorOpened = useRef(false), viewRef = useRef(currentView), beforeCalibrate = useRef('library');
  if (currentView === 'tutor') tutorOpened.current = true;
  viewRef.current = currentView;

  const chooseView = (id) => {
    entryDecided.current = true; // Late setup status must never override explicit navigation.
    setCurrentView(id);
  };

  const go = (id) => {
    if (id === 'calibrate' && currentView !== 'calibrate') {
      beforeCalibrate.current = currentView;
      setInitialCalibration(false);
    }
    if (id === 'tutor') setTutorAlert(false);
    if (id === 'library') setLibraryFocus(null); // the tab itself opens the new-flashcard creator
    if (id === 'atlas') setAtlasFocus(null);
    chooseView(id);
  };
  useEffect(() => {  // signed in, a guest already, or new here: a guest, with the sign-in dialog open
    currentSession().then(async (s) => {
      if (s.user || s.guest) return setUser(s.user);
      await startGuest();
      setSigningIn(true);
      setUser(null);
    }).catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;
    const read = path => fetch(`${process.env.REACT_APP_API_URL || ''}${path}`).then(r => {
      if (!r.ok) throw new Error('Setup status unavailable');
      return r.json();
    });
    Promise.all([read('/api/calibrate'), read('/api/known-count')]).then(([status, count]) => {
      if (cancelled) return;
      const setup = calibrationEntry(status, count);
      setSetupStatus(setup);
      if (!entryDecided.current && setup === 'fresh') {
        beforeCalibrate.current = 'atlas';
        setInitialCalibration(true);
        setCurrentView('calibrate');
      }
      entryDecided.current = true;
    }).catch(() => { if (!cancelled) entryDecided.current = true; });
    return () => { cancelled = true; };
  }, [user]);
  // Refresh the cue after normal navigation, without making another entry decision.
  useEffect(() => {
    if (user === undefined || currentView === 'calibrate' || !entryDecided.current) return;
    let cancelled = false;
    const read = path => fetch(`${process.env.REACT_APP_API_URL || ''}${path}`).then(r => {
      if (!r.ok) throw new Error('Setup status unavailable');
      return r.json();
    });
    Promise.all([read('/api/calibrate'), read('/api/known-count')]).then(([status, count]) => {
      if (!cancelled) setSetupStatus(calibrationEntry(status, count));
    }).catch(() => { if (!cancelled) setSetupStatus(null); });
    return () => { cancelled = true; };
  }, [currentView, user]);
  const onCalibrationStatus = useCallback(status => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/known-count`).then(r => {
      if (!r.ok) throw new Error('Setup status unavailable');
      return r.json();
    }).then(count => setSetupStatus(calibrationEntry(status, count))).catch(() => {});
  }, []);
  const calibrationCue = setupStatus === 'fresh' ? 'Start here' : setupStatus === 'partial' ? 'Continue calibration' : null;
  const alerting = (id) => currentView !== id && ((id === 'tutor' && tutorAlert) || (id === 'calibrate' && calibrationCue));

  const navButton = ({ id, label, icon: Icon }) => (
    <button
      key={id}
      onClick={() => go(id)}
      aria-label={label}
      aria-current={currentView === id ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 group
        ${currentView === id
          ? 'bg-active text-accent'
          : alerting(id) ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/50'
          : 'text-slate-400 hover:text-ink hover:bg-slate-800/50'
        }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${currentView === id ? 'text-accent' : alerting(id) ? 'text-indigo-300' : 'text-slate-500 group-hover:text-ink'}`} />
      <span className="text-left">{label}{id === 'calibrate' && calibrationCue && <small className="block mt-1 text-xs font-normal text-accent">{calibrationCue}</small>}</span>
      {alerting(id) && id === 'tutor' && <span className="ml-auto w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
    </button>
  );

  if (user === undefined) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="app-shell flex min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">

      {/* Sidebar Navigation */}
      <nav className="atlas-sidebar w-60 shrink-0 bg-slate-900 border-r border-slate-700 p-5 flex flex-col hidden md:flex sticky top-0 h-screen z-30">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-5 px-2">
          <img src={logo} alt="" className="w-11 h-11 rounded-xl" />
          {/* text-box trims the lines to the capitals and baseline, so the block is exactly 32px tall (Chrome, Edge) */}
          <h1 className="text-[18.82px] font-bold text-ink tracking-[-0.025em] leading-none whitespace-pre" style={{ textBox: 'trim-both cap alphabetic' }}>{'ATLAS\nArabic Tools'}</h1>
        </div>

        {/* Navigation Items */}
        <div className="space-y-2">{[CALIBRATE, ...VIEWS].map(navButton)}</div>
        <div className="mt-auto pt-6 border-t border-slate-800 space-y-3">
          {user ? <AccountMenu user={user} onUser={setUser} /> : <SignInButton onClick={() => setSigningIn(true)} />}
        </div>
      </nav>

      <div className="appearance-bar"><p>Arabic learning</p><AppearanceControl /></div>

      {/* Account on phones, where the sidebar is hidden */}
      <div className="md:hidden fixed top-3 right-3 z-40">
        {user ? <AccountMenu user={user} onUser={setUser} up={false} compact /> : <SignInButton onClick={() => setSigningIn(true)} compact />}
      </div>
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}

      {/* Main Content Area */}
      <main onPointerDownCapture={() => { entryDecided.current = true; }} onKeyDownCapture={() => { entryDecided.current = true; }}
            className="flex-1 min-w-0 p-4 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-8 md:pt-24 overflow-y-auto max-h-screen [scrollbar-gutter:stable]">
        <div className="max-w-7xl mx-auto min-h-full">
          {currentView === 'library' && <LibraryView focusSentenceId={libraryFocus} onOpenWord={(id) => { setAtlasFocus(id); chooseView('atlas'); }} />}
          {currentView === 'flashcards' && <FlashcardsView onTutor={() => go('tutor')} onOpenWord={(id) => { setAtlasFocus(id); chooseView('atlas'); }}
                                                          onAutoCreate={() => { setAtlasFocus('auto'); chooseView('atlas'); }} />}
          {/* Kept mounted after the first visit so the chat survives switching views */}
          {tutorOpened.current && (
            <div className={currentView === 'tutor' ? '' : 'hidden'}><TutorView onReply={() => viewRef.current !== 'tutor' && setTutorAlert(true)}
                                                                                onViewSentence={(id) => { setLibraryFocus(id); chooseView('library'); }} /></div>
          )}
          {currentView === 'atlas' && <AtlasView onCalibrate={() => go('calibrate')} focusWordId={atlasFocus} />}
          {currentView === 'calibrate' && <CalibrateView onClose={() => go(beforeCalibrate.current)} initialEntry={initialCalibration} onStatus={onCalibrationStatus} />}
        </div>
      </main>

      {/* Bottom tab bar on phones, where the sidebar is hidden */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-700 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {[CALIBRATE, ...VIEWS].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-label={label}
            aria-current={currentView === id ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${currentView === id ? 'bg-indigo-500/15 text-indigo-300' : alerting(id) ? 'text-indigo-300' : 'text-slate-400'}`}
          >
            <Icon className="w-5 h-5" />
            {alerting(id) && id === 'tutor' && <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
            {label}
            {id === 'calibrate' && calibrationCue && <span className="text-[9px] leading-tight text-accent">{setupStatus === 'fresh' ? 'Start here' : 'Continue'}</span>}
          </button>
        ))}
      </nav>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;700&display=swap');

        .font-arabic {
          font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(var(--panel));
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(var(--line));
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(var(--control));
        }
      `}</style>
    </div>
  );
};

export default App;
