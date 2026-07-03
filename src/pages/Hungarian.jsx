import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Volume2, RotateCcw, Lightbulb, List, CheckCircle, 
  Hammer, Sun, Moon, Eye, Activity, Search, Upload, Download, 
  BookText, Workflow, Copy, PenTool, MessageSquare, Trash2, 
  XCircle, Loader2, ArrowLeft 
} from 'lucide-react';
import firebase, { auth, db } from '../firebase';

// --- UTILS ---
const fallbackCopyText = (text, setCopied) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
  document.body.appendChild(textArea); textArea.focus(); textArea.select();
  try { document.execCommand('copy'); if (setCopied) { setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch (err) {}
  document.body.removeChild(textArea);
};

const removeDiacritics = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}		

// --- GEMINI LIVE WEBSOCKET AUDIO SETUP & STATE ---
let ws = null;
let audioContext = null;
let nextAudioTime = 0;
let activeAudioNodes = [];
let currentOnEndCallback = null; 

const GEMINI_SYSTEM_INSTRUCTION = "You are a direct text-to-speech reader. Read the text provided to you exactly as written. If the text contains both Hungarian and English, read each part in its respective language. Do not add any filler words, greetings, or acknowledgements.";

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

    activeAudioNodes.push(source);
    source.onended = () => {
        activeAudioNodes = activeAudioNodes.filter(n => n !== source);
    };
}

const handleWsMessage = async (event) => {
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
            if (currentOnEndCallback) {
                const cb = currentOnEndCallback;
                currentOnEndCallback = null; 
                
                const timeLeft = Math.max(0, nextAudioTime - (audioContext ? audioContext.currentTime : 0));
                setTimeout(() => cb(), (timeLeft * 1000) + 100);
            }
        }
    }
};

const UI = {
  Section: ({ isDark, children }) => <section className={`p-5 sm:p-6 rounded-3xl shadow-sm border transition-all duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>{children}</section>,
  Card: ({ isDark, children }) => <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${isDark ? 'bg-zinc-900/50 border-zinc-800 hover:shadow-md hover:border-zinc-700' : 'bg-white border-stone-200 hover:shadow-md hover:border-stone-300'}`}>{children}</div>,
  MainText: ({ isDark, children }) => <p className={`font-semibold text-lg sm:text-xl tracking-wide ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>{children}</p>,
  SubText: ({ isDark, children }) => <p className={`italic text-sm sm:text-base mt-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>{children}</p>,
  AnswerText: ({ isDark, children }) => <p className={`font-bold text-xl mb-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{children}</p>,
  Btn: ({ isDark, onClick, icon: IconComponent, solid, color, disabled, children }) => {
    const isEmerald = color === 'emerald';
    const bg = solid ? (isEmerald ? 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 border-blue-600 hover:bg-blue-700 text-white') : (isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100');
    return <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all border shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${bg}`}>{IconComponent && <IconComponent size={14}/>} {children}</button>
  },
  IconBtn: ({ isDark, onClick, icon: IconComponent, active, destructive, title, disabled }) => {
    let col = active ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-blue-500' : 'bg-stone-50 text-stone-500 border-stone-200 hover:text-blue-600';
    if (destructive) col = isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-red-400' : 'bg-stone-50 text-stone-500 border-stone-200 hover:text-red-600';
    return <button onClick={onClick} disabled={disabled} title={title} className={`p-2 rounded-full border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${col}`}><IconComponent size={14}/></button>
  }
};

function ModuleHeader({ title, moduleName, icon: IconComponent, isDark, progressPercent, onReset }) {
  return (
    <div className={`mb-6 p-5 sm:p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}><IconComponent size={24} /></div>
        <div><h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-zinc-100' : 'text-stone-800'}`}>{title}</h1><p className={`text-sm font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>{moduleName}</p></div>
      </div>
      {progressPercent !== undefined && (
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`flex-1 sm:w-32 h-2.5 rounded-full overflow-hidden border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-stone-100 border-stone-200'}`}><div className={`h-full transition-all duration-500 bg-blue-500`} style={{ width: `${progressPercent}%` }} /></div>
          {onReset && <UI.IconBtn isDark={isDark} onClick={onReset} icon={RotateCcw} destructive title="Reset Progress" />}
        </div>
      )}
    </div>
  );
}

function ProgressStatsBar({ isDark, title, score, total, onCopy, copied }) {
  return (
    <div className={`mt-6 p-4 rounded-2xl border flex flex-col sm:flex-row gap-3 justify-between sm:items-center ${isDark ? 'bg-zinc-900/40 border-zinc-800 text-zinc-100' : 'bg-stone-50 border-stone-200 text-stone-800'}`}>
      <div className="text-sm font-bold">{title}: <span className="font-extrabold text-blue-600 dark:text-blue-400">{score}</span> / {total}</div>
      <UI.Btn isDark={isDark} onClick={onCopy} icon={copied ? CheckCircle : Copy} solid={copied} color={copied ? 'emerald' : 'blue'}>{copied ? 'Copied!' : 'Copy Summary'}</UI.Btn>
    </div>
  );
}

function CardHeader({ index, title, isMastered, isDark, onTogglePlay, extraButtons }) {
  return (
    <div className={`flex justify-between items-center mb-3 pb-2 border-b ${isDark ? 'border-zinc-800' : 'border-stone-100'}`}>
      <div className="flex gap-3 items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 ${isMastered ? 'border-emerald-500 bg-emerald-500 text-white' : isDark ? 'border-zinc-700 text-zinc-500' : 'border-stone-300 text-stone-400'}`}>{isMastered ? <CheckCircle size={12} /> : index}</div>
        <h4 className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{title}</h4>
      </div>
      <div className="flex gap-2">
        {extraButtons}
        {onTogglePlay && <UI.IconBtn isDark={isDark} onClick={onTogglePlay} icon={Volume2} />}
      </div>
    </div>
  );
}

