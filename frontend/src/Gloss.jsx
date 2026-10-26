import React from 'react';

// Lexicon glosses use Buckwalter/SAMA notation:
//   #  separates glosses of different forms merged into one lemma (e.g. "books#book")
//   ;  separates synonyms          _  is a space
//   _+_ joins a clitic's gloss to the word's ("with/by_+_it") - a fused form, not the lemma itself
//   [masc.sg.] etc. are grammatical tags
export const formatGloss = (gloss) => {
  const parts = (gloss || '').split('#');
  const plain = parts.filter(p => !p.includes('+'));
  const senses = (plain.length ? plain : parts).map(p => p
    .replace(/\[[^\]]*\]/g, '')
    .replace(/_/g, ' ')
    .replace(/;/g, ', ')
    .replace(/^[\s+]+|[\s+]+$/g, '')
    .replace(/\s+/g, ' '));
  return [...new Set(senses)].filter(Boolean).join('; ');
};

// mx-auto: a w-max block ignores text-align, so centre it explicitly (it otherwise hugs the right inside RTL text)
const Gloss = ({ text }) => (
  <div dir="ltr" className="whitespace-normal w-max max-w-xs mx-auto text-slate-300">
    {formatGloss(text) || <span className="text-slate-500 italic">No translation</span>}
  </div>
);

export default Gloss;
