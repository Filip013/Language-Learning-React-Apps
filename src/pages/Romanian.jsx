import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Volume2, Pause, Lightbulb, CheckCircle, Check, 
  Search, Tag, Hash, Sun, Moon, Globe, Layers, Clock, 
  Copy, Trash2, XCircle, Sparkles, Loader2, ChevronDown, 
  MessageSquare, Upload, Download, Eye, ArrowLeft 
} from 'lucide-react';
import firebase, { auth, db } from '../firebase';

// --- UTILS ---
const removeDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- GEMINI LIVE TTS WEBSOCKET ---
let ws = null;
let audioContext = null;
let nextAudioTime = 0;
let lastSourceNode = null;
let currentOnComplete = null;
let currentOnError = null;

function playPCMChunk(base64Data) {
    if (!audioContext) return;
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const int16Array = new Int16Array(bytes.buffer);
    const audioBuffer = audioContext.createBuffer(1, int16Array.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    const currentTime = audioContext.currentTime;
    if (nextAudioTime < currentTime) nextAudioTime = currentTime + 0.05;
    source.start(nextAudioTime);
    nextAudioTime += audioBuffer.duration;
    lastSourceNode = source;
}

const stopSpeak = () => {
    if (ws) { ws.close(); ws = null; }
    if (lastSourceNode) {
        try { lastSourceNode.stop(); } catch(e) {}
        lastSourceNode.onended = null;
        lastSourceNode = null;
    }
    if (audioContext) nextAudioTime = audioContext.currentTime; 
    if (currentOnComplete) currentOnComplete();
    currentOnComplete = null;
    currentOnError = null;
};

const handleSpeak = (text, onComplete = null, onError = null) => {
    if (!text || !text.trim()) return;
    const myKey = localStorage.getItem('geminiApiKey');
    if (!myKey) {
        alert("API key not found. Please set your Gemini API Key in the Hub settings for Audio.");
        if (onError) onError();
        return;
    }

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    if (audioContext.state === 'suspended') audioContext.resume();
    
    stopSpeak();

    nextAudioTime = audioContext.currentTime;
    currentOnComplete = onComplete;
    currentOnError = onError;

    const sendAudioRequest = () => {
        ws.send(JSON.stringify({ realtimeInput: { text: text } }));
    };

    const setupMessageHandlers = () => {
        ws.onmessage = async (event) => {
            let rawData = event.data;
            if (rawData instanceof Blob) rawData = await rawData.text();
            const msg = JSON.parse(rawData);
            
            if (msg.serverContent) {
                if (msg.serverContent.modelTurn) {
                    for (const part of msg.serverContent.modelTurn.parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                            playPCMChunk(part.inlineData.data);
                        }
                    }
                }
                if (msg.serverContent.turnComplete) {
                    if (lastSourceNode && currentOnComplete) {
                        const cb = currentOnComplete;
                        currentOnComplete = null;
                        lastSourceNode.onended = () => { cb(); };
                    } else if (currentOnComplete) {
                        currentOnComplete();
                        currentOnComplete = null;
                    }
                }
            }
        };
        ws.onerror = (e) => {
            console.error("TTS WebSocket Error:", e);
            if (currentOnError) currentOnError();
            alert("Audio connection failed. Check your API key or try again later.");
        };
    };

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${myKey.trim()}`);
        ws.onopen = () => {
            const setupMessage = {
                setup: {
                    model: "models/gemini-3.1-flash-live-preview",
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } }
                    },
                    systemInstruction: { parts: [{ text: "You are a bilingual text-to-speech reader. Read the text provided aloud exactly as written. Switch naturally between Romanian and English based on the text. Do not translate. Do not add any conversational filler or introductions. Provide clear pauses between sentences." }] }
                }
            };
            ws.send(JSON.stringify(setupMessage));
            setTimeout(sendAudioRequest, 500);
        };
        setupMessageHandlers();
    } else {
        setupMessageHandlers();
        sendAudioRequest();
    }
};

export default function Romanian() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [episodesList, setEpisodesList] = useState([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [globalDictionary, setGlobalDictionary] = useState([]);
  
  const [progress, setProgress] = useState({ mastered: {}, quizAnswers: {}, quizGraded: {}, quizRevealed: {} });
  
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  
  // Dictionary State
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fileInputRef = useRef(null);
  const scrollPositions = useRef({});

  // Handle Authentication
  useEffect(() => {
      const unsub = auth.onAuthStateChanged(setUser);
      return () => unsub();
  }, []);

  const handleTabSwitch = (newTab) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(newTab);
    setTimeout(() => { window.scrollTo({ top: scrollPositions.current[newTab] || 0, behavior: 'instant' }); }, 0);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handler = e => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    if (!user) return;
    const unsubLex = db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('database').doc('lexicon')
      .onSnapshot(snap => {
        setGlobalDictionary(snap.exists && snap.data().entries ? snap.data().entries : []);
      });

    const unsubEps = db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('episodes')
      .orderBy('timestamp', 'desc').onSnapshot(snap => {
        const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEpisodesList(eps);
        if (eps.length > 0 && !activeEpisodeId && !isGenerating) setActiveEpisodeId(eps[0].id);
      });
    return () => { unsubLex(); unsubEps(); };
  }, [user]);

  useEffect(() => {
    if (!user || !activeEpisodeId) return;
    db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId)
      .get().then(snap => { if (snap.exists) setActiveEpisode(snap.data()); });
    
    const unsubProg = db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId)
      .onSnapshot(snap => {
        if (snap.exists) {
          const d = snap.data(); 
          setProgress({ mastered: d.mastered||{}, quizAnswers: d.quizAnswers||{}, quizGraded: d.quizGraded||{}, quizRevealed: d.quizRevealed||{} });
        } else {
          setProgress({ mastered: {}, quizAnswers: {}, quizGraded: {}, quizRevealed: {} });
        }
      });
    return () => unsubProg();
  }, [user, activeEpisodeId]);

  const updateProgress = async (fields) => {
    if (!user || !activeEpisodeId) return;
    setProgress(p => ({ ...p, ...fields }));
    try { 
      await db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set(fields, { merge: true }); 
    } catch (err) {}
  };

  // --- FLATTEN DRILLS FOR UI ---
  const drillsFlattened = useMemo(() => {
    if (!activeEpisode || !Array.isArray(activeEpisode.drills)) return [];
    const list = [];
    activeEpisode.drills.forEach((dr, drIdx) => {
      if (!Array.isArray(dr.examples)) return;
      dr.examples.forEach((ex, idx) => {
        list.push({
          id: `dr_${drIdx}_${idx}`, 
          wordId: `dr_${drIdx}`, 
          targetText: ex.romanian, 
          english: ex.english
        });
      });
    });
    return list;
  }, [activeEpisode]);

  // --- DICTIONARY LOGIC ---
  const filteredVocab = useMemo(() => {
    const q = removeDiacritics(searchTerm);
    return (globalDictionary || []).filter(w => !q || removeDiacritics(w.romanian).includes(q) || removeDiacritics(w.english).includes(q));
  }, [searchTerm, globalDictionary]);

  const deleteWord = async (id) => {
    if (!user) return;
    const newDict = globalDictionary.filter(i => i.id !== id);
    await db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('database').doc('lexicon').set({ entries: newDict });
    setDeletingId(null);
  };

  // --- PROMPT EXPORT ENGINE ---
  const handleExportPrompt = async () => {
    if (!topicInput.trim() || !user) return;
    setIsGenerating(true); setGenError('');
    
    try {
      const epsSnapshot = await db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('episodes')
          .orderBy('timestamp', 'desc').limit(5).get();
      
      let richContext = "";
      for (const docSnap of epsSnapshot.docs) {
        const ep = docSnap.data();
        const progSnap = await db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('progress').doc(docSnap.id).get();
        const prog = progSnap.exists ? progSnap.data() : {};
        const score = ep.quiz ? ep.quiz.filter((q, i) => prog.quizAnswers?.[`quiz_${i}`] === q.correct).length : 0;
        
        let drillSentences = [];
        if (Array.isArray(ep.drills)) {
          ep.drills.forEach(d => { if (Array.isArray(d.examples)) d.examples.forEach(ex => { if (ex.romanian) drillSentences.push(ex.romanian); }); });
        }
        
        let quizQuestions = [];
        if (Array.isArray(ep.quiz)) {
          ep.quiz.forEach(q => { if (q.text) quizQuestions.push(q.text.replace(/_{3,}/, q.correct || '____')); });
        }

        richContext += `\n--- Episode: ${ep.title} ---\nUser Request: ${ep.userPrompt || 'None'}\nReading: ${ep.reading?.romanian}\nDrilled Target Words: ${ep.reading?.focus?.map(f=>f.word).join(', ')}\nDrill Sentences: ${drillSentences.join(' | ')}\nQuiz Sentences: ${quizQuestions.join(' | ')}\nQuiz Score: ${score}/${ep.quiz?.length || 15}\n`;
      }

      const vocabContext = globalDictionary.map(d => d.romanian).join(', ');

      const systemInstruction = `You are an expert Romanian curriculum designer. Generate a highly structured A2/B1 lesson. 
      
      CRITICAL RULE: You MUST strictly follow the requested JSON array lengths. Do not leave fields blank.
      
      TASKS:
      1. 'reading': An A2/B1 passage (3 paragraphs, separated by \\n\\n) and its English translation.
      2. 'focus': EXACTLY 5 target words from the reading, with nuance/grammar notes.
      3. 'drills': EXACTLY 5 objects. Each MUST have EXACTLY 5 example sentences in RO/EN.
      4. 'quiz': EXACTLY 15 questions testing the reading and past context. Use '_____' (5 underscores) for the blank.
      5. 'newLemmas': Extract new base words from the reading that are NOT in the KNOWN VOCABULARY. 'pos' MUST be 1-2 words only (e.g., 'Noun', 'Verb').`;

      const outputFormat = `{
"title": "Lesson Title",
"tutorIntroduction": "Short engaging intro",
"closingNotes": "Short closing remarks",
"reading": {
"romanian": "3 paragraphs separated by \\n\\n",
"english": "English translation",
"focus": [{ "word": "word", "explanation": "Grammar/nuance note" }]
},
"drills": [
{
  "word": "word",
  "translation": "translation",
  "examples": [{ "romanian": "...", "english": "..." }]
}
],
"quiz": [
{
  "text": "Sentence with _____",
  "translation": "English hint",
  "correct": "answer",
  "options": ["wrong1", "wrong2", "wrong3", "answer"]
}
],
"newLemmas": [
{ "romanian": "...", "english": "...", "pos": "Noun" }
]
}`;

      const exportedText = `SYSTEM INSTRUCTION:\n${systemInstruction}\n\nKNOWN VOCABULARY:\n[${vocabContext}]\n\nCONTEXT (Last 5 lessons for reference):\n${richContext}\n\nUSER REQUEST:\n${topicInput}\n\n---\n\nOUTPUT FORMAT (Raw JSON only):\n${outputFormat}`;

      const blob = new Blob([exportedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Romanian_Prompt_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      setGenError("Failed to build prompt: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- JSON IMPORT ENGINE ---
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let textToParse = event.target.result.trim();
        if (textToParse.startsWith('```json')) textToParse = textToParse.replace(/^```json\n?/, '');
        else if (textToParse.startsWith('```')) textToParse = textToParse.replace(/^```\n?/, '');
        if (textToParse.endsWith('```')) textToParse = textToParse.replace(/\n?```$/, '');

        const lessonJSON = JSON.parse(textToParse);
        const newEpisodeId = `ep_${Date.now()}`;
        
        if (lessonJSON.quiz) lessonJSON.quiz.forEach(q => { if (q.options) q.options = shuffleArray(q.options); });

        const episodeDoc = { ...lessonJSON, id: newEpisodeId, timestamp: Date.now(), userPrompt: topicInput || "Imported JSON Lesson" };
        
        const safeLemmas = Array.isArray(lessonJSON.newLemmas) ? lessonJSON.newLemmas : [];
        delete episodeDoc.newLemmas; 
        
        const combinedDictionary = [
          ...safeLemmas.map(l => ({ ...l, id: `dict_${Date.now()}_${Math.random().toString(36).substring(7)}` })), 
          ...globalDictionary
        ];
        
        const batch = db.batch();
        batch.set(db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('episodes').doc(newEpisodeId), episodeDoc);
        batch.set(db.collection('artifacts').doc('romanian-master').collection('users').doc(user.uid).collection('database').doc('lexicon'), { entries: combinedDictionary }, { merge: true });
        await batch.commit();

        setActiveEpisodeId(newEpisodeId);
        setTopicInput('');
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        alert("Import failed. Make sure the file contains valid JSON.");
      }
    };
    reader.readAsText(file);
  };

  const isFullyGraded = (activeEpisode?.quiz && Array.isArray(activeEpisode.quiz)) ? Object.keys(progress.quizGraded || {}).length === activeEpisode.quiz.length : false;
  const getQuizScore = () => (activeEpisode?.quiz && Array.isArray(activeEpisode.quiz)) ? activeEpisode.quiz.filter((q, i) => progress.quizGraded?.[`quiz_${i}`] && progress.quizAnswers?.[`quiz_${i}`] === q.correct).length : 0;

  // PLAY BUTTON COMPONENT
  function PlayBtn({ id, textToSpeak, onMaster }) {
      const [isPlaying, setIsPlaying] = useState(false);
      return (
          <button 
              disabled={isGenerating} 
              onClick={() => {
                  if (isPlaying) {
                      stopSpeak();
                      setIsPlaying(false);
                      return;
                  }
                  setIsPlaying(true);
                  handleSpeak(
                      textToSpeak, 
                      () => { setIsPlaying(false); if (onMaster) onMaster(); },
                      () => { setIsPlaying(false); }
                  );
              }} 
              className={`flex items-center justify-center p-3 rounded-full transition-all border ${isPlaying ? 'bg-indigo-500/20 text-indigo-500 border-indigo-500/50 shadow-inner' : isDarkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border-zinc-700' : 'bg-white text-stone-500 hover:bg-stone-50 hover:text-indigo-600 border-stone-200 shadow-sm'}`}
          >
              {isPlaying ? <Pause size={18} className="animate-pulse text-indigo-500" /> : <Volume2 size={18} />}
          </button>
      );
  }

  // UI CONSTANTS
  const cardClass = `p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`;
  const headerClass = `flex items-center justify-between mb-6 pb-4 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-100'}`;

  if (!user) return null;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 flex flex-col ${isDarkMode ? 'bg-zinc-950 text-zinc-300' : 'bg-stone-50 text-stone-900'}`}>
      
      <header className={`sticky top-0 z-50 w-full backdrop-blur-md transition-colors duration-300 border-b ${isDarkMode ? 'bg-zinc-950/85 border-zinc-800' : 'bg-white/90 border-stone-200'}`}>
        <nav className={`py-2 px-4 md:px-6 flex items-center justify-between border-b ${isDarkMode ? 'border-zinc-800/50' : 'border-stone-100'}`}>
          <div className="flex items-center gap-3">
            <Link to="/" className={`p-1.5 rounded-xl border transition-all active:scale-90 ${isDarkMode ? 'bg-zinc-850 border-zinc-700 text-zinc-400 hover:text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'}`}>
              <ArrowLeft size={16} />
            </Link>
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm shadow-indigo-900/20"><Globe size={18} /></div>
            <span className="text-lg font-bold tracking-tight">Romanian Cloud</span>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <button onClick={() => !isGenerating && setDropdownOpen(!dropdownOpen)} disabled={isGenerating} className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-indigo-400 hover:bg-zinc-700' : 'border-stone-200 bg-stone-50 text-indigo-700 hover:bg-stone-100'}`}>
                <span className="max-w-[120px] sm:max-w-[200px] truncate">{activeEpisode ? activeEpisode.title : 'Episodes'}</span>
                <ChevronDown size={14} />
              </button>
              {dropdownOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden z-50 ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-stone-200'}`}>
                  <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
                  <div className="max-h-64 overflow-y-auto">
                    {episodesList.map(ep => (
                      <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); setActiveTab('studio'); setDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-700') : (isDarkMode ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-50 text-stone-700')}`}>
                        {ep.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1.5 rounded-full border transition-all active:scale-90 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-indigo-400' : 'bg-stone-50 border-stone-200 text-indigo-600'}`}>
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </nav>

        <div className="max-w-4xl w-full mx-auto px-4">
          <div className="flex overflow-x-auto no-scrollbar">
            {[
              { id: 'studio', icon: MessageSquare, label: 'Studio' },
              { id: 'reading', icon: BookOpen, label: 'Reading', disabled: !activeEpisode?.reading?.romanian },
              { id: 'drills', icon: Layers, label: 'Drills', disabled: !activeEpisode?.drills?.length },
              { id: 'quiz', icon: CheckCircle, label: 'Quiz', disabled: !activeEpisode?.quiz?.length },
              { id: 'dictionary', icon: Hash, label: 'Dictionary' }
            ].map(tab => (
              <button key={tab.id} disabled={tab.disabled} onClick={() => handleTabSwitch(tab.id)} className={`py-3 px-3 sm:px-5 text-sm font-bold border-b-2 -mb-[1px] transition-all flex items-center gap-2 shrink-0 ${tab.disabled ? 'opacity-30 cursor-not-allowed' : activeTab === tab.id ? (isDarkMode ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-700') : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
                <tab.icon size={16} /> <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 pt-6 pb-16 flex-1 flex flex-col">
        {activeTab === 'studio' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <header className="mb-4 flex items-center gap-4">
              <div className="p-4 bg-indigo-800 text-indigo-50 rounded-2xl shadow-lg"><MessageSquare size={32} /></div>
              <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Lesson Studio</h2><p className={`text-sm mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>Your personal AI language tutor</p></div>
            </header>

            <section className={cardClass}>
              <h3 className="text-xl font-bold mb-4">{activeEpisode ? "Start a new lesson" : "What do you want to learn today?"}</h3>
              <div className="flex flex-col gap-4">
                <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} disabled={isGenerating} placeholder="e.g., A short story about vampires in Transylvania..." className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-stone-50 border-stone-200 text-stone-900'}`} />
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={handleExportPrompt} disabled={isGenerating || !topicInput.trim()} className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>
                    {isGenerating ? <Loader2 className="w-5 h-5" /> : <Download className="w-5 h-5" />} Export Prompt File
                  </button>
                  <label className={`cursor-pointer flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>
                    <Upload className="w-5 h-5" /> Import JSON File
                    <input type="file" accept=".json,.txt" ref={fileInputRef} onChange={handleFileUpload} disabled={isGenerating} className="hidden" />
                  </label>
                </div>
              </div>
              {genError && <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-medium">{genError}</div>}
            </section>

            {activeEpisode && (activeEpisode.userPrompt || activeEpisode.tutorIntroduction) && (
              <div className="space-y-6 pt-4">
                {activeEpisode.userPrompt && (
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>You</span>
                    <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tr-sm shadow-sm border ${isDarkMode ? 'bg-zinc-800/80 border-zinc-700' : 'bg-white border-stone-200'}`}>
                      <p className="text-lg leading-relaxed">{activeEpisode.userPrompt}</p>
                    </div>
                  </div>
                )}
                {activeEpisode.tutorIntroduction && (
                  <div className="flex flex-col items-start animate-in fade-in">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-indigo-500' : 'text-indigo-600'}`}>Tutor</span>
                    <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tl-sm shadow-sm border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/50 text-indigo-100' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
                      <p className="text-lg leading-relaxed">{activeEpisode.tutorIntroduction}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button onClick={() => setActiveTab('reading')} className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${isDarkMode ? 'bg-indigo-800/50 hover:bg-indigo-800' : 'bg-indigo-200/50 hover:bg-indigo-200 text-indigo-800'}`}>Go to Reading</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reading' && activeEpisode?.reading && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <header className="mb-8 flex items-center gap-4">
              <div className="p-4 bg-indigo-800 text-indigo-50 rounded-2xl shadow-lg"><Globe size={32} /></div>
              <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{activeEpisode.title}</h2><p className={`text-sm mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>Romanian • A2/B1</p></div>
            </header>

            <section className={cardClass}>
              <div className={headerClass}>
                <div className="flex items-center gap-3"><BookOpen className="text-indigo-600" size={24} /><h2 className="text-xl sm:text-2xl font-bold tracking-wide">Reading</h2></div>
                <PlayBtn id="read-ro" textToSpeak={activeEpisode.reading.romanian} />
              </div>
              <div className="prose prose-lg max-w-none leading-relaxed text-xl space-y-6">
                {typeof activeEpisode.reading.romanian === 'string' && activeEpisode.reading.romanian.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>

            {activeEpisode.reading.english && (
              <section className={cardClass}>
                <div className={headerClass}>
                  <div className="flex items-center gap-3"><BookOpen className="text-indigo-600" size={24} /><h2 className="text-xl sm:text-2xl font-bold tracking-wide">Translation</h2></div>
                  <PlayBtn id="read-en" textToSpeak={activeEpisode.reading.english} />
                </div>
                <div className={`prose prose-lg max-w-none leading-relaxed text-lg italic space-y-6 ${isDarkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
                  {typeof activeEpisode.reading.english === 'string' && activeEpisode.reading.english.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </section>
            )}

            {Array.isArray(activeEpisode.reading.focus) && activeEpisode.reading.focus.length > 0 && (
              <section className={cardClass}>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100 dark:border-zinc-800">
                  <Lightbulb className="text-amber-500" size={24} />
                  <h2 className="text-xl sm:text-2xl font-bold tracking-wide">Focus Vocabular & Gramatică</h2>
                </div>
                <div className="space-y-4">
                  {activeEpisode.reading.focus.map((item, idx) => (
                    <div key={idx} className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-zinc-950/45 border-zinc-800' : 'bg-stone-50 border-stone-200'}`}>
                      <h3 className="font-bold text-lg text-indigo-500 mb-2">{idx + 1}. {item.word}</h3>
                      <p className="text-base leading-relaxed">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'drills' && activeEpisode?.drills && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <header className="mb-8">
              <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-800 text-indigo-50 rounded-2xl shadow-lg"><Layers size={32} /></div>
                  <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Exerciții</h2></div>
                </div>
                <div className="text-right pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 text-indigo-600">Progres</span>
                  <span className="text-3xl font-black">{drillsFlattened.length > 0 ? Math.round((Object.keys(progress.mastered || {}).length / drillsFlattened.length) * 100) : 0}%</span>
                </div>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-zinc-800' : 'bg-stone-200'}`}>
                <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000" style={{ width: `${drillsFlattened.length > 0 ? (Object.keys(progress.mastered || {}).length / drillsFlattened.length) * 100 : 0}%` }} />
              </div>
            </header>

            <div className="space-y-12">
              {Array.isArray(activeEpisode.drills) && activeEpisode.drills.map((dr, drIdx) => (
                <section key={drIdx} className="space-y-6">
                  <div className={`flex items-center gap-3 pb-2 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-200'}`}>
                    <Clock className="text-indigo-500" size={20} />
                    <h3 className="text-xl font-bold tracking-wide">{drIdx + 1}. {dr.word} ({dr.translation})</h3>
                  </div>
                  <div className="space-y-4">
                    {drillsFlattened.filter(c => c.wordId === `dr_${drIdx}`).map((chunk, idx) => {
                      const isMastered = progress.mastered?.[chunk.id];
                      const textToRead = `${chunk.targetText}. ${chunk.english}. ${chunk.targetText}`;
                      return (
                        <div key={idx} className={`rounded-2xl p-5 border shadow-sm transition-all duration-300 ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                          <div className={`flex items-center justify-between mb-4 border-b pb-3 ${isDarkMode ? 'border-zinc-800/85' : 'border-stone-200/50'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-6 h-6 rounded-full border ${isMastered ? 'bg-indigo-100 border-indigo-50 text-indigo-600' : isDarkMode ? 'border-zinc-700 text-zinc-800' : 'border-stone-300 text-stone-200'}`}><Check size={14} /></div>
                              <h4 className={`font-bold uppercase text-sm tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>EXEMPLU {idx + 1}</h4>
                            </div>
                            <PlayBtn id={chunk.id} textToSpeak={textToRead} onMaster={() => updateProgress({ mastered: { ...progress.mastered, [chunk.id]: true } })} />
                          </div>
                          <div className={`space-y-2 transition-all duration-700 ${!isMastered ? 'blur-md opacity-30 select-none pointer-events-none' : 'blur-0 opacity-100'}`}>
                            <p className="font-medium text-xl leading-relaxed">{chunk.targetText}</p>
                            <p className={`italic text-lg leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>{chunk.english}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'quiz' && activeEpisode?.quiz && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <header className="mb-8 flex justify-between items-end">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-800 text-indigo-50 rounded-2xl shadow-lg"><CheckCircle size={32} /></div>
                <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Quiz</h2></div>
              </div>
              <div className="text-right pb-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${isFullyGraded ? 'text-amber-500' : 'text-indigo-600'}`}>{isFullyGraded ? 'Scor' : 'Progres'}</span>
                <span className={`text-3xl font-black ${isFullyGraded ? 'text-amber-500' : ''}`}>{isFullyGraded ? getQuizScore() : Object.keys(progress.quizGraded || {}).length} / {activeEpisode.quiz.length}</span>
              </div>
            </header>

            <div className="space-y-6">
              {Array.isArray(activeEpisode.quiz) && activeEpisode.quiz.map((q, idx) => {
                const qId = `quiz_${idx}`;
                const isGraded = progress.quizGraded?.[qId];
                const pAnswer = progress.quizAnswers?.[qId];
                
                return (
                  <div key={idx} className={`${cardClass}`}>
                    <p className="text-xl font-medium mb-5 leading-relaxed">
                      <span className="font-bold mr-3 opacity-50">{idx + 1}.</span>
                      {typeof q.text === 'string' && q.text.split(/_{3,}/).map((part, i, arr) => (
                        <Fragment key={i}>
                            {part}
                            {i < arr.length - 1 && (
                            <span className={`mx-1 px-3 py-1 font-bold rounded-lg border text-base ${pAnswer ? (isGraded ? (pAnswer === q.correct ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-red-100 text-red-800 border-red-300 line-through') : (isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-900')) : (isDarkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-100 text-slate-400')}`}>{pAnswer || "___"}</span>
                            )}
                        </Fragment>
                        ))}
                    </p>

                    {!progress.quizRevealed?.[qId] ? (
                      <button disabled={isGenerating} onClick={() => updateProgress({ quizRevealed: { ...progress.quizRevealed, [qId]: true } })} className={`flex items-center px-4 py-2.5 rounded-xl border text-xs font-bold uppercase ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-indigo-400' : 'text-indigo-700 bg-white border-indigo-200'}`}><Eye className="w-4 h-4 mr-2" /> Vezi opțiunile</button>
                    ) : (
                      <div className="animate-in fade-in">
                        <p className={`text-sm italic mb-5 border-l-2 pl-3 ${isDarkMode ? 'text-zinc-400 border-zinc-800' : 'text-stone-500 border-stone-300'}`}>{q.translation}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          {Array.isArray(q.options) && q.options.map((opt, optIdx) => (
                            <button key={`${opt}-${optIdx}`} onClick={() => !isGraded && updateProgress({ quizAnswers: { ...progress.quizAnswers, [qId]: opt } })} disabled={isGraded || isGenerating} className={`px-4 py-3 rounded-xl border text-sm font-medium ${isGraded ? (q.correct === opt ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-600' : pAnswer === opt ? 'bg-red-500/10 text-red-400/50 line-through' : 'opacity-50') : (pAnswer === opt ? 'bg-indigo-600 text-white border-indigo-500' : isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300')}`}>{opt}</button>
                          ))}
                        </div>
                        <div className="flex justify-end mt-2">
                          {pAnswer && !isGraded && <button disabled={isGenerating} onClick={() => { updateProgress({ quizGraded: { ...progress.quizGraded, [qId]: true } }); handleSpeak(q.text.replace(/_{3,}/, q.correct)); }} className="flex items-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold"><CheckCircle className="w-4 h-4 mr-2" /> Verifică</button>}
                          {isGraded && <PlayBtn id={qId} textToSpeak={q.text.replace(/_{3,}/, q.correct)} />}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'dictionary' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="mb-8 flex flex-col md:flex-row justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-800 text-indigo-50 rounded-2xl"><Hash size={32} /></div>
                <div><h2 className="text-2xl font-bold">Cloud Dictionary</h2><p className="text-sm">{globalDictionary?.length || 0} cuvinte în baza de date.</p></div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder="Caută..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-stone-300'}`} 
                  />
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVocab.map(item => (
                <div key={item.id} className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-serif font-medium">{item.romanian}</h3>
                      <div className="flex gap-2 items-center">
                        {item.pos && <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded-md border text-indigo-600 dark:text-indigo-400">{item.pos}</span>}
                        {deletingId === item.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => deleteWord(item.id)} className="text-red-500 text-xs font-bold uppercase transition-transform active:scale-95">Confirm</button>
                            <button onClick={() => setDeletingId(null)}><XCircle size={14} className="text-stone-400 cursor-pointer" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(item.id)}><Trash2 size={14} className="text-stone-400 hover:text-red-500 cursor-pointer transition-colors" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-zinc-800/50 flex items-start gap-2"><Tag className="w-3.5 h-3.5 mt-0.5 text-zinc-400" /><p className="text-sm font-medium">{item.english}</p></div>
                </div>
              ))}
              {filteredVocab.length === 0 && (
                <div className="col-span-full p-10 text-center text-stone-500 italic">No matching vocabulary found.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}