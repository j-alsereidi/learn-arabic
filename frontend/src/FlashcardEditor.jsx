import React, { useState, useEffect } from 'react';
import { 
  RotateCw, 
  ThumbsUp, 
  ThumbsDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader 
} from 'lucide-react';
import Gloss from './Gloss';

const API_BASE = process.env.REACT_APP_API_URL || '';

// --- Helpers ---
const stripDiacritics = (text) => {
    if (!text) return "";
    return text
        .normalize('NFD')
        .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
        .replace(/[،؛؟!.,;:]/g, '');
};

// Each token's lemma: explicit link, else exact word match, else unique fuzzy match
const sentenceLemmas = (sentence, words, lemmas, wordInstances) =>
    sentence.plaintext.split(' ').map((token, index) => {
        const explicitLink = wordInstances.find(i => i.sentence_id === sentence.sentence_id && i.index === index);
        let match = null;

        if (explicitLink) {
            match = words.find(w => w.word_id === explicitLink.word_id);
        } else {
            const cleanToken = token.replace(/[،؛؟!.,;:]/g, '');
            match = words.find(w => w.plaintext === cleanToken || w.plaintext === token);
            if (!match) {
                const fuzzyMatches = words.filter(w => w.prune === stripDiacritics(cleanToken));
                if (fuzzyMatches.length === 1) match = fuzzyMatches[0];
            }
        }

        return { text: token, lemma: match && lemmas.find(l => l.lemma_id === match.lemma_id) };
    });

