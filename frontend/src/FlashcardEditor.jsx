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

const API_BASE = process.env.REACT_APP_API_URL || '';

// --- Helpers (Reused logic) ---
const stripDiacritics = (text) => {
    if (!text) return "";
    return text
        .normalize('NFD')
        .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
        .replace(/[؟،!.,;:]/g, ''); 
};

// --- Sub-Components ---

const InteractiveSentence = ({ sentence, words, roots, wordInstances }) => {
    // Removed unused state highlightedWordId

    const tokens = sentence.plaintext.split(' ').map((token, index) => {
        const explicitLink = wordInstances.find(i => i.sentence_id === sentence.sentence_id && i.index === index);
        let match = null;
        let status = 'missing'; // eslint-disable-line no-unused-vars

        if (explicitLink) {
            match = words.find(w => w.word_id === explicitLink.word_id);
            if (match) status = 'linked';
        } else {
            const cleanToken = token.replace(/[؟،!.,;:]/g, '');
            match = words.find(w => w.plaintext === cleanToken || w.plaintext === token);
            if (match) {
                status = 'exact';
            } else {
                const prunedToken = stripDiacritics(cleanToken);
                const fuzzyMatches = words.filter(w => w.prune === prunedToken);
                if (fuzzyMatches.length === 1) {
                    match = fuzzyMatches[0];
                    status = 'inferred';
                }
            }
        }

        const rootData = match ? roots.find(r => r.root_id === match.root_id) : null;
        return { text: token, match, rootData };
    });

    return (
        <div className="flex flex-wrap justify-center gap-3 text-3xl md:text-4xl leading-relaxed font-arabic text-white" dir="rtl">
            {tokens.map((t, idx) => (
                <div key={idx} className="relative group">
                    <span 
                        className={`
                            px-1 rounded-md transition-colors duration-200 cursor-help
                            ${t.match ? 'hover:text-indigo-300' : ''}
                        `}
                    >
                        {t.text}
                    </span>
                    
                    {/* Tooltip */}
                    {t.match && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-20">
                            <div className="bg-slate-800 text-xs rounded-lg shadow-xl border border-slate-700 p-2 min-w-[100px] text-center">
                                <div className="font-bold text-indigo-400 mb-0.5">{t.rootData?.plaintext || 'No Root'}</div>
                                <div className="text-slate-300">{t.rootData?.translation}</div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const FlashcardEditor = () => {
    // State
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState([]); // These will be the 'complete' sentences
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
    
    // Animation State
    const [slideDirection, setSlideDirection] = useState('none'); // 'none', 'next-out', 'next-in', 'prev-out', 'prev-in'
    const [isAnimating, setIsAnimating] = useState(false);

    // Data for interactive back
    const [words, setWords] = useState([]);
    const [roots, setRoots] = useState([]);
    const [wordInstances, setWordInstances] = useState([]);

    useEffect(() => {
        const fetchCards = async () => {
            try {
                setLoading(true);
                const [sRes, wRes, rRes, iRes] = await Promise.all([
                    fetch(`${API_BASE}/api/sentences`),
                    fetch(`${API_BASE}/api/words`),
                    fetch(`${API_BASE}/api/roots`),
                    fetch(`${API_BASE}/api/word-instances`)
                ]);
                
                const [sData, wData, rData, iData] = await Promise.all([
                    sRes.json(), wRes.json(), rRes.json(), iRes.json()
                ]);

                // Filter for COMPLETE sentences only
                const validCards = sData.filter(s => s.complete);
                setCards(validCards);
                
                setWords(wData);
                setRoots(rData);
                setWordInstances(iData);
            } catch (err) {
                console.error("Failed to load flashcards:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCards();
    }, []);

    const changeCard = (direction) => {
    if (isAnimating) return;
    setIsAnimating(true);

    // 1. Slide OUT (without resetting flip yet)
    setSlideDirection(direction === 'next' ? 'next-out' : 'prev-out');

    setTimeout(() => {
        // Reset flip AFTER out animation, so back shows during out if it was flipped
        setIsFlipped(false);

        // 2. Change Index (while hidden/offscreen)
        if (direction === 'next') {
            setCurrentIndex((prev) => (prev + 1) % cards.length);
        } else {
            setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
        }
        
        // 3. Prepare to Slide IN
        // We set it to the 'start' position of the IN animation
        setSlideDirection(direction === 'next' ? 'next-in-start' : 'prev-in-start');

        // Small delay to allow React to render the new card at the start position (invisible/offscreen)
        // before we transition it to the center.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                 setSlideDirection(direction === 'next' ? 'next-in-end' : 'prev-in-end');
                 
                 // 4. Cleanup after animation
                 setTimeout(() => {
                     setSlideDirection('none');
                     setIsAnimating(false);
                 }, 300); // Duration of the IN animation
            });
        });

    }, 300); // Duration of the OUT animation
};
    
    const handleNext = () => changeCard('next');
    const handlePrev = () => changeCard('prev');

    const handleRate = (isCorrect) => {
        setSessionStats(prev => ({
            reviewed: prev.reviewed + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
        }));
        handleNext();
    };

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

    // Determine animation styles based on state
    let transformClass = "translate-x-0 opacity-100";
    let durationClass = "duration-300"; // Default duration

    if (slideDirection === 'next-out') {
        transformClass = "-translate-x-[120%] opacity-0 rotate-[-5deg]";
    } else if (slideDirection === 'prev-out') {
        transformClass = "translate-x-[120%] opacity-0 rotate-[5deg]";
    } else if (slideDirection === 'next-in-start') {
        transformClass = "translate-x-[120%] opacity-0"; // Start from right
        durationClass = "duration-0"; // Snap instantly
    } else if (slideDirection === 'prev-in-start') {
        transformClass = "-translate-x-[120%] opacity-0"; // Start from left
        durationClass = "duration-0";
    } else if (slideDirection === 'next-in-end' || slideDirection === 'prev-in-end') {
        transformClass = "translate-x-0 opacity-100"; // Slide to center
    }

    return (
        <div className="h-full flex flex-col items-center max-w-4xl mx-auto py-4 space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
            
            {/* Header Stats */}
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

            {/* Main Card Area */}
            <div className="w-full relative group perspective-1000">
                <div 
                    key={currentIndex}
                    className={`
                        transition-all ease-out ${durationClass} ${transformClass}
                    `}
                > {/* New slide wrapper: handles translate/opacity */}
                    <div 
                        className={`
                            relative w-full aspect-[16/10] md:aspect-[2/1] transform-style-3d cursor-pointer
                            transition-all duration-300  // Keep flip duration separate
                            ${isFlipped ? 'rotate-y-180' : ''}
                        `}
                        onClick={() => !isAnimating && setIsFlipped(!isFlipped)}
                    >
                        {/* FRONT */}
                        <div className="absolute inset-0 backface-hidden">
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

                        {/* BACK */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180">
                            <div className="h-full w-full bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-900/10 flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden">
                                {/* Decorative background blob */}
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                
                                <span className="absolute top-6 left-6 text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                                    Analysis & Translation
                                </span>

                                {/* Interactive Arabic Sentence */}
                                <div className="mb-8 w-full">
                                    <InteractiveSentence 
                                        sentence={currentCard} 
                                        words={words} 
                                        roots={roots} 
                                        wordInstances={wordInstances} 
                                    />
                                </div>

                                {/* Translation */}
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

            {/* Controls */}
            <div className="flex items-center gap-6 md:gap-12">
                <button 
                    onClick={(e) => { e.stopPropagation(); handleRate(false); }}
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
                    onClick={(e) => { e.stopPropagation(); handleRate(true); }}
                    disabled={isAnimating}
                    className="flex flex-col items-center gap-2 group disabled:opacity-50"
                >
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-500 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:-translate-y-1 group-active:scale-95">
                        <ThumbsUp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Easy</span>
                </button>
            </div>

            {/* Styles for 3D Flip */}
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