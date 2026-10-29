import React, { useState, useRef, useEffect } from 'react';
import { SquarePen, SendHorizontal, Copy, Check, Languages, BookmarkPlus, RotateCw } from 'lucide-react';
import { InteractiveSentence } from './FlashcardEditor';

const API_BASE = process.env.REACT_APP_API_URL || '';

const IconButton = ({ label, onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

const TutorMessage = ({ message, known, onToggle }) => {
  const [showEnglish, setShowEnglish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.arabic);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveFlashcard = async () => {
    const res = await fetch(`${API_BASE}/api/tutor/flashcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    if (res.ok) setSaved(true);
  };

  return (
    <div className="flex flex-col items-start max-w-[85%]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-5 py-3">
        <InteractiveSentence
          tokens={message.tokens}
          stagedChanges={known}
          toggleLemmaStage={onToggle}
          className="gap-x-1.5 text-2xl"
        />
        {showEnglish && <p className="mt-2 pt-2 border-t border-slate-800 text-sm text-slate-400">{message.english}</p>}
      </div>
      <div className="flex gap-0.5 mt-1">
        <IconButton label="Translation" onClick={() => setShowEnglish(s => !s)}>
          <Languages className={`w-4 h-4 ${showEnglish ? 'text-indigo-400' : ''}`} />
        </IconButton>
        <IconButton label="Copy" onClick={copy}>
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </IconButton>
        <IconButton label="Save as flashcard" onClick={saveFlashcard} disabled={saved}>
          {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <BookmarkPlus className="w-4 h-4" />}
        </IconButton>
      </div>
    </div>
  );
};

const TutorView = () => {
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
    <div className="h-[calc(100vh-4rem)] max-w-3xl mx-auto flex flex-col animate-in fade-in duration-300">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
        <p className="flex-1 text-sm italic text-slate-400 min-h-[1.25rem]">{scenario}</p>
        <IconButton label="New chat" onClick={() => setChatId(id => id + 1)}>
          <SquarePen className="w-5 h-5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pt-16 pb-4 pr-2">
        {messages.map((m, i) => m.role === 'tutor'
          ? <TutorMessage key={i} message={m} known={known} onToggle={toggleKnown} />
          : (
            <div key={i} dir="auto" className="self-end max-w-[85%] bg-indigo-600 text-white font-arabic text-xl rounded-2xl rounded-tr-sm px-5 py-3">
              {m.text}
            </div>
          )
        )}
        {waiting && (
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

      <form onSubmit={send} className="flex gap-2 pt-4 border-t border-slate-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="auto"
          placeholder="اكتب…"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-arabic text-lg text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!input.trim() || waiting}
          aria-label="Send"
          className="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
        >
          <SendHorizontal className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default TutorView;
