import React from 'react';
import Gloss from './Gloss';

// A sentence whose words show known (green) / unknown (red); click a word to toggle it, hover for its lemma
export const InteractiveSentence = ({ tokens, known = {}, onToggle, className = "justify-center gap-3 text-3xl md:text-4xl" }) => {
    return (
        <div className={`flex flex-wrap leading-relaxed font-arabic ${className}`} dir="rtl">
            {tokens.map((t, idx) => {
                // `known` overrides the lemma's loaded state (the tutor's toggles); a missing key means untouched
                const lemmaId = t.lemma?.lemma_id;
                const isKnown = known[lemmaId] ?? t.lemma?.known ?? false;

                return (
                    <div key={idx} className="relative inline-block group">
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                if (t.lemma) onToggle(lemmaId, isKnown);
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

