import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Type, 
  Database, 
  Search, 
  Plus, 
  Trash2,
  Save,
  Languages, 
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader,
  ArrowDown,
  Check,
  X
} from 'lucide-react';

// --- Components ---

const FrequencyBar = ({ value }) => {
  const bars = 5;
  const filledBars = Math.ceil((value / 100) * bars);
  return (
    <div className="flex gap-1 items-center" title={`Frequency: ${value}`}>
      {[...Array(bars)].map((_, i) => (
        <div key={i} className={`h-4 w-1.5 rounded-sm transition-all ${i < filledBars ? 'bg-indigo-400' : 'bg-slate-700/50'}`} />
      ))}
    </div>
  );
};

const Tooltip = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-50 animate-in fade-in zoom-in duration-200">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

const TableRow = ({ data, columns, onClick, isActive, className = "" }) => (
  <tr 
    onClick={onClick}
    className={`
      border-b border-slate-800/50 cursor-pointer transition-colors duration-200
      ${isActive ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-slate-800/50'}
      ${className}
    `}
  >
    {columns.map((col, idx) => (
      <td key={idx} className={`p-4 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.isArabic ? 'font-arabic text-lg' : 'text-slate-300'}`}>
        {col.render ? col.render(data) : data[col.key]}
      </td>
    ))}
  </tr>
);