// --- STEP COMPONENTS ---
function Step1App({ episodeData, progress, updateProgress, isDarkMode, handleSpeak }) {
  const mst = progress?.step1?.mastered || {};
  if (!episodeData?.reading) return <div className="p-10 text-center opacity-50">Data not ready</div>;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <ModuleHeader title={episodeData.title || "Reading"} moduleName="Reading" icon={BookOpen} isDark={isDarkMode} />
      
      <div className="space-y-6 sm:space-y-8">
        
        {/* 1. DEFINITIONS */}
        {Array.isArray(episodeData.reading.definitions) && episodeData.reading.definitions.length > 0 && (
          <UI.Section isDark={isDarkMode}>
            <div className={`flex justify-between items-center mb-4 pb-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-100'}`}>
              <div className="flex items-center gap-3"><div className="text-blue-600 dark:text-blue-400"><BookOpen size={24} /></div><h2 className={`text-xl sm:text-2xl font-bold tracking-wide ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Definíciók (Definitions)</h2></div>
              <UI.IconBtn isDark={isDarkMode} onClick={() => { handleSpeak(episodeData.reading.definitions.map(d=>d.word + ". " + d.text).join(' ')); updateProgress('step1', { mastered: { ...mst, defs: true } }); }} icon={Volume2} />
            </div>
            <div className={`space-y-4 text-lg ${isDarkMode ? 'text-zinc-300' : 'text-stone-700'}`}>
              <ul className="space-y-3">
                {episodeData.reading.definitions.map((def, idx) => (
                  <li key={idx}><strong className={`font-bold ${isDarkMode ? 'text-zinc-100' : 'text-stone-900'}`}>{def.word}</strong>: {def.text}</li>
                ))}
              </ul>
            </div>
          </UI.Section>
        )}

        {/* 2. READING (HUNGARIAN) */}
        <UI.Section isDark={isDarkMode}>
          <div className={`flex justify-between items-center mb-4 pb-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-100'}`}>
            <div className="flex items-center gap-3"><div className="text-blue-600 dark:text-blue-400"><BookOpen size={24} /></div><h2 className={`text-xl sm:text-2xl font-bold tracking-wide ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Olvasás (Reading)</h2></div>
            <UI.IconBtn isDark={isDarkMode} onClick={() => { handleSpeak(episodeData.reading.hungarian); updateProgress('step1', { mastered: { ...mst, read: true } }); }} icon={Volume2} />
          </div>
          {typeof episodeData.reading.hungarian === 'string' && episodeData.reading.hungarian.split('\n\n').map((p, i) => (
            <p key={i} className={`mb-3 sm:mb-4 text-lg leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-stone-700'}`}>{p}</p>
          ))}
        </UI.Section>

        {/* 3. READING (ENGLISH) */}
        {episodeData.reading.english && (
          <UI.Section isDark={isDarkMode}>
            <div className={`flex justify-between items-center mb-4 pb-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-100'}`}>
              <div className="flex items-center gap-3"><div className="text-blue-600 dark:text-blue-400"><BookOpen size={24} /></div><h2 className={`text-xl sm:text-2xl font-bold tracking-wide ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Angol fordítás</h2></div>
              <UI.IconBtn isDark={isDarkMode} onClick={() => { handleSpeak(episodeData.reading.english); updateProgress('step1', { mastered: { ...mst, eng: true } }); }} icon={Volume2} />
            </div>
            {typeof episodeData.reading.english === 'string' && episodeData.reading.english.split('\n\n').map((p, i) => (
              <p key={i} className={`mb-3 sm:mb-4 text-lg leading-relaxed italic ${isDarkMode ? 'text-zinc-400' : 'text-stone-600'}`}>{p}</p>
            ))}
          </UI.Section>
        )}

        {/* 4. FOCUS / GRAMMAR */}
        {Array.isArray(episodeData.reading.focus) && episodeData.reading.focus.length > 0 && (
          <UI.Section isDark={isDarkMode}>
            <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-stone-100'}`}>
              <div className="text-amber-500"><Lightbulb size={24} /></div>
              <h2 className={`text-xl sm:text-2xl font-bold tracking-wide ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Fókusz & Nyelvtan</h2>
            </div>
            <div className={`space-y-6 text-lg ${isDarkMode ? 'text-zinc-300' : 'text-stone-700'}`}>
              {episodeData.reading.focus.map((item, idx) => (
                <div key={idx}>
                  <span className={`font-bold ${isDarkMode ? 'text-zinc-100' : 'text-stone-900'}`}>{idx + 1}. {item.word}</span>
                  <p className="text-sm mt-1 mb-2">{item.explanation}</p>
                </div>
              ))}
            </div>
          </UI.Section>
        )}

      </div>
    </div>
  );
}

function Step2App({ episodeData, progress, updateProgress, isDarkMode, handleSpeak }) {
  const mst = progress?.drills?.mastered || {}, rev = progress?.drills?.revealed || {};
  if (!Array.isArray(episodeData?.drills) || episodeData.drills.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <ModuleHeader title="Pattern Recognition" moduleName="Drills" icon={Hammer} isDark={isDarkMode} onReset={() => updateProgress('drills', { mastered: {}, revealed: {} })} />
      <div className="space-y-6 sm:space-y-8">
        {episodeData.drills.map((sec, drIdx) => (
          <UI.Section key={drIdx} isDark={isDarkMode}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 pb-3 border-b ${isDarkMode ? 'text-zinc-100 border-zinc-800' : 'text-stone-800 border-stone-200'}`}>{drIdx + 1}. {sec.word} ({sec.translation})</h2>
            <div className="space-y-4 sm:space-y-6">
              {sec.examples.map((ex, exIdx) => {
                const id = `drill_${drIdx}_${exIdx}`;
                const ttsText = `${ex.hungarian}. ${ex.english}. ${ex.hungarian}`;
                
                return (
                  <UI.Card key={id} isDark={isDarkMode}>
                    <CardHeader index={exIdx + 1} title={`Mondat ${String(exIdx + 1).padStart(2, '0')}`} isMastered={mst[id]} isDark={isDarkMode} onTogglePlay={() => { 
                        updateProgress('drills', { mastered: { ...mst, [id]: true } });
                        handleSpeak(ttsText, () => {
                            updateProgress('drills', { revealed: { ...rev, [id]: true } });
                        }); 
                    }} />
                    <div className="pl-10">
                      {rev[id] ? (
                        <div className="space-y-2 animate-in fade-in">
                          <UI.MainText isDark={isDarkMode}>{ex.hungarian}</UI.MainText><UI.SubText isDark={isDarkMode}>{ex.english}</UI.SubText>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          <UI.Btn isDark={isDarkMode} solid onClick={() => { 
                              updateProgress('drills', { mastered: { ...mst, [id]: true } });
                              handleSpeak(ttsText, () => {
                                  updateProgress('drills', { revealed: { ...rev, [id]: true } });
                              }); 
                          }} icon={Volume2}>Listen to Drill</UI.Btn>
                        </div>
                      )}
                    </div>
                  </UI.Card>
                );
              })}
            </div>
          </UI.Section>
        ))}
      </div>
    </div>
  );
}

