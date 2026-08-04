// src/components/course/SweepTab.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, RotateCcw, Volume2, Loader2, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import PlayButton from '../common/PlayButton';
import NoteButton from '../common/NoteButton';

export default function SweepTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, handleOpenNote, onTabNext, onTabPrev }) {
  const [playingId, setPlayingId] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
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

  const mst = progressState.sweepMastered || {};
  const rev = progressState.sweepRevealed || {};
  const notes = progressState.notes || {};

  useEffect(() => {
    if (isActive && activeEpisode?.id && autoNavigatedEpisodeId !== activeEpisode.id && activeEpisode.sweep) {
      const firstUnfinished = activeEpisode.sweep.findIndex((_, idx) => !rev[`sweep_${idx}`]);
      
      if (firstUnfinished !== -1) {
        setCurrentIdx(firstUnfinished);
      } else if (activeEpisode.sweep.length > 0) {
        setCurrentIdx(activeEpisode.sweep.length - 1);
      }
      
      setAutoNavigatedEpisodeId(activeEpisode.id);
    }
  }, [isActive, activeEpisode, rev, autoNavigatedEpisodeId]);

  const totalItems = activeEpisode?.sweep?.length || 0;
  const item = activeEpisode?.sweep?.[currentIdx];
  const qId = `sweep_${currentIdx}`;
  const textToRead = item ? [`${item.word}. ${item[config.primaryTextKey]}`, item.english, item[config.primaryTextKey]] : [];

  const playSweep = useCallback((id, text, isRev) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => { setPlayingId(null); updateFirebase({ sweepMastered: { ...mst, [id]: true }, sweepRevealed: { ...rev, [id]: true } }); }, () => setPlayingId(null));
  }, [playingId, mst, rev, handleSpeak, stopSpeak, updateFirebase]);

  const handleNext = useCallback(() => { 
    stopSpeak(); 
    if (currentIdx < totalItems - 1) {
      setSlideDirection('next');
      setCurrentIdx(prev => prev + 1); 
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentIdx, totalItems, stopSpeak, onTabNext]);

  const handlePrev = useCallback(() => { 
    stopSpeak(); 
    if (currentIdx > 0) {
      setSlideDirection('prev');
      setCurrentIdx(prev => prev - 1); 
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentIdx, stopSpeak, onTabPrev]);
  
  const resetSweep = () => { updateFirebase({ sweepMastered: {}, sweepRevealed: {} }); setShowConfirmReset(false); setCurrentIdx(0); };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActive || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || !item) return;

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
          playSweep(qId, textToRead, rev[qId]);
          break;
        case 'n': case 'N':
          e.preventDefault();
          handleOpenNote(qId, `Sweep: ${item.word}`, notes[qId]);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, item, qId, rev, textToRead, notes, handleNext, handlePrev, playSweep, handleOpenNote]);

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

  if (!activeEpisode?.sweep?.length) return null;
  if (!item) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
              <Activity size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Diagnostic Sweep</span>
          </div>

          <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 self-center mx-1"></div>

          <div className="inline-block relative">
            {!showConfirmReset ? (
              <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-1 text-stone-400 hover:text-red-500 text-[10px] uppercase font-bold tracking-wider px-2 py-1"><RotateCcw size={12} /> Reset</button>
            ) : (
              <div className={`flex items-center gap-2 px-2 py-0.5 rounded border text-[10px] font-bold ${isDarkMode ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
                <span className="text-red-500">Reset?</span>
                <button onClick={resetSweep} className="text-red-600">Yes</button>
                <button onClick={() => setShowConfirmReset(false)} className="text-stone-500">No</button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {activeEpisode.sweep.map((_, idx) => {
            const iterQid = `sweep_${idx}`;
            const isCompleted = rev[iterQid];
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
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar flex flex-col justify-start pt-6">
              <div className="relative min-h-[140px] flex flex-col justify-start pt-2">
                <div className={`transition-all ${!rev[qId] ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'} space-y-3`}>
                  <p className="font-bold text-sm uppercase tracking-widest text-blue-500">{item.word}</p>
                  <p className={`${config.fontClass || 'font-sans'} ${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{item[config.primaryTextKey]}</p>
                  <p className={`text-lg md:text-[17px] font-sans leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{item.english}</p>
                </div>

                {!rev[qId] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playSweep(qId, textToRead, false)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg text-base font-bold border transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-amber-600 text-stone-900 border-amber-500 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 border-amber-400 hover:bg-amber-400'}`}>
                      {playingId === qId ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />} Listen to Sweep
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Sentence {currentIdx + 1}</div>
              <div className="flex items-center gap-2">
                <NoteButton isDarkMode={isDarkMode} hasNote={!!notes[qId]} onClick={() => handleOpenNote(qId, `Sweep: ${item.word}`, notes[qId])} />
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === qId} onClick={() => playSweep(qId, textToRead, rev[qId])} size={20} />
              </div>
            </div>

          </div>
        </div>

        <div className={`shrink-0 p-3 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
          <button onClick={handlePrev} disabled={currentIdx === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentIdx === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-855')}`}>
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
          </button>
          <div className="text-center shrink-0 px-2">
            <span className={`block text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5`}>Sentence</span>
            <span className={`font-bold font-sans tracking-widest text-sm ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{currentIdx + 1} / {totalItems}</span>
          </div>
          <button onClick={handleNext} disabled={currentIdx === totalItems - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentIdx === totalItems - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
