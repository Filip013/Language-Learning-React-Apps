import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, XCircle, ArrowRight, RotateCcw, 
  Loader2, RefreshCw, ArrowLeft, Gamepad2, Sparkles, 
  History, Search, Trash2, Database, Settings2, Eye
} from 'lucide-react';
import { auth, db } from '../firebase';

const dbAppId = 'character-drills';

const fontStyles = `
  @import url('https://db.onlinewebfonts.com/c/fe4f9dac99fb6b607c03981e6ce16869?family=DFKai-SB');
  @import url('https://db.onlinewebfonts.com/c/1ee9941f1b8c128110ca4307dda59917?family=STKaiti');
  .moe-font {
    font-family: 'DFKai-SB', 'STKaiti', 'KaiTi', 'BiauKai', 'Kaiti TC', serif !important;
  }
`;

const PIECE_COLORS = [
    "bg-amber-100 text-amber-800 border-amber-300",
    "bg-emerald-100 text-emerald-800 border-emerald-300",
    "bg-rose-100 text-rose-800 border-rose-300",
    "bg-sky-100 text-sky-800 border-sky-300",
    "bg-indigo-100 text-indigo-800 border-indigo-300"
];

export default function CharacterDrill() {
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('main'); 
  const [historySearch, setHistorySearch] = useState('');
  
  // Developer Testing Settings
  const [showSettings, setShowSettings] = useState(false);
  const [selectedKeyType, setSelectedKeyType] = useState('free'); // 'free' | 'paid'
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite'); 
  
  // Data State
  const [lexiconChars, setLexiconChars] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Game State
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [score, setScore] = useState(0);

  // Local Interaction State
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isHintRevealed, setIsHintRevealed] = useState(false);
  const [isAssemblyCorrect, setIsAssemblyCorrect] = useState(false);
  const [assemblyPieces, setAssemblyPieces] = useState([]);
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [showSimplifiedBig, setShowSimplifiedBig] = useState(false);

  useEffect(() => {
      const checkTheme = () => {
          const localTheme = localStorage.getItem('lingocraft_theme');
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setIsDarkMode(localTheme === 'dark' || (!localTheme && systemDark));
      };
      checkTheme();
      window.addEventListener('theme-changed', checkTheme);
      return () => window.removeEventListener('theme-changed', checkTheme);
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  // Fetch Master Lexicon & History
  useEffect(() => {
    if (!user) return;

    const historyRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history');
    const unsubHistory = historyRef.onSnapshot((docSnap) => {
        if (docSnap.exists) setHistory(docSnap.data().items || []);
    });

    const fetchLexicon = async () => {
        try {
            let chars = new Set();
            const docRef = db.collection('artifacts').doc('mandarin-master').collection('users').doc(user.uid).collection('database').doc('lexicon');
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                Object.values(docSnap.data()).forEach(val => {
                    const str = typeof val === 'string' ? val : (val.word || val.target || JSON.stringify(val));
                    const matches = str.match(/[\u4e00-\u9fa5]/g);
                    if (matches) matches.forEach(c => chars.add(c));
                });
            }
            setLexiconChars([...chars]);
        } catch (err) { console.error(err); } 
        finally { setLoadingChars(false); }
    };

    fetchLexicon();
    return () => unsubHistory();
  }, [user]);

  const activities = activeEpisode?.activities || [];
  const slide = activities[currentSlide];
  const isComplete = activities.length > 0 && currentSlide >= activities.length;

  // Initialize Game Slide State
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setIsHintRevealed(false);
    setIsAssemblyCorrect(false);
    setSelectedPieceId(null);
    setShowSimplifiedBig(false);
    
    if (slide && slide.type === 'click-assembly') {
      const shuffled = [...(slide.pieces || [])]
        .sort(() => Math.random() - 0.5)
        .map(p => ({ ...p, zone: 'source' }));
      setAssemblyPieces(shuffled);
    } else {
      setAssemblyPieces([]);
    }
  }, [currentSlide, slide]);

  // GAME ENGINE: Build activities from raw LLM linguistic data
  const buildActivities = (llmData) => {
    const generatedActivities = [];
    let activityId = 1;

    llmData.forEach((charData) => {
        // --- 1. Assembly Game ---
        const slots = [];
        const struct = charData.structure;
        
        if (struct === 'top-bottom') {
            slots.push({ id: "top", label: "Top", className: "absolute left-0 top-0 w-full h-[55%] border-b-2 border-dashed border-stone-300 rounded-t-xl bg-white/50 z-10" });
            slots.push({ id: "bottom", label: "Bottom", className: "absolute left-0 bottom-0 w-full h-[45%] border-dashed border-stone-300 rounded-b-xl bg-white/30 z-10" });
        } else if (struct === 'outside-inside') {
            slots.push({ id: "outside", label: "Outer", className: "absolute left-2 top-2 w-[55%] h-[55%] border-2 border-dashed border-stone-300 rounded-tl-xl bg-white/50 z-10" });
            slots.push({ id: "inside", label: "Inner", className: "absolute right-2 bottom-2 w-[55%] h-[55%] border-2 border-dashed border-stone-300 rounded-br-xl bg-white/80 z-20" });
        } else if (struct === 'left-middle-right') {
            slots.push({ id: "left", label: "Left", className: "absolute left-0 top-0 w-[33.3%] h-full border-r-2 border-dashed border-stone-300 rounded-l-xl bg-white/50 z-10" });
            slots.push({ id: "middle", label: "Mid", className: "absolute left-[33.3%] top-0 w-[33.4%] h-full border-r-2 border-dashed border-stone-300 bg-white/40 z-10" });
            slots.push({ id: "right", label: "Right", className: "absolute right-0 top-0 w-[33.3%] h-full border-dashed border-stone-300 rounded-r-xl bg-white/30 z-10" });
        } else if (struct === 'top-middle-bottom') {
            slots.push({ id: "top", label: "Top", className: "absolute left-0 top-0 w-full h-[33.3%] border-b-2 border-dashed border-stone-300 rounded-t-xl bg-white/50 z-10" });
            slots.push({ id: "middle", label: "Mid", className: "absolute left-0 top-[33.3%] w-full h-[33.4%] border-b-2 border-dashed border-stone-300 bg-white/40 z-10" });
            slots.push({ id: "bottom", label: "Bot", className: "absolute left-0 bottom-0 w-full h-[33.3%] border-dashed border-stone-300 rounded-b-xl bg-white/30 z-10" });
        } else { 
            // default left-right
            slots.push({ id: "left", label: "Left", className: "absolute left-0 top-0 w-[40%] h-full border-r-2 border-dashed border-stone-300 rounded-l-xl bg-white/50 z-10" });
            slots.push({ id: "right", label: "Right", className: "absolute right-0 top-0 w-[60%] h-full border-dashed border-stone-300 rounded-r-xl bg-white/30 z-10" });
        }

        const pieces = [];
        let pieceIdCounter = 1;
        const availableColors = [...PIECE_COLORS].sort(() => Math.random() - 0.5);

        // Add true components
        const trueComps = charData.components || [];
        trueComps.forEach((comp, idx) => {
            pieces.push({
                id: `p${pieceIdCounter++}`,
                char: comp.char,
                targetZone: comp.position,
                color: availableColors[idx % availableColors.length]
            });
        });

        // Add distractors to equal exactly 5 pieces total
        const distractorsNeeded = Math.max(0, 5 - trueComps.length);
        (charData.assemblyDistractors || []).slice(0, distractorsNeeded).forEach((distractor, idx) => {
            pieces.push({
                id: `p${pieceIdCounter++}`,
                char: distractor,
                targetZone: "none",
                color: availableColors[(idx + trueComps.length) % availableColors.length]
            });
        });

        generatedActivities.push({
            id: activityId++,
            type: "click-assembly",
            target: charData.target,
            pinyin: charData.pinyin || "",
            simplified: charData.simplified || charData.target,
            meaning: charData.meaning || "",
            slots: slots,
            pieces: pieces
        });

        // --- 2. Discrimination Game ---
        const options = [charData.target, ...(charData.similarChars || [])].slice(0, 4);
        options.sort(() => Math.random() - 0.5);

        generatedActivities.push({
            id: activityId++,
            type: "discrimination",
            target: charData.target,
            pinyin: charData.pinyin || "",
            simplified: charData.simplified || charData.target,
            meaning: charData.meaning || "",
            correct: charData.target,
            options: options
        });
    });

    return generatedActivities;
  };

  const handleGenerate = async () => {
    if (!user || loadingChars) return;

    // Get the requested Key
    const keyName = selectedKeyType === 'paid' ? 'geminiPaidApiKey' : 'geminiApiKey';
    const apiKey = localStorage.getItem(keyName) || localStorage.getItem(selectedKeyType === 'free' ? 'geminiPaidApiKey' : 'geminiApiKey');
    
    if (!apiKey) {
        setError(`No API Key found. Please add it in your Hub settings.`);
        return;
    }

    if (lexiconChars.length === 0) {
        setError("Your lexicon is empty. Please add vocabulary to your database first.");
        return;
    }

    setLoading(true);
    setError(null);
    setActiveTab('main');
    setActiveEpisode(null);

    const recentDrilled = new Set(history.slice(0, 3).flatMap(h => h.focusCharacters || []));
    const unDrilled = lexiconChars.filter(c => !recentDrilled.has(c));
    
    const shuffledUnDrilled = [...unDrilled].sort(() => 0.5 - Math.random());
    const shuffledRecent = [...recentDrilled].sort(() => 0.5 - Math.random());

    let targetChars = [];
    if (shuffledUnDrilled.length >= 3 && shuffledRecent.length >= 1) {
        targetChars = [...shuffledUnDrilled.slice(0, 3), shuffledRecent[0]];
    } else {
        targetChars = [...lexiconChars].sort(() => 0.5 - Math.random()).slice(0, 4);
    }

    targetChars.sort(() => 0.5 - Math.random());
    const targetString = JSON.stringify(targetChars);

    const systemInstruction = `You are a linguistic database API for Traditional Chinese.
    I will provide an array of exactly 4 Chinese characters.
    For each character, return its linguistic data matching the exact JSON schema provided.

    RULES:
    1. For 'structure', classify the character as one of these 5 types: "left-right", "top-bottom", "outside-inside", "left-middle-right", or "top-middle-bottom". 
       IMPORTANT: If it is a full enclosure (like 國) or a semi-enclosure (like 居, 房, 區, 近, 這, 閃), you MUST use "outside-inside". If it has 3 clear horizontal parts (like 街), use "left-middle-right".
    2. For 'components', break the character into exactly 2 or 3 main radicals/parts depending on its structure. Set 'position' to "left", "right", "top", "bottom", "outside", "inside", or "middle" to match the chosen structure.
    3. For 'assemblyDistractors', provide exactly 3 random standard radicals (e.g. 犭, 木, 釒) that are NOT in the character.
    4. For 'similarChars', provide exactly 3 distinct characters that look visually similar to the target character to act as visual distractors.
    
    Return an ARRAY of objects. No markdown, no explanations, just JSON.`;

    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                target: { type: "STRING" },
                pinyin: { type: "STRING" },
                simplified: { type: "STRING" },
                meaning: { type: "STRING" },
                structure: { type: "STRING", enum: ["left-right", "top-bottom", "outside-inside", "left-middle-right", "top-middle-bottom"] },
                components: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            char: { type: "STRING" },
                            position: { type: "STRING", enum: ["left", "right", "top", "bottom", "outside", "inside", "middle"] }
                        },
                        required: ["char", "position"]
                    }
                },
                assemblyDistractors: { type: "ARRAY", items: { type: "STRING" } },
                similarChars: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["target", "pinyin", "meaning", "structure", "components", "assemblyDistractors", "similarChars"]
        }
    };

    const payload = {
        contents: [{ parts: [{ text: `Generate data for these 4 characters: ${targetString}` }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: responseSchema,
            temperature: 0.1
        }
    };

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("API Connection Failed");
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("Empty response received.");

        const llmData = JSON.parse(rawText);
        const generatedActivities = buildActivities(llmData);
        
        const episodeData = {
            focusCharacters: targetChars,
            activities: generatedActivities
        };

        setActiveEpisode(episodeData);
        setCurrentSlide(0);
        setScore(0);

        const drillRecord = {
            id: Date.now().toString(),
            ...episodeData,
            timestamp: Date.now()
        };

        const newHistory = [drillRecord, ...history].slice(0, 50);
        setHistory(newHistory);
        await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history').set({ items: newHistory });

    } catch (err) {
        console.error(err);
        setError(`Unable to generate episode using ${selectedModel}. Please try again or switch models.`);
    } finally {
        setLoading(false);
    }
  };

  const loadHistoryItem = (item) => {
    setActiveEpisode(item);
    setCurrentSlide(0);
    setScore(0);
    setActiveTab('main');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = async (id, e) => {
    if (!user) return;
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    try {
        await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history').set({ items: newHistory });
    } catch (e) {}
  };

  const handlePieceClick = (pieceId) => {
    if (isAnswered) return;
    setSelectedPieceId(selectedPieceId === pieceId ? null : pieceId);
  };

  const handleSlotClick = (slotId) => {
    if (isAnswered) return;
    setAssemblyPieces(prev => {
      const newPieces = [...prev];
      if (selectedPieceId) {
        const pieceIdx = newPieces.findIndex(p => p.id === selectedPieceId);
        const originalZone = newPieces[pieceIdx].zone;
        
        const occupantIdx = newPieces.findIndex(p => p.zone === slotId);
        if (occupantIdx !== -1) {
          newPieces[occupantIdx] = { ...newPieces[occupantIdx], zone: originalZone };
        }
        
        newPieces[pieceIdx] = { ...newPieces[pieceIdx], zone: slotId };
        setSelectedPieceId(null);
      } else {
        const occupantIdx = newPieces.findIndex(p => p.zone === slotId);
        if (occupantIdx !== -1) {
          newPieces[occupantIdx] = { ...newPieces[occupantIdx], zone: 'source' };
        }
      }
      return newPieces;
    });
  };

  const handleOptionClick = (opt) => {
    if (isAnswered) return;
    setSelectedOption(opt);
  };

  const checkAnswer = () => {
    setIsAnswered(true);
    setIsHintRevealed(true); // Auto reveal info/header on check
    let correct = false;

    if (slide.type === 'click-assembly') {
      correct = assemblyPieces.every(p => {
          const expected = (p.targetZone && p.targetZone !== "none") ? p.targetZone : 'source';
          return p.zone === expected;
      });
      setIsAssemblyCorrect(correct);
    } else {
      correct = selectedOption === slide.correct;
    }

    if (correct) setScore(score + 1);
  };

  const renderPiece = (piece, inSlot = false) => {
    const isSelected = selectedPieceId === piece.id;
    return (
      <button
        key={piece.id}
        onClick={(e) => {
          e.stopPropagation();
          if (inSlot) handleSlotClick(piece.zone);
          else handlePieceClick(piece.id);
        }}
        disabled={isAnswered}
        className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl border-2 shadow-sm transition-all select-none
          ${piece.color || 'bg-stone-100 text-stone-800'} 
          ${isSelected ? 'ring-4 ring-offset-2 ring-stone-800 scale-105 z-20' : 'hover:scale-[1.02] active:scale-95'}
          ${isAnswered ? 'opacity-90 cursor-default' : 'cursor-pointer'}
        `}
      >
        <span className="text-3xl sm:text-4xl moe-font">{piece.char}</span>
      </button>
    );
  };

  const isAssemblyReady = slide?.type === 'click-assembly' && slide.slots?.every(slot => assemblyPieces.some(p => p.zone === slot.id));
  const isDiscriminationReady = slide?.type === 'discrimination' && selectedOption !== null;
  const isReadyToCheck = isAssemblyReady || isDiscriminationReady;
  
  const filteredHistory = history.filter(i => 
    i.focusCharacters?.some(c => c.includes(historySearch))
  );

  if (!user) return null;

  return (
    <div className={`min-h-screen transition-colors duration-300 pb-16 ${isDarkMode ? 'bg-zinc-950' : 'bg-stone-50'}`}>
      <style>{fontStyles}</style>

      {/* NAVBAR */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm ${isDarkMode ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100' : 'bg-white/80 border-stone-200 text-stone-900'}`}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Link 
                      to="/" 
                      className={`p-2 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                      title="Back to Hub"
                  >
                      <ArrowLeft size={16} />
                  </Link>

                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('main')}>
                      <div className={`p-2 rounded-xl border flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                          <Gamepad2 size={20} />
                      </div>
                      <div className="hidden sm:block">
                          <h1 className="text-xl font-extrabold tracking-tight leading-none">Character Drills</h1>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>AI Discovery Engine</p>
                      </div>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-dashed border-stone-300 dark:border-zinc-700 text-stone-500 dark:text-zinc-400">
                      <Database size={12} />
                      {loadingChars ? 'Scanning DB...' : `${lexiconChars.length} Items`}
                  </div>
                  
                  <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className={`p-2 rounded-full border transition-all active:scale-95 ${showSettings ? 'bg-stone-800 text-white border-stone-800' : isDarkMode ? 'bg-zinc-900 border-zinc-800 text-stone-400 hover:bg-zinc-800' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                      title="Dev Settings"
                  >
                      <Settings2 size={16} />
                  </button>

                  <button 
                      onClick={() => setActiveTab(activeTab === 'history' ? 'main' : 'history')} 
                      className={`p-2 rounded-full border transition-all active:scale-95 ${activeTab === 'history' ? 'bg-indigo-600 text-white border-indigo-600' : isDarkMode ? 'bg-zinc-900 border-zinc-800 text-indigo-400 hover:bg-zinc-800' : 'bg-white border-stone-200 text-indigo-600 hover:bg-stone-50'}`}
                      title="History"
                  >
                      <History size={16} />
                  </button>

                  <button
                      onClick={handleGenerate}
                      disabled={loading || loadingChars}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 text-sm"
                  >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span className="hidden sm:inline">New Episode</span>
                  </button>
              </div>
          </div>
          
          {/* Dev Settings Drawer */}
          {showSettings && (
              <div className={`border-t p-3 text-sm font-sans flex justify-end gap-3 ${isDarkMode ? 'border-zinc-800 bg-zinc-900/90' : 'border-stone-200 bg-stone-100/90'}`}>
                  <select 
                      value={selectedKeyType}
                      onChange={(e) => setSelectedKeyType(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg border font-medium outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-stone-300 text-stone-700'}`}
                  >
                      <option value="free">Free API Key</option>
                      <option value="paid">Paid API Key</option>
                  </select>
                  <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg border font-medium outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-stone-300 text-stone-700'}`}
                  >
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                  </select>
              </div>
          )}
      </nav>

      {/* GAME AREA */}
      {activeTab === 'main' ? (
          <div className="max-w-2xl mx-auto mt-6 px-4 pb-12 moe-font" lang="zh-Hant">
            
            {loading && (
                <div className="flex flex-col items-center justify-center py-24">
                    <Loader2 className={`animate-spin mb-4 text-indigo-500`} size={48} />
                    <p className={`font-medium font-sans animate-pulse ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>Generating linguistic data...</p>
                </div>
            )}

            {error && (
                <div className="p-4 mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 flex items-start gap-3">
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm font-sans">{error}</p>
                </div>
            )}

            {!loading && !error && !activeEpisode && (
                 <div className={`p-12 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center mt-12 ${isDarkMode ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-stone-200'}`}>
                    <Gamepad2 className={`w-16 h-16 mb-4 opacity-20 ${isDarkMode ? 'text-zinc-400' : 'text-stone-400'}`} />
                    <h2 className={`text-2xl font-bold mb-2 font-sans ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Ready to Practice?</h2>
                    <p className={`max-w-md text-sm leading-relaxed font-sans ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                        Click <strong>New Episode</strong> to let the engine pick 4 characters from your lexicon and assemble a custom 8-stage drill.
                    </p>
                 </div>
            )}

            {!loading && activeEpisode && isComplete && (
                <div className={`p-10 rounded-2xl shadow-sm border text-center mt-12 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-800'}`}>
                  <h2 className="text-3xl font-bold mb-4 font-sans">Episode Complete</h2>
                  <p className={`text-xl mb-8 font-sans ${isDarkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Final Score: {score} / {activities.length}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button 
                        onClick={() => { setCurrentSlide(0); setScore(0); }}
                        className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg transition-colors font-sans font-bold ${isDarkMode ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                      >
                        <RotateCcw size={20} /> Retry Episode
                      </button>
                      <button 
                        onClick={handleGenerate}
                        className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg transition-colors font-sans font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Sparkles size={20} /> Generate Next
                      </button>
                  </div>
                </div>
            )}

            {!loading && activeEpisode && !isComplete && slide && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                
                {/* Header & Progress Bar */}
                <div className="mb-8 font-sans">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h1 className={`text-2xl font-bold mb-1 flex items-center flex-wrap gap-3 ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                          <span>Practice:</span> 
                          <span className={`moe-font font-normal transition-all duration-300 ${isHintRevealed ? 'opacity-100 blur-none' : 'opacity-40 blur-md select-none'}`}>
                            {activeEpisode.focusCharacters.join(', ')}
                          </span>
                          {!isHintRevealed && (
                              <button 
                                  onClick={() => setIsHintRevealed(true)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                                  title="Reveal Characters"
                              >
                                  <Eye size={14} />
                              </button>
                          )}
                      </h1>
                      <div className={`flex gap-4 text-sm font-bold tracking-widest uppercase ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                        <span>Activity {currentSlide + 1} / {activities.length}</span>
                        <span>Score: {score}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setCurrentSlide(0); setScore(0); }}
                      className={`flex items-center gap-2 text-sm transition-colors ${isDarkMode ? 'text-zinc-500 hover:text-red-400' : 'text-stone-400 hover:text-red-500'}`}
                    >
                      <RefreshCw size={16} /> Reset
                    </button>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-zinc-800' : 'bg-stone-200'}`}>
                    <div 
                      className={`h-full transition-all duration-300 ${isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                      style={{ width: `${((currentSlide) / activities.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className={`p-6 sm:p-10 rounded-3xl shadow-sm border ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                  
                  {/* Target Word Info */}
                  <div className="text-center mb-8 min-h-[100px] flex flex-col items-center justify-center">
                    <p className={`text-lg font-sans mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>{slide.meaning}</p>
                    <p className={`text-2xl font-medium font-sans mb-2 ${isDarkMode ? 'text-zinc-200' : 'text-stone-700'}`}>{slide.pinyin}</p>
                    <div className="h-6 mt-1 flex items-center justify-center">
                        {isAnswered && (
                        <p className={`text-sm font-sans animate-in fade-in duration-300 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                            Simplified: <span style={{ fontFamily: "'STKaiti', 'KaiTi', serif" }} className="text-lg align-middle">{slide.simplified}</span>
                        </p>
                        )}
                    </div>
                  </div>

                  {/* Activity Area */}
                  <div className="mb-8 min-h-[300px] flex items-center justify-center w-full">
                    {slide.type === 'click-assembly' ? (
                      (isAnswered && isAssemblyCorrect) ? (
                        <div className="flex flex-col items-center justify-center w-full animate-in zoom-in spin-in-2 duration-500">
                          <div 
                            onClick={() => setShowSimplifiedBig(!showSimplifiedBig)}
                            className="relative w-56 h-56 sm:w-64 sm:h-64 bg-emerald-50 border-4 border-emerald-400 rounded-2xl shadow-xl flex items-center justify-center cursor-pointer hover:bg-emerald-100 transition-all active:scale-95"
                            title="Click to toggle Simplified/Traditional"
                          >
                            <span 
                              style={showSimplifiedBig ? { fontFamily: "'STKaiti', 'KaiTi', serif" } : undefined}
                              className={`text-[120px] sm:text-[140px] text-emerald-800 leading-none pb-4 select-none ${showSimplifiedBig ? '' : 'moe-font'}`}
                            >
                              {showSimplifiedBig ? slide.simplified : slide.target}
                            </span>
                            <span className="absolute bottom-4 text-emerald-600/60 font-sans text-[10px] font-bold uppercase tracking-widest select-none">
                              {showSimplifiedBig ? 'Simplified' : 'Traditional'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center w-full">
                          {/* Structural Canvas */}
                          <div className={`relative w-56 h-56 sm:w-64 sm:h-64 border-4 rounded-xl overflow-hidden mb-8 shadow-inner ${isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-stone-50 border-stone-200'}`}>
                            {slide.slots?.map(slot => {
                              const occupant = assemblyPieces.find(p => p.zone === slot.id);
                              const isValidTarget = selectedPieceId !== null && !occupant;
                              
                              return (
                                <div 
                                  key={slot.id}
                                  onClick={() => handleSlotClick(slot.id)}
                                  className={`${slot.className} flex flex-col items-center justify-center transition-all duration-200 ease-out cursor-pointer
                                    ${isValidTarget ? (isDarkMode ? 'bg-amber-900/30 hover:bg-amber-800/40' : 'bg-amber-50/50 hover:bg-amber-100/80') : (isDarkMode ? 'hover:bg-zinc-800/50' : 'hover:bg-stone-100/50')}
                                  `}
                                >
                                  {!occupant && (
                                    <span className={`text-[10px] font-sans uppercase tracking-widest pointer-events-none select-none text-center px-2 w-full overflow-hidden whitespace-nowrap text-ellipsis ${isDarkMode ? 'text-zinc-600' : 'text-stone-300'}`}>
                                        {slot.label}
                                    </span>
                                  )}
                                  {occupant && renderPiece(occupant, true)}
                                </div>
                              );
                            })}
                          </div>

                          {/* Source Bank Area */}
                          <div className={`w-full min-h-[120px] p-4 border-2 border-dashed rounded-xl flex flex-wrap gap-3 sm:gap-4 items-center justify-center ${isDarkMode ? 'bg-zinc-950 border-zinc-700' : 'bg-white border-stone-300'}`}>
                            {assemblyPieces.filter(p => p.zone === 'source').map(p => renderPiece(p, false))}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-4 w-full">
                        {slide.options?.map((opt, idx) => (
                          <button
                            key={idx}
                            disabled={isAnswered}
                            onClick={() => handleOptionClick(opt)}
                            className={`h-32 text-6xl rounded-2xl border-2 transition-all moe-font
                              ${selectedOption === opt 
                                ? (isDarkMode ? 'border-zinc-300 bg-zinc-800 scale-[0.98]' : 'border-stone-800 bg-stone-50 scale-[0.98]')
                                : (isDarkMode ? 'border-zinc-800 bg-zinc-950 hover:border-zinc-600 text-zinc-100' : 'border-stone-100 bg-white hover:border-stone-300 hover:shadow-sm text-stone-800')
                              }
                            `}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Controls & Feedback */}
                  <div className="min-h-[80px] flex flex-col justify-center">
                    {!isAnswered ? (
                      <button
                        onClick={checkAnswer}
                        disabled={!isReadyToCheck}
                        className={`w-full py-4 rounded-xl text-lg font-sans disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold ${isDarkMode ? 'bg-zinc-100 text-zinc-900 hover:bg-white' : 'bg-stone-800 text-white hover:bg-stone-700'}`}
                      >
                        Check Answer
                      </button>
                    ) : (
                      <div className="flex items-start sm:items-center justify-between font-sans animate-in slide-in-from-bottom-2">
                        <div className="flex items-start gap-3">
                          {((slide.type === 'click-assembly' && isAssemblyCorrect) || 
                            (slide.type === 'discrimination' && selectedOption === slide.correct)) ? (
                            <>
                              <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={28} />
                              <span className={`font-bold text-lg mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Correct! {slide.target}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={28} />
                              <div className="flex flex-col">
                                <span className={`font-bold text-lg leading-none mt-1 ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>Incorrect.</span>
                                {slide.type === 'click-assembly' && (
                                   <div className={`text-sm mt-2 flex flex-col ${isDarkMode ? 'text-rose-300' : 'text-rose-800'}`}>
                                      <span>Correct character: <strong className="text-2xl moe-font align-bottom mx-1">{slide.target}</strong></span>
                                      <span className={`text-xs mt-1 opacity-80`}>
                                         Layout: {slide.pieces.filter(p => p.targetZone && p.targetZone !== 'none').map(p => `${p.char} (${p.targetZone})`).join(', ')}
                                      </span>
                                   </div>
                                )}
                                {slide.type === 'discrimination' && (
                                   <div className={`text-sm mt-2 ${isDarkMode ? 'text-rose-300' : 'text-rose-800'}`}>
                                      Correct answer: <strong className="text-2xl moe-font align-bottom mx-1">{slide.correct}</strong>
                                   </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setCurrentSlide(currentSlide + 1)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors shadow-sm whitespace-nowrap self-center ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-800'}`}
                        >
                          Next <ArrowRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
      ) : (
          <div className="max-w-2xl mx-auto px-4 py-8 animate-in fade-in duration-300 font-sans">
              <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
                  <h2 className={`text-2xl font-extrabold flex items-center gap-3 ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                      <History className="w-6 h-6 text-indigo-500" /> Episode History
                  </h2>
                  <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                      <input
                          type="text"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          placeholder="Search episodes..."
                          className={`w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium text-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500' : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'}`}
                      />
                  </div>
              </div>

              <div className="space-y-4">
                  {filteredHistory.length === 0 ? (
                      <div className={`text-center py-12 text-sm border border-dashed rounded-3xl ${isDarkMode ? 'text-zinc-500 border-zinc-800' : 'text-stone-500 border-stone-200'}`}>
                          {historySearch ? 'No matching episodes found.' : 'Your generated episodes will appear here.'}
                      </div>
                  ) : (
                      filteredHistory.map((item) => (
                          <div
                              key={item.id}
                              onClick={() => loadHistoryItem(item)}
                              className={`group p-6 rounded-2xl border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative ${
                                  activeEpisode?.id === item.id 
                                      ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200')
                                      : (isDarkMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-stone-200 hover:shadow-md hover:border-stone-300')
                              }`}
                          >
                              <div className="pr-8">
                                  <div className={`font-bold text-lg mb-1 ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                                      Practice: <span className="moe-font font-normal">{item.focusCharacters?.join(', ')}</span>
                                  </div>
                                  <div className="flex gap-2 mt-3">
                                      {item.focusCharacters?.map((c, i) => (
                                          <span key={i} className={`px-2 py-1 rounded-lg text-lg moe-font border ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-stone-100 border-stone-200 text-stone-700'}`}>
                                              {c}
                                          </span>
                                      ))}
                                  </div>
                              </div>
                              
                              <div className={`text-[10px] uppercase font-bold tracking-widest shrink-0 self-start sm:self-auto ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                                  {new Date(item.timestamp).toLocaleDateString()}
                              </div>
                              
                              <button
                                  onClick={(e) => deleteHistoryItem(item.id, e)}
                                  className={`absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isDarkMode ? 'hover:bg-red-500/20 text-zinc-600 hover:text-red-400' : 'hover:bg-red-50 text-stone-300 hover:text-red-600'}`}
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}
    </div>
  );
}