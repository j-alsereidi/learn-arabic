import React, { useState, useRef } from 'react';
import LibraryView from './LibraryView';
import FlashcardEditor from './FlashcardEditor';
import TutorView from './TutorView';
import { 
  Languages, 
  Library,     
  GraduationCap, 
  LayoutGrid   
} from 'lucide-react';

const App = () => {
  const [currentView, setCurrentView] = useState('library');
  const tutorOpened = useRef(false);
  if (currentView === 'tutor') tutorOpened.current = true;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col hidden md:flex">
        
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
        <div className="space-y-3">
          <button 
            onClick={() => setCurrentView('library')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 group
              ${currentView === 'library' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
          >
            <Library className={`w-5 h-5 ${currentView === 'library' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            Library
          </button>
          
          <button 
            onClick={() => setCurrentView('flashcards')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 group
              ${currentView === 'flashcards' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
          >
            <LayoutGrid className={`w-5 h-5 ${currentView === 'flashcards' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            Flashcards
          </button>

          <button 
            onClick={() => setCurrentView('tutor')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 group
              ${currentView === 'tutor' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
          >
            <GraduationCap className={`w-5 h-5 ${currentView === 'tutor' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            Tutor
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <div className="max-w-7xl mx-auto h-full">
          {currentView === 'library' && <LibraryView />}
          {currentView === 'flashcards' && <FlashcardEditor />}
          {/* Kept mounted after the first visit so the chat survives switching views */}
          {tutorOpened.current && (
            <div className={currentView === 'tutor' ? '' : 'hidden'}><TutorView /></div>
          )}
        </div>
      </main>

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