function Step3App({ episodeData, progress, updateProgress, isDarkMode, handleSpeak }) {
  const [copied, setCopied] = useState(false);
  const answers = progress?.quiz?.answers || {};
  const rev = progress?.quiz?.revealed || {};
  const drafts = progress?.quiz?.drafts || {};

  if (!Array.isArray(episodeData?.quiz) || episodeData.quiz.length === 0) return null;

  const score = Object.keys(answers).filter(id => {
    const idx = parseInt(id.split('_')[1], 10);
    const q = episodeData.quiz[idx];
    return q && answers[id] === q.correct;
  }).length;

  const handleSelectDraft = (qId, optionStr) => {
    if (answers[qId] !== undefined) return;
    updateProgress('quiz', { drafts: { ...drafts, [qId]: optionStr } });
  };

  const handleListenAndCheck = (qId, idx) => {
    if (drafts[qId] === undefined || answers[qId] !== undefined) return;
    
    updateProgress('quiz', { answers: { ...answers, [qId]: drafts[qId] } });
    
    const q = episodeData.quiz[idx];
    const fullText = q.text.replace(/_{3,}/, drafts[qId]);
    handleSpeak(fullText);
  };

  const copyResults = () => {
    let textOutput = `🇭🇺 Quiz Translation Mistakes 🇭🇺\n\n`;
    let errorsExist = false;
    episodeData.quiz.forEach((q, idx) => {
      const qId = `quiz_${idx}`;
      const userAns = answers[qId];
      if (userAns !== undefined && userAns !== q.correct) {
        errorsExist = true;
        textOutput += `Mondat ${idx + 1}\nEN: ${q.translation}\nSelected: ${userAns} | Correct: ${q.correct}\n---\n`;
      }
    });
    if (!errorsExist) textOutput += "No mistakes logged! Perfect score! 🎉\n";
    fallbackCopyText(textOutput, setCopied);
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <ModuleHeader title="Grammar & Vocab Quiz" moduleName="Quiz" icon={Workflow} isDark={isDarkMode} progressPercent={(Object.keys(answers).length / episodeData.quiz.length) * 100} onReset={() => updateProgress('quiz', { answers: {}, revealed: {}, drafts: {} })} />

      <div className="space-y-6">
        {episodeData.quiz.map((item, idx) => {
          const qId = `quiz_${idx}`;
          const isRevealed = rev[qId];
          const draftChosen = drafts[qId];
          const isLocked = answers[qId] !== undefined;
          const chosen = answers[qId];
          const isCorrect = chosen === item.correct;
          const fullText = item.text.replace(/_{3,}/, item.correct);

          return (
            <UI.Card key={qId} isDark={isDarkMode}>
              <CardHeader index={idx + 1} title={`Kérdés ${String(idx + 1).padStart(2, '0')}`} isMastered={isLocked && isCorrect} isDark={isDarkMode} onTogglePlay={isLocked ? () => handleSpeak(fullText) : undefined} />
              <div className="pl-0 sm:pl-10 space-y-4">
                <p className={`text-lg font-bold leading-relaxed ${isDarkMode ? 'text-zinc-200' : 'text-stone-800'}`}>
                  {typeof item.text === 'string' && item.text.split(/_{3,}/).map((part, i, arr) => (
                    <Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className={`mx-1 px-3 py-1 font-bold rounded-lg border text-base ${isLocked ? (isCorrect ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300 line-through') : draftChosen ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-900') : (isDarkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-100 text-slate-400')}`}>
                            {isLocked ? chosen : (draftChosen || "___")}
                        </span>
                      )}
                    </Fragment>
                  ))}
                </p>

                <p className={`text-sm italic ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>{item.translation}</p>

                {!isRevealed ? (
                  <div className="pt-2">
                    <button onClick={() => updateProgress('quiz', { revealed: { ...rev, [qId]: true } })} className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-xl border text-sm font-bold tracking-wider uppercase shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                      <Eye size={16} /><span>Reveal Options</span>
                    </button>
                  </div>
                ) : (
                  <div className="animate-in duration-300 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {Array.isArray(item.options) && item.options.map((opt, oIdx) => {
                        const isOptionDrafted = draftChosen === opt;
                        const isOptionLocked = chosen === opt;
                        const isOptionCorrect = opt === item.correct;
                        
                        let btnStyle = isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300';
                        if (isLocked) {
                          if (isOptionCorrect) btnStyle = isDarkMode ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-extrabold' : 'bg-emerald-50 border-emerald-400 text-emerald-800 font-extrabold';
                          else if (isOptionLocked) btnStyle = isDarkMode ? 'bg-red-950/40 border-red-500/50 text-red-300 font-extrabold' : 'bg-red-50 border-red-400 text-red-800 font-extrabold';
                        } else if (isOptionDrafted) {
                          btnStyle = isDarkMode ? 'bg-blue-900/40 border-blue-500/50 text-blue-300 font-bold' : 'bg-blue-50 border-blue-400 text-blue-800 font-bold';
                        }

                        return (
                          <button key={oIdx} onClick={() => handleSelectDraft(qId, opt)} className={`p-3 rounded-xl border text-left text-sm transition-all flex items-center justify-between ${btnStyle}`} disabled={isLocked}>
                            <span>{opt}</span>
                            {isLocked && isOptionCorrect && <CheckCircle size={14} className="text-emerald-500 shrink-0 ml-2" />}
                            {isLocked && isOptionLocked && !isOptionCorrect && <XCircle size={14} className="text-red-500 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                    {!isLocked && (
                      <div className="flex justify-start">
                        <UI.Btn isDark={isDarkMode} solid disabled={draftChosen === undefined} onClick={() => handleListenAndCheck(qId, idx)} icon={Volume2}>Listen & Check</UI.Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </UI.Card>
          );
        })}
      </div>
      <ProgressStatsBar isDark={isDarkMode} title="Quiz Correct Score" score={score} total={episodeData.quiz.length} onCopy={copyResults} copied={copied} />
    </div>
  );
}

function StepTestApp({ episodeData, progress, updateProgress, isDarkMode, handleSpeak }) {
  const mst = progress?.test?.mastered || {}, rev = progress?.test?.revealed || {}, mis = progress?.test?.mistakes || {};
  if (!Array.isArray(episodeData?.test) || episodeData.test.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <ModuleHeader title="Active Translation" moduleName="Test" icon={PenTool} isDark={isDarkMode} onReset={() => updateProgress('test', { mastered: {}, revealed: {}, mistakes: {} })} />
      <div className="space-y-4">
        {episodeData.test.map((item, i) => {
          const qId = `test_${i}`;
          return (
            <UI.Card key={qId} isDark={isDarkMode}>
              <CardHeader index={i + 1} title={`Mondat ${String(i + 1).padStart(2, '0')}`} isMastered={mst[qId]} isDark={isDarkMode} onTogglePlay={() => { 
                  updateProgress('test', { mastered: { ...mst, [qId]: true } });
                  handleSpeak(item.hungarian, () => {
                      updateProgress('test', { revealed: { ...rev, [qId]: true } });
                  }); 
              }} />
              <div className="pl-0 sm:pl-10">
                <UI.MainText isDark={isDarkMode}>{item.english}</UI.MainText>
                {!rev[qId] ? (
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <UI.Btn isDark={isDarkMode} solid onClick={() => { 
                        updateProgress('test', { mastered: { ...mst, [qId]: true } });
                        handleSpeak(item.hungarian, () => {
                            updateProgress('test', { revealed: { ...rev, [qId]: true } });
                        }); 
                    }} icon={Volume2}>Listen to Answer</UI.Btn>
                  </div>
                ) : (
                  <div className={`mt-4 pt-4 border-t border-dashed ${isDarkMode ? 'border-zinc-800' : 'border-stone-200'}`}>
                    <UI.AnswerText isDark={isDarkMode}>{item.hungarian}</UI.AnswerText>
                    <textarea 
                      value={mis[qId] || ''} onChange={e => updateProgress('test', { mistakes: { ...mis, [qId]: e.target.value } })}
                      placeholder="Log your mistake or note here..." rows="2"
                      className={`w-full p-4 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner transition-all mt-4 ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:border-blue-500' : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 focus:border-blue-500'}`} 
                    />
                  </div>
                )}
              </div>
            </UI.Card>
          );
        })}
      </div>
    </div>
  );
}

function Step4App({ episodeData, progress, updateProgress, isDarkMode, handleSpeak }) {
  const mst = progress?.sweep?.mastered || {}, rev = progress?.sweep?.revealed || {};
  if (!Array.isArray(episodeData?.sweep) || episodeData.sweep.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <ModuleHeader title="Diagnostic Sweep" moduleName="Sweep" icon={Activity} isDark={isDarkMode} onReset={() => updateProgress('sweep', { mastered: {}, revealed: {} })} />
      <div className="space-y-4">
        {episodeData.sweep.map((item, i) => {
          const qId = `sweep_${i}`;
          const textToRead = `${item.word}. ${item.hungarian}. ${item.english}. ${item.hungarian}`;
          
          return (
            <UI.Card key={qId} isDark={isDarkMode}>
              <CardHeader index={i + 1} title={`Mondat ${String(i + 1).padStart(2, '0')}`} isMastered={mst[qId]} isDark={isDarkMode} onTogglePlay={() => { 
                  updateProgress('sweep', { mastered: { ...mst, [qId]: true } });
                  handleSpeak(textToRead, () => {
                      updateProgress('sweep', { revealed: { ...rev, [qId]: true } });
                  }); 
              }} />
              <div className="pl-0 sm:pl-10">
                {rev[qId] ? (
                  <div className="space-y-2 animate-in fade-in">
                    <p className={`font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{item.word}</p>
                    <UI.MainText isDark={isDarkMode}>{item.hungarian}</UI.MainText><UI.SubText isDark={isDarkMode}>{item.english}</UI.SubText>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <UI.Btn isDark={isDarkMode} solid onClick={() => { 
                        updateProgress('sweep', { mastered: { ...mst, [qId]: true } });
                        handleSpeak(textToRead, () => {
                            updateProgress('sweep', { revealed: { ...rev, [qId]: true } });
                        }); 
                    }} icon={Volume2}>Listen to Sweep</UI.Btn>
                  </div>
                )}
              </div>
            </UI.Card>
          );
        })}
      </div>
    </div>
  );
}

