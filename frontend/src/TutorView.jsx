import React, { useMemo, useState } from 'react';
import {
  GraduationCap,
  Plus,
  History as HistoryIcon,
  Search,
  X,
  Copy,
  BookmarkPlus,
  Send,
  Volume2,
  Check,
  MessageCircle
} from 'lucide-react';

const dictionary = {
  أريد: {
    arabic: 'أريد',
    transliteration: 'urīdu',
    meaning: 'I want / I would like',
    root: 'ر و د'
  },
  قائمة: {
    arabic: 'قائمة',
    transliteration: 'qāʾimah',
    meaning: 'list / menu',
    root: 'ق و م'
  },
  الطعام: {
    arabic: 'الطعام',
    transliteration: 'al-ṭaʿām',
    meaning: 'food',
    root: 'ط ع م'
  },
  من: {
    arabic: 'من',
    transliteration: 'min',
    meaning: 'from',
    root: '—'
  },
  فضلك: {
    arabic: 'فضلك',
    transliteration: 'faḍlik',
    meaning: 'your favor / please',
    root: 'ف ض ل'
  },
  ماذا: {
    arabic: 'ماذا',
    transliteration: 'mādhā',
    meaning: 'what',
    root: '—'
  },
  توصي: {
    arabic: 'توصي',
    transliteration: 'tūṣī',
    meaning: 'you recommend',
    root: 'و ص ي'
  }
};

const conversations = [
  {
    id: 1,
    title: 'Ordering food',
    preview: 'Can you help me order food...',
    date: 'Today'
  },
  {
    id: 2,
    title: 'Arabic greetings',
    preview: 'Common greetings and introductions',
    date: 'Sep 28'
  },
  {
    id: 3,
    title: 'At the airport',
    preview: 'Travel vocabulary',
    date: 'Sep 25'
  },
  {
    id: 4,
    title: 'At home',
    preview: 'Daily life conversation',
    date: 'Sep 20'
  },
  {
    id: 5,
    title: 'Shopping',
    preview: 'Useful phrases',
    date: 'Sep 18'
  }
];

const tutorMessages = [
  {
    id: 1,
    intro: "Of course! Here's a useful phrase to order food at a restaurant.",
    words: [
      { text: 'أريد', state: 'known' },
      { text: 'قائمة', state: 'normal' },
      { text: 'الطعام', state: 'unknown' },
      { text: 'من', state: 'normal' },
      { text: 'فضلك', state: 'normal', punctuation: '.' }
    ],
    translation: 'I would like the menu, please.'
  },
  {
    id: 2,
    intro: 'You can also say:',
    words: [
      { text: 'ماذا', state: 'known' },
      { text: 'توصي', state: 'unknown', punctuation: '؟' }
    ],
    translation: 'What do you recommend?'
  }
];

const wordClasses = {
  known: 'text-emerald-300',
  unknown: 'text-rose-300',
  normal: 'text-slate-100'
};

