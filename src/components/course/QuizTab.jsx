// src/components/course/QuizTab.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CheckCircle2, RotateCcw, Eye, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import PlayButton from '../common/PlayButton';
import NoteButton from '../common/NoteButton';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuizTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, handleOpenNote, onTabNext, onTabPrev }) {
  const [shuffledData, setShuffledData] = useState([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const [autoNavigatedEpisodeId, setAutoNavigatedEpisodeId] = useState(null);
  const cardRef = useRef(null);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (isActive && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIdx, isActive]);

  const userSelections = progressState.selections || {};
  const revealedIds = progressState.revealed || [];
  const gradedIds = progressState.gradedIds || [];
  const notes = progressState.notes || {};

  useEffect(() => {
    if (isActive && activeEpisode?.id && autoNavigatedEpisodeId !== activeEpisode.id && shuffledData.length > 0) {
      const firstUnfinished = shuffledData.findIndex(q => !gradedIds.includes(`quiz_${q.id}`));
      
      if (firstUnfinished !== -1) {
        setCurrentIdx(firstUnfinished);
      } else {
        setCurrentIdx(shuffledData.length - 1);
      }
      
      setAutoNavigatedEpisodeId(activeEpisode.id);
    }
  }, [isActive, activeEpisode, shuffledData, gradedIds, autoNavigatedEpisodeId]);

  useEffect(() => {
    if (activeEpisode?.quiz) {
      setShuffledData(activeEpisode.quiz.map((q, i) => {
        const answer = q.answer || q.correct;
        const opts = q.options ? q.options : shuffleArray(Array.from(new Set([...(q.distractors||[]), answer])));
        return { 
          ...q, 
          id: i, 
          sentence: q.sentence || q.text, 
          transliteration: q.transliteration || '',
          answer: answer, 
          englishHint: q.englishHint || q.translation, 
          options: opts 
        };
      }));
    }
  }, [activeEpisode?.quiz]);

  const handleSelect = useCallback((qId, choice) => {
    if (gradedIds.includes(qId)) return;
    updateFirebase({ selections: { ...userSelections, [qId]: choice } });
  }, [gradedIds, userSelections, updateFirebase]);

  const playAnswer = useCallback((id, question) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    
    const sentenceToUse = (config.ttsUseTransliteration && question.transliteration)
      ? question.transliteration
      : question.sentence;

    const fullText = sentenceToUse.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, question.answer);
    handleSpeak(fullText, () => setPlayingId(null), () => setPlayingId(null));
  }, [playingId, stopSpeak, handleSpeak, config.ttsUseTransliteration]);

  const handleNext = useCallback(() => { 
    stopSpeak(); 
    if (currentIdx < shuffledData.length - 1) {
      setSlideDirection('next');
      setCurrentIdx(prev => prev + 1); 
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentIdx, shuffledData.length, stopSpeak, onTabNext]);

  const handlePrev = useCallback(() => { 
    stopSpeak(); 
    if (currentIdx > 0) {
      setSlideDirection('prev');
      setCurrentIdx(prev => prev - 1); 
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentIdx, stopSpeak, onTabPrev]);

  const q = shuffledData[currentIdx];
  const qId = q ? `quiz_${q.id}` : '';
  const isRevealed = revealedIds.includes(qId);
  const isGraded = gradedIds.includes(qId);
  const userChoice = userSelections[qId];
  const isCorrect = userChoice === q?.answer;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActive || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || !q) return;

      const scrollContainer = cardRef.current?.querySelector('.overflow-y-auto');

      switch (e.key) {
        case 'ArrowRight':
        case 'w':
        case 'W':
          handleNext();
          break;
        case 'ArrowLeft':
        case 'q':
        case 'Q':
          handlePrev();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (scrollContainer) {
            e.preventDefault();
            scrollContainer.scrollBy({ top: 100, behavior: 'smooth' });
          }
          break;
        case 'ArrowUp':
        case 'a':
        case 'A':
          if (scrollContainer) {
            e.preventDefault();
            scrollContainer.scrollBy({ top: -100, behavior: 'smooth' });
          }
          break;
        case ' ': 
          e.preventDefault();
          if (isGraded) {
            playAnswer(`quiz-audio-${qId}`, q);
          } else if (userChoice) {
            updateFirebase({ gradedIds: [...gradedIds, qId] });
            playAnswer(`quiz-audio-${qId}`, q);
          }
          break;
        case 'r': case 'R':
          if (isRevealed) updateFirebase({ revealed: revealedIds.filter(id => id !== qId) });
          else updateFirebase({ revealed: [...revealedIds, qId] });
          break;
        case '1': case '2': case '3': case '4':
          const optIdx = parseInt(e.key) - 1;
          if (!isGraded && q.options && q.options[optIdx]) handleSelect(qId, q.options[optIdx]);
          break;
        case 'n': case 'N':
          e.preventDefault();
          handleOpenNote(qId, `Quiz: Question ${q.id + 1}`, notes[qId]);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, q, qId, isGraded, isRevealed, userChoice, revealedIds, gradedIds, notes, handleNext, handlePrev, playAnswer, handleSelect, updateFirebase, handleOpenNote]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const setRefs = useCallback((node) => {
    cardRef.current = node;
    swipeHandlers.ref(node);
  }, [swipeHandlers]);

  if (!shuffledData.length) return <div className="p-10 text-center font-sans opacity-50">No quiz generated yet.</div>;
  if (!q) return null;

  const resetQuiz = () => { updateFirebase({ selections: {}, revealed: [], gradedIds: [] }); setShowConfirmReset(false); setCurrentIdx(0); };
  const correctCount = Object.entries(userSelections).filter(([id, val]) => {
    const question = shuffledData.find(qt => `quiz_${qt.id}` === id);
    return question && question.answer === val && gradedIds.includes(id);
  }).length;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
              <CheckCircle2 size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Review Quiz</span>
          </div>
          
          <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 self-center mx-1"></div>

          <div className="inline-block relative">
            {!showConfirmReset ? (
              <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-1 text-stone-400 hover:text-red-500 text-[10px] uppercase font-bold tracking-wider px-2 py-1"><RotateCcw size={12} /> Reset</button>
            ) : (
              <div className={`flex items-center gap-2 px-2 py-0.5 rounded border text-[10px] font-bold ${isDarkMode ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
                <span className="text-red-500">Reset?</span>
                <button onClick={resetQuiz} className="text-red-600">Yes</button>
                <button onClick={() => setShowConfirmReset(false)} className="text-stone-500">No</button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {shuffledData.map((item, idx) => {
            const iterQid = `quiz_${item.id}`;
            const isCompleted = gradedIds.includes(iterQid);
            const isCurrent = currentIdx === idx;
            
            let cardClasses = `flex-1 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all text-center whitespace-nowrap `;
            
            if (isCurrent) {
              cardClasses += isDarkMode ? 'bg-stone-800 text-amber-400 shadow-sm border border-stone-750' : 'bg-white text-amber-700 shadow-sm border border-stone-105';
            } else if (isCompleted) {
              cardClasses += isDarkMode ? 'text-emerald-500 hover:bg-stone-800' : 'text-emerald-600 hover:bg-stone-200';
            } else {
              cardClasses += isDarkMode ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800';
            }

            return (
              <button 
                key={idx} 
                data-active={isCurrent}
                onClick={() => { stopSpeak(); setSlideDirection(idx > currentIdx ? 'next' : 'prev'); setCurrentIdx(idx); }} 
                className={cardClasses}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </header>

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
        <div {...swipeHandlers} ref={setRefs} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
          <div key={qId} className={`absolute inset-0 flex flex-col animate-in fade-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar flex flex-col relative justify-between">
              <div className="space-y-4 shrink-0 mb-4">
                <p className={`${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'} ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                  {(() => {
                    const match = q.sentence?.match(/(_{2,}|\.{3,}|(?:_\s*){2,})/);
                    if (!match) return q.sentence;
                    const before = q.sentence.substring(0, match.index);
                    const after = q.sentence.substring(match.index + match[0].length);
                    return (
                      <>{before}
                        {userChoice ? (
                          <span className={`inline-block align-middle px-3 py-1 mx-1 min-w-[3.5em] text-center rounded-lg border-2 transition-all ${isDarkMode ? 'text-amber-400 border-amber-500/50 bg-amber-500/10' : 'text-amber-700 border-amber-400 bg-amber-50'}`}>{userChoice}</span>
                        ) : (
                          <span className={`inline-block align-middle px-3 py-1 mx-1 min-w-[3.5em] text-center rounded-lg border-2 border-dashed transition-colors ${isDarkMode ? 'border-amber-700/50 bg-amber-950/40 text-transparent' : 'border-amber-300/80 bg-amber-50/60 text-transparent'}`}>&nbsp;</span>
                        )}
                        {after}</>
                    );
                  })()}
                </p>
                <div className={`transition-all ${!isRevealed ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'}`}>
                  <p className={`font-sans text-lg md:text-[17px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Hint: {q.englishHint}</p>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                <div className={`transition-all ${!isRevealed ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'}`}>
                  
                  {(() => {
                    const maxOptLength = Math.max(...q.options.map(opt => String(opt).length));
                    const gridClasses = maxOptLength > 35 ? "grid-cols-1" : maxOptLength > 14 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4";
                    return (
                      <div className={`grid gap-2 mb-4 ${gridClasses}`}>
                        {q.options.map((option, optIdx) => {
                          let btnClass = `px-3 py-2.5 rounded-xl border-2 transition-all text-center ${config.scriptStyles?.interactive || 'text-base md:text-lg font-medium'} ${config.fontClass || 'font-sans'} `;
                          if (!isGraded) btnClass += userChoice === option ? (isDarkMode ? "border-amber-500 bg-amber-950/40 text-amber-300" : "border-amber-500 bg-amber-50 text-amber-800") : (isDarkMode ? "border-stone-750 bg-stone-900/40 text-stone-200" : "border-stone-200 bg-white text-stone-700");
                          else btnClass += option === q.answer ? (isDarkMode ? "border-emerald-500 bg-emerald-950/50 text-emerald-300" : "border-emerald-500 bg-emerald-50 text-emerald-800") : userChoice === option ? "border-rose-900 bg-rose-950/30 text-rose-450 line-through opacity-70" : "border-stone-855 bg-stone-900/10 text-stone-600 opacity-40";
                          return <button key={optIdx} disabled={isGraded} onClick={() => !isGraded && handleSelect(qId, option)} className={btnClass}>{option}</button>;
                        })}
                      </div>
                    );
                  })()}
                  
                  <div className="flex justify-between items-center font-sans min-h-[44px]">
                    {!isGraded ? (
                     <button disabled={!userChoice} onClick={() => { if(userChoice) { updateFirebase({ gradedIds: [...gradedIds, qId] }); playAnswer(`quiz-audio-${qId}`, q); } }} className={`w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors ${!userChoice ? (isDarkMode ? 'bg-stone-800 text-stone-600' : 'bg-stone-200 text-stone-400') : (isDarkMode ? 'bg-amber-600 text-stone-950 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 hover:bg-amber-400')}`}>
                        Grade Answer
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 animate-in duration-300 w-full">
                        <span className={`text-base font-bold flex items-center gap-1.5 ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>{isCorrect ? "Correct!" : "Incorrect"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Question {currentIdx + 1}</div>
              <div className="flex items-center gap-2">
                <NoteButton isDarkMode={isDarkMode} hasNote={!!notes[qId]} onClick={() => handleOpenNote(qId, `Quiz: Question ${q.id + 1}`, notes[qId])} />
                {isGraded ? (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === `quiz-audio-${qId}`} onClick={() => playAnswer(`quiz-audio-${qId}`, q)} size={20} />
                  </div>
                ) : (
                  <button onClick={() => { if (isRevealed) updateFirebase({ revealed: revealedIds.filter(id => id !== qId) }); else updateFirebase({ revealed: [...revealedIds, qId] }); }} className={`p-2 rounded-full transition-all border shadow-sm ${!isRevealed ? (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-amber-400' : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50 hover:text-amber-600') : (isDarkMode ? 'bg-amber-950/30 border-amber-500/40 text-amber-400 hover:bg-stone-800' : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-white')}`}>
                    <Eye size={18} className={isRevealed ? "opacity-60" : ""} />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className={`shrink-0 p-3 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
          <button onClick={handlePrev} disabled={currentIdx === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentIdx === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-855')}`}>
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
          </button>
          <div className="flex items-center gap-6 px-2">
            <div className="text-center">
              <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Graded</span>
              <span className={`text-base font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{gradedIds.length} / {shuffledData.length}</span>
            </div>
            {gradedIds.length > 0 && (
              <>
                <div className="w-px h-6 bg-stone-300 dark:bg-stone-700"></div>
                <div className="text-center">
                  <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Score</span>
                  <span className="text-base font-bold text-emerald-500 flex items-center justify-center gap-1">{correctCount} <CheckCircle2 size={16} /></span>
                </div>
              </>
            )}
          </div>
          <button onClick={handleNext} disabled={currentIdx === shuffledData.length - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentIdx === shuffledData.length - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
