import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Volume2, Pause, RotateCcw, MessageSquare, Sun, Moon, BookMarked, Eye, CheckCircle2, ChevronDown, AlertCircle, Search, Book, Trash2, XCircle, Copy, Award, Upload, Download, List, Loader2, ArrowLeft, PenTool, Activity, Lightbulb, ClipboardPaste, Sparkles } from 'lucide-react';
import { auth, db } from '../firebase';
import { useGeminiTTS } from '../hooks/useGeminiTTS';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

const removeDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

function PlayButton({ isDarkMode, onClick, size = 24, isLoading = false, isPlaying = false }) {
  const colorClasses = isDarkMode ? 'bg-stone-700 text-stone-300 hover:bg-stone-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200';
  return (
    <button disabled={isLoading} onClick={onClick} className={`flex items-center justify-center rounded-full transition-colors p-3 ${colorClasses} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {isLoading ? <Loader2 size={size} className="animate-spin text-amber-500" /> : isPlaying ? <Pause size={size} className="text-amber-500 animate-pulse" /> : <Volume2 size={size} />}
    </button>
  );
}

// --- TAB COMPONENTS ---

function EpisodeTab({ isDarkMode, activeEpisode, handleSpeak, stopSpeak, config }) {
  const [playingId, setPlayingId] = useState(null);
  if (!activeEpisode?.story) return null;

  const versions = [
    { id: config.primaryTextKey, title: 'Target Script', fontClass: `${config.fontClass || 'font-sans'} text-[28px] md:text-3xl leading-relaxed`, text: activeEpisode.story[config.primaryTextKey] },
    { id: 'english', title: 'English', fontClass: 'font-sans text-lg md:text-xl leading-relaxed', text: activeEpisode.story.english }
  ];
  
  if (config.secondaryScriptKey) versions.push({ id: config.secondaryScriptKey, title: 'Secondary Script', fontClass: `${config.secondaryFontClass || config.fontClass} text-[28px] md:text-3xl leading-relaxed`, text: activeEpisode.story[config.secondaryScriptKey] });
  if (config.transliterationKey) versions.push({ id: config.transliterationKey, title: 'Transliteration', fontClass: 'font-sans text-lg md:text-xl leading-relaxed', text: activeEpisode.story[config.transliterationKey] });
  
  const filteredVersions = versions.filter(v => v.text);

  const playAudio = (id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-8">
      <header className={`mb-12 border-b pb-8 text-center relative ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><BookOpen size={32} /></div>
        <h1 className={`text-4xl font-bold mb-3 tracking-wider ${config.fontClass || ''} ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{activeEpisode.title || 'Story Content'}</h1>
        <p className={`text-lg font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>AI-Generated Chapter</p>
      </header>
      <main className="space-y-8">
        {filteredVersions.map((v) => (
          <section key={v.id} className={`p-6 md:p-10 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <div className={`flex items-center justify-between mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
              <h2 className={`text-2xl font-bold tracking-wide font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{v.title}</h2>
              {v.id !== config.transliterationKey && <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === v.id} onClick={() => playAudio(v.id, v.text)} />}
            </div>
            <div className={`space-y-4 ${v.fontClass} ${v.id !== 'english' && v.id !== config.transliterationKey ? (isDarkMode ? 'text-stone-100' : 'text-stone-800') : (isDarkMode ? 'text-stone-300' : 'text-stone-700')}`}>
              {v.text.split('\n\n').map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function ReadingTab({ isDarkMode, activeEpisode, handleSpeak, stopSpeak, config }) {
  const [playingId, setPlayingId] = useState(null);
  const reading = activeEpisode?.reading;
  if (!reading) return null;

  const playAudio = (id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  };

  const targetText = reading[config.primaryTextKey];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className={`mb-12 border-b pb-8 text-center relative ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><BookOpen size={32} /></div>
        <h1 className={`text-4xl font-bold mb-3 tracking-wider ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{activeEpisode.title || 'Reading'}</h1>
        <p className={`text-lg font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Reading & Comprehension</p>
      </header>

      <div className="space-y-8">
        {Array.isArray(reading.definitions) && reading.definitions.length > 0 && (
          <section className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <div className={`flex items-center justify-between mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
              <h2 className="text-2xl font-bold tracking-wide">Definíciók (Definitions)</h2>
              <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'defs'} onClick={() => playAudio('defs', reading.definitions.map(d=>d.word + ". " + d.text).join(' '))} />
            </div>
            <ul className="space-y-3 text-lg leading-relaxed">
              {reading.definitions.map((def, idx) => (
                <li key={idx}><strong className={isDarkMode ? 'text-stone-100' : 'text-stone-900'}>{def.word}</strong>: {def.text}</li>
              ))}
            </ul>
          </section>
        )}

        {targetText && (
          <section className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <div className={`flex items-center justify-between mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
              <h2 className="text-2xl font-bold tracking-wide">Reading</h2>
              <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'read'} onClick={() => playAudio('read', targetText)} />
            </div>
            <div className={`space-y-4 ${config.fontClass || ''} text-xl leading-relaxed`}>
              {targetText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        )}

        {reading.english && (
          <section className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <div className={`flex items-center justify-between mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
              <h2 className="text-2xl font-bold tracking-wide">Translation</h2>
              <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'eng'} onClick={() => playAudio('eng', reading.english)} />
            </div>
            <div className={`space-y-4 text-lg italic leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-600'}`}>
              {reading.english.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        )}

        {Array.isArray(reading.focus) && reading.focus.length > 0 && (
          <section className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <div className={`flex items-center gap-3 mb-6 border-b pb-4 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
              <Lightbulb className="text-amber-500" size={24} />
              <h2 className="text-2xl font-bold tracking-wide">Focus & Grammar</h2>
            </div>
            <div className="space-y-6 text-lg">
              {reading.focus.map((item, idx) => (
                <div key={idx}>
                  <span className={`font-bold ${config.fontClass || ''} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{idx + 1}. {item.word}</span>
                  <p className="mt-1 text-base">{item.explanation || item.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DrillTab({ isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, isLatestEpisode }) {
  const listenedIds = progressState.listenedDrills || [];
  const [playingId, setPlayingId] = useState(null);

  if (!activeEpisode?.drills?.length) return <div className="p-10 text-center font-sans opacity-50">No drills generated yet.</div>;

  const playDrill = (ex, exId, isListened) => {
    if (playingId === exId) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(exId);
    const targetText = ex[config.primaryTextKey] || ex.traditional || ex.portuguese || ex.hungarian || ex.romanian;
    // Array creates a sequence: Target Language -> English -> Target Language
    handleSpeak([targetText, ex.english, targetText], () => { setPlayingId(null); if (!isListened) updateFirebase({ listenedDrills: [...listenedIds, exId] }); }, () => setPlayingId(null));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-16 py-12 px-4 md:px-8">
      <header className={`mb-8 border-b pb-6 text-center ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><BookMarked size={32} /></div>
        <h1 className={`text-3xl font-bold font-sans ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Interactive Audio Drills</h1>
      </header>

      {activeEpisode.drills.map((section, sectionIdx) => (
        <section key={sectionIdx} className={`space-y-8 p-6 md:p-10 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
          <div className="text-center mb-8">
            <div className={`inline-block rounded-2xl p-4 md:p-6 border shadow-sm ${isDarkMode ? 'bg-stone-700 border-stone-600 text-stone-100' : 'bg-stone-100 border-stone-200 text-stone-800'}`}>
              <h2 className={`${config.useLargeDrillFont ? 'text-6xl md:text-7xl moe-font tracking-widest' : 'text-xl md:text-2xl font-bold font-sans tracking-wide px-4'}`}>{section.word}</h2>
              {config.transliterationKey && section[config.transliterationKey] && <p className="mt-2 font-sans text-sm opacity-70">{section[config.transliterationKey]}</p>}
            </div>
          </div>
          <div className="space-y-10 pl-2">
            {section.examples?.map((ex, exIndex) => {
              const exId = `drill_${sectionIdx}_${exIndex}`;
              const isListened = !isLatestEpisode || listenedIds.includes(exId);
              const targetText = ex[config.primaryTextKey] || ex.traditional || ex.portuguese || ex.hungarian || ex.romanian;
              
              return (
                <div key={exId} className={`group border-b pb-8 last:border-0 last:pb-0 ${isDarkMode ? 'border-stone-700' : 'border-stone-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-bold font-sans tracking-wide ${isDarkMode ? 'text-stone-400' : 'text-stone-450'}`}>Example {exIndex + 1}</h3>
                      {isListened && <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">Listened ✓</span>}
                    </div>
                    <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === exId} onClick={() => playDrill(ex, exId, isListened)} size={20} />
                  </div>
                  <div className="relative mt-2">
                    <div className={`space-y-4 transition-all duration-700 ${!isListened ? 'blur-md opacity-40 select-none pointer-events-none' : 'blur-0 opacity-100'}`}>
                      <p className={`${config.useLargeDrillFont ? 'text-[28px] md:text-3xl' : 'text-xl font-bold'} ${config.fontClass || 'font-sans'} leading-relaxed ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{targetText}</p>
                      <p className={`text-lg font-sans leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{ex.english || ex.translation}</p>
                      
                      {config.secondaryScriptKey && ex[config.secondaryScriptKey] && (
                        <p className={`text-[28px] md:text-3xl ${config.secondaryFontClass || ''} leading-relaxed ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{ex[config.secondaryScriptKey]}</p>
                      )}
                      {config.transliterationKey && ex[config.transliterationKey] && (
                        <p className={`text-lg font-sans leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{ex[config.transliterationKey]}</p>
                      )}
                    </div>
                    {!isListened && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <button onClick={() => playDrill(ex, exId, isListened)} className={`flex items-center gap-2 px-6 py-2.5 rounded-full shadow-md font-sans text-sm font-bold border ${isDarkMode ? 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700 hover:text-amber-400' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50 hover:text-amber-600'}`}>
                          {playingId === exId ? <Loader2 size={18} className="animate-spin text-amber-500" /> : <Volume2 size={18} />} Play to Reveal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drill Notes / Grammar Focus */}
          {section.notes && section.notes.length > 0 && (
            <div className={`mt-8 p-6 rounded-2xl border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200'}`}>
              <div className={`flex items-center gap-3 mb-4 border-b pb-3 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
                <Lightbulb className="text-amber-500" size={20} />
                <h4 className={`text-lg font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Focus & Grammar</h4>
              </div>
              <div className="space-y-3">
                {section.notes.map((note, noteIdx) => (
                  <p key={noteIdx} className={`text-base leading-relaxed ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>{note}</p>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function QuizTab({ isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config }) {
  const [shuffledData, setShuffledData] = useState([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  const userSelections = progressState.selections || {};
  const revealedIds = progressState.revealed || [];
  const gradedIds = progressState.gradedIds || [];

  useEffect(() => {
    if (activeEpisode?.quiz) {
      setShuffledData(activeEpisode.quiz.map((q, i) => {
        const answer = q.answer || q.correct;
        const opts = q.options ? q.options : shuffleArray(Array.from(new Set([...(q.distractors||[]), answer])));
        return { ...q, id: i, sentence: q.sentence || q.text, answer: answer, englishHint: q.englishHint || q.translation, options: opts };
      }));
    }
  }, [activeEpisode?.quiz]);

  if (!activeEpisode?.quiz?.length) return <div className="p-10 text-center font-sans opacity-50">No quiz generated yet.</div>;

  const handleSelect = (qId, choice) => {
    if (gradedIds.includes(qId)) return;
    updateFirebase({ selections: { ...userSelections, [qId]: choice } });
  };

  const playAnswer = (id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  };

  const resetQuiz = () => { updateFirebase({ selections: {}, revealed: [], gradedIds: [] }); setShowConfirmReset(false); };

  const correctCount = Object.entries(userSelections).filter(([qId, val]) => {
    const question = shuffledData.find(q => `quiz_${q.id}` === qId);
    return question && question.answer === val && gradedIds.includes(qId);
  }).length;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className={`mb-12 border-b-2 pb-8 text-center relative ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="absolute right-0 top-0">
          {!showConfirmReset ? (
            <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-2 text-stone-400 hover:text-red-500 text-sm px-3 py-2"><RotateCcw size={16} /> 重置</button>
          ) : (
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
              <AlertCircle size={16} className="text-red-500" />
              <button onClick={resetQuiz} className="text-red-600 font-bold text-sm">Yes</button>
              <span className="text-red-200">|</span>
              <button onClick={() => setShowConfirmReset(false)} className="text-stone-500 text-sm">No</button>
            </div>
          )}
        </div>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><CheckCircle2 size={32} /></div>
        <h1 className={`text-3xl font-bold font-sans mb-3 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Review Quiz</h1>
        <p className={`text-lg ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Chapter Comprehension & Vocabulary</p>
      </header>

      <div className="space-y-16 pb-32">
        {shuffledData.map((q) => {
          const qId = `quiz_${q.id}`;
          const isRevealed = revealedIds.includes(qId);
          const isGraded = gradedIds.includes(qId);
          const userChoice = userSelections[qId];
          const isCorrect = userChoice === q.answer;

          return (
            <div key={q.id} className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-stone-400 font-bold uppercase tracking-wider">Question {String(q.id + 1).padStart(2, '0')}</div>
                {!isRevealed && (
                  <button onClick={() => updateFirebase({ revealed: [...revealedIds, qId] })} className={`p-2.5 rounded-full transition-colors border shadow-sm ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-amber-400' : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50 hover:text-amber-600'}`}>
                    <Eye size={18} />
                  </button>
                )}
              </div>
              <p className={`${config.useLargeDrillFont ? 'text-[28px] md:text-3xl' : 'text-xl font-bold'} ${config.fontClass || 'font-sans'} leading-relaxed mb-4 ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{q.sentence?.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, userChoice ? ` ${userChoice} ` : ' ＿＿＿ ')}</p>

              <div className="relative mt-6">
                <div className={`transition-all duration-700 ${!isRevealed ? 'blur-md opacity-40 select-none pointer-events-none' : 'blur-0 opacity-100'}`}>
                  <div className="mb-6">
                    <p className={`font-sans text-lg ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Hint: {q.englishHint}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {q.options.map((option, optIdx) => {
                      let btnClass = `px-4 py-3 rounded-xl border-2 transition-all text-center ${config.useLargeDrillFont ? 'text-[26px] md:text-2xl' : 'text-lg font-bold'} ${config.fontClass || 'font-sans'} `;
                      if (!isGraded) btnClass += userChoice === option ? (isDarkMode ? "border-amber-500 bg-amber-950/40 text-amber-300" : "border-amber-500 bg-amber-50 text-amber-800") : (isDarkMode ? "border-stone-750 bg-stone-900/40 text-stone-200" : "border-stone-200 bg-white text-stone-700");
                      else btnClass += option === q.answer ? (isDarkMode ? "border-emerald-500 bg-emerald-950/50 text-emerald-300" : "border-emerald-500 bg-emerald-50 text-emerald-800") : userChoice === option ? "border-rose-900 bg-rose-950/30 text-rose-450 line-through opacity-70" : "border-stone-850 bg-stone-900/10 text-stone-600 opacity-40";
                      return <button key={optIdx} disabled={isGraded} onClick={() => !isGraded && handleSelect(qId, option)} className={btnClass}>{option}</button>;
                    })}
                  </div>
                  <div className="flex justify-between items-center mt-4 font-sans">
                    {!isGraded ? (
                     <button disabled={!userChoice} onClick={() => { if(userChoice) { updateFirebase({ gradedIds: [...gradedIds, qId] }); playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer)); } }} className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors ${!userChoice ? (isDarkMode ? 'bg-stone-800 text-stone-600' : 'bg-stone-200 text-stone-400') : (isDarkMode ? 'bg-amber-600 text-stone-950 hover:bg-amber-500' : 'bg-amber-500 text-stone-900 hover:bg-amber-400')}`}>
                        {config.id === 'mandarin' ? '驗證答案 (Grade Answer)' : 'Grade Answer'}
                     </button>
                    ) : (
                      <div className="flex items-center gap-4 animate-in duration-300 w-full justify-between">
                        <span className={`text-sm font-bold flex items-center gap-1.5 ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isCorrect ? (config.id === 'mandarin' ? "答對了 (Correct!)" : "Correct!") : (config.id === 'mandarin' ? "答錯了 (Incorrect)" : "Incorrect")}
                        </span>
                        <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === `quiz-audio-${qId}`} onClick={() => playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer))} size={18} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className={`fixed bottom-0 left-0 right-0 py-3 px-6 backdrop-blur-md border-t font-sans z-10 ${isDarkMode ? 'bg-stone-950/90 border-stone-900' : 'bg-stone-50/90 border-stone-200'}`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center text-stone-500">
          <div className="flex gap-8 items-center w-full justify-around">
            <div className="text-center">
              <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Graded</span>
              <span className={`text-xl font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{gradedIds.length} / {shuffledData.length}</span>
            </div>
            {gradedIds.length > 0 && (
              <div className="text-center">
                <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Score</span>
                <span className="text-xl font-bold text-emerald-500 flex items-center justify-center gap-1">{correctCount} <CheckCircle2 size={18} /></span>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function TestTab({ isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config }) {
  const [playingId, setPlayingId] = useState(null);
  if (!activeEpisode?.test?.length) return null;

  const mst = progressState.testMastered || {};
  const rev = progressState.testRevealed || {};
  const mis = progressState.mistakes || {};

  const playAnswer = (id, text, isRev) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => {
        setPlayingId(null);
        updateFirebase({ testMastered: { ...mst, [id]: true }, testRevealed: { ...rev, [id]: true } });
    }, () => setPlayingId(null));
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className={`mb-12 border-b pb-8 text-center relative ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><PenTool size={32} /></div>
        <h1 className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Active Translation</h1>
        <p className={`text-lg font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Translate EN to {config.name.replace(' Master', '')}</p>
      </header>

      <div className="space-y-8">
        {activeEpisode.test.map((item, i) => {
          const qId = `test_${i}`;
          return (
            <div key={qId} className={`p-6 md:p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center justify-between mb-4 border-b pb-4 border-stone-100 dark:border-stone-800">
                <div className="text-sm font-bold uppercase tracking-wider text-amber-500">Sentence {String(i + 1).padStart(2, '0')}</div>
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === qId} onClick={() => playAnswer(qId, item[config.primaryTextKey], rev[qId])} size={20} />
              </div>
              <p className={`text-xl font-bold leading-relaxed mb-6 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{item.english}</p>
              
              <div className="relative mt-6">
                <div className={`transition-all duration-700 ${!rev[qId] ? 'blur-md opacity-40 select-none pointer-events-none' : 'blur-0 opacity-100'} pt-4 border-t border-dashed border-stone-200 dark:border-stone-700`}>
                  <p className={`text-2xl font-bold mb-4 ${config.fontClass || ''} ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{item[config.primaryTextKey]}</p>
                  <textarea 
                    value={mis[qId] || ''} onChange={e => updateFirebase({ mistakes: { ...mis, [qId]: e.target.value } })}
                    placeholder="Log your mistake or note here..." rows="2"
                    className={`w-full p-4 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'}`} 
                  />
                </div>
                {!rev[qId] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playAnswer(qId, item[config.primaryTextKey], false)} className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-md font-sans text-sm font-bold border ${isDarkMode ? 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700 hover:text-amber-400' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50 hover:text-amber-600'}`}>
                      {playingId === qId ? <Loader2 size={18} className="animate-spin text-amber-500" /> : <Volume2 size={18} />} Play to Reveal
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SweepTab({ isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config }) {
  const [playingId, setPlayingId] = useState(null);
  if (!activeEpisode?.sweep?.length) return null;

  const mst = progressState.sweepMastered || {};
  const rev = progressState.sweepRevealed || {};

  const playSweep = (id, text, isRev) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => {
        setPlayingId(null);
        updateFirebase({ sweepMastered: { ...mst, [id]: true }, sweepRevealed: { ...rev, [id]: true } });
    }, () => setPlayingId(null));
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className={`mb-12 border-b pb-8 text-center relative ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><Activity size={32} /></div>
        <h1 className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Diagnostic Sweep</h1>
      </header>

      <div className="space-y-6">
        {activeEpisode.sweep.map((item, i) => {
          const qId = `sweep_${i}`;
          const textToRead = [`${item.word}. ${item[config.primaryTextKey]}`, item.english, item[config.primaryTextKey]];
          
          return (
            <div key={qId} className={`p-6 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold uppercase tracking-wider text-stone-400">Sentence {String(i + 1).padStart(2, '0')}</div>
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === qId} onClick={() => playSweep(qId, textToRead, rev[qId])} size={20} />
              </div>
              
              <div className="relative mt-4">
                <div className={`transition-all duration-700 ${!rev[qId] ? 'blur-md opacity-40 select-none pointer-events-none' : 'blur-0 opacity-100'} space-y-2 pt-4 border-t border-stone-100 dark:border-stone-800`}>
                  <p className="font-bold text-xs uppercase tracking-widest text-blue-500 mb-2">{item.word}</p>
                  <p className={`${config.useLargeDrillFont ? 'text-[28px] md:text-3xl' : 'text-xl font-bold'} ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{item[config.primaryTextKey]}</p>
                  <p className={`text-lg font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{item.english}</p>
                </div>

                {!rev[qId] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playSweep(qId, textToRead, false)} className={`flex items-center gap-2 px-6 py-2.5 rounded-full shadow-md text-sm font-bold border ${isDarkMode ? 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'}`}>
                      {playingId === qId ? <Loader2 size={18} className="animate-spin text-amber-500" /> : <Volume2 size={18} />} Listen to Sweep
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LexiconTab({ isDarkMode, globalLexicon, user, config }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [deletingWord, setDeletingWord] = useState(null);

  const categories = useMemo(() => {
    if (!globalLexicon || Object.keys(globalLexicon).length === 0) return [];
    
    let isObjectArray = Array.isArray(globalLexicon) || (globalLexicon.entries && Array.isArray(globalLexicon.entries));
    let mainList = isObjectArray ? (globalLexicon.entries || globalLexicon) : (globalLexicon.accumulated || []);
    
    return [
      { id: 'all', label: 'All Words', words: mainList }, 
      ...(isObjectArray ? [] : [
        { id: 'hsk4', label: 'HSK 4', words: globalLexicon.hsk4 || [] }, 
        { id: 'hsk3', label: 'HSK 3', words: globalLexicon.hsk3 || [] }
      ])
    ];
  }, [globalLexicon]);

  const filteredData = useMemo(() => {
    if (categories.length === 0) return [];
    const term = removeDiacritics(searchTerm);
    
    return categories.map(cat => ({ 
      ...cat, 
      words: term ? cat.words.filter(w => {
        if (typeof w === 'string') return removeDiacritics(w).includes(term);
        if (typeof w === 'object' && w !== null) {
          const target = w[config.primaryTextKey] || w.word || w.targetText || "";
          const en = w.english || w.meaning || w.translation || "";
          return removeDiacritics(target).includes(term) || removeDiacritics(en).includes(term);
        }
        return false;
      }) : cat.words 
    })).filter(cat => activeTab === 'all' || cat.id === activeTab);
  }, [searchTerm, activeTab, categories, config.primaryTextKey]);

  const handleDeleteConfirm = async (wordToDelete) => {
    if (!globalLexicon || !user) return;
    
    try {
      if (Array.isArray(globalLexicon) || globalLexicon.entries) {
        const list = globalLexicon.entries || globalLexicon;
        const newLex = list.filter(w => w.id !== wordToDelete.id);
        const docName = config.lexiconDoc || 'lexicon';
        await db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName).set({ entries: newLex });
      } else {
        const newLex = { ...globalLexicon, accumulated: (globalLexicon.accumulated || []).filter(w => w !== wordToDelete) };
        await db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc('lexicon').set(newLex);
      }
      setDeletingWord(null);
    } catch (err) { console.error(err); }
  };

  if (!globalLexicon || Object.keys(globalLexicon).length === 0) return <div className="p-20 text-center text-stone-500 font-sans">Loading master lexicon...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className="mb-10 text-center">
        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><Search size={32} /></div>
        <h1 className={`text-3xl font-bold font-sans mb-3 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{config.name} Lexicon</h1>
      </header>

      <div className={`p-6 rounded-2xl shadow-sm border mb-8 sticky top-4 z-10 ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input type="text" placeholder="Search vocabulary or translation..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 text-xl focus:outline-none transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100' : 'bg-stone-50 border-stone-100'}`} />
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === cat.id ? (isDarkMode ? 'bg-stone-600 text-stone-100' : 'bg-stone-800 text-stone-100') : (isDarkMode ? 'bg-stone-900 text-stone-400 hover:bg-stone-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}`}>{cat.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-10">
        {filteredData.map(cat => {
          if (cat.words.length === 0) return null;
          return (
            <section key={cat.id} className="animate-in duration-500">
              {cat.id !== 'all' && <h2 className={`text-2xl font-bold font-sans mb-6 border-b-2 pb-2 ${isDarkMode ? 'text-stone-300 border-stone-700' : 'text-stone-700 border-stone-200'}`}>{cat.label}</h2>}
              
              <div className="flex flex-wrap gap-3">
                {cat.words.map((word, idx) => {
                  const isObj = typeof word === 'object' && word !== null;
                  const displayWord = isObj ? (word[config.primaryTextKey] || word.word) : word;
                  const displayEn = isObj ? (word.english || word.meaning || word.translation) : "";
                  const pos = isObj ? word.pos : "";
                  const wId = isObj ? word.id : word;

                  return (
                    <div key={`${wId}-${idx}`} className={`flex flex-col gap-2 p-4 border rounded-xl shadow-sm ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span className={`${config.fontClass ? `${config.fontClass} text-[28px] md:text-3xl` : 'font-sans font-bold text-xl'}`}>{displayWord}</span>
                        {deletingWord === wId ? (
                          <div className={`flex items-center gap-1 rounded-md px-1 ml-2 ${isDarkMode ? 'bg-red-500/20' : 'bg-red-50'}`}>
                            <button onClick={() => handleDeleteConfirm(word)} className="px-2 py-1 text-[10px] font-bold uppercase text-red-500 font-sans">Confirm</button>
                            <button onClick={() => setDeletingWord(null)} className="p-1 text-stone-400"><XCircle size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingWord(wId)} className="p-1.5 rounded-md text-stone-400 hover:text-red-500 ml-2"><Trash2 size={14} /></button>
                        )}
                      </div>
                      
                      {(displayEn || pos) && (
                        <div className="text-sm font-sans flex items-center gap-2 mt-1 pt-2 border-t border-stone-100 dark:border-stone-700">
                           {pos && <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 border border-emerald-500/30 px-1.5 rounded bg-emerald-500/10">{pos}</span>}
                           <span className={isDarkMode ? 'text-stone-400' : 'text-stone-500'}>{displayEn}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StoryTab({ isDarkMode, activeStoryId, setActiveStoryId, storyList }) {
  if (storyList.length === 0) return <div className="p-20 text-center font-sans opacity-50">Loading archive...</div>;
  const activeStoryData = storyList.find(s => s.id === activeStoryId) || storyList[0];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 md:px-8 font-sans">
      <header className="mb-12 text-center flex flex-col items-center">
        <div className={`inline-flex p-4 rounded-full mb-6 shadow-md ${isDarkMode ? 'bg-stone-700 text-stone-100' : 'bg-stone-800 text-stone-100'}`}><BookOpen size={32} /></div>
        
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
        
        <h1 className={`text-4xl font-bold tracking-wider moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{activeStoryData.currentTitle || 'Archive'}</h1>
      </header>
      <div className="space-y-12">
        {activeStoryData.episodes?.map((ep, i) => (
          <article key={ep.id || i} className={`p-8 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
            <h2 className={`text-3xl font-bold mb-6 border-b pb-4 moe-font ${isDarkMode ? 'text-stone-100 border-stone-700' : 'text-stone-800 border-stone-100'}`}>{ep.title}</h2>
            <div className={`text-[28px] md:text-3xl leading-relaxed space-y-6 moe-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{ep.text.split('\n\n').map((p, idx) => <p key={idx}>{p}</p>)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

// --- MAIN GENERIC COMPONENT ---
export default function LanguageCourse({ config }) {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollPositions = useRef({});
  
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
  const [isExporting, setIsExporting] = useState(false);
  const [genError, setGenError] = useState('');
  const [deletingEpisodeId, setDeletingEpisodeId] = useState(null);
  const fileInputRef = useRef(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  // --- CENTRALIZED PROMPT BUILDER ---
  const generatePromptString = async (isForAPI = false) => {
    const flatLexicon = Object.values(globalLexicon || {}).flat().map(w => {
        if (typeof w === 'string') return w;
        if (w && typeof w === 'object') return w.word || w[config.primaryTextKey] || w.targetText || '';
        return '';
    }).filter(Boolean).join(', ');
    
    let currentStoryText = "";
    if (config.hasStories) {
        const activeBackendStoryId = userPrefs.activeStoryId || 'season_3';
        const currentStoryData = storyList.find(s => s.id === activeBackendStoryId) || { episodes: [] };
        currentStoryText = (currentStoryData.episodes || []).map(e => `[Chapter: ${e.title}]\n${e.text}`).join('\n\n');
    }
    
    let pastContext = '';
    const pastEps = episodesList.slice(0, 10).reverse();
    
    for (let i = 0; i < pastEps.length; i++) {
      const ep = pastEps[i];
      let epContext = '';
      
      const progSnap = await db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('progress').doc(ep.id).get();
      const prog = progSnap.exists ? progSnap.data() : {};

      if (ep.userPrompt) epContext += `User Request: ${ep.userPrompt}\n`;
      if (ep.tutorIntroduction) epContext += `Tutor Response: ${ep.tutorIntroduction}\n\n`;

      if (!config.hasStories && ep.reading) {
          const targetText = ep.reading[config.primaryTextKey] || "";
          if (targetText) epContext += `Reading Passage:\n${targetText}\n\n`;
          if (ep.reading.focus && ep.reading.focus.length > 0) {
              const focusNotes = ep.reading.focus.map(f => `- ${f.word}: ${f.explanation || f.text}`).join('\n');
              epContext += `Focus:\n${focusNotes}\n\n`;
          }
      }
      
      if (ep.quiz) {
        let quizDetails = [];
        
        // Support both modern and legacy database structures
        const selections = prog.selections || {};
        const legacy1 = prog.quizAnswers || {};
        const legacy2 = prog.quiz?.answers || {};

        ep.quiz.forEach((q, idx) => {
            const qId = `quiz_${idx}`; 
            
            // Check all possible locations for the user's answer
            let userAns = selections[qId] || selections[idx] || selections[String(idx)] ||
                          legacy1[qId] || legacy1[idx] || legacy1[String(idx)] ||
                          legacy2[qId] || legacy2[idx] || legacy2[String(idx)];
                          
            if (typeof userAns === 'string') userAns = userAns.trim();
            
            const rawQuestion = q.sentence || q.text || "";
            const correctAns = (q.answer || q.correct || "").trim();
            
            // Safely extract distractors
            const distractorsList = q.distractors && Array.isArray(q.distractors) 
                ? q.distractors.join(', ') 
                : (q.options ? q.options.filter(o => o !== correctAns).join(', ') : 'None');

            // Format the output cleanly for the LLM
            if (userAns) {
                const isCorrect = (userAns === correctAns);
                quizDetails.push(`- Q: ${rawQuestion} | Correct Answer: ${correctAns} | Distractors: [${distractorsList}] | Result: ${isCorrect ? 'Correct' : `Incorrect (Guessed: ${userAns})`}`);
            } else {
                quizDetails.push(`- Q: ${rawQuestion} | Correct Answer: ${correctAns} | Distractors: [${distractorsList}] | Result: Not answered`);
            }
        });
        
        if (quizDetails.length > 0) epContext += `Quiz Performance:\n${quizDetails.join('\n')}\n\n`;
      }

      if (ep.sweep) {
         let sweepSentences = [];
         ep.sweep.forEach(s => {
             const text = s[config.primaryTextKey] || s.hungarian;
             if (text) sweepSentences.push(text);
         });
         if (sweepSentences.length > 0) epContext += `Sweep Sentences:\n- ${sweepSentences.join('\n- ')}\n\n`;
      }
      
      if (ep.test) {
        let testSentences = [];
        ep.test.forEach((t, tIdx) => {
            const m = prog.mistakes?.[`test_${tIdx}`] || prog.test?.mistakes?.[`test_${tIdx}`];
            const correctAns = t[config.primaryTextKey] || t.hungarian;
            if (m && m.trim()) testSentences.push(`EN: ${t.english} -> Correct: ${correctAns} | User Note: ${m.trim()}`);
            else testSentences.push(`EN: ${t.english} -> Correct: ${correctAns}`);
        });
        if (testSentences.length > 0) epContext += `Test Translations & Notes:\n- ${testSentences.join('\n- ')}\n\n`;
      }
      
      if (epContext) pastContext += `\n--- Past Episode: ${ep.title} ---\n${epContext}`;
    }

    const storyContextBlock = config.hasStories && currentStoryText ? `\nCURRENT STORY SO FAR:\n${currentStoryText}\n` : '';
    const pastContextBlock = pastContext ? `\nRECENT CONTEXT & PERFORMANCE (Last 10 lessons):\n${pastContext}\n` : '';
    
    // API vs Chatbot output instructions
    const outputInstruction = isForAPI 
        ? `OUTPUT FORMAT (Provide response strictly as raw JSON, without any markdown formatting or backticks. Do NOT wrap in \`\`\`json):\n${config.promptOutputFormat}`
        : `OUTPUT FORMAT (Provide response as JSON inside a \`\`\`json codeblock):\n${config.promptOutputFormat}`;

    return `SYSTEM INSTRUCTION:\n${config.promptSystemInstruction}\n\nKNOWN VOCABULARY:\n[${flatLexicon}]\n${storyContextBlock}${pastContextBlock}\nUSER REQUEST:\n${topicInput}\n\n---\n\n${outputInstruction}`;
  };

  // --- EXPORT PROMPT FUNCTION ---
  const handleExportPrompt = async () => {
    if (!topicInput.trim() || !user) return;
    setIsExporting(true); // <-- Uses distinct state
    setGenError('');
    try {
      const exportedText = await generatePromptString(false); // isForAPI = false
      const blob = new Blob([exportedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.name.replace(/\s+/g, '_')}_Prompt_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError("Failed to build prompt: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // --- API GENERATION FUNCTION ---
  const handleGenerateLLM = async () => {
    if (!topicInput.trim() || !user) return;
    const apiKey = localStorage.getItem('geminiApiKey') || localStorage.getItem('geminiPaidApiKey');
    
    if (!apiKey) {
      setGenError("No API Key found. Please set it in Hub settings.");
      setShowGenerateConfirm(false);
      return;
    }

    setIsGenerating(true);
    setGenError('');
    setShowGenerateConfirm(false);

    try {
      const promptText = await generatePromptString(true); // isForAPI = true
      
      const payload = {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { 
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: "HIGH" } 
          }
      };

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error?.message || "API Connection Failed");
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error("Empty response received.");

      await processImportedJSON(rawText);
    } catch (err) {
      setGenError("Generation failed: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const { handleSpeak, stopSpeak } = useGeminiTTS(config.ttsSystemInstruction);

  useEffect(() => { const unsub = auth.onAuthStateChanged(setUser); return () => unsub(); }, []);
  
  useEffect(() => {
    const checkTheme = () => {
      const localTheme = localStorage.getItem('lingocraft_theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(localTheme === 'dark' || (!localTheme && systemDark));
    };
    checkTheme();
    window.addEventListener('storage', checkTheme);
    window.addEventListener('theme-changed', checkTheme);
    return () => {
      window.removeEventListener('storage', checkTheme);
      window.removeEventListener('theme-changed', checkTheme);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const docName = config.lexiconDoc || 'lexicon';
    const lexRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    const unsubLex = lexRef.onSnapshot(snap => setGlobalLexicon(snap.exists ? snap.data() : {}));
    
    if (config.hasStories) {
      const prefsRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs');
      const unsubPrefs = prefsRef.onSnapshot(snap => { if (snap.exists) { setUserPrefs(snap.data()); setViewingStoryId(prev => prev === 'season_3' ? (snap.data().activeStoryId || 'season_3') : prev); }});
      const storiesRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('stories');
      const unsubStories = storiesRef.onSnapshot(snap => setStoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))));
      return () => { unsubLex(); unsubPrefs(); unsubStories(); };
    }
    return () => unsubLex();
  }, [user, config]);

  useEffect(() => {
    if (!user) return;
    const epsRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('episodes').orderBy('timestamp', 'desc').limit(10);
    return epsRef.onSnapshot(snap => {
      const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEpisodesList(eps);
      setActiveEpisodeId(prevId => !prevId && eps.length > 0 ? eps[0].id : prevId);
    });
  }, [user, config]);

  useEffect(() => {
    if (!activeEpisodeId || !user) { setActiveEpisode(null); setProgressState({}); return; }
    const epRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId);
    const unsubEp = epRef.onSnapshot(snap => { if (snap.exists) setActiveEpisode({ id: snap.id, ...snap.data() }); });
    const progRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId);
    
    const unsubProg = progRef.onSnapshot(snap => {
      if (snap.exists) {
        const d = snap.data();
        const rawSelections = d.selections || d.quizAnswers || d.quiz?.answers || {};
        const normalizedSelections = {};
        Object.keys(rawSelections).forEach(k => { normalizedSelections[k.toString().startsWith('quiz_') ? k : `quiz_${k}`] = rawSelections[k]; });
        
        const rawRevealed = d.revealed || Object.keys(d.quizRevealed || d.quiz?.revealed || {}).filter(k=>d.quizRevealed?.[k]||d.quiz?.revealed?.[k]) || [];
        const normalizedRevealed = Array.isArray(rawRevealed) ? rawRevealed.map(k => k.toString().startsWith('quiz_') ? k.toString() : `quiz_${k}`) : [];
        
        const rawGraded = d.gradedIds || Object.keys(d.quizGraded || d.quiz?.answers || {}).filter(k=>d.quizGraded?.[k]||d.quiz?.answers?.[k]) || [];
        const normalizedGraded = Array.isArray(rawGraded) ? rawGraded.map(k => k.toString().startsWith('quiz_') ? k.toString() : `quiz_${k}`) : [];

        const unifiedProgress = {
            ...d,
            selections: normalizedSelections,
            revealed: normalizedRevealed,
            gradedIds: normalizedGraded,
            testMastered: d.testMastered || d.test?.mastered || {},
            testRevealed: d.testRevealed || d.test?.revealed || {},
            mistakes: d.mistakes || d.test?.mistakes || {},
            sweepMastered: d.sweepMastered || d.sweep?.mastered || {},
            sweepRevealed: d.sweepRevealed || d.sweep?.revealed || {},
            listenedDrills: d.listenedDrills || Object.keys(d.drills?.mastered || {}).map(id => id.replace(/_/g, '-')), 
        };
        setProgressState(unifiedProgress);
      } else {
        setProgressState({});
      }
    });
    return () => { unsubEp(); unsubProg(); };
  }, [activeEpisodeId, user, config]);

  const updateFirebase = useCallback(async (updates) => {
    if (!activeEpisodeId || !user) return;
    setProgressState(prev => ({ ...prev, ...updates }));
    await db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set(updates, { merge: true });
  }, [activeEpisodeId, user, config]);

  const handleTabSwitch = (newTab) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(newTab);
    setTimeout(() => { window.scrollTo({ top: scrollPositions.current[newTab] || 0, behavior: 'instant' }); }, 0);
  };

  const processImportedJSON = async (textToParse) => {
    try {
      if (textToParse.startsWith('```json')) textToParse = textToParse.replace(/^```json\n?/, '');
      else if (textToParse.startsWith('```')) textToParse = textToParse.replace(/^```\n?/, '');
      if (textToParse.endsWith('```')) textToParse = textToParse.replace(/\n?```$/, '');

      const lessonJSON = JSON.parse(textToParse);
      const newEpisodeId = `ep_${Date.now()}`;
      
      if (lessonJSON.drills) lessonJSON.drills.forEach(d => { if (d.examples) d.examples = d.examples.slice(0, 5); });
      
      const validNewLemmas = (lessonJSON.newLemmas || []).map(w => {
          if (typeof w === 'object' && w !== null && !w.id) {
              return { ...w, id: `dict_${Date.now()}_${Math.random().toString(36).substring(7)}` };
          }
          return w;
      }).filter(Boolean);

      const episodeDoc = { ...lessonJSON, newLemmas: validNewLemmas, id: newEpisodeId, timestamp: Date.now(), userPrompt: topicInput || "Imported JSON Lesson" };
      
      const batch = db.batch();
      batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(newEpisodeId), episodeDoc);
      
      const docName = config.lexiconDoc || 'lexicon';
      if (Array.isArray(globalLexicon) || globalLexicon?.entries) {
          const existingEntries = globalLexicon.entries || globalLexicon || [];
          const newEntries = [...validNewLemmas, ...existingEntries];
          batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries }, { merge: true });
      } else {
          const newAcc = [...validNewLemmas, ...(globalLexicon?.accumulated || [])];
          batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { ...globalLexicon, accumulated: newAcc }, { merge: true });
      }
      
      if (config.hasStories) {
          let targetStoryId = userPrefs.activeStoryId || 'season_3';
          if (lessonJSON.storyStatus === 'new_story') {
            targetStoryId = `season_${Date.now()}`;
            batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs'), { activeStoryId: targetStoryId }, { merge: true });
          }
          const targetStoryData = storyList.find(s => s.id === targetStoryId) || { episodes: [] };
          const targetEps = [...(targetStoryData.episodes || [])];
          if (lessonJSON.story?.traditional) targetEps.push({ id: newEpisodeId, title: lessonJSON.title, text: lessonJSON.story.traditional });
          batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStoryId), { currentTitle: lessonJSON.storyTitle || "Story", episodes: targetEps, timestamp: targetStoryData.timestamp || Date.now() }, { merge: true });
      }
      
      await batch.commit();
      setActiveEpisodeId(newEpisodeId);
      setTopicInput('');
      setGenError('');
    } catch (err) {
      setGenError("Import failed. Make sure the data contains valid JSON.");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      await processImportedJSON(event.target.result.trim());
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handlePasteLesson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error("Clipboard is empty.");
      await processImportedJSON(text.trim());
    } catch (err) {
      setGenError("Failed to read clipboard: " + err.message);
    }
  };

  const handleDeleteEpisode = async () => {
    if (!activeEpisodeId || !user) return;
    try {
      const batch = db.batch();
      batch.delete(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId));
      batch.delete(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId));
      
      if (config.hasStories) {
          let targetStory = null;
          for (const story of storyList) {
            if (story.episodes && story.episodes.some(e => e.id === activeEpisodeId)) { targetStory = story; break; }
          }
          if (targetStory) {
            const updatedEps = targetStory.episodes.filter(e => e.id !== activeEpisodeId);
            batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStory.id), { episodes: updatedEps }, { merge: true });
          }
      }

      if (activeEpisode?.newLemmas && activeEpisode.newLemmas.length > 0) {
        const docName = config.lexiconDoc || 'lexicon';
        if (Array.isArray(globalLexicon) || globalLexicon?.entries) {
            const list = globalLexicon.entries || globalLexicon;
            const toDeleteIds = activeEpisode.newLemmas.map(l => l.id).filter(Boolean);
            const newEntries = list.filter(w => !toDeleteIds.includes(w.id));
            batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries }, { merge: true });
        } else {
            const newAcc = (globalLexicon?.accumulated || []).filter(w => !activeEpisode.newLemmas.includes(w));
            batch.set(db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { accumulated: newAcc }, { merge: true });
        }
      }

      await batch.commit();
      setDeletingEpisodeId(null);
      const nextEp = episodesList.find(e => e.id !== activeEpisodeId) || null;
      setActiveEpisodeId(nextEp ? nextEp.id : null);
    } catch (e) { console.error("Delete failed", e); }
  };

  const navItems = [
    { id: 'studio', label: 'Studio', icon: MessageSquare },
    ...(config.hasStories ? [{ id: 'episode', label: 'Audio', icon: Volume2 }] : []),
    ...(config.hasReading ? [{ id: 'reading', label: 'Reading', icon: BookOpen }] : []),
    { id: 'drill', label: 'Drills', icon: BookMarked },
    { id: 'quiz', label: 'Quiz', icon: CheckCircle2 },
    ...(config.hasTestTab ? [{ id: 'test', label: 'Test', icon: PenTool }] : []),
    ...(config.hasSweepTab ? [{ id: 'sweep', label: 'Sweep', icon: Activity }] : []),
    { id: 'lexicon', label: 'Lexicon', icon: Search }
  ];

  const isLatestEpisode = episodesList.length > 0 && activeEpisodeId === episodesList[0].id;

  if (!user) return null;

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${isDarkMode ? 'bg-stone-950 text-stone-100 selection:bg-stone-750' : 'bg-stone-50 text-stone-900 selection:bg-stone-200'}`} lang={config.id === 'mandarin' ? 'zh-Hant' : 'en'}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://db.onlinewebfonts.com/c/fe4f9dac99fb6b607c03981e6ce16869?family=DFKai-SB'); @import url('https://db.onlinewebfonts.com/c/1ee9941f1b8c128110ca4307dda59917?family=STKaiti'); .moe-font { font-family: 'DFKai-SB', '標楷體', 'BiauKai', serif; } .simp-font { font-family: 'STKaiti', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif; }`}} />

      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md px-4 py-3 flex justify-between shadow-sm ${isDarkMode ? 'bg-stone-900/85 border-stone-850' : 'bg-white/90 border-stone-200'}`}>
        <div className="flex gap-1 md:gap-4 overflow-x-auto no-scrollbar mask-edges pr-8 flex-1">
          <Link to="/" className={`p-2 rounded-lg border transition-all active:scale-95 shrink-0 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700 hover:text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-800'}`}><ArrowLeft size={16} /></Link>
          {navItems.map(item => (
            <button key={item.id} onClick={() => handleTabSwitch(item.id)} className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === item.id ? (isDarkMode ? 'bg-stone-700 text-amber-400' : 'bg-stone-800 text-white') : (isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100')}`}>
              <item.icon size={16} /> <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'studio' && (
        <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 animate-in fade-in duration-300">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl shadow-lg ${isDarkMode ? 'bg-stone-800 text-stone-100' : 'bg-stone-800 text-white'}`}><MessageSquare size={32} /></div>
              <div><h2 className="text-2xl md:text-3xl font-bold">Studio</h2><p className={`text-sm mt-1 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Generate next lesson</p></div>
            </div>
            
            <div className="relative shrink-0">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-200' : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-700'}`}>
                <List size={16} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
                <span className="max-w-[150px] truncate font-bold text-sm">{activeEpisode ? activeEpisode.title : 'Archive'}</span>
                <ChevronDown size={16} />
              </button>
              {dropdownOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-xl border overflow-hidden z-50 ${isDarkMode ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}`}>
                  <div className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
                  <div className="max-h-64 overflow-y-auto">
                    {episodesList.map(ep => (
                      <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); setDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700') : (isDarkMode ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-stone-50 text-stone-700')}`}>
                        {ep.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          <section className={`p-6 md:p-8 rounded-3xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
            <h3 className="text-xl font-bold mb-4 font-sans">Prompt the AI</h3>
            <div className="flex flex-col gap-4">
              <input 
                type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} disabled={isGenerating} 
                placeholder="e.g., Focus on grammar. Review words: table, sky." 
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} 
              />
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
                {/* 1. API Generation Button */}
                {!showGenerateConfirm ? (
                  <button 
                      onClick={() => setShowGenerateConfirm(true)} 
                      disabled={isGenerating || isExporting || !topicInput.trim()} 
                      title="Generate instantly via Gemini 3.5 API" 
                      className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isDarkMode ? 'bg-amber-600/20 border-amber-600/30 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50'}`}
                  >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      <span className="truncate hidden sm:inline">Generate</span>
                      <span className="truncate sm:hidden">Gen API</span>
                  </button>
                ) : (
                  <div className={`flex items-center justify-between gap-1 py-1 px-2 rounded-xl border shadow-sm ${isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider pl-1 hidden sm:inline">Sure?</span>
                      <button onClick={handleGenerateLLM} className="px-3 py-2 sm:py-1.5 bg-amber-500 text-stone-900 text-xs font-bold rounded-lg hover:bg-amber-400 w-full sm:w-auto">Yes</button>
                      <button onClick={() => setShowGenerateConfirm(false)} className="px-3 py-2 sm:py-1.5 text-xs font-bold opacity-70 hover:opacity-100 w-full sm:w-auto">No</button>
                  </div>
                )}

                {/* 2. Export Button */}
                <button 
                    onClick={handleExportPrompt} 
                    disabled={isGenerating || isExporting || !topicInput.trim()} 
                    title="Download detailed prompt file for LLM Web App" 
                    className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                    >
                    {isExporting ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" /> : <Download className="w-5 h-5 shrink-0" />}
                    <span className="truncate hidden sm:inline">Export Prompt</span>
                    <span className="truncate sm:hidden">Export</span>
                </button>

                {/* 3. Paste Button */}
                <button 
                    onClick={handlePasteLesson} 
                    disabled={isGenerating || isExporting} 
                    title="Paste copied JSON from clipboard" 
                    className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                    >
                    <ClipboardPaste className="w-5 h-5 shrink-0" />
                    <span className="truncate hidden sm:inline">Paste JSON</span>
                    <span className="truncate sm:hidden">Paste</span>
                </button>
                
                {/* 4. Import Button */}
                <label className={`cursor-pointer font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${(isGenerating || isExporting) ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                  <Upload className="w-5 h-5 shrink-0" /> 
                  <span className="truncate hidden sm:inline">Import File</span>
                  <span className="truncate sm:hidden">Import</span>
                  <input 
                    type="file" accept=".json,.txt" ref={fileInputRef} onChange={handleFileUpload} disabled={isGenerating || isExporting} className="hidden" 
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
                    
                    {(activeEpisode.story || activeEpisode.reading) && (
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
                          <button onClick={() => handleTabSwitch(config.hasStories ? 'episode' : 'reading')} className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-stone-800 hover:bg-stone-700 text-amber-400' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}>
                            Go to {config.hasStories ? 'Audio' : 'Reading'}
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

      {config.hasStories && <div className={activeTab === 'episode' ? 'block animate-in fade-in duration-300' : 'hidden'}><EpisodeTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} /></div>}
      {config.hasReading && <div className={activeTab === 'reading' ? 'block animate-in fade-in duration-300' : 'hidden'}><ReadingTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} /></div>}
      <div className={activeTab === 'drill' ? 'block animate-in fade-in duration-300' : 'hidden'}><DrillTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} isLatestEpisode={isLatestEpisode} /></div>
      <div className={activeTab === 'quiz' ? 'block animate-in fade-in duration-300' : 'hidden'}><QuizTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} /></div>
      {config.hasTestTab && <div className={activeTab === 'test' ? 'block animate-in fade-in duration-300' : 'hidden'}><TestTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} /></div>}
      {config.hasSweepTab && <div className={activeTab === 'sweep' ? 'block animate-in fade-in duration-300' : 'hidden'}><SweepTab isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={config} /></div>}
      <div className={activeTab === 'lexicon' ? 'block animate-in fade-in duration-300' : 'hidden'}><LexiconTab isDarkMode={isDarkMode} globalLexicon={globalLexicon} user={user} config={config} /></div>
      {config.hasStories && <div className={activeTab === 'story' ? 'block animate-in fade-in duration-300' : 'hidden'}><StoryTab isDarkMode={isDarkMode} activeStoryId={viewingStoryId} setActiveStoryId={setViewingStoryId} storyList={storyList} /></div>}
    </div>
  );
}