// --- Sub-Components ---
const InteractiveSentence = ({ tokens, stagedChanges, toggleLemmaStage }) => {
    return (
        <div className="flex flex-wrap justify-center gap-3 text-3xl md:text-4xl leading-relaxed font-arabic" dir="rtl">
            {tokens.map((t, idx) => {
                // Staged changes win over the database state; a missing key means untouched.
                const lemmaId = t.lemma?.lemma_id;
                const isKnown = stagedChanges[lemmaId] ?? t.lemma?.known ?? false;

                return (
                    <div key={idx} className="relative inline-block group">
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                if (t.lemma) toggleLemmaStage(lemmaId, isKnown);
                            }}
                            className={`
                                relative px-1 cursor-pointer transition-all duration-300 select-none
                                ${isKnown ? 'text-emerald-300' : 'text-rose-400'}
                                ${t.lemma 
                                    ? (isKnown 
                                        ? 'hover:text-emerald-200 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                                        : 'hover:text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]')
                                    : 'text-rose-400/50 opacity-70'
                                }
                            `}
                            style={t.lemma ? {
                                filter: `drop-shadow(0 0 ${isKnown ? '1px rgba(52, 211, 153, 0.4)' : '1px rgba(251, 113, 133, 0.4)'})`
                            } : {}}
                        >
                            {t.text}
                        </span>

                        {t.lemma && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                                <div className="bg-slate-800 text-xs rounded-lg shadow-xl border border-slate-700 p-2 min-w-[120px] text-center">
                                    <div className="font-bold text-indigo-400 mb-0.5">
                                        {t.lemma.plaintext}
                                    </div>
                                    <Gloss text={t.lemma.translation} />
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const FlashcardEditor = () => {
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
    
    const [slideDirection, setSlideDirection] = useState('none');
    const [isAnimating, setIsAnimating] = useState(false);

    const [words, setWords] = useState([]);
    const [lemmas, setLemmas] = useState([]);
    const [wordInstances, setWordInstances] = useState([]);

    // Stores manual toggles for the CURRENT card only.
    // Structure: { [lemmaId]: boolean }
    // If a key is missing, it means it hasn't been touched (use DB state).
    const [stagedChanges, setStagedChanges] = useState({});

    useEffect(() => {
        const fetchCards = async () => {
            try {
                setLoading(true);
                const [sRes, wRes, lRes, iRes] = await Promise.all([
                    fetch(`${API_BASE}/api/sentences`),
                    fetch(`${API_BASE}/api/words`),
                    fetch(`${API_BASE}/api/lemmas`),
                    fetch(`${API_BASE}/api/word-instances`)
                ]);

                const [sData, wData, lData, iData] = await Promise.all([
                    sRes.json(), wRes.json(), lRes.json(), iRes.json()
                ]);

                const validCards = sData.filter(s => s.complete);
                setCards(validCards);

                setWords(wData);
                setLemmas(lData);
                setWordInstances(iData);
            } catch (err) {
                console.error("Failed to load flashcards:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCards();
    }, []);

    // Reset staged changes when card index changes
    useEffect(() => {
        setStagedChanges({});
        setIsFlipped(false);
    }, [currentIndex]);

    const tokens = cards[currentIndex] ? sentenceLemmas(cards[currentIndex], words, lemmas, wordInstances) : [];

    const toggleLemmaStage = (lemmaId, currentKnownStatus) => {
        setStagedChanges(prev => ({
            ...prev,
            [lemmaId]: !currentKnownStatus
        }));
    };

    const persistChanges = async (updates) => {
        // updates is an array of { id, known }
        if (updates.length === 0) return;

        // 1. Update Backend
        await Promise.all(
            updates.map(({ id, known }) =>
                fetch(`${API_BASE}/api/set-known/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ known })
                }).catch(err => console.error(`Failed to save lemma ${id}:`, err))
            )
        );

        // 2. Update Frontend State (Lemmas)
        setLemmas(prev => prev.map(l => {
            const update = updates.find(u => u.id === l.lemma_id);
            return update ? { ...l, known: update.known } : l;
        }));
    };

    const changeCard = (direction) => {
        if (isAnimating || cards.length === 0) return;
        setIsAnimating(true);
        setSlideDirection(direction === 'next' ? 'next-out' : 'prev-out');

        setTimeout(() => {
            // NOTE: We do NOT save on simple navigation (Prev/Next), we just reset.
            setCurrentIndex(prev =>
                direction === 'next'
                    ? (prev + 1) % cards.length
                    : (prev - 1 + cards.length) % cards.length
            );

            setSlideDirection(direction === 'next' ? 'next-in-start' : 'prev-in-start');

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setSlideDirection(direction === 'next' ? 'next-in-end' : 'prev-in-end');
                    setTimeout(() => {
                        setSlideDirection('none');
                        setIsAnimating(false);
                    }, 300);
                });
            });
        }, 300);
    };

    // --- Button Logic ---

    // HARD: Submit only what was manually staged
    const handleHard = async () => {
        const changesToSubmit = Object.entries(stagedChanges).map(([idStr, val]) => ({
            id: Number(idStr),
            known: val
        }));

        await persistChanges(changesToSubmit);
        
        setSessionStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
        changeCard('next');
    };

    // EASY: Ignore staged changes, mark every unknown lemma in the sentence known.
    const handleEasy = async () => {
        const unknownIds = new Set(
            tokens.filter(t => t.lemma && !t.lemma.known).map(t => t.lemma.lemma_id)
        );
        await persistChanges([...unknownIds].map(id => ({ id, known: true })));

        setSessionStats(prev => ({ 
            reviewed: prev.reviewed + 1, 
            correct: prev.correct + 1 
        }));
        changeCard('next');
    };

    const handleNext = () => changeCard('next');
    const handlePrev = () => changeCard('prev');

    if (loading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-slate-500 animate-pulse">
                <Loader className="w-8 h-8 mb-4 animate-spin text-indigo-500" />
                <p>Loading your deck...</p>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 opacity-50" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">No Cards Available</h2>
                <p className="max-w-md mx-auto">
                    You don't have any complete sentences yet. 
                    Go to the <strong>Library</strong> and complete sentence translations to build your deck.
                </p>
            </div>
        );
    }

    const currentCard = cards[currentIndex];

    let transformClass = "translate-x-0 opacity-100";
    let durationClass = "duration-300";

    if (slideDirection === 'next-out') {
        transformClass = "-translate-x-[120%] opacity-0 rotate-[-5deg]";
    } else if (slideDirection === 'prev-out') {
        transformClass = "translate-x-[120%] opacity-0 rotate-[5deg]";
    } else if (slideDirection === 'next-in-start') {
        transformClass = "translate-x-[120%] opacity-0";
        durationClass = "duration-0";
    } else if (slideDirection === 'prev-in-start') {
        transformClass = "-translate-x-[120%] opacity-0";
        durationClass = "duration-0";
    } else if (slideDirection === 'next-in-end' || slideDirection === 'prev-in-end') {
        transformClass = "translate-x-0 opacity-100";
    }

    return (
        <div className="h-full flex flex-col items-center max-w-4xl mx-auto py-4 space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
            
            <div className="w-full flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>
                <div className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    Session: {sessionStats.correct}/{sessionStats.reviewed}
                </div>
            </div>

            <div className="w-full relative perspective-1000">
                <div 
                    key={currentIndex}
                    className={`transition-all ease-out ${durationClass} ${transformClass}`}
                >
                    <div 
                        className={`
                            relative w-full aspect-[16/10] md:aspect-[2/1] transform-style-3d cursor-pointer
                            transition-all duration-300
                            ${isFlipped ? 'rotate-y-180' : ''}
                        `}
                        onClick={() => !isAnimating && setIsFlipped(prev => !prev)}
                    >
                        <div className="absolute inset-0 backface-hidden group">
                            <div className="h-full w-full bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 md:p-12 hover:border-indigo-500/30 transition-colors">
                                <span className="absolute top-6 left-6 text-[10px] font-bold tracking-widest text-slate-600 uppercase">
                                    Arabic
                                </span>
                                
                                <h2 className="text-4xl md:text-6xl font-arabic text-white text-center leading-relaxed drop-shadow-lg">
                                    {currentCard.plaintext}
                                </h2>

                                <div className="absolute bottom-6 flex items-center gap-2 text-slate-600 text-xs font-medium opacity-50 group-hover:opacity-100 transition-opacity">
                                    <RotateCw className="w-3 h-3" /> Click to flip
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 backface-hidden rotate-y-180">
                            <div className="h-full w-full bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-900/10 flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden">
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                
                                <span className="absolute top-6 left-6 text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                                    Analysis & Translation
                                </span>

                                <div className="mb-8 w-full">
                                    <InteractiveSentence
                                        tokens={tokens}
                                        stagedChanges={stagedChanges}
                                        toggleLemmaStage={toggleLemmaStage}
                                    />
                                </div>

                                <div className="relative">
                                    <div className="absolute -inset-4 bg-indigo-500/5 blur-lg rounded-full"></div>
                                    <p className="relative text-xl md:text-2xl text-indigo-100 font-medium text-center max-w-2xl leading-relaxed">
                                        "{currentCard.translation}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 md:gap-12">
                <button 
                    onClick={(e) => { e.stopPropagation(); handleHard(); }}
                    disabled={isAnimating}
                    className="flex flex-col items-center gap-2 group disabled:opacity-50"
                >
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-rose-500 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-rose-500 group-hover:text-white group-hover:-translate-y-1 group-active:scale-95">
                        <ThumbsDown className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-rose-500 transition-colors">Hard</span>
                </button>

                <div className="flex gap-2">
                    <button 
                        onClick={handlePrev}
                        disabled={isAnimating}
                        className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleNext}
                        disabled={isAnimating}
                        className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); handleEasy(); }}
                    disabled={isAnimating}
                    className="flex flex-col items-center gap-2 group disabled:opacity-50"
                >
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-500 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:-translate-y-1 group-active:scale-95">
                        <ThumbsUp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Easy</span>
                </button>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};

export default FlashcardEditor;