function DictionaryApp({ isDarkMode, globalDictionary, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPos, setFilterPos] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyDict = () => {
    const t = globalDictionary.map(i => `${i.word}; ${i.meaning}; ${i.pos || 'N/A'}`).join('\n');
    fallbackCopyText(t, setCopied);
  };

  const filteredVocab = useMemo(() => {
    const q = removeDiacritics(searchQuery).toLowerCase();
    return (globalDictionary || []).filter(item => {
      const matchesSearch = !q || removeDiacritics(item.word).toLowerCase().includes(q) || removeDiacritics(item.meaning).toLowerCase().includes(q);
      const matchesPos = filterPos === 'all' || item.pos === filterPos;
      return matchesSearch && matchesPos;
    });
  }, [searchQuery, filterPos, globalDictionary]);

  const deleteItem = async (id) => {
    if (!user) return;
    const newDict = globalDictionary.filter(i => i.id !== id);
    await db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('database').doc('dictionary').set({ entries: newDict });
    setDeletingId(null);
  };

  const getBadge = pos => {
    switch (pos?.toLowerCase()) {
      case 'n': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'v': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'adj': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'adv': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <div className="space-y-6">
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex justify-center items-center border ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}><BookText size={20} /></div>
            <div>
              <h1 className={`text-xl font-bold ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>Magyar Szótár</h1>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>Master Cloud Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${isDarkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-stone-100 text-stone-600'}`}>{filteredVocab.length} visible</div>
            <UI.Btn isDark={isDarkMode} onClick={copyDict} icon={copied ? CheckCircle : Copy} solid={copied} color={copied ? 'emerald' : 'blue'}>{copied ? 'Copied' : 'Backup'}</UI.Btn>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute left-3 top-3 text-stone-400"><Search size={20} /></div>
            <input placeholder="Search vocabulary..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full pl-10 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 font-medium' : 'bg-white border-stone-200 text-stone-800 font-medium'}`} />
          </div>
          <select value={filterPos} onChange={e => setFilterPos(e.target.value)} className={`p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 font-bold' : 'bg-white border-stone-200 text-stone-800 font-bold'}`}>
            <option value="all">All Types</option>
            <option value="n">Nouns</option>
            <option value="v">Verbs</option>
            <option value="adj">Adjectives</option>
            <option value="adv">Adverbs</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVocab.map(item => (
            <div key={item.id} className={`flex flex-col p-5 rounded-xl border transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
              <div className="flex justify-between items-start mb-3">
                <span className={`text-lg font-bold ${isDarkMode ? 'text-zinc-100' : 'text-stone-900'}`}>{item.word}</span>
                <div className="flex gap-2">
                  {item.pos && <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${getBadge(item.pos)}`}>{item.pos}</span>}
                  {deletingId === item.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => deleteItem(item.id)} className="text-red-500 text-xs font-bold uppercase">Confirm</button>
                      <button onClick={() => setDeletingId(null)}><XCircle size={14} className="text-stone-400 cursor-pointer" /></button>
                    </div>
                  ) : <button onClick={() => setDeletingId(item.id)}><Trash2 size={14} className="text-stone-400 hover:text-red-500 cursor-pointer" /></button>}
                </div>
              </div>
              <div className={`text-sm mt-auto ${isDarkMode ? 'text-zinc-400' : 'text-stone-600'}`}>{item.meaning}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- MAIN PORTED APP ---
export default function Hungarian() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');
  const scrollPositions = useRef({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const [episodesList, setEpisodesList] = useState([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [globalDictionary, setGlobalDictionary] = useState([]);
  const [progress, setProgress] = useState({});

  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const fileInputRef = useRef(null);

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

  useEffect(() => {
    const myKey = localStorage.getItem('geminiApiKey');
    if (!myKey) return; 

    ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${myKey}`);

    ws.onopen = () => {
        const setupMessage = {
            setup: {
                model: "models/gemini-3.1-flash-live-preview",
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } }
                },
                systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] }
            }
        };
        ws.send(JSON.stringify(setupMessage));
    };

    ws.onmessage = handleWsMessage;
    return () => { if (ws) ws.close(); };
  }, []);

  const handleSpeak = (text, onEnd) => {
      const myKey = localStorage.getItem('geminiApiKey');
      if (!myKey) {
          alert("Audio is still connecting or failed. Make sure your API key is saved on the home page!");
          return;
      }

      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      if (audioContext.state === 'suspended') audioContext.resume();

      activeAudioNodes.forEach(n => { try { n.stop(); } catch(e){} });
      activeAudioNodes = [];
      nextAudioTime = audioContext ? audioContext.currentTime : 0;

      currentOnEndCallback = onEnd || null;

      const sendAudioRequest = () => ws.send(JSON.stringify({ realtimeInput: { text: text } }));

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
                      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] }
                  }
              };
              ws.send(JSON.stringify(setupMessage));
              sendAudioRequest();
          };
          ws.onmessage = handleWsMessage;
      } else {
          sendAudioRequest();
      }
  };

  useEffect(() => {
    if (!user || !activeEpisodeId) return;
    const epRef = db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId);
    epRef.get().then(snap => { if (snap.exists) setActiveEpisode(snap.data()); });
    
    const progRef = db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId);
    const unsubProg = progRef.onSnapshot(snap => {
      setProgress(snap.exists ? snap.data() : {});
    });
    return () => unsubProg();
  }, [user, activeEpisodeId]);

  useEffect(() => {
    if (!user) return;
    const dictRef = db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('database').doc('dictionary');
    const unsubLex = dictRef.onSnapshot(snap => {
      setGlobalDictionary(snap.exists && snap.data().entries ? snap.data().entries : []);
    });

    const epsRef = db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('episodes').orderBy('timestamp', 'desc');
    const unsubEps = epsRef.onSnapshot(snap => {
      const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEpisodesList(eps);
      if (eps.length > 0 && !activeEpisodeId) setActiveEpisodeId(eps[0].id);
    });

    return () => { unsubLex(); unsubEps(); };
  }, [user]);

  const updateProgress = (tabName, fields) => {
    if (!user || !activeEpisodeId) return;
    setProgress(p => ({ ...p, [tabName]: { ...(p[tabName] || {}), ...fields } }));
    db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set({ [tabName]: fields }, { merge: true });
  };

  const handleDeleteLesson = async () => {
    if (!user || !activeEpisodeId) return;
    try {
      await db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId).delete();
      await db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).delete();
      setActiveEpisode(null); 
      setProgress({}); 
      setConfirmDelete(false);
      const remaining = episodesList.filter(ep => ep.id !== activeEpisodeId);
      if (remaining.length > 0) setActiveEpisodeId(remaining[0].id); else setActiveEpisodeId(null);
    } catch (err) { console.error("Error deleting lesson:", err); }
  };

  const buildPromptContext = async () => {
    if (!user) throw new Error("Must be logged in.");
    const epsSnapshot = await db.collection('artifacts').doc('hungarian-master')
        .collection('users').doc(user.uid).collection('episodes')
        .orderBy('timestamp', 'desc').limit(10).get();
    
    let richContext = "";
    for (const docSnap of epsSnapshot.docs) {
      const ep = docSnap.data();
      const progSnap = await db.collection('artifacts').doc('hungarian-master')
          .collection('users').doc(user.uid).collection('progress').doc(docSnap.id).get();
      const prog = progSnap.exists ? progSnap.data() : {};
      
      let quizScore = "N/A"; let quizMisses = "";
      if (ep.quiz && prog.quiz?.answers) {
        let correct = 0; let misses = [];
        ep.quiz.forEach((q, i) => {
          const ans = prog.quiz.answers[`quiz_${i}`];
          if (ans === q.correct) correct++; else if (ans) misses.push(`Target: ${q.correct}, Guessed: ${ans}`);
        });
        quizScore = `${correct}/${ep.quiz.length}`;
        quizMisses = misses.length > 0 ? ` (Misses: ${misses.join(' | ')})` : "";
      }

      let testMisses = "";
      if (ep.test && prog.test?.mistakes) {
        let tMis = [];
        ep.test.forEach((t, i) => {
          const m = prog.test.mistakes[`test_${i}`];
          if (m && m.trim()) tMis.push(`EN: ${t.english} -> User wrote: ${m.trim()} (Correct: ${t.hungarian})`);
        });
        testMisses = tMis.length > 0 ? `Test mistakes: ${tMis.join(' | ')}` : "";
      }

      richContext += `\n--- Episode: ${ep.title} ---
      User Request: ${ep.userPrompt || 'None'}
      Tutor Reply: ${ep.tutorIntroduction || 'None'}
      Target Words: ${ep.reading?.definitions?.map(d=>d.word).join(', ') || 'None'}
      Grammar/Vocab Focus: ${ep.reading?.focus?.map(f => `${f.word}: ${f.explanation}`).join(' | ') || 'None'}
      Reading (HU): ${ep.reading?.hungarian || 'None'}
      Drills (HU): ${ep.drills?.map(d => `${d.word} -> ${d.examples?.map(ex => ex.hungarian).join(' ')}`).join(' | ') || 'None'}
      Quiz Sentences (HU): ${ep.quiz?.map(q => q.text.replace(/_{3,}/, q.correct)).join(' ') || 'None'}
      Test Sentences (HU): ${ep.test?.map(t => t.hungarian).join(' ') || 'None'}
      Sweep Sentences (HU): ${ep.sweep?.map(s => s.hungarian).join(' ') || 'None'}
      Quiz Score & Misses: ${quizScore}${quizMisses}
      Active Translation Mistakes: ${testMisses}\n`;
    }

    const vocabContext = globalDictionary.map(d => d.word).join(', ');

    const systemInstruction = `You are an expert Hungarian language curriculum designer. Generate a highly structured lesson. 
    
    CRITICAL RULES:
    1. EXTRACT EXACTLY 3 NEW BASE WORDS to teach, PLUS any additional words the user explicitly requests to be added (silent additions). These MUST NOT be in the Known Vocabulary list.
    2. Do NOT randomly add review words. ONLY highlight specific review words or "silent additions" if the user explicitly requests them in the prompt.
    3. The Definitions, Quiz, and Test MUST NOT contain any unknown words outside the Known Vocabulary + the 3 new target words + explicit user requests.
    4. Reading, Drills, and Sweep may use other new words sparingly, but keep the core focus tight.
    5. For the Quiz and Test (15 questions each): EXACTLY 2 questions must target each of the 3 new target words, and EXACTLY 2 questions must target each explicit review/silent addition word. The remaining questions should test other grammar or vocabulary from the Known list to review weak points identified in the context.
    6. Strictly follow the requested JSON schema and lengths.
    
    TASKS:
    1. 'reading.definitions': Provide Hungarian definitions for ONLY the 3 new target words, written ENTIRELY using Known Vocabulary.
    2. 'reading.hungarian': 3 to 5 paragraphs separated by \\n\\n. It MUST include conversational dialogue.
    3. 'reading.english': Literal English translation.
    4. 'reading.focus': Variable length. Explain grammar rules, nuances, and vocabulary requested by the user, and explain how the 3 new words are used.
    5. 'drills': Exactly 5 items. Each needs exactly 5 example sentences in HU/EN.
    6. 'quiz': Exactly 15 grammar/vocab questions. Use '_____' (5 underscores) for the blank. (Follow rule 5 for distribution).
    7. 'test': Exactly 15 active translation sentences (English to Hungarian). (Follow rule 5 for distribution).
    8. 'sweep': Exactly 15 diagnostic sentences.
    9. 'newLemmas': Extract the 3 new base words, PLUS any extra words the user explicitly requested.`;

    return { richContext, vocabContext, systemInstruction };
  };

  const handleExportPrompt = async () => {
    if (!topicInput.trim()) { setGenError("Please enter a topic first."); return; }
    setIsGenerating(true); setGenError('');

    try {
      const { richContext, vocabContext, systemInstruction } = await buildPromptContext();
      
      const exportedText = `SYSTEM INSTRUCTION:\n${systemInstruction}\n\nKNOWN VOCABULARY:\n[${vocabContext}]\n\nCONTEXT (Past performance & prompts):\n${richContext}\n\nUSER REQUEST:\n${topicInput}\n\n---\n\nOUTPUT FORMAT:\nYou must output ONLY valid JSON matching this exact structure (Do not use markdown formatting like \`\`\`json, just output the raw JSON object):\n\n{\n  "title": "Lesson Title",\n  "tutorIntroduction": "Short engaging intro",\n  "closingNotes": "Short closing remarks",\n  "reading": {\n    "definitions": [{ "word": "word", "text": "Hungarian definition using known words" }],\n    "hungarian": "Text with paragraphs separated by \\n\\n",\n    "english": "English translation",\n    "focus": [{ "word": "grammar topic", "explanation": "Explanation" }]\n  },\n  "drills": [{ "word": "pattern", "translation": "meaning", "examples": [{ "hungarian": "...", "english": "..." }] }],\n  "quiz": [{ "text": "Sentence with _____", "translation": "English trans", "correct": "answer", "options": ["ans1","ans2","ans3","ans4"] }],\n  "test": [{ "hungarian": "...", "english": "..." }],\n  "sweep": [{ "word": "target", "hungarian": "...", "english": "...", "ttsText": "word.\\n- hungarian\\n- english\\n- hungarian" }],\n  "newLemmas": [{ "word": "word", "meaning": "meaning", "pos": "v/n/adj" }]\n}`;

      const blob = new Blob([exportedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gemini_Prompt_${Date.now()}.txt`;
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

        const parsedJSON = JSON.parse(textToParse);
        const newEpisodeId = `ep_${Date.now()}`;
        const episodeDoc = { ...parsedJSON, id: newEpisodeId, timestamp: Date.now(), userPrompt: topicInput || "Imported JSON Lesson" };
        
        const safeLemmas = Array.isArray(parsedJSON.newLemmas) ? parsedJSON.newLemmas : [];
        delete episodeDoc.newLemmas; 
        const combinedDictionary = [
          ...safeLemmas.map(l => ({ ...l, id: `dict_${Date.now()}_${Math.random().toString(36).substring(7)}` })), 
          ...globalDictionary
        ];
        
        const batch = db.batch();
        batch.set(db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('episodes').doc(newEpisodeId), episodeDoc);
        batch.set(db.collection('artifacts').doc('hungarian-master').collection('users').doc(user.uid).collection('database').doc('dictionary'), { entries: combinedDictionary }, { merge: true });
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

  const TABS = [
    { id: 'studio', l: 'Studio', i: MessageSquare },
    { id: 'step1', l: 'Reading', i: BookOpen, disabled: !activeEpisode?.reading?.hungarian }, 
    { id: 'step2', l: 'Drills', i: Hammer, disabled: !activeEpisode?.drills?.length }, 
    { id: 'step3', l: 'Quiz', i: Workflow, disabled: !activeEpisode?.quiz?.length }, 
    { id: 'test', l: 'Test', i: PenTool, disabled: !activeEpisode?.test?.length }, 
    { id: 'step4', l: 'Sweep', i: Activity, disabled: !activeEpisode?.sweep?.length }, 
    { id: 'dict', l: 'Dictionary', i: BookText }
  ];

  if (!user) return null; // Controlled by central layout routing.

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-zinc-950 text-zinc-300' : 'bg-stone-50/50 text-stone-900'}`}>
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/80 border-stone-200'}`}>
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center justify-between gap-4">

          <div className="flex flex-1 items-center justify-start gap-1 overflow-x-auto no-scrollbar mask-edges pr-8">
            {/* BACK TO HUB */}
            <Link to="/" className={`p-2 rounded-full border transition-all active:scale-95 shrink-0 mr-2 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`} title="Back to Hub">
              <ArrowLeft size={14} />
            </Link>

            {TABS.map(t => {
              const IconComp = t.i;
              return (
                <button key={t.id} onClick={() => handleTabSwitch(t.id)} disabled={t.disabled} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all shrink-0 active:scale-95 ${t.disabled ? 'opacity-30 cursor-not-allowed' : activeTab === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : isDarkMode ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}>
                  <IconComp size={16} /><span className="hidden sm:inline">{t.l}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className={`p-2 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-blue-400' : 'border-stone-200 bg-stone-50 text-blue-700'}`}>
              <List size={14} />
            </button>
            {dropdownOpen && (
              <div className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden z-50 ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-stone-200'}`}>
                <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
                <div className="max-h-64 overflow-y-auto">
                  {episodesList.map(ep => (
                    <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); handleTabSwitch('studio'); setDropdownOpen(false); setConfirmDelete(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700') : (isDarkMode ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-50 text-stone-700')}`}>
                      {ep.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-blue-500' : 'bg-white border-stone-200 text-blue-600'}`}>
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </nav>

      <main className="px-3 sm:px-4 max-w-4xl mx-auto w-full pt-4 pb-12">
        {activeTab === 'studio' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <header className="mb-4 flex items-center gap-4">
              <div className="p-4 bg-blue-800 text-blue-50 rounded-2xl shadow-lg"><MessageSquare size={32} /></div>
              <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Lesson Studio</h2><p className={`text-sm mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>Your personal Hungarian tutor</p></div>
            </header>

            <UI.Section isDark={isDarkMode}>
              <h3 className="text-xl font-bold mb-4">What do you want to learn today?</h3>
              
              <div className="flex flex-col gap-4">
                <input 
                    type="text" 
                    value={topicInput} 
                    onChange={e => setTopicInput(e.target.value)} 
                    disabled={isGenerating} 
                    placeholder="e.g., A mystery story set in Budapest..." 
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-600' : 'bg-stone-50 border-stone-200 text-stone-900'}`} 
                />
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleExportPrompt} 
                    disabled={isGenerating || !topicInput.trim()} 
                    title="Download detailed prompt file for Gemini Web App" 
                    className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                    <span>Export Prompt File</span>
                  </button>
                  
                  <label className={`cursor-pointer flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
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
            </UI.Section>

            {activeEpisode && (activeEpisode.userPrompt || activeEpisode.tutorIntroduction) && (
              <div className="space-y-6 pt-4">
                {activeEpisode.userPrompt && (
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>You</span>
                    <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tr-sm shadow-sm border ${isDarkMode ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-800'}`}>
                      <p className="text-lg leading-relaxed">{activeEpisode.userPrompt}</p>
                    </div>
                  </div>
                )}
                {activeEpisode.tutorIntroduction && (
                  <div className="flex flex-col items-start animate-in fade-in">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'}`}>Tutor</span>
                    <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tl-sm shadow-sm border ${isDarkMode ? 'bg-blue-950/30 border-blue-900/50 text-blue-100' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
                      <p className="text-lg leading-relaxed">{activeEpisode.tutorIntroduction}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        {activeEpisode.reading && (
                          <button onClick={() => handleTabSwitch('step1')} className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${isDarkMode ? 'bg-blue-800/50 hover:bg-blue-800 text-blue-300' : 'bg-blue-200/50 hover:bg-blue-200 text-blue-800'}`}>
                            Go to Reading
                          </button>
                        )}
                        {confirmDelete ? (
                          <div className="flex items-center gap-2">
                            <button onClick={handleDeleteLesson} className={`text-sm font-bold px-4 py-2 rounded-xl transition-all border shadow-sm ${isDarkMode ? 'bg-red-900/80 border-red-900 text-red-100 hover:bg-red-800' : 'bg-red-600 border-red-600 text-white hover:bg-red-700'}`}>
                              Confirm Delete
                            </button>
                            <button onClick={() => setConfirmDelete(false)} className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200/50'}`}>
                              <XCircle size={18} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(true)} className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all border ${isDarkMode ? 'border-red-900/50 text-red-400 hover:bg-red-900/30' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                            <Trash2 size={14} /> Delete Lesson
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'step1' && <Step1App episodeData={activeEpisode} progress={progress} updateProgress={updateProgress} isDarkMode={isDarkMode} handleSpeak={handleSpeak} />}
        {activeTab === 'step2' && <Step2App episodeData={activeEpisode} progress={progress} updateProgress={updateProgress} isDarkMode={isDarkMode} handleSpeak={handleSpeak} />}
        {activeTab === 'step3' && <Step3App episodeData={activeEpisode} progress={progress} updateProgress={updateProgress} isDarkMode={isDarkMode} handleSpeak={handleSpeak} />}
        {activeTab === 'test' && <StepTestApp episodeData={activeEpisode} progress={progress} updateProgress={updateProgress} isDarkMode={isDarkMode} handleSpeak={handleSpeak} />}
        {activeTab === 'step4' && <Step4App episodeData={activeEpisode} progress={progress} updateProgress={updateProgress} isDarkMode={isDarkMode} handleSpeak={handleSpeak} />}
        {activeTab === 'dict' && <DictionaryApp isDarkMode={isDarkMode} globalDictionary={globalDictionary} user={user} />}
      </main>
    </div>
  );
}