import React, { useState, useRef, useEffect } from 'react';
import { SquarePen, SendHorizontal, Copy, Check, Languages, BookmarkPlus, RotateCw, Loader, SquareArrowOutUpRight } from 'lucide-react';
import { InteractiveSentence } from './InteractiveSentence';

const API_BASE = process.env.REACT_APP_API_URL || '';

const IconButton = ({ label, onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="inline-flex items-center justify-center gap-2 min-h-10 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
  >
    {children}<span>{label}</span>
  </button>
);

const TutorMessage = ({ message, known, onToggle, onViewSentence }) => {
  const [showEnglish, setShowEnglish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState(null); // the new flashcard's sentence, once saved
  const [armed, setArmed] = useState(false); // several flashcards: clicked once, the next click adds them
  // Unknown words as the chat shows them: each gets a flashcard (none: one for the message's rarest word)
  const unknown = [...new Set(message.tokens.filter(t => t.lemma && !(known[t.lemma.lemma_id] ?? t.lemma.known)).map(t => t.lemma.lemma_id))];

  const copy = async () => {
    await navigator.clipboard.writeText(message.arabic);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveFlashcard = async () => {
    if (unknown.length > 1 && !armed) return setArmed(true);
    setArmed(false);
    const res = await fetch(`${API_BASE}/api/tutor/flashcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, targets: unknown })
    });
    if (res.ok) setSavedId((await res.json()).sentence_id);
  };

  return (
    <div className="flex flex-col items-start max-w-full sm:max-w-[90%]">
      <div className="tutor-message bg-slate-950 border border-slate-800 rounded-2xl px-5 sm:px-7 py-6">
        <InteractiveSentence
          tokens={message.tokens}
          known={known}
          onToggle={onToggle}
          className="gap-x-1.5 text-2xl leading-[1.9]"
        />
        {showEnglish && <p className="mt-2 pt-2 border-t border-slate-800 text-base leading-relaxed text-slate-300">{message.english}</p>}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        <IconButton label="Translation" onClick={() => setShowEnglish(s => !s)}>
          <Languages className={`w-4 h-4 ${showEnglish ? 'text-indigo-400' : ''}`} />
        </IconButton>
        <IconButton label="Copy" onClick={copy}>
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </IconButton>
        {savedId
          ? <IconButton label="View flashcard" onClick={() => onViewSentence?.(savedId)}><SquareArrowOutUpRight className="w-4 h-4 text-emerald-400" /></IconButton>
          : <button onClick={saveFlashcard} onMouseLeave={() => setArmed(false)} title={unknown.length > 1 ? `Save as ${unknown.length} flashcards` : 'Save as flashcard'}
                    className={`inline-flex items-center justify-center gap-1.5 min-w-[12rem] p-2.5 rounded-lg text-sm transition-colors ${armed ? 'bg-indigo-600 text-on-primary px-2.5' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}>
              <BookmarkPlus className="w-4 h-4" /><span className={armed ? 'hidden' : ''}>Save as flashcard</span>{armed && `Add ${unknown.length} flashcards?`}
            </button>}
      </div>
    </div>
  );
};

// onReply: called whenever a tutor message arrives (the app highlights the Tutor tab if you're elsewhere)
// onViewSentence: open a saved flashcard in the Library
const TutorView = ({ onReply, onViewSentence }) => {
  const [scenario, setScenario] = useState('');
  const [messages, setMessages] = useState([]); // {role: 'tutor', arabic, english, tokens} | {role: 'user', text}
  const [known, setKnown] = useState({}); // lemma_id -> known, for toggles made in this chat
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);
  const [chatId, setChatId] = useState(0);
  const chatRef = useRef(0); // responses from an abandoned chat are dropped
  const endRef = useRef(null);

  const request = async (history, currentScenario) => {
    const chat = chatRef.current;
    setWaiting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: currentScenario,
          messages: history.map(({ role, text, arabic, english }) => ({ role, text, arabic, english }))
        })
      });
      const data = await res.json();
      if (chat !== chatRef.current) return;
      if (!res.ok) throw new Error(data.error);
      setScenario(data.scenario);
      setMessages([...history, { role: 'tutor', arabic: data.arabic, english: data.english, tokens: data.tokens }]);
      onReply?.();
    } catch (err) {
      if (chat === chatRef.current) setError(err.message || 'Error');
    } finally {
      if (chat === chatRef.current) setWaiting(false);
    }
  };

  useEffect(() => {
    chatRef.current += 1;
    setScenario('');
    setMessages([]);
    setKnown({});
    setError(null);
    request([], '');
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, waiting, error]);

  const send = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || waiting) return;
    const history = [...messages, { role: 'user', text }];
    setMessages(history);
    setInput('');
    request(history, scenario);
  };

  const toggleKnown = (lemmaId, isKnown) => {
    setKnown(k => ({ ...k, [lemmaId]: !isKnown }));
    fetch(`${API_BASE}/api/set-known/${lemmaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ known: !isKnown })
    }).catch(err => console.error(`Failed to save lemma ${lemmaId}:`, err));
  };

  return (
    <div className="tutor-view max-w-4xl mx-auto flex flex-col">
      <div className="flex flex-wrap items-start gap-4 pb-4 border-b border-slate-700">
        <div className="flex-1 min-w-0"><h1 className="page-heading">Tutor</h1><p className="page-description">Practise Arabic through conversation.</p><p className="mt-3 text-sm leading-relaxed text-accent min-h-[1.25rem]">{scenario}</p></div>
        <IconButton label="New chat" onClick={() => setChatId(id => id + 1)}>
          <SquarePen className="w-5 h-5" />
        </IconButton>
      </div>

      {messages.some(m => m.role === 'tutor') && <div className="state-legend pt-3"><span><i className="legend-swatch bg-emerald-500" aria-hidden="true" />Known word</span><span><i className="legend-swatch bg-rose-500" aria-hidden="true" />Unknown word</span></div>}
      <div className="conversation-surface flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-6 pt-6 pb-5 pr-2">
        {messages.map((m, i) => m.role === 'tutor'
          ? <TutorMessage key={i} message={m} known={known} onToggle={toggleKnown} onViewSentence={onViewSentence} />
          : (
            <div key={i} dir="auto" className="self-end max-w-[90%] break-words bg-indigo-600 text-on-primary font-arabic text-xl rounded-2xl rounded-tr-sm px-5 py-3">
              {m.text}
            </div>
          )
        )}
        {waiting && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center text-slate-400">
            <Loader className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="whitespace-pre-line leading-relaxed">{'Loading a new conversation.\nThis might take a minute.'}</p>
          </div>
        )}
        {waiting && messages.length > 0 && (
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 w-fit">
            {[0, 150, 300].map(delay => (
              <span key={delay} className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-400">
            {error}
            <IconButton label="Retry" onClick={() => request(messages, scenario)}>
              <RotateCw className="w-4 h-4" />
            </IconButton>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex shrink-0 gap-2 pt-4 border-t border-slate-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="auto"
          placeholder="اكتب…"
          aria-label="Message your tutor"
          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-arabic text-[22px] leading-relaxed text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || waiting}
          aria-label="Send"
          className="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-on-primary transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
        >
          <SendHorizontal className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default TutorView;
