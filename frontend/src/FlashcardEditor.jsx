import React, { useState } from 'react';
import { 
  CreditCard, 
  RotateCw, 
  ThumbsUp, 
  ThumbsDown,
  Layers
} from 'lucide-react';

const FlashcardEditor = () => {
  const [activeDeck, setActiveDeck] = useState('all'); // Fixed: 'all' instead of 'All'

  // Placeholder data - eventually this will come from props or context/API
  const decks = [
    { id: 'all', name: 'All Cards', count: 124 },
    { id: 'new', name: 'New', count: 15 },
    { id: 'learning', name: 'Learning', count: 42 },
    { id: 'review', name: 'Review', count: 67 },
  ];

  return (
    <div className="h-full flex flex-col p-6 space-y-8 animate-in fade-in duration-300">
      
      {/* Header / Deck Selection */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Flashcards</h1>
          <p className="text-slate-500 text-sm mt-1">Review and memorize your vocabulary.</p>
        </div>
        
        {/* Main Function Tabs - Expanded & Prettier */}
        <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => setActiveDeck(deck.id)}
              className={`
                flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-2
                ${activeDeck === deck.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <span>{deck.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeDeck === deck.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>
                {deck.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Study Area */}
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-3xl aspect-[3/2] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative group cursor-pointer perspective-1000 transition-transform hover:scale-[1.01] duration-300">
           
           {/* Card Content Placeholder */}
           <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">Word</span>
              <h2 className="text-6xl md:text-7xl font-arabic text-white mb-8">مرحبا</h2>
              <p className="text-slate-500 text-sm font-medium opacity-50 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                <RotateCw className="w-4 h-4" /> Click to flip
              </p>
           </div>

           {/* Progress Indicator */}
           <div className="absolute top-8 right-8 text-slate-500 text-xs font-mono bg-slate-950/50 px-3 py-1 rounded-full border border-slate-800">
             1 / {decks.find(d => d.id === activeDeck)?.count || 0}
           </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-6 pb-4">
        <button className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/50 hover:-translate-y-1 transition-all duration-200 shadow-lg shadow-black/50 group">
          <ThumbsDown className="w-8 h-8 group-active:scale-90 transition-transform" />
        </button>
        <button className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:-translate-y-1 transition-all duration-200 shadow-lg shadow-black/50 group">
          <ThumbsUp className="w-8 h-8 group-active:scale-90 transition-transform" />
        </button>
      </div>

    </div>
  );
};

export default FlashcardEditor;