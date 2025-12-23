import React, { useState, useRef, useEffect, useCallback } from 'react';
import FlashcardEditor from './FlashcardEditor'; // Import the new component
import { 
  BookOpen, 
  Type, 
  Database, 
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
  X,
  CopyPlus,
  HelpCircle,
  Link as LinkIcon,
  Library,     // For Library Icon
  GraduationCap, // For Tutor Icon
  LayoutGrid   // For Flashcards Icon
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || '';

// --- Helpers ---

const stripDiacritics = (text) => {
    if (!text) return "";
    return text
        .normalize('NFD')
        .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
        .replace(/[؟،!.,;:]/g, ''); 
};

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
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-50 animate-in fade-in zoom-in duration-200 pointer-events-none">
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

// --- MAIN LIBRARY COMPONENT (Refactored logic from previous App) ---
const LibraryView = () => {
  // ... (All original state and logic from your previous App component goes here)
  // I will preserve your logic EXACTLY as it was, just scoped to this component.
  
  // Data State
  const [sentences, setSentences] = useState([]);
  const [words, setWords] = useState([]);
  const [roots, setRoots] = useState([]);
  const [wordInstances, setWordInstances] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sentences');
  const [selectedSentenceId, setSelectedSentenceId] = useState(null);
  const [highlightedWordId, setHighlightedWordId] = useState(null);
  const [translationInput, setTranslationInput] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [isEditingSentence, setIsEditingSentence] = useState(false);
  const [editingSentenceText, setEditingSentenceText] = useState("");

  const [isStaging, setIsStaging] = useState(false);
  const [isProcessingWords, setIsProcessingWords] = useState(false);
  const [stagedWords, setStagedWords] = useState([]);
  const [newRootsCount, setNewRootsCount] = useState(0); 
  const [deletedRootsCount, setDeletedRootsCount] = useState(0); 

  const [isEditingWord, setIsEditingWord] = useState(false);
  const [editingWordId, setEditingWordId] = useState(null); 
  const [editingWord, setEditingWord] = useState("");
  const [editingRoot, setEditingRoot] = useState("");
  const [editingWordTrans, setEditingWordTrans] = useState("");
  const [editingRootTrans, setEditingRootTrans] = useState("");
  const [isTranslatingWord, setIsTranslatingWord] = useState(false);

  const [deleteConfirmSentence, setDeleteConfirmSentence] = useState(false);
  const [deleteConfirmWord, setDeleteConfirmWord] = useState(false);
  const [ambiguityModal, setAmbiguityModal] = useState(null);

  const wordRefs = useRef({});
  const rootRefs = useRef({});
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sentencesRes, wordsRes, rootsRes, instanceRes] = await Promise.all([
        fetch(`${API_BASE}/api/sentences`),
        fetch(`${API_BASE}/api/words`),
        fetch(`${API_BASE}/api/roots`),
        fetch(`${API_BASE}/api/word-instances`)
      ]);
      const [sData, wData, rData, iData] = await Promise.all([
        sentencesRes.json(), wordsRes.json(), rootsRes.json(), instanceRes.json()
      ]);
      setSentences(sData);
      setWords(wData);
      setRoots(rData);
      setWordInstances(iData);
      
      if (sData.length > 0) {
        // Logic handled in effect
      } 
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
      if (!loading && sentences.length > 0) {
          if (!selectedSentenceId || !sentences.find(s => s.sentence_id === selectedSentenceId)) {
              setSelectedSentenceId(sentences[0].sentence_id);
          }
      }
  }, [loading, sentences, selectedSentenceId]);

  const selectedSentence = sentences.find(s => s.sentence_id === selectedSentenceId);
  
  const sentenceTokens = selectedSentence 
    ? selectedSentence.plaintext.split(' ').map((token, index) => {
        const explicitLink = wordInstances.find(
            i => i.sentence_id === selectedSentenceId && i.index === index
        );
        if (explicitLink) {
            const linkedWord = words.find(w => w.word_id === explicitLink.word_id);
            if (linkedWord) {
                return {
                    text: token,
                    status: 'linked',
                    wordData: linkedWord,
                    rootData: roots.find(r => r.root_id === linkedWord.root_id),
                    index
                };
            }
        }

        const cleanToken = token.replace(/[؟،!.,;:]/g, ''); 
        const exactMatch = words.find(w => w.plaintext === cleanToken || w.plaintext === token);
        if (exactMatch) {
            return {
                text: token,
                status: 'exact',
                wordData: exactMatch,
                rootData: roots.find(r => r.root_id === exactMatch.root_id),
                index
            };
        }

        const prunedToken = stripDiacritics(cleanToken);
        const fuzzyMatches = words.filter(w => w.prune === prunedToken);

        if (fuzzyMatches.length === 1) {
            const match = fuzzyMatches[0];
            return {
                text: token,
                status: 'inferred',
                wordData: match,
                rootData: roots.find(r => r.root_id === match.root_id),
                index
            };
        } else if (fuzzyMatches.length > 1) {
            return {
                text: token,
                status: 'ambiguous',
                candidates: fuzzyMatches, 
                index
            };
        }

        return {
            text: token,
            cleanText: cleanToken,
            status: 'missing',
            wordData: null,
            rootData: null,
            index
        };
      })
    : [];

  const missingWords = sentenceTokens.filter(t => t.status === 'missing').map(t => t.cleanText || t.text);
  const hasMissingWords = missingWords.length > 0;

  useEffect(() => {
    if (selectedSentence) {
        setTranslationInput(selectedSentence.translation);
        if (isEditingSentence) {
             setEditingSentenceText(selectedSentence.plaintext);
        }
        setDeleteConfirmSentence(false); 
    }
  }, [selectedSentenceId, selectedSentence, isEditingSentence]); 

  useEffect(() => {
    if (newRootsCount > 0) {
      const timer = setTimeout(() => setNewRootsCount(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [newRootsCount]);

  useEffect(() => {
    if (deletedRootsCount > 0) {
      const timer = setTimeout(() => setDeletedRootsCount(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [deletedRootsCount]);

  const handleWordClick = async (token) => {
    const {wordData, text, status, candidates, index} = token;

    if (status === 'ambiguous') {
        setAmbiguityModal({ tokenIndex: index, candidates, tokenText: text });
        return;
    }

    if (wordData) {
      setActiveTab('words');
      setHighlightedWordId(wordData.word_id);
      setTimeout(() => {
        wordRefs.current[wordData.word_id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      setIsEditingWord(true);
      setEditingWordId(null);
      setDeleteConfirmWord(false); 
      setEditingWord(stripDiacritics(text));
      setEditingRoot("");
      setEditingWordTrans("");
      setEditingRootTrans("");

      setIsTranslatingWord(true);
      try {
        const response = await fetch(`${API_BASE}/suggest-words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: [text] })
        });
        const suggestions = await response.json();
        if (suggestions && suggestions.length > 0) {
            const suggestion = suggestions[0];
            if (suggestion.plaintext !== "Error") {
                setEditingWord(suggestion.plaintext); 
                setEditingWordTrans(suggestion.translation);
                setEditingRoot(suggestion.root_plaintext);
                setEditingRootTrans(suggestion.root_translation);
            }
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      } finally {
        setIsTranslatingWord(false);
      }
    }
  };

  const handleTableWordClick = (word) => {
    const root = roots.find(r => r.root_id === word.root_id);
    setIsEditingWord(true);
    setEditingWordId(word.word_id);
    setEditingWord(word.plaintext);
    setEditingRoot(root ? root.plaintext : "");
    setEditingWordTrans(word.translation);
    setEditingRootTrans(root ? root.translation : "");
    setDeleteConfirmWord(false); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSentenceSelect = (s) => {
    setIsEditingSentence(false);
    setSelectedSentenceId(s.sentence_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTranslateSentence = async () => {
    const textToTranslate = isEditingSentence ? editingSentenceText : selectedSentence?.plaintext;
    if (!textToTranslate) return;

    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: textToTranslate }),
      });
      const data = await response.json();
      if (data.translatedText) setTranslationInput(data.translatedText);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateWordEditor = async () => {
    setIsTranslatingWord(true);
    try {
      const wRes = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: editingWord }),
      });
      const wData = await wRes.json();
      if (wData.translatedText) setEditingWordTrans(wData.translatedText);

      if (editingRoot) {
        const rRes = await fetch(`${API_BASE}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: editingRoot }),
        });
        const rData = await rRes.json();
        if (rData.translatedText) setEditingRootTrans(rData.translatedText);
      }
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslatingWord(false);
    }
  };

  const handleConfirmWordEditor = async () => {
    if (!editingWord || !editingRoot) {
      alert("Please enter both Word and Root.");
      return;
    }

    setIsProcessingWords(true);
    try {
      let response;
      if (editingWordId) {
        response = await fetch(`${API_BASE}/api/update-word/${editingWordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plaintext: editingWord,
                translation: editingWordTrans,
                root_plaintext: editingRoot,
                root_translation: editingRootTrans
            })
        });
      } else {
        const payload = {
            items: [{
            plaintext: editingWord,
            translation: editingWordTrans,
            root_plaintext: editingRoot,
            root_translation: editingRootTrans
            }]
        };
        response = await fetch(`${API_BASE}/add-words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
      }
      if (!response.ok) throw new Error("Server error");
      const result = await response.json();
      if (result.success) {
        if (result.new_roots_count > 0 || result.new_root_created) setNewRootsCount(prev => prev + 1);
        if (result.deleted_root) setDeletedRootsCount(prev => prev + 1);
        await fetchData();
        setIsEditingWord(false);
      }
    } catch (err) {
      console.error("Error saving word:", err);
      alert("Error saving word.");
    } finally {
      setIsProcessingWords(false);
    }
  };

  const handleAddWordsClick = async () => {
    if (missingWords.length === 0) return;
    setIsProcessingWords(true);
    try {
      const response = await fetch(`${API_BASE}/suggest-words-isri`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: missingWords })
      });
      const suggestions = await response.json();
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
      const response = await fetch(`${API_BASE}/add-words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: wordsToAdd })
      });
      if (!response.ok) throw new Error("Server error");
      const result = await response.json();
      if (result.success) {
        if (result.new_roots_count > 0) setNewRootsCount(result.new_roots_count);
        await fetchData();
        setIsStaging(false);
        setStagedWords([]);
      }
    } catch (err) {
      console.error("Error confirming words:", err);
      alert("Error saving words.");
    } finally {
      setIsProcessingWords(false);
    }
  };

  const handleSelectAmbiguousCandidate = async (word) => {
    if (!ambiguityModal) return;
    try {
        const response = await fetch(`${API_BASE}/api/link-word`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sentence_id: selectedSentenceId,
                index: ambiguityModal.tokenIndex,
                word_id: word.word_id
            })
        });
        if (response.ok) {
            setAmbiguityModal(null);
            await fetchData();
        } else {
            alert("Failed to save selection.");
        }
    } catch (err) {
        console.error(err);
        alert("Error saving selection.");
    }
  };

  const handleDeleteSentenceClick = () => {
    if (deleteConfirmSentence) handleDeleteSentence();
    else setDeleteConfirmSentence(true);
  };

  const handleDeleteSentence = async () => {
    if (!selectedSentenceId) return;
    try {
        const response = await fetch(`${API_BASE}/api/delete-sentence/${selectedSentenceId}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchData();
            setDeleteConfirmSentence(false); 
        } else {
            alert("Failed to delete sentence.");
            setDeleteConfirmSentence(false);
        }
    } catch (err) {
        console.error(err);
        alert("Error deleting sentence");
        setDeleteConfirmSentence(false);
    }
  };

  const handleDeleteWordClick = () => {
    if (deleteConfirmWord) handleDeleteWord();
    else setDeleteConfirmWord(true);
  };

  const handleDeleteWord = async () => {
    if (!editingWordId) return; 
    try {
        const response = await fetch(`${API_BASE}/api/delete-word/${editingWordId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            if (result.deleted_root) setDeletedRootsCount(prev => prev + 1);
            await fetchData();
            setIsEditingWord(false);
            setDeleteConfirmWord(false);
        } else {
            alert("Failed to delete word: " + result.error);
            setDeleteConfirmWord(false);
        }
    } catch (err) {
        console.error(err);
        alert("Error deleting word");
        setDeleteConfirmWord(false);
    }
  };

  const handleEditSentenceClick = () => {
    setIsEditingSentence(true);
    setEditingSentenceText(selectedSentence.plaintext);
  };

  const handleUpdateSentence = async () => {
    const textToSend = isEditingSentence ? editingSentenceText : selectedSentence.plaintext;
    try {
        const response = await fetch(`${API_BASE}/api/update-sentence/${selectedSentenceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                plaintext: textToSend,
                translation: translationInput
            })
        });
        if (response.ok) {
            setIsEditingSentence(false);
            await fetchData();
        } else {
            alert("Failed to update sentence.");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating sentence");
    }
  };

  const handleCreateSentence = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/create-sentence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                plaintext: editingSentenceText,
                translation: translationInput
            })
        });
        const result = await response.json();
        if (result.success) {
            setIsEditingSentence(false);
            await fetchData();
            setSelectedSentenceId(result.sentence_id);
        } else {
            alert("Failed to create sentence.");
        }
    } catch (err) {
        console.error(err);
        alert("Error creating sentence");
    }
  };

  // --- Render (Component Scoped) ---
  // (Original Render Logic extracted below)
  
  // Ambiguity Modal
  const AmbiguityModal = () => {
    if (!ambiguityModal) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <div>
                        <h3 className="text-lg font-medium text-indigo-400">Multiple Matches Found</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            The word <span className="text-white font-arabic mx-1">"{ambiguityModal.tokenText}"</span> matches multiple entries.
                        </p>
                    </div>
                    <button onClick={() => setAmbiguityModal(null)} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 bg-slate-900 max-h-[60vh] overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select the correct meaning:</p>
                    <div className="space-y-2">
                        {ambiguityModal.candidates.map(candidate => (
                            <button
                                key={candidate.word_id}
                                onClick={() => handleSelectAmbiguousCandidate(candidate)}
                                className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-800 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500 transition-all group text-left"
                            >
                                <div>
                                    <div className="text-xl font-arabic text-white mb-1">{candidate.plaintext}</div>
                                    <div className="text-sm text-slate-400 group-hover:text-indigo-200">{candidate.translation}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 mb-1">Root</div>
                                    <div className="text-sm font-arabic text-indigo-400">R-{candidate.root_id}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800">
                         <button 
                            onClick={() => {
                                setAmbiguityModal(null);
                                setIsEditingWord(true);
                                setEditingWord(ambiguityModal.tokenText);
                                setEditingWordId(null);
                            }}
                            className="w-full py-3 px-4 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all text-sm font-medium flex items-center justify-center gap-2"
                        >
                            <CopyPlus className="w-4 h-4" />
                            None of these? Create new word
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // Word Editor
  const WordEditor = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
       <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
       <div className="relative z-10 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
             <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
               {editingWordId ? "Editing Existing Word" : "Adding New Word"}
             </h2>
             <button onClick={() => setIsEditingWord(false)} className="text-slate-500 hover:text-white transition-colors">
               <X className="w-5 h-5" />
             </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">WORD (ARABIC)</label>
                <input 
                  value={editingWord} 
                  onChange={(e) => setEditingWord(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-right font-arabic text-xl text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">ROOT (ARABIC)</label>
                <input 
                  value={editingRoot} 
                  onChange={(e) => setEditingRoot(e.target.value)}
                  placeholder="Enter Root..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-right font-arabic text-xl text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={handleTranslateWordEditor}
                disabled={isTranslatingWord}
                className="group flex items-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-all border border-slate-700 hover:border-indigo-500 shadow-sm"
              >
                {isTranslatingWord ? <Loader className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
                {isTranslatingWord ? "Translating..." : "Translate"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">TRANSLATION</label>
                <input 
                  value={editingWordTrans} 
                  onChange={(e) => setEditingWordTrans(e.target.value)}
                  placeholder="Word translation..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">ROOT TRANSLATION</label>
                <input 
                  value={editingRootTrans} 
                  onChange={(e) => setEditingRootTrans(e.target.value)}
                  placeholder="Root translation..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-800/50">
            <button 
                onClick={handleDeleteWordClick}
                onMouseLeave={() => setDeleteConfirmWord(false)}
                disabled={!editingWordId}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                    ${!editingWordId 
                        ? 'bg-slate-900 text-slate-700 border-slate-700 cursor-not-allowed' 
                        : deleteConfirmWord
                            ? 'bg-rose-600 border-rose-500 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-900/30 hover:text-rose-400'
                    }
                `}
            >
               <Trash2 className="w-4 h-4" />
               {deleteConfirmWord ? "Are you sure?" : "Delete"}
            </button>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditingWord(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmWordEditor}
                disabled={isProcessingWords}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isProcessingWords ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Save
              </button>
            </div>
          </div>
       </div>
    </div>
  );

  // Staging Area
  const StagingArea = () => (
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
              <div className={`
                absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors
                ${item.checked ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}
              `}>
                <Check className="w-4 h-4" />
              </div>

              <div className="space-y-4 pr-8">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New Word</div>
                  <div className="text-2xl font-arabic text-slate-200 mb-1" dir="rtl">{item.plaintext}</div>
                  <div className="text-sm text-indigo-300 font-medium">{item.translation}</div>
                </div>
                
                <div className="h-px bg-slate-700/50 w-full" />

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

  // Main Sentence Editor Logic
  const SentenceEditor = () => {
    if (loading && sentences.length === 0) {
       return (
        <div className="flex flex-col items-center justify-center h-64 text-indigo-400 border-2 border-dashed border-indigo-900 rounded-xl bg-slate-900/30">
          <Loader className="w-8 h-8 mb-4 animate-spin" />
          <p className="text-lg">Loading data...</p>
        </div>
      );
    }
    if (error) {
       return (
        <div className="flex flex-col items-center justify-center h-64 text-rose-400 border-2 border-dashed border-rose-900 rounded-xl bg-slate-900/30">
          <AlertCircle className="w-8 h-8 mb-4" />
          <p className="text-lg font-medium">{error}</p>
        </div>
      );
    }
    if (!selectedSentence && sentences.length > 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <p className="text-lg">Select a sentence</p>
            </div>
        )
    }
    if (!selectedSentence) return null;
    if (isEditingWord) return <WordEditor />;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex justify-between items-center">
             <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
               {isEditingSentence ? "Editing Sentence Text" : `Editing Sentence #${selectedSentence.sentence_id}`}
             </h2>
          </div>

          <div className="bg-slate-950/50 rounded-lg p-8 min-h-[160px] flex items-center justify-center border border-slate-800 shadow-inner" dir="rtl">
            {isEditingSentence ? (
                <textarea 
                    value={editingSentenceText}
                    onChange={(e) => setEditingSentenceText(e.target.value)}
                    className="w-full bg-transparent text-4xl leading-relaxed font-arabic text-slate-100 text-center outline-none border-none resize-none focus:ring-0"
                    placeholder="Type sentence here..."
                    autoFocus
                />
            ) : (
                <div className="flex flex-wrap gap-3 text-4xl leading-relaxed font-arabic text-slate-100">
                {sentenceTokens.map((token, idx) => {
                    const isFound = !!token.wordData;
										const isAmbiguous = token.status === 'ambiguous';
										const isLinked = token.status === 'linked';
										return (
                    <Tooltip 
                        key={idx} 
                        content={
                        <div className="text-center min-w-[80px]">
														{isAmbiguous ? (
														<div className="text-amber-400 font-medium flex items-center justify-center gap-1">
																<HelpCircle className="w-3 h-3" />
																Ambiguous
														</div>
                            ) : isFound ? (
                            <>
																<div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                                    {isLinked && <LinkIcon className="w-3 h-3 text-indigo-400" />}
                                    {token.status === 'inferred' && "Inferred"}
                                    {token.status === 'exact' && ""} 
                                </div> 
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
                        onClick={() => handleWordClick(token)}
                        onMouseEnter={() => isFound && token.wordData && setHighlightedWordId(token.wordData.word_id)}
                        onMouseLeave={() => setHighlightedWordId(null)}
                        className={`
                            px-2 py-1 rounded-md transition-all duration-200 relative
                            ${isFound 
                            ? `cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-300 hover:scale-105 hover:-translate-y-1 ${highlightedWordId === token.wordData?.word_id ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50' : ''}`
                            : 'cursor-pointer text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-400 decoration-rose-500/30'
                            }
                        `}
                        >
                        {token.text}
                        </span>
                    </Tooltip>
                    );
                })}
                </div>
            )}
          </div>
          
          <div className="flex justify-center -my-2 z-20">
            <button 
              onClick={handleTranslateSentence}
              disabled={isTranslating}
              className="group flex items-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-all border border-slate-700 hover:border-indigo-500 shadow-sm"
            >
              {isTranslating ? <Loader className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
              {isTranslating ? "Translating..." : "Translate"}
            </button>
          </div>

          <div className="w-full">
            <textarea
              value={translationInput}
              onChange={(e) => setTranslationInput(e.target.value)}
              className="w-full h-[80px] bg-slate-950/30 border border-slate-800 text-slate-300 text-lg rounded-lg p-4 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-600"
              placeholder="Enter translation here..."
            />
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/50 mt-2">
            {isEditingSentence ? (
                <>
                    <button 
                        onClick={() => setIsEditingSentence(false)}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleCreateSentence}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                        >
                            <CopyPlus className="w-4 h-4" />
                            Save New
                        </button>
                        <button 
                            onClick={handleUpdateSentence}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm & Save
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <button 
                        onClick={handleDeleteSentenceClick}
                        onMouseLeave={() => setDeleteConfirmSentence(false)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                            ${deleteConfirmSentence
                                ? 'bg-rose-600 border-rose-500 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-900/30 hover:text-rose-400'
                            }
                        `}
                    >
                        <Trash2 className="w-4 h-4" />
                        {deleteConfirmSentence ? "Are you sure?" : "Delete"}
                    </button>

                    <div className="flex gap-2">
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

                        <button 
                            onClick={handleEditSentenceClick}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit
                        </button>
                        
                        <button 
                            onClick={handleUpdateSentence} // SAVE NOW OVERWRITES IN VIEW MODE
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            Save
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render return for LibraryView
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <AmbiguityModal />
      
      {/* Editor Section */}
      <section>
        {SentenceEditor()}
      </section>

      {/* Tables Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col h-[600px] relative transition-all">
        {isStaging ? (
          StagingArea()
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
                  {tab.id === 'roots' && newRootsCount > 0 && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 animate-out fade-out duration-[3000ms]">
                      +{newRootsCount}
                    </span>
                  )}
                  {tab.id === 'roots' && deletedRootsCount > 0 && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 animate-out fade-out duration-[3000ms]">
                      -{deletedRootsCount}
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
                          {['ID', 'Plaintext', 'Translation', 'Length', 'Complete'].map(h => (
                            <th key={h} className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {sentences.sort((a, b) => a.sentence_id - b.sentence_id).map(s => (
                          <TableRow 
                            key={s.sentence_id}
                            isActive={selectedSentenceId === s.sentence_id}
                            onClick={() => handleSentenceSelect(s)}
                            data={s}
                            columns={[
                              { key: 'sentence_id', render: d => <span className="font-mono text-slate-500">#{d.sentence_id}</span> },
                              { key: 'plaintext', isArabic: true },
                              { key: 'translation' },
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
                        {words.sort((a, b) => a.word_id - b.word_id).map(w => (
                          <tr 
                            key={w.word_id}
                            ref={el => wordRefs.current[w.word_id] = el}
                            onClick={() => handleTableWordClick(w)}
                            className={`
                              border-b border-slate-800/50 transition-colors duration-500 cursor-pointer
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
                        {roots.sort((a, b) => a.root_id - b.root_id).map(r => (
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
  );
}

// --- Main App Component with Navigation ---
const App = () => {
  const [currentView, setCurrentView] = useState('library');

  // Placeholder for Tutor View
  const TutorView = () => (
    <div className="flex items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 animate-in fade-in duration-300">
      <div className="text-center">
        <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">AI Tutor</h2>
        <p>Coming soon...</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col hidden md:flex">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Flashcard<br/>Studio</h1>
          </div>
        </div>

        <div className="space-y-1">
          <button 
            onClick={() => setCurrentView('library')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'library' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Library className="w-4 h-4" />
            Library
          </button>
          
          <button 
            onClick={() => setCurrentView('flashcards')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'flashcards' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            Flashcards
          </button>

          <button 
            onClick={() => setCurrentView('tutor')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'tutor' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <GraduationCap className="w-4 h-4" />
            Tutor
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <div className="max-w-7xl mx-auto">
          {currentView === 'library' && <LibraryView />}
          {currentView === 'flashcards' && <FlashcardEditor />}
          {currentView === 'tutor' && <TutorView />}
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