export default function App() {
  // --- State ---
  // Data
  const [sentences, setSentences] = useState([]);
  const [words, setWords] = useState([]);
  const [roots, setRoots] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sentences');
  const [selectedSentenceId, setSelectedSentenceId] = useState(null);
  const [highlightedWordId, setHighlightedWordId] = useState(null);
  const [translationInput, setTranslationInput] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Staging / Adding Words State
  const [isStaging, setIsStaging] = useState(false);
  const [isProcessingWords, setIsProcessingWords] = useState(false);
  const [stagedWords, setStagedWords] = useState([]);
  const [newRootsCount, setNewRootsCount] = useState(0); // For animation

  // Refs
  const wordRefs = useRef({});
  const rootRefs = useRef({}); // <--- FIXED: Added missing ref definition
  
  // --- Data Fetching ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const [sentencesRes, wordsRes, rootsRes] = await Promise.all([
        fetch('/api/sentences'),
        fetch('/api/words'),
        fetch('/api/roots')
      ]);
      const [sData, wData, rData] = await Promise.all([
        sentencesRes.json(), wordsRes.json(), rootsRes.json()
      ]);
      setSentences(sData);
      setWords(wData);
      setRoots(rData);
      if (sData.length > 0 && !selectedSentenceId) {
        setSelectedSentenceId(sData[0].sentence_id);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Derived State ---
  const selectedSentence = sentences.find(s => s.sentence_id === selectedSentenceId);
  
  const sentenceTokens = selectedSentence 
    ? selectedSentence.plaintext.split(' ').map(token => {
        const wordMatch = words.find(w => w.plaintext === token);
        return {
          text: token,
          wordData: wordMatch,
          rootData: wordMatch ? roots.find(r => r.root_id === wordMatch.root_id) : null
        };
      })
    : [];

  const missingWords = sentenceTokens.filter(t => !t.wordData).map(t => t.text);
  const hasMissingWords = missingWords.length > 0;

  useEffect(() => {
    if (selectedSentence) setTranslationInput(selectedSentence.translation);
  }, [selectedSentenceId, selectedSentence]);

  // --- Animation Effect ---
  useEffect(() => {
    if (newRootsCount > 0) {
      const timer = setTimeout(() => setNewRootsCount(0), 3000); // Reset after 3s
      return () => clearTimeout(timer);
    }
  }, [newRootsCount]);

  // --- Handlers ---

  const handleWordClick = (wordId) => {
    if (!wordId) return;
    setActiveTab('words');
    setHighlightedWordId(wordId);
    setTimeout(() => {
      wordRefs.current[wordId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSentenceSelect = (s) => {
    setSelectedSentenceId(s.sentence_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTranslate = async () => {
    if (!selectedSentence) return;
    setIsTranslating(true);
    try {
      const response = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: selectedSentence.plaintext }),
      });
      const data = await response.json();
      if (data.translatedText) setTranslationInput(data.translatedText);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAddWordsClick = async () => {
    if (missingWords.length === 0) return;
    
    setIsProcessingWords(true);
    try {
      // 1. Get Suggestions
      const response = await fetch('/suggest-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: missingWords })
      });
      const suggestions = await response.json();
      
      // 2. Prepare Staging State
      // Add a 'checked' property to each suggestion for the UI
      setStagedWords(suggestions.map(s => ({ ...s, checked: true })));
      setIsStaging(true);
      
    } catch (err) {
      console.error("Error getting suggestions:", err);
      alert("Failed to get word suggestions.");
    } finally {
      setIsProcessingWords(false);
    }
  };

  const handleToggleStagedWord = (index) => {
    const updated = [...stagedWords];
    updated[index].checked = !updated[index].checked;
    setStagedWords(updated);
  };

  const handleConfirmAddWords = async () => {
    const wordsToAdd = stagedWords.filter(w => w.checked);
    if (wordsToAdd.length === 0) {
      setIsStaging(false);
      return;
    }

    setIsProcessingWords(true);
    try {
      const response = await fetch('/add-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: wordsToAdd })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Server error");
      }

      const result = await response.json();

      if (result.success) {
        // Trigger Success Animation if roots were added
        if (result.new_roots_count > 0) {
          setNewRootsCount(result.new_roots_count);
        }
        
        // Refresh Data
        await fetchData();
        setIsStaging(false);
        setStagedWords([]);
      }
    } catch (err) {
      console.error("Error confirming words:", err);
      alert("Error saving words: " + err.message);
    } finally {
      setIsProcessingWords(false);
    }
  };

  // --- Render Helpers ---

  const renderStagingArea = () => (
    <div className="flex flex-col h-full bg-slate-900/50">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-20">
        <div>
          <h3 className="text-lg font-medium text-white">Review New Words</h3>
          <p className="text-slate-400 text-sm">Uncheck any incorrect suggestions before saving.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsStaging(false)}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirmAddWords}
            disabled={isProcessingWords}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessingWords ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirm & Save
          </button>
        </div>
      </div>
      
      <div className="p-6 overflow-auto custom-scrollbar flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stagedWords.map((item, idx) => (
            <div 
              key={idx}
              className={`
                relative p-4 rounded-xl border transition-all duration-200 cursor-pointer group
                ${item.checked 
                  ? 'bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
                  : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-80'
                }
              `}
              onClick={() => handleToggleStagedWord(idx)}
            >
              {/* Checkbox Overlay */}
              <div className={`
                absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors
                ${item.checked ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}
              `}>
                <Check className="w-4 h-4" />
              </div>

              <div className="space-y-4 pr-8">
                {/* Word Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New Word</div>
                  <div className="text-2xl font-arabic text-slate-200 mb-1" dir="rtl">{item.plaintext}</div>
                  <div className="text-sm text-indigo-300 font-medium">{item.translation}</div>
                </div>
                
                <div className="h-px bg-slate-700/50 w-full" />

                {/* Root Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Root</div>
                  <div className="text-xl font-arabic text-slate-300 mb-1" dir="rtl">{item.root_plaintext}</div>
                  <div className="text-sm text-slate-400">{item.root_translation}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSentenceEditor = () => {
    if (loading && !selectedSentence) {
       return (
        <div className="flex flex-col items-center justify-center h-64 text-indigo-400 border-2 border-dashed border-indigo-900 rounded-xl bg-slate-900/30">
          <Loader className="w-8 h-8 mb-4 animate-spin" />
          <p className="text-lg">Loading data...</p>
        </div>
      );
    }

    if (!selectedSentence) return null;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex justify-between items-center">
             <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Editing Sentence #{selectedSentence.sentence_id}</h2>
          </div>

          {/* Main Text */}
          <div className="bg-slate-950/50 rounded-lg p-8 min-h-[160px] flex items-center justify-center border border-slate-800 shadow-inner" dir="rtl">
            <div className="flex flex-wrap gap-3 text-4xl leading-relaxed font-arabic text-slate-100">
              {sentenceTokens.map((token, idx) => {
                const isFound = !!token.wordData;
                return (
                  <Tooltip 
                    key={idx} 
                    content={
                      <div className="text-center min-w-[80px]">
                        {isFound ? (
                          <>
                            <div className="font-bold text-indigo-300 mb-1">{token.rootData?.plaintext || "No Root"}</div>
                            <div className="text-slate-300">{token.rootData?.translation}</div>
                          </>
                        ) : (
                          <div className="text-rose-400 font-medium flex items-center justify-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Not found
                          </div>
                        )}
                      </div>
                    }
                  >
                    <span
                      onClick={() => handleWordClick(token.wordData?.word_id)}
                      onMouseEnter={() => isFound && setHighlightedWordId(token.wordData.word_id)}
                      onMouseLeave={() => setHighlightedWordId(null)}
                      className={`
                        px-2 py-1 rounded-md transition-all duration-200 relative
                        ${isFound 
                          ? `cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-300 hover:scale-105 hover:-translate-y-1 ${highlightedWordId === token.wordData?.word_id ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50' : ''}`
                          : 'cursor-help text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-400 decoration-rose-500/30'
                        }
                      `}
                    >
                      {token.text}
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          
          {/* Translate Button */}
          <div className="flex justify-center -my-2 z-20">
            <button 
              onClick={handleTranslate}
              disabled={isTranslating}
              className="group flex items-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-4 py-1.5 rounded-full text-xs font-medium transition-all border border-slate-700 hover:border-indigo-500 shadow-sm"
            >
              {isTranslating ? <Loader className="w-3 h-3 animate-spin" /> : <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />}
              {isTranslating ? "Translating..." : "Translate"}
            </button>
          </div>

          {/* Translation Box */}
          <div className="w-full">
            <textarea
              value={translationInput}
              onChange={(e) => setTranslationInput(e.target.value)}
              className="w-full h-[80px] bg-slate-950/30 border border-slate-800 text-slate-300 text-lg rounded-lg p-4 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-600"
              placeholder="Enter translation here..."
            />
          </div>
          
          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/50 mt-2">
             <div className="flex items-center gap-2 text-slate-500 text-xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Hover words for roots, click to find in table</span>
            </div>

            <div className="flex gap-2">
              <button className="flex items-center gap-2 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-400 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              
              <button 
                onClick={handleAddWordsClick}
                disabled={!hasMissingWords || isProcessingWords}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                  ${hasMissingWords && !isProcessingWords
                    ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700 cursor-pointer shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                  }
                `}
              >
                {isProcessingWords ? <Loader className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                Add Words
              </button>
              
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Flashcard Studio</h1>
            <p className="text-slate-500 text-sm">Arabic Language Database</p>
          </div>
        </header>

        {/* Editor */}
        <section>
          {renderSentenceEditor()}
        </section>

        {/* Bottom Section: Tables or Staging Area */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col h-[600px] relative transition-all">
          
          {isStaging ? (
            renderStagingArea()
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                {[
                  { id: 'sentences', label: 'Sentences', icon: Type },
                  { id: 'words', label: 'Words', icon: BookOpen },
                  { id: 'roots', label: 'Roots', icon: Database },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={loading}
                    className={`
                      flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-all relative
                      ${activeTab === tab.id ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
                      ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {/* Success Animation Badge */}
                    {tab.id === 'roots' && newRootsCount > 0 && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 animate-out fade-out duration-[3000ms]">
                        +{newRootsCount}
                      </span>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50">
                {loading && (
                  <div className="flex justify-center items-center h-full text-indigo-400 p-8">
                    <Loader className="w-6 h-6 mr-2 animate-spin" />
                    <p>Loading tables...</p>
                  </div>
                )}
                
                {!loading && (
                  <>
                    {/* Sentences Table */}
                    {activeTab === 'sentences' && (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
                          <tr>
                            {['ID', 'Plaintext', 'Translation', 'Source', 'Length', 'Complete'].map(h => (
                              <th key={h} className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {sentences.map(s => (
                            <TableRow 
                              key={s.sentence_id}
                              isActive={selectedSentenceId === s.sentence_id}
                              onClick={() => handleSentenceSelect(s)}
                              data={s}
                              columns={[
                                { key: 'sentence_id', render: d => <span className="font-mono text-slate-500">#{d.sentence_id}</span> },
                                { key: 'plaintext', isArabic: true },
                                { key: 'translation' },
                                { key: 'source_id', render: d => <span className="font-mono text-slate-400">SRC-{d.source_id}</span> },
                                { key: 'length', render: d => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">{d.length} words</span> },
                                { key: 'complete', render: d => (
                                  <div className="flex items-center gap-2">
                                     {d.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-600" />}
                                    <span className={d.complete ? "text-emerald-500" : "text-slate-600"}>{d.complete ? "Yes" : "No"}</span>
                                  </div>
                                )}
                              ]}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Words Table */}
                    {activeTab === 'words' && (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
                          <tr>
                            {['ID', 'Root ID', 'Plaintext', 'Translation', 'Freq', 'Known'].map(h => (
                              <th key={h} className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {words.map(w => (
                            <tr 
                              key={w.word_id}
                              ref={el => wordRefs.current[w.word_id] = el}
                              className={`
                                border-b border-slate-800/50 transition-colors duration-500
                                ${highlightedWordId === w.word_id ? 'bg-indigo-500/20' : 'hover:bg-slate-800/30'}
                              `}
                            >
                              <td className="p-4 text-sm font-mono text-slate-500">#{w.word_id}</td>
                              <td className="p-4 text-sm font-mono text-indigo-400">R-{w.root_id}</td>
                              <td className="p-4 text-lg font-arabic text-slate-200" dir="rtl">{w.plaintext}</td>
                              <td className="p-4 text-sm text-slate-300">{w.translation}</td>
                              <td className="p-4 text-sm text-slate-400"><FrequencyBar value={w.frequency} /></td>
                              <td className="p-4 text-sm">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${w.known ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {w.known ? 'Known' : 'Learning'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Roots Table */}
                    {activeTab === 'roots' && (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
                          <tr>
                            {['ID', 'Root', 'Translation'].map(h => (
                              <th key={h} className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {roots.map(r => (
                            <tr key={r.root_id} ref={el => rootRefs.current[r.root_id] = el} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 text-sm font-mono text-slate-500">#{r.root_id}</td>
                              <td className="p-4 text-xl font-arabic text-indigo-400" dir="rtl">{r.plaintext}</td>
                              <td className="p-4 text-sm text-slate-300">{r.translation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;700&display=swap');
        .font-arabic { font-family: 'Noto Sans Arabic', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}