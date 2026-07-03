
import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Volume2, RotateCcw, MessageSquare, Sun, Moon, 
  BookMarked, Eye, CheckCircle2, ChevronDown, AlertCircle, 
  Search, Book, Trash2, XCircle, Copy, Award, Upload, 
  Download, List, Loader2, ArrowLeft 
} from 'lucide-react';
import firebase, { auth, db } from '../firebase';

const dbAppId = 'mandarin-master';

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

const handleSpeak = (text, onComplete = null, onError = null) => {
    if (!text || !text.trim()) return;
    const myKey = localStorage.getItem('geminiApiKey');
    if (!myKey) {
        alert("API key not found. Please set your Gemini API Key in your other app or environment first.");
        if (onError) onError();
        return;
    }

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    nextAudioTime = audioContext.currentTime;
    lastSourceNode = null;
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
                    const parts = msg.serverContent.modelTurn.parts;
                    for (const part of parts) {
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
                    systemInstruction: { parts: [{ text: "You are a bilingual text-to-speech reader. Read the text provided aloud exactly as written. Switch naturally between Mandarin Chinese and English based on the text. Do not translate the text. Do not add any conversational filler, introductions, or extra words. Provide clear pauses between sentences." }] }
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

// --- UTILITIES ---
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function PlayButton({ isDarkMode, onClick, size = 24, isLoading = false }) {
  const colorClasses = isDarkMode ? 'bg-stone-700 text-stone-300 hover:bg-stone-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200';
  return (
    <button disabled={isLoading} onClick={onClick} className={`flex items-center justify-center rounded-full transition-colors p-3 ${colorClasses} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {isLoading ? <Loader2 size={size} className="animate-spin text-amber-500" /> : <Volume2 size={size} />}
    </button>
  );
}

// --- SUB-TABS ---
function EpisodeTab({ isDarkMode, activeEpisode }) {
  const [playingId, setPlayingId] = useState(null);

  if (!activeEpisode?.story) return <div className="p-10 text-center font-sans opacity-50">No audio generated yet.</div>;

  const versions = [
    { id: 'traditional', title: '繁體中文 (Traditional)', fontClass: 'moe-font text-[28px] md:text-3xl leading-relaxed', text: activeEpisode.story.traditional },
    { id: 'english', title: 'English', fontClass: 'font-sans text-lg md:text-xl leading-relaxed', text: activeEpisode.story.english },
    { id: 'simplified', title: '简体中文 (Simplified)', fontClass: 'simp-font text-[28px] md:text-3xl leading-relaxed', text: activeEpisode.story.simplified },
    { id: 'pinyin', title: '拼音 (Pinyin)', fontClass: 'font-sans text-lg md:text-xl leading-relaxed', text: activeEpisode.story.pinyin }
  ].filter(v => v.text);

  const playAudio = (id, text) => {
    if (playingId) return;
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-8">
      <header className={`mb-12 border-b pb-8 text-center relative ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md transition-transform hover:scale-105 ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}>
          <BookOpen size={32} />
        </div>
        <h1 className={`text-4xl font-bold mb-3 tracking-wider moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
          {activeEpisode.title || 'Story Content'}
        </h1>
        <p className={`text-lg font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>AI-Generated Chapter</p>
      </header>

      <main className="space-y-8">
        {versions.map((v) => {
          const isChineseScript = v.id === 'traditional' || v.id === 'simplified';

          return (
            <section key={v.id} className={`p-6 md:p-10 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
              <div className={`flex items-center justify-between mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
                <h2 className={`text-2xl font-bold tracking-wide font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{v.title}</h2>
                {v.id !== 'pinyin' && (
                  <div className="flex items-center gap-2">
                    <PlayButton 
                      isDarkMode={isDarkMode}
                      isLoading={playingId === v.id}
                      onClick={() => playAudio(v.id, v.text)}
                    />
                  </div>
                )}
              </div>
              <div className={`space-y-4 ${v.fontClass} ${isChineseScript ? (isDarkMode ? 'text-stone-100' : 'text-stone-800') : (isDarkMode ? 'text-stone-300' : 'text-stone-700')}`}>
                {v.text.split('\n\n').map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function DrillTab({ isDarkMode, activeEpisode, progressState, updateFirebase }) {
  const listenedIds = progressState.listenedDrills || [];
  const [playingId, setPlayingId] = useState(null);

  if (!activeEpisode?.drills?.length) return <div className="p-10 text-center font-sans opacity-50">No drills generated yet.</div>;

  const playDrill = (ex, exId, isListened) => {
    if (playingId) return;
    setPlayingId(exId);
    const textToRead = `${ex.traditional}。\n\n${ex.english}\n\n${ex.traditional}。`;
    
    handleSpeak(
      textToRead, 
      () => {
        setPlayingId(null);
        if (!isListened) updateFirebase({ listenedDrills: [...listenedIds, exId] });
      },
      () => setPlayingId(null)
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-16 py-12 px-4 md:px-8">
      <header className={`mb-8 border-b pb-6 text-center ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md transition-transform hover:scale-105 ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}>
          <BookMarked size={32} />
        </div>
        <h1 className={`text-3xl font-bold flex justify-center items-center gap-3 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
          Interactive Audio Drills
        </h1>
      </header>

      {activeEpisode.drills.map((section, sectionIdx) => (
        <section key={sectionIdx} className={`space-y-8 p-6 md:p-10 rounded-2xl shadow-sm border animate-in fade-in ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
          <div className="text-center mb-8">
            <div className={`inline-block rounded-2xl p-6 md:p-8 border shadow-sm ${isDarkMode ? 'bg-stone-700 border-stone-600 text-stone-100' : 'bg-stone-100 border-stone-200 text-stone-800'}`}>
              <h2 className="text-6xl md:text-7xl moe-font tracking-widest">{section.word}</h2>
              <p className="mt-4 font-sans text-xl opacity-70">{section.pinyin}</p>
            </div>
          </div>
          <div className="space-y-10 pl-2">
            {section.examples?.map((ex, exIndex) => {
              const exId = `drill-${sectionIdx}-${exIndex}`;
              const isListened = listenedIds.includes(exId);

              return (
                <div key={exId} className={`group border-b pb-8 last:border-0 last:pb-0 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-bold font-sans tracking-wide ${isDarkMode ? 'text-stone-400' : 'text-stone-450'}`}>
                        Example {exIndex + 1}
                      </h3>
                      {isListened && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                          Listened ✓
                        </span>
                      )}
                    </div>
                    <PlayButton 
                      isDarkMode={isDarkMode}
                      isLoading={playingId === exId}
                      onClick={() => playDrill(ex, exId, isListened)}
                      size={20}
                    />
                  </div>

                  {!isListened ? (
                    <div 
                      onClick={() => playDrill(ex, exId, isListened)}
                      className={`flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-stone-700 bg-stone-900/30 text-stone-500 hover:bg-stone-800' : 'border-stone-200 bg-stone-50/50 text-stone-400 hover:bg-stone-100'}`}
                    >
                      {playingId === exId ? (
                        <Loader2 size={32} className="opacity-40 mb-2 animate-spin text-amber-500" />
                      ) : (
                        <Volume2 size={32} className="opacity-40 mb-2 animate-pulse" />
                      )}
                      <p className="font-sans text-sm font-medium tracking-wide mt-2">
                        {playingId === exId ? "[ 播放中... ]" : "[ 點擊播放音檔解鎖此例句 ]"}
                      </p>
                      <p className="font-sans text-xs opacity-60 mt-1">Click to play audio and reveal</p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-550">
                      <p className={`text-[28px] md:text-3xl moe-font leading-relaxed ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{ex.traditional}</p>
                      <p className={`text-lg md:text-xl font-sans leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{ex.english}</p>
                      <p className={`text-[28px] md:text-3xl simp-font leading-relaxed ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{ex.simplified}</p>
                      <p className={`text-lg md:text-xl font-sans leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{ex.pinyin}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {section.notes && section.notes.length > 0 && (
            <div className={`mt-12 p-6 md:p-8 rounded-xl border ${isDarkMode ? 'bg-stone-900 border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
              <h4 className={`text-sm uppercase tracking-wider mb-4 font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                <BookMarked size={16} /> Vocabulary & Synonym Notes
              </h4>
              <div className="space-y-4 font-sans">
                {section.notes.map((note, noteIdx) => (
                  <p key={noteIdx} className={`leading-relaxed text-lg ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>{note}</p>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function QuizTab({ isDarkMode, activeEpisode, progressState, updateFirebase }) {
  const [shuffledData, setShuffledData] = useState([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  const userSelections = progressState.selections || {};
  const revealedIds = progressState.revealed || [];
  const gradedIds = progressState.gradedIds || [];

  useEffect(() => {
    if (activeEpisode?.quiz) {
      const shuffled = activeEpisode.quiz.map((q, i) => {
        let opts = q.distractors ? [...q.distractors, q.answer] : [q.answer];
        opts = Array.from(new Set(opts));
        return { ...q, id: i, options: shuffleArray(opts) };
      });
      setShuffledData(shuffled);
    }
  }, [activeEpisode?.quiz]);

  if (!activeEpisode?.quiz?.length) return <div className="p-10 text-center font-sans opacity-50">No quiz generated yet.</div>;

  const handleSelect = (questionId, choice) => {
    if (gradedIds.includes(questionId)) return;
    updateFirebase({ selections: { ...userSelections, [questionId]: choice } });
  };

  const playAnswer = (id, text) => {
    if (playingId) return;
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  };

  const resetQuiz = () => { updateFirebase({ selections: {}, revealed: [], gradedIds: [] }); setShowConfirmReset(false); };

  const correctCount = Object.entries(userSelections).filter(([id, val]) => {
    const question = shuffledData.find(q => q.id === Number(id));
    return question && question.answer === val && gradedIds.includes(Number(id));
  }).length;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className={`mb-12 border-b-2 pb-8 flex justify-between items-end ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div>
          <h1 className={`text-4xl font-bold mb-2 moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Review Quiz</h1>
          <p className="text-stone-500 text-lg font-sans">Chapter Comprehension & Vocabulary</p>
        </div>
        {!showConfirmReset ? (
          <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-2 text-stone-400 hover:text-red-500 transition-colors text-sm font-sans">
            <RotateCcw size={16} /> 重置 (Reset)
          </button>
        ) : (
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-red-950/30 border-red-900' : 'bg-red-50 border-red-100'}`}>
            <AlertCircle size={16} className="text-red-500" />
            <button onClick={resetQuiz} className="text-red-600 font-bold text-sm">Yes</button>
            <span className="text-red-200">|</span>
            <button onClick={() => setShowConfirmReset(false)} className="text-stone-500 text-sm">No</button>
          </div>
        )}
      </header>

      <div className="space-y-16 pb-32">
        {shuffledData.map((q) => {
          const isRevealed = revealedIds.includes(q.id);
          const isGraded = gradedIds.includes(q.id);
          const userChoice = userSelections[q.id];
          const isCorrect = userChoice === q.answer;

          return (
            <div key={q.id} className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
              <div className="text-sm text-stone-400 font-bold mb-4 uppercase tracking-wider font-sans">Question {String(q.id + 1).padStart(2, '0')}</div>
              <p className={`text-[28px] md:text-3xl leading-relaxed mb-4 moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                {q.sentence?.replace('___', userChoice ? ` ${userChoice} ` : ' ＿＿＿ ')}
              </p>

              {!isRevealed ? (
                <button onClick={() => updateFirebase({ revealed: [...revealedIds, q.id] })} className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all shadow-sm font-sans text-sm ${isDarkMode ? 'bg-stone-700 text-stone-100 hover:bg-stone-600' : 'bg-stone-800 text-stone-100 hover:bg-stone-700'}`}>
                  <Eye size={16} /> 顯示選項 (Reveal Options)
                </button>
              ) : (
                <div className="animate-in fade-in duration-500">
                  <div className="mb-6"><p className="text-stone-400 italic font-sans text-lg">Hint: {q.englishHint}</p></div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
                    {q.options.map((option, optIdx) => {
                      const isSelected = userChoice === option;
                      const isThisCorrect = option === q.answer;
                      let btnClass = "px-4 py-3 rounded-md border-2 text-[28px] md:text-3xl transition-all text-center moe-font ";
                      if (!isGraded) btnClass += isSelected ? (isDarkMode ? "border-amber-500 bg-amber-900/30 text-amber-400" : "border-amber-400 bg-amber-50 text-amber-700") : (isDarkMode ? "border-stone-700 text-stone-300" : "border-stone-200 text-stone-600");
                      else btnClass += isThisCorrect ? (isDarkMode ? "border-emerald-600 bg-emerald-900/30 text-emerald-400 font-bold" : "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold") : (isSelected ? (isDarkMode ? "border-rose-700 bg-rose-900/30 text-rose-400 line-through opacity-80" : "border-rose-400 bg-rose-50 text-rose-600 line-through opacity-80") : (isDarkMode ? "border-stone-800 text-stone-600 opacity-50" : "border-stone-100 text-stone-400 opacity-50"));
                      return <button key={`${option}-${optIdx}`} disabled={isGraded} onClick={() => handleSelect(q.id, option)} className={btnClass}>{option}</button>;
                    })}
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    {!isGraded ? (
                     <button disabled={!userChoice} onClick={() => { if(userChoice) { updateFirebase({ gradedIds: [...gradedIds, q.id] }); playAnswer(`quiz-${q.id}`, q.sentence.replace('___', q.answer)); } }} className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors ${!userChoice ? 'bg-stone-300 text-stone-500' : (isDarkMode ? 'bg-amber-600 text-stone-900' : 'bg-amber-500 text-stone-900')}`}>
                        驗證答案 (Grade Answer)
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 animate-in duration-300 w-full justify-between">
                        <span className={`text-sm font-bold font-sans flex items-center gap-1.5 ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>{isCorrect ? "答對了 (Correct!)" : "答錯了 (Incorrect)"}</span>
                        <PlayButton 
                          isDarkMode={isDarkMode} 
                          isLoading={playingId === `quiz-${q.id}`}
                          onClick={() => playAnswer(`quiz-${q.id}`, q.sentence.replace('___', q.answer))} 
                          size={18} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className={`fixed bottom-0 left-0 right-0 p-6 backdrop-blur-md border-t font-sans z-10 ${isDarkMode ? 'bg-stone-900/90 border-stone-800' : 'bg-stone-50/90 border-stone-200'}`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center text-stone-500">
          <div className="flex gap-8 items-center">
            <div><span className="block text-xs uppercase tracking-tighter opacity-50">完成度 (Graded)</span><span className={`text-xl font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>{gradedIds.length} / {shuffledData.length}</span></div>
            {gradedIds.length > 0 && <div><span className="block text-xs uppercase tracking-tighter opacity-50">準確率 (Score)</span><span className="text-xl font-bold text-emerald-500 flex items-center gap-1">{correctCount} <CheckCircle2 size={18} /></span></div>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function LexiconTab({ isDarkMode, globalLexicon, user }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [deletingWord, setDeletingWord] = useState(null);

  const categories = useMemo(() => {
    if (!globalLexicon || Object.keys(globalLexicon).length === 0) return [];
    return [
      { id: 'all', label: 'All Words' },
      { id: 'accumulated', label: 'Accumulated', words: globalLexicon.accumulated || [] },
      { id: 'hsk4', label: 'HSK 4', words: globalLexicon.hsk4 || [] },
      { id: 'hsk3', label: 'HSK 3', words: globalLexicon.hsk3 || [] },
      { id: 'hsk2', label: 'HSK 2', words: globalLexicon.hsk2 || [] },
      { id: 'hsk1', label: 'HSK 1', words: globalLexicon.hsk1 || [] }
    ];
  }, [globalLexicon]);

  const filteredData = useMemo(() => {
    if (categories.length === 0) return [];
    const term = searchTerm.trim().toLowerCase();
    return categories.slice(1).map(cat => ({
      ...cat, words: term ? cat.words.filter(w => w.toLowerCase().includes(term)) : cat.words
    })).filter(cat => activeTab === 'all' || cat.id === activeTab);
  }, [searchTerm, activeTab, categories]);

  const handleDeleteConfirm = async (wordToDelete) => {
    if (!globalLexicon || !user) return;
    const newLex = { ...globalLexicon, accumulated: (globalLexicon.accumulated || []).filter(w => w !== wordToDelete) };
    try {
      await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc('lexicon').set(newLex);
    } catch (err) { console.error(err); }
    setDeletingWord(null);
  };

  if (!globalLexicon || Object.keys(globalLexicon).length === 0) return <div className="p-20 text-center text-stone-500 font-sans">Loading master lexicon...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className="mb-10 text-center">
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><Search size={32} /></div>
        <h1 className={`text-4xl font-bold mb-3 tracking-wide ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Mandarin Lexicon</h1>
      </header>

      <div className={`p-6 rounded-2xl shadow-sm border mb-8 sticky top-4 z-10 ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input type="text" placeholder="Search vocabulary..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 text-[28px] md:text-3xl focus:outline-none transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100' : 'bg-stone-50 border-stone-100'}`} />
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === cat.id ? (isDarkMode ? 'bg-stone-600 text-stone-100' : 'bg-stone-800 text-stone-100') : (isDarkMode ? 'bg-stone-900 text-stone-400 hover:bg-stone-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}`}>{cat.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-10">
        {filteredData.map(cat => {
          if (cat.words.length === 0) return null;
          const isAccumulated = cat.id === 'accumulated';
          return (
            <section key={cat.id} className="animate-in duration-500">
              <div className={`flex items-baseline justify-between mb-6 border-b-2 pb-2 ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
                <h2 className={`text-[28px] md:text-3xl font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{cat.label}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {cat.words.map((word, idx) => (
                  <div key={`${word}-${idx}`} className={`flex items-center gap-2 px-4 py-2 border rounded-lg shadow-sm cursor-default ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
                    <span className="moe-font text-[28px] md:text-3xl">{word}</span>
                    {isAccumulated && (
                      deletingWord === word ? (
                        <div className={`flex items-center gap-1 rounded-md px-1 ml-2 ${isDarkMode ? 'bg-red-500/20' : 'bg-red-50'}`}>
                          <button onClick={() => handleDeleteConfirm(word)} className="px-2 py-1 text-[10px] font-bold uppercase text-red-500 font-sans">Confirm</button>
                          <button onClick={() => setDeletingWord(null)} className="p-1 text-stone-400"><XCircle size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingWord(word)} className="p-1.5 rounded-md text-stone-400 hover:text-red-500 ml-2"><Trash2 size={14} /></button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StoryTab({ isDarkMode, activeStoryId, setActiveStoryId, storyList }) {
  if (storyList.length === 0) return <div className="p-20 text-center text-stone-500 font-sans">Loading master story...</div>;

  const activeStoryData = storyList.find(s => s.id === activeStoryId) || storyList[0];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className="mb-12 text-center relative flex flex-col items-center">
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><BookOpen size={32} /></div>
        
        {storyList.length > 1 && (
          <div className="mb-6 relative">
             <select 
               value={activeStoryId}
               onChange={(e) => setActiveStoryId(e.target.value)}
               className={`appearance-none font-bold text-sm pl-4 pr-10 py-2.5 rounded-xl border shadow-sm outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200 text-stone-800'}`}
             >
               {storyList.map(s => (
                 <option key={s.id} value={s.id}>{s.currentTitle || s.id.replace('_', ' ').toUpperCase()}</option>
               ))}
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50" />
          </div>
        )}
        
        <h1 className={`text-4xl font-bold tracking-wider moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{activeStoryData.currentTitle || 'Story Archive'}</h1>
      </header>
      
      <div className="space-y-12">
        {(!activeStoryData.episodes || activeStoryData.episodes.length === 0) ? (
          <p className="text-center opacity-50">No episodes generated for this story yet.</p>
        ) : (
          activeStoryData.episodes.map((ep, i) => (
            <article key={ep.id || i} className={`p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
              <h2 className={`text-3xl font-bold mb-6 border-b pb-4 moe-font ${isDarkMode ? 'text-stone-100 border-stone-700' : 'text-stone-800 border-stone-100'}`}>{ep.title}</h2>
              <div className={`text-[28px] md:text-3xl leading-relaxed space-y-6 moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
                {ep.text.split('\n\n').map((p, idx) => <p key={idx}>{p}</p>)}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

// --- MAIN PORTED APP ---
export default function Mandarin() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [globalLexicon, setGlobalLexicon] = useState(null);
  const [storyList, setStoryList] = useState([]);
  const [userPrefs, setUserPrefs] = useState({ activeStoryId: 'season_3' });
  const [viewingStoryId, setViewingStoryId] = useState('season_3');
  
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [progressState, setProgressState] = useState({});
  const [episodesList, setEpisodesList] = useState([]);
  
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [deletingEpisodeId, setDeletingEpisodeId] = useState(null);
  
  const fileInputRef = useRef(null);

  // Handle Authentication
  useEffect(() => {
      const unsub = auth.onAuthStateChanged(setUser);
      return () => unsub();
  }, []);

  // Dark mode auto-detect
  useEffect(() => {
    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(matchMedia.matches);
    const handler = (e) => setIsDarkMode(e.matches);
    matchMedia.addEventListener('change', handler);
    return () => matchMedia.removeEventListener('change', handler);
  }, []);

  // Fetch Master Lexicon & User Prefs
  useEffect(() => {
    if (!user) return;
    const lexRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc('lexicon');
    const unsubLex = lexRef.onSnapshot(
      snap => setGlobalLexicon(snap.exists ? snap.data() : {}),
      err => console.error("Lexicon Sync Error:", err)
    );
    
    const prefsRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs');
    const unsubPrefs = prefsRef.onSnapshot(
      snap => {
        if (snap.exists) {
          setUserPrefs(snap.data());
          setViewingStoryId(prev => prev === 'season_3' ? (snap.data().activeStoryId || 'season_3') : prev);
        }
      },
      err => console.error("Prefs Sync Error:", err)
    );

    return () => { unsubLex(); unsubPrefs(); };
  }, [user]);

  // Fetch All Stories for Archive
  useEffect(() => {
    if (!user) return;
    const storiesRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('stories');
    const unsubStories = storiesRef.onSnapshot(
      snap => {
        const stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stories.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setStoryList(stories);
      },
      err => console.error("Stories Sync Error:", err)
    );
    return unsubStories;
  }, [user]);

  // Fetch Episodes List
  useEffect(() => {
    if (!user) return;
    const epsRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('episodes').orderBy('timestamp', 'desc').limit(10);
    const unsubEps = epsRef.onSnapshot(
      snap => {
        const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEpisodesList(eps);
        setActiveEpisodeId(prevId => {
           if (!prevId && eps.length > 0) return eps[0].id;
           return prevId;
        });
      },
      err => console.error("Episodes List Sync Error:", err)
    );
    return unsubEps;
  }, [user]);

  // Fetch Data for the Currently Selected Episode
  useEffect(() => {
    if (!activeEpisodeId || !user) {
      setActiveEpisode(null);
      setProgressState({});
      return;
    }

    const epRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId);
    const unsubEp = epRef.onSnapshot(
      snap => {
        if (snap.exists) setActiveEpisode({ id: snap.id, ...snap.data() });
      },
      err => console.error("Episode Document Sync Error:", err)
    );

    const progRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId);
    const unsubProg = progRef.onSnapshot(
      snap => {
        setProgressState(snap.exists ? snap.data() : {});
      },
      err => console.error("Progress Document Sync Error:", err)
    );

    return () => { unsubEp(); unsubProg(); };
  }, [activeEpisodeId, user]);

  const updateFirebase = useCallback(async (updates) => {
    if (!activeEpisodeId || !user) return;
    setProgressState(prev => ({ ...prev, ...updates }));
    try { 
      await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set(updates, { merge: true }); 
    } catch (e) {
      console.error("Firebase Update Error:", e);
    }
  }, [activeEpisodeId, user]);

  // --- PROMPT EXPORT ENGINE ---
  const handleExportPrompt = async () => {
    if (!topicInput.trim()) return;
    setIsGenerating(true); setGenError('');
    
    try {
      const flatLexicon = Object.values(globalLexicon || {}).flat().filter(Boolean).join(', ');
      
      const activeBackendStoryId = userPrefs.activeStoryId || 'season_3';
      const currentStoryData = storyList.find(s => s.id === activeBackendStoryId) || { episodes: [] };
      const currentStoryText = (currentStoryData.episodes || []).map(e => `[Chapter: ${e.title}]\n${e.text}`).join('\n\n');
      
      const pastEps = episodesList.slice(0, 10);
      let pastContext = '';
      pastEps.forEach((ep, i) => {
        pastContext += `\n--- Chapter ${i + 1} ago ---\nDrilled Words: `;
        if (ep.drills) {
          pastContext += ep.drills.map(d => d.word).join(', ') + '\nSentences:\n';
          ep.drills.forEach(d => {
            if (d.examples) d.examples.forEach(ex => pastContext += `- ${ex.traditional}\n`);
          });
        }
        if (ep.quiz) {
          pastContext += 'Quiz:\n';
          ep.quiz.forEach(q => pastContext += `- ${q.sentence}\n`);
        }
      });

      const systemInstruction = `You are an expert curriculum designer and storyteller for a Mandarin Chinese learning app. Your task is to write stories that should be 30+ episodes long.
      
      CRITICAL RULES:
      1. VOCABULARY: Write the story primarily using the KNOWN VOCABULARY list.
      2. NEW WORDS: You are allowed to introduce up to 5 NEW WORDS not on the known list. You MUST list any new words introduced in the 'newLemmas' array. Do not leave 'newLemmas' empty if you introduced new words!
      3. DRILLS: For EACH word in the 'drills' array (which should be the new words + requested review words), you MUST generate an 'examples' array containing EXACTLY 5 sentences. NEVER leave 'examples' empty.
      4. REVIEW WORDS: Do not force user-requested Review Words into the story plot. They should only appear in drills and the quiz.
      5. STORY MANAGEMENT: If the user asks to start a brand new story (e.g., changing genre, or stating "start a new story"), you MUST set 'storyStatus' to 'new_story' and invent a new 'storyTitle'. If continuing the current story, set to 'continue'. If the user asks to end the story, set to 'finale'.
      
      DRILL AND QUIZ DESIGN:
      - I have provided the traditional Chinese text from the last 10 episodes' drills and quizzes.
      - DO NOT reuse past example sentences. Generate completely new sentences.
      - Note which words were recently drilled. Select DIFFERENT older words from the KNOWN VOCABULARY to review in this episode's drills and quiz.
      - The quiz should be exactly 15 questions, testing a mix of newly introduced words and older vocabulary.`;

      const outputFormat = `You must output ONLY valid JSON matching this exact structure (Do not use markdown formatting like \`\`\`json, just output the raw JSON object):

{
  "title": "Title of the chapter/episode.",
  "storyTitle": "The overarching name of the entire Book/Season.",
  "storyStatus": "MUST be one of: 'continue', 'finale', or 'new_story'.",
  "tutorIntroduction": "Short engaging intro",
  "story": {
    "traditional": "...",
    "simplified": "...",
    "pinyin": "...",
    "english": "..."
  },
  "drills": [
    {
      "word": "word",
      "pinyin": "pinyin",
      "notes": ["note 1", "note 2"],
      "examples": [
        { "traditional": "...", "simplified": "...", "pinyin": "...", "english": "..." }
      ]
    }
  ],
  "quiz": [
    {
      "sentence": "Use ___ for blank",
      "answer": "answer",
      "distractors": ["wrong1", "wrong2", "wrong3"],
      "englishHint": "hint"
    }
  ],
  "newLemmas": ["word1", "word2"]
}`;

      const exportedText = `SYSTEM INSTRUCTION:\n${systemInstruction}\n\nKNOWN VOCABULARY:\n[${flatLexicon}]\n\nCURRENT STORY SO FAR:\n${currentStoryText}\n\nRECENT DRILLS & QUIZZES (For reference):\n${pastContext}\n\nUSER REQUEST:\n${topicInput}\n\n---\n\nOUTPUT FORMAT:\n${outputFormat}`;

      const blob = new Blob([exportedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mandarin_Prompt_${Date.now()}.txt`;
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
        
        if (lessonJSON.drills) lessonJSON.drills.forEach(d => { if (d.examples) d.examples = d.examples.slice(0, 5); });
        const validNewLemmas = (lessonJSON.newLemmas || []).filter(w => typeof w === 'string' && w.trim() !== '');
        const episodeDoc = { ...lessonJSON, newLemmas: validNewLemmas, id: newEpisodeId, timestamp: Date.now(), userPrompt: topicInput || "Imported JSON Lesson" };
        
        const newAcc = Array.from(new Set([...validNewLemmas, ...(globalLexicon?.accumulated || [])]));
        
        const batch = db.batch();
        
        let targetStoryId = userPrefs.activeStoryId || 'season_3';
        if (lessonJSON.storyStatus === 'new_story') {
          targetStoryId = `season_${Date.now()}`;
          batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs'), { activeStoryId: targetStoryId }, { merge: true });
        }

        const targetStoryData = storyList.find(s => s.id === targetStoryId) || { episodes: [] };
        const targetEps = [...(targetStoryData.episodes || [])];
        
        if (lessonJSON.story?.traditional) {
          targetEps.push({ id: newEpisodeId, title: lessonJSON.title, text: lessonJSON.story.traditional });
        }

        batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('episodes').doc(newEpisodeId), episodeDoc);
        batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc('lexicon'), { ...globalLexicon, accumulated: newAcc }, { merge: true });
        batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStoryId), { 
          currentTitle: lessonJSON.storyTitle || "Story", 
          episodes: targetEps,
          timestamp: targetStoryData.timestamp || Date.now()
        }, { merge: true });
        
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

  const handleDeleteEpisode = async () => {
    if (!activeEpisodeId || !user) return;
    try {
      const batch = db.batch();
      batch.delete(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId));
      batch.delete(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId));
      
      let targetStory = null;
      for (const story of storyList) {
        if (story.episodes && story.episodes.some(e => e.id === activeEpisodeId)) { targetStory = story; break; }
      }
      if (targetStory) {
        const updatedEps = targetStory.episodes.filter(e => e.id !== activeEpisodeId);
        batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStory.id), { episodes: updatedEps }, { merge: true });
      }

      if (activeEpisode?.newLemmas && activeEpisode.newLemmas.length > 0) {
        const newAcc = (globalLexicon?.accumulated || []).filter(w => !activeEpisode.newLemmas.includes(w));
        batch.set(db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc('lexicon'), { accumulated: newAcc }, { merge: true });
      }

      await batch.commit();
      setDeletingEpisodeId(null);
      
      const nextEp = episodesList.find(e => e.id !== activeEpisodeId) || null;
      setActiveEpisodeId(nextEp ? nextEp.id : null);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const navItems = [
    { id: 'studio', label: 'Studio', icon: MessageSquare },
    { id: 'episode', label: 'Audio', icon: Volume2 },
    { id: 'drill', label: 'Drills', icon: BookMarked },
    { id: 'quiz', label: 'Quiz', icon: CheckCircle2 },
    { id: 'lexicon', label: 'Lexicon', icon: Search },
    { id: 'story', label: 'Story', icon: BookOpen }
  ];

  if (!user) return null; // Global Router handles Auth.

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${isDarkMode ? 'bg-stone-950 text-stone-100 selection:bg-stone-700' : 'bg-stone-50 text-stone-900 selection:bg-stone-200'}`} lang="zh-Hant">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://db.onlinewebfonts.com/c/fe4f9dac99fb6b607c03981e6ce16869?family=DFKai-SB');
        @import url('https://db.onlinewebfonts.com/c/1ee9941f1b8c128110ca4307dda59917?family=STKaiti');
        .moe-font { font-family: 'DFKai-SB', '標楷體', 'BiauKai', serif; }
        .simp-font { font-family: 'STKaiti', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif; }
      `}} />

      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm ${isDarkMode ? 'bg-stone-900/85 border-stone-800' : 'bg-white/90 border-stone-200'}`}>
        <div className="flex gap-1 md:gap-4 overflow-x-auto no-scrollbar mask-edges pr-8 flex-1">
          {/* BACK TO HUB ARROW */}
          <Link to="/" className={`p-2 rounded-lg border transition-all active:scale-95 shrink-0 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-800'}`}>
            <ArrowLeft size={16} />
          </Link>

          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id} onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${isActive ? (isDarkMode ? 'bg-stone-700 text-amber-400' : 'bg-stone-800 text-white') : (isDarkMode ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800')}`}
              >
                <Icon size={16} /> <span className="hidden md:inline">{item.label}</span>
              </button>
            )
          })}
        </div>
        
        <div className="flex items-center gap-2 shrink-0 relative">
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className={`p-2 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'border-stone-700 bg-stone-800 text-amber-400' : 'border-stone-200 bg-stone-50 text-amber-600'}`}>
            <List size={14} />
          </button>
          {dropdownOpen && (
            <div className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden z-50 ${isDarkMode ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}`}>
              <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
              <div className="max-h-64 overflow-y-auto">
                {episodesList.map(ep => (
                  <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); setDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700') : (isDarkMode ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-stone-50 text-stone-700')}`}>
                    {ep.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors shrink-0 border shadow-sm ${isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {activeTab === 'studio' && (
        <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 animate-in fade-in duration-300">
          <header className="mb-8 flex items-center gap-4">
            <div className={`p-4 rounded-2xl shadow-lg ${isDarkMode ? 'bg-stone-800 text-stone-100' : 'bg-stone-800 text-white'}`}><MessageSquare size={32} /></div>
            <div><h2 className="text-2xl md:text-3xl font-bold">Studio</h2><p className={`text-sm mt-1 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Generate next chapter</p></div>
          </header>

          <section className={`p-6 md:p-8 rounded-3xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
            <h3 className="text-xl font-bold mb-4 font-sans">Prompt the AI</h3>
            <div className="flex flex-col gap-4">
              <input 
                type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} disabled={isGenerating} 
                placeholder="e.g., Continue the story. Review words: 表面, 旋轉" 
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} 
              />
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleExportPrompt} 
                  disabled={isGenerating || !topicInput.trim()} 
                  title="Download detailed prompt file for Gemini Web App" 
                  className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  <span>Export Prompt File</span>
                </button>
                
                <label className={`cursor-pointer flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                  <Upload className="w-5 h-5" /> 
                  <span>Import JSON File</span>
                  <input 
                    type="file" 
                    accept=".json,.txt" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    disabled={isGenerating}
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
            {genError && <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-medium">{genError}</div>}
          </section>

          {activeEpisode && (activeEpisode.userPrompt || activeEpisode.tutorIntroduction) && (
            <div className="space-y-6 pt-10 font-sans">
              {activeEpisode.userPrompt && (
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>You</span>
                  <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tr-sm shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
                    <p className="text-lg leading-relaxed">{activeEpisode.userPrompt}</p>
                  </div>
                </div>
              )}
              {(activeEpisode.tutorIntroduction) && (
                <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>Tutor</span>
                  <div className={`w-full max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tl-sm shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100' : 'bg-stone-100 border-stone-200 text-stone-900'}`}>
                    <p className="text-lg leading-relaxed mb-6">{activeEpisode.tutorIntroduction}</p>
                    
                    {activeEpisode.story && (
                      <>
                        {activeEpisode.storyStatus === 'finale' && (
                          <div className={`mb-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            <span className="font-bold flex items-center gap-2"><Award size={18} /> Story Finale!</span>
                            <p className="text-sm mt-1 opacity-80">The LLM has concluded the current storybook.</p>
                          </div>
                        )}
                        {activeEpisode.storyStatus === 'new_story' && (
                          <div className={`mb-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                            <span className="font-bold flex items-center gap-2"><Book size={18} /> New Story Started!</span>
                            <p className="text-sm mt-1 opacity-80">Title: {activeEpisode.storyTitle || "Untitled"}</p>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-3 border-t pt-5 border-stone-200 dark:border-stone-700">
                          <button onClick={() => setActiveTab('episode')} className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-stone-800 hover:bg-stone-700 text-amber-400' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}>
                            Go to Audio
                          </button>
                          
                          {deletingEpisodeId === activeEpisode.id ? (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border ${isDarkMode ? 'bg-red-950/30 border-red-900' : 'bg-red-50 border-red-200'}`}>
                              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Are you sure?</span>
                              <button onClick={handleDeleteEpisode} className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">Yes, Delete</button>
                              <button onClick={() => setDeletingEpisodeId(null)} className="px-2 py-1 text-stone-500 hover:text-stone-700 text-xs font-bold">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingEpisodeId(activeEpisode.id)} className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all border ${isDarkMode ? 'border-stone-700 text-stone-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20' : 'border-stone-200 text-stone-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200'}`}>
                              <Trash2 size={16} /> Delete Lesson
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={activeTab === 'episode' ? 'block animate-in fade-in duration-300' : 'hidden'}>
        <EpisodeTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} />
      </div>
      <div className={activeTab === 'drill' ? 'block animate-in fade-in duration-300' : 'hidden'}>
        <DrillTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} />
      </div>
      <div className={activeTab === 'quiz' ? 'block animate-in fade-in duration-300' : 'hidden'}>
        <QuizTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} />
      </div>
      <div className={activeTab === 'lexicon' ? 'block animate-in fade-in duration-300' : 'hidden'}>
        <LexiconTab isDarkMode={isDarkMode} globalLexicon={globalLexicon} user={user} />
      </div>
      <div className={activeTab === 'story' ? 'block animate-in fade-in duration-300' : 'hidden'}>
        <StoryTab isDarkMode={isDarkMode} activeStoryId={viewingStoryId} setActiveStoryId={setViewingStoryId} storyList={storyList} />
      </div>
    </div>
  );
}