const TutorView = () => {
  const [historyOpen, setHistoryOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWord, setSelectedWord] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState([
    'Can you help me order food at a restaurant?'
  ]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(query) ||
        conversation.preview.toLowerCase().includes(query)
    );
  }, [search]);

  const sentenceText = (message) =>
    message.words
      .map((word) => `${word.text}${word.punctuation || ''}`)
      .join(' ');

  const speakArabic = (text) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-AE';
    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);
  };

  const copySentence = async (message) => {
    const text = `${sentenceText(message)}\n${message.translation}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(message.id);

      setTimeout(() => {
        setCopiedMessage(null);
      }, 1500);
    } catch (error) {
      console.error('Unable to copy sentence:', error);
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();

    const message = input.trim();
    if (!message) return;

    setUserMessages((current) => [...current, message]);
    setInput('');
  };

  const newChat = () => {
    setUserMessages([]);
    setSelectedWord(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] min-h-[680px] flex overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">

      {/* Tutor conversation history panel */}
      {historyOpen && (
        <aside className="w-80 shrink-0 border-r border-slate-800 bg-slate-900/80 flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">
                Conversations
              </h2>

              <button
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close conversation history"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={newChat}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shadow-lg shadow-indigo-950/30"
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="p-3 overflow-y-auto custom-scrollbar">
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent
            </p>

            <div className="space-y-1">
              {filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.id}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    index === 0
                      ? 'bg-indigo-500/10 border-indigo-500/40'
                      : 'border-transparent hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex gap-3">
                    <MessageCircle className="w-5 h-5 mt-1 shrink-0 text-slate-400" />

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <p className="font-semibold text-sm text-slate-100 truncate">
                          {conversation.title}
                        </p>

                        <span className="text-xs text-slate-500 shrink-0">
                          {conversation.date}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {conversation.preview}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Main tutor */}
      <section className="min-w-0 flex-1 flex flex-col">

        {/* Header */}
        <header className="h-20 shrink-0 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-white">
                AI Tutor
              </h1>
              <p className="text-xs text-slate-500">
                Arabic learning assistant
              </p>
            </div>
          </div>

          <button
            onClick={() => setHistoryOpen((current) => !current)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <HistoryIcon className="w-4 h-4" />
            History
          </button>
        </header>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6"
          onClick={() => setSelectedWord(null)}
        >
          <div className="max-w-4xl mx-auto space-y-5">

            {userMessages.length > 0 && (
              <div className="flex justify-end">
                <div className="max-w-[70%] bg-indigo-600 text-white px-5 py-3.5 rounded-2xl rounded-tr-md shadow-lg shadow-indigo-950/20">
                  {userMessages[0]}
                </div>
              </div>
            )}

            {tutorMessages.map((message) => (
              <div key={message.id} className="flex gap-3 items-start">
                <div className="w-9 h-9 shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mt-1">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                </div>

                <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-md px-5 py-4 shadow-lg shadow-black/10">
                  <p className="text-sm text-slate-300 mb-4">
                    {message.intro}
                  </p>

                  {/* Arabic interactive sentence */}
                  <div
                    dir="rtl"
                    className="font-arabic text-3xl leading-[2.2] text-right"
                  >
                    {message.words.map((word, index) => {
                      const details = dictionary[word.text];
                      const isSelected = selectedWord === `${message.id}-${index}`;

                      return (
                        <span
                          key={`${message.id}-${word.text}-${index}`}
                          className="relative inline-block"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedWord(
                                isSelected ? null : `${message.id}-${index}`
                              );
                            }}
                            className={`px-1 rounded-md transition hover:bg-indigo-500/10 ${
                              wordClasses[word.state]
                            } ${
                              isSelected
                                ? 'bg-indigo-500/15 ring-1 ring-indigo-400'
                                : ''
                            }`}
                          >
                            {word.text}
                            {word.punctuation || ''}
                          </button>

                          {/* Dictionary popup anchored to clicked word */}
                          {isSelected && details && (
                            <div
                              dir="ltr"
                              onClick={(event) => event.stopPropagation()}
                              className="absolute z-50 bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-64 rounded-2xl border border-indigo-500/50 bg-slate-900 shadow-2xl shadow-black/50 p-4 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p
                                    dir="rtl"
                                    className="font-arabic text-2xl text-white leading-normal"
                                  >
                                    {details.arabic}
                                  </p>

                                  <p className="text-sm text-slate-400 mt-1">
                                    {details.transliteration}
                                  </p>
                                </div>

                                <button
                                  onClick={() => speakArabic(details.arabic)}
                                  className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                                  aria-label="Play pronunciation"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-4">
                                <p className="text-xs uppercase tracking-wider text-slate-500">
                                  Meaning
                                </p>

                                <p className="mt-1 text-base text-slate-100">
                                  {details.meaning}
                                </p>
                              </div>

                              <div className="border-t border-slate-700 mt-4 pt-3 flex items-center justify-between">
                                <span className="text-sm text-slate-500">
                                  Root
                                </span>

                                <span
                                  dir="rtl"
                                  className="font-arabic text-xl text-slate-100"
                                >
                                  {details.root}
                                </span>
                              </div>

                              <div className="absolute left-1/2 -bottom-2 w-4 h-4 bg-slate-900 border-r border-b border-indigo-500/50 rotate-45 -translate-x-1/2" />
                            </div>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-base text-slate-400">
                    {message.translation}
                  </p>

                  {/* Sentence actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => speakArabic(sentenceText(message))}
                      className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      aria-label="Play sentence"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => copySentence(message)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      {copiedMessage === message.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>

                    <button
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Sentence-based flashcard integration will be connected next"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      Create Flashcard
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {userMessages.slice(1).map((message, index) => (
              <div
                key={`user-${index}`}
                className="flex justify-end"
              >
                <div className="max-w-[70%] bg-indigo-600 text-white px-5 py-3.5 rounded-2xl rounded-tr-md">
                  {message}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-950/90 p-4">
          <form
            onSubmit={sendMessage}
            className="max-w-4xl mx-auto flex items-center gap-3"
          >
            <div className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 focus-within:border-indigo-500 transition">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a message in English or Arabic..."
                className="w-full bg-transparent px-5 py-4 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim()}
              className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition shadow-lg shadow-indigo-950/30"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default TutorView;