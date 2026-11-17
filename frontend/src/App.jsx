import React, { useState, useRef, useEffect } from 'react';
import LibraryView from './LibraryView';
import FlashcardsView from './FlashcardsView';
import TutorView from './TutorView';
import AtlasView from './AtlasView';
import CalibrateView from './CalibrateView';
import { SignInDialog, SignInButton, AccountMenu } from './AccountView';
import { currentSession, startGuest } from './auth';
import {
  Languages,
  Library,
  GraduationCap,
  LayoutGrid,
  Map as MapIcon,
  Gauge
} from 'lucide-react';

// In workflow order: find words, review them, use them, then your own sentences
const VIEWS = [
  { id: 'atlas', label: 'Atlas', icon: MapIcon },
  { id: 'flashcards', label: 'Flashcards', icon: LayoutGrid },
  { id: 'tutor', label: 'Tutor', icon: GraduationCap },
  { id: 'library', label: 'Library', icon: Library },
];
const CALIBRATE = { id: 'calibrate', label: 'Calibrate', icon: Gauge };

// ?atlas=<lemma id> (the browser extension's Atlas button) opens the Atlas on that word
const linkedWord = Number(new URLSearchParams(window.location.search).get('atlas')) || null;
if (linkedWord) window.history.replaceState(null, '', window.location.pathname);  // a reload opens the app normally

const App = () => {
  const [user, setUser] = useState(undefined); // undefined: checking; null: a guest (data for this browser session only)
  const [signingIn, setSigningIn] = useState(false); // the sign-in dialog, over the app
  const [currentView, setCurrentView] = useState(linkedWord ? 'atlas' : 'library');
  const [tutorAlert, setTutorAlert] = useState(false); // a tutor reply arrived while you were on another page
  const [libraryFocus, setLibraryFocus] = useState(null); // a sentence to open in the Library (the Tutor's "view flashcard")
  const [atlasFocus, setAtlasFocus] = useState(linkedWord); // a word to open on the Atlas (from Flashcards or a link)
  const [knowsNothing, setKnowsNothing] = useState(false); // no known words yet: the Calibrate tab glows
  const tutorOpened = useRef(false), viewRef = useRef(currentView), beforeCalibrate = useRef('library');
  if (currentView === 'tutor') tutorOpened.current = true;
  viewRef.current = currentView;

  const go = (id) => {
    if (id === 'calibrate' && currentView !== 'calibrate') beforeCalibrate.current = currentView;
    if (id === 'tutor') setTutorAlert(false);
    if (id === 'library') setLibraryFocus(null); // the tab itself opens the new-flashcard creator
    if (id === 'atlas') setAtlasFocus(null);
    setCurrentView(id);
  };
  useEffect(() => {  // signed in, a guest already, or new here: a guest, with the sign-in dialog open
    currentSession().then(async (s) => {
      if (s.user || s.guest) return setUser(s.user);
      await startGuest();
      setSigningIn(true);
      setUser(null);
    }).catch(() => setUser(null));
  }, []);
  useEffect(() => {  // checked on every page change, so it stops glowing once you've calibrated
    if (user === undefined) return;
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/known-count`).then(r => r.json()).then(d => setKnowsNothing(d.known === 0)).catch(() => {});
  }, [currentView, user]);
  const alerting = (id) => currentView !== id && ((id === 'tutor' && tutorAlert) || (id === 'calibrate' && knowsNothing));

  const navButton = ({ id, label, icon: Icon }) => (
    <button
      key={id}
      onClick={() => go(id)}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 group
        ${currentView === id
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1'
          : alerting(id) ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/50'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
    >
      <Icon className={`w-5 h-5 ${currentView === id ? 'text-white' : alerting(id) ? 'text-indigo-300' : 'text-slate-500 group-hover:text-white'}`} />
      {label}
      {alerting(id) && id === 'tutor' && <span className="ml-auto w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
    </button>
  );

  if (user === undefined) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">

      {/* Sidebar Navigation */}
      <nav className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col hidden md:flex sticky top-0 h-screen z-30">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
            <Languages className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Flashcard<br/>Studio</h1>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="space-y-3">{VIEWS.map(navButton)}</div>
        <div className="mt-auto pt-6 border-t border-slate-800 space-y-3">
          {navButton(CALIBRATE)}
          {user ? <AccountMenu user={user} onUser={setUser} /> : <SignInButton onClick={() => setSigningIn(true)} />}
        </div>
      </nav>

      {/* Account on phones, where the sidebar is hidden */}
      <div className="md:hidden fixed top-3 right-3 z-40">
        {user ? <AccountMenu user={user} onUser={setUser} up={false} compact /> : <SignInButton onClick={() => setSigningIn(true)} compact />}
      </div>
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 pt-16 pb-24 md:p-8 overflow-y-auto max-h-screen [scrollbar-gutter:stable]">
        <div className="max-w-7xl mx-auto h-full">
          {currentView === 'library' && <LibraryView focusSentenceId={libraryFocus} />}
          {currentView === 'flashcards' && <FlashcardsView onTutor={() => go('tutor')} onOpenWord={(id) => { setAtlasFocus(id); setCurrentView('atlas'); }} />}
          {/* Kept mounted after the first visit so the chat survives switching views */}
          {tutorOpened.current && (
            <div className={currentView === 'tutor' ? '' : 'hidden'}><TutorView onReply={() => viewRef.current !== 'tutor' && setTutorAlert(true)}
                                                                                onViewSentence={(id) => { setLibraryFocus(id); setCurrentView('library'); }} /></div>
          )}
          {currentView === 'atlas' && <AtlasView onCalibrate={() => go('calibrate')} focusWordId={atlasFocus} />}
          {currentView === 'calibrate' && <CalibrateView onClose={() => go(beforeCalibrate.current)} />}
        </div>
      </main>

      {/* Bottom tab bar on phones, where the sidebar is hidden */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {[...VIEWS, CALIBRATE].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-label={label}
            aria-current={currentView === id ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${currentView === id ? 'text-indigo-400' : alerting(id) ? 'text-indigo-300' : 'text-slate-500'}`}
          >
            <Icon className="w-5 h-5" />
            {alerting(id) && id === 'tutor' && <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
            {label}
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
          background: #0f172a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};

export default App;
