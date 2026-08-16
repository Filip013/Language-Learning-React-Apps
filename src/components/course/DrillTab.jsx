// src/components/course/DrillTab.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookMarked, Volume2, Loader2, Lightbulb, 
  XCircle, ChevronDown, Check, Eye, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import PlayButton from '../common/PlayButton';
import NoteButton from '../common/NoteButton';

export default function DrillTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, isLatestEpisode, handleOpenNote, onTabNext, onTabPrev }) {
  const listenedIds = progressState.listenedDrills || [];
  const drillRevealed = progressState.drillRevealed || [];
  const notes = progressState.notes || {};
  
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (isActive && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentWordIdx, isActive]);

  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [showLexicalNote, setShowLexicalNote] = useState(false);
  const [slideDirection, setSlideDirection] = useState('next');
  const [autoNavigatedEpisodeId, setAutoNavigatedEpisodeId] = useState(null);

  useEffect(() => {
    if (isActive && activeEpisode?.id && autoNavigatedEpisodeId !== activeEpisode.id && activeEpisode.drills) {
      let foundWordIdx = -1;
      let foundExIdx = -1;
      let found = false;
      for (let wIdx = 0; wIdx < activeEpisode.drills.length; wIdx++) {
        const section = activeEpisode.drills[wIdx];
        for (let eIdx = 0; eIdx < (section.examples?.length || 0); eIdx++) {
          if (!listenedIds.includes(`drill_${wIdx}_${eIdx}`) && !drillRevealed.includes(`drill_${wIdx}_${eIdx}`)) {
            foundWordIdx = wIdx; foundExIdx = eIdx; found = true; break;
          }
        }
        if (found) break;
      }
      
      if (found) {
        setCurrentWordIdx(foundWordIdx);
        setCurrentExIdx(foundExIdx);
      } else if (activeEpisode.drills.length > 0) {
        const lastWordIdx = activeEpisode.drills.length - 1;
        setCurrentWordIdx(lastWordIdx);
        setCurrentExIdx((activeEpisode.drills[lastWordIdx].examples?.length || 1) - 1);
      }
      
      setAutoNavigatedEpisodeId(activeEpisode.id);
    }
  }, [isActive, activeEpisode, listenedIds, drillRevealed, autoNavigatedEpisodeId]);

  const totalWords = activeEpisode?.drills?.length || 0;
  const currentSection = activeEpisode?.drills?.[currentWordIdx];
  const totalExamples = currentSection?.examples?.length || 0;
  const currentExample = currentSection?.examples?.[currentExIdx];

  const exId = `drill_${currentWordIdx}_${currentExIdx}`;
  
  const isActuallyListened = !isLatestEpisode || listenedIds.includes(exId);
  const isManuallyRevealed = drillRevealed.includes(exId);
  const isCompleted = isActuallyListened || isManuallyRevealed;
  const isRevealed = config.disableDrillBlur || isCompleted;

  const targetText = currentExample ? currentExample[config.primaryTextKey] : '';
  const hasNotes = currentSection?.notes && currentSection.notes.length > 0;

  const playDrill = useCallback((ex, id, listened) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    
    const targetText = (config.ttsUseTransliteration && config.transliterationKey && ex[config.transliterationKey])
      ? ex[config.transliterationKey]
      : ex[config.primaryTextKey];

    handleSpeak([targetText, ex.english, targetText], () => { 
      setPlayingId(null); 
      if (!listened) updateFirebase({ listenedDrills: [...listenedIds, id] }); 
    }, () => setPlayingId(null));
  }, [playingId, listenedIds, config.primaryTextKey, config.transliterationKey, config.ttsUseTransliteration, handleSpeak, stopSpeak, updateFirebase]);

  const toggleReveal = useCallback(() => {
    if (isManuallyRevealed) {
      updateFirebase({ drillRevealed: drillRevealed.filter(id => id !== exId) });
    } else {
      updateFirebase({ drillRevealed: [...drillRevealed, exId] });
    }
  }, [isManuallyRevealed, drillRevealed, exId, updateFirebase]);

  const handleNext = useCallback(() => {
    setShowLexicalNote(false);
    setSlideDirection('next');
    if (currentExIdx < totalExamples - 1) {
      setCurrentExIdx(prev => prev + 1);
    } else if (currentWordIdx < totalWords - 1) {
      setCurrentWordIdx(prev => prev + 1);
      setCurrentExIdx(0);
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentExIdx, currentWordIdx, totalExamples, totalWords, onTabNext]);

  const handlePrev = useCallback(() => {
    setShowLexicalNote(false);
    setSlideDirection('prev');
    if (currentExIdx > 0) {
      setCurrentExIdx(prev => prev - 1);
    } else if (currentWordIdx > 0) {
      setCurrentWordIdx(prev => prev - 1);
      setCurrentExIdx(activeEpisode.drills[currentWordIdx - 1].examples.length - 1);
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentExIdx, currentWordIdx, activeEpisode, onTabPrev]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; 
      if (!isActive || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || !currentExample) return;
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
          e.preventDefault();
          if (currentWordIdx < totalWords - 1) { setSlideDirection('next'); setCurrentWordIdx(p => p + 1); }
          break;
        case 'ArrowUp':
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentWordIdx > 0) { setSlideDirection('prev'); setCurrentWordIdx(p => p - 1); }
          break;
        case ' ':
          e.preventDefault();
          playDrill(currentExample, exId, isActuallyListened);
          break;
        case 'r': case 'R':
          e.preventDefault();
          toggleReveal();
          break;
        case 'l': case 'L':
          if (hasNotes) setShowLexicalNote(p => !p);
          break;
        case 'n': case 'N':
          e.preventDefault();
          handleOpenNote(exId, `Drill: ${targetText}`, notes[exId]);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentExample, exId, isActuallyListened, currentWordIdx, totalWords, hasNotes, targetText, notes, handleNext, handlePrev, playDrill, stopSpeak, handleOpenNote, toggleReveal]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const isWordCompleted = (wordIdx) => {
    if (!isLatestEpisode || config.disableDrillBlur) return true;
    const section = activeEpisode.drills[wordIdx];
    return section.examples?.every((_, idx) => {
      const id = `drill_${wordIdx}_${idx}`;
      return listenedIds.includes(id) || drillRevealed.includes(id);
    });
  };

  const cleanDrillWord = (word) => {
    if (!word || typeof word !== 'string') return '';
    return word.replace(/\s*\([^)]*\)/g, '').trim();
  };

  const getDrillTransliteration = (section, cfg) => {
    if (!section) return '';
    if (cfg.transliterationKey && section[cfg.transliterationKey]) {
      return section[cfg.transliterationKey];
    }
    if (typeof section.word === 'string') {
      const match = section.word.match(/\(([^)]+)\)/);
      if (match) return match[1].trim();
    }
    return '';
  };

  if (!activeEpisode?.drills?.length) return <div className="p-10 text-center font-sans opacity-50">No drills generated yet.</div>;
  if (!currentExample) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
            <BookMarked size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Interactive Drills</span>
        </div>

        <div ref={scrollContainerRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {activeEpisode.drills.map((drill, idx) => {
            const isCurrentWord = idx === currentWordIdx;
            const isCompleted = isWordCompleted(idx);
            const wordFontClass = config.useLargeDrillFont ? `${config.fontClass || 'moe-font'} text-sm md:text-base pt-0.5` : `${config.fontClass || 'font-sans'} text-xs md:text-sm`;
            
            let cardClasses = `flex-1 px-2 sm:px-3.5 py-1.5 rounded-lg font-bold transition-all text-center whitespace-nowrap ${wordFontClass} `;
            
            if (isCurrentWord) {
              cardClasses += isDarkMode ? 'bg-stone-800 text-amber-400 shadow-sm border border-stone-750' : 'bg-white text-amber-700 shadow-sm border border-stone-105';
            } else if (isCompleted) {
              cardClasses += isDarkMode ? 'text-emerald-500 hover:bg-stone-800' : 'text-emerald-600 hover:bg-stone-200';
            } else {
              cardClasses += isDarkMode ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800';
            }

            return (
              <button 
                key={idx} 
                data-active={isCurrentWord}
                onClick={() => { setSlideDirection(idx > currentWordIdx ? 'next' : 'prev'); setCurrentWordIdx(idx); setCurrentExIdx(0); setShowLexicalNote(false); }} 
                className={cardClasses}
              >
                {cleanDrillWord(drill.word)}
              </button>
            );
          })}
        </div>
      </header>

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors relative ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
        <div {...swipeHandlers} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
          <div key={exId} className={`absolute inset-0 flex flex-col animate-in fade-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar flex flex-col relative">
              <div className="shrink-0 text-center mb-4">
                <h2 className={`${config.scriptStyles?.mainHeader || 'text-2xl md:text-3xl font-bold tracking-tight'} tracking-wide px-4 ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
                  {cleanDrillWord(currentSection.word)}
                </h2>
                {config.transliterationKey && getDrillTransliteration(currentSection, config) && (
                  <p className="mt-1 font-sans text-base opacity-70">{getDrillTransliteration(currentSection, config)}</p>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-start relative min-h-[120px] pt-4">
                <div className={`space-y-3 transition-all ${!isRevealed ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'}`}>
                  <p className={`${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'} ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{targetText}</p>
                  <div className="space-y-1.5 mt-1">
                    <p className={`text-base md:text-[17px] font-sans leading-relaxed ${isDarkMode ? 'text-stone-300' : 'text-stone-650'}`}>{currentExample.english || currentExample.translation}</p>
                    {config.secondaryScriptKey && currentExample[config.secondaryScriptKey] && (
                      <p className={`${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'} ${config.secondaryFontClass || config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{currentExample[config.secondaryScriptKey]}</p>
                    )}
                    {config.transliterationKey && currentExample[config.transliterationKey] && (
                      <p className={`text-base md:text-[17px] font-sans leading-relaxed ${isDarkMode ? 'text-stone-300' : 'text-stone-650'}`}>{currentExample[config.transliterationKey]}</p>
                    )}
                  </div>
                </div>

                {!isRevealed && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playDrill(currentExample, exId, isActuallyListened)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-sans text-sm font-bold border transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-amber-600 text-stone-900 border-amber-500 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 border-amber-400 hover:bg-amber-400'}`}>
                      {playingId === exId ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />} Play to Reveal
                    </button>
                  </div>
                )}
              </div>

              {hasNotes && (
                <div className="mt-4 shrink-0 relative">
                  {showLexicalNote && (
                    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 p-4 border rounded-2xl animate-in slide-in-from-bottom-2 duration-300 max-h-[220px] flex flex-col shadow-2xl bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-850">
                      <div className="flex justify-between items-center mb-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
                          <Lightbulb size={16} /> Lexical Note
                        </span>
                        <button 
                          onClick={() => setShowLexicalNote(false)} 
                          className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                      <div className="overflow-y-auto no-scrollbar space-y-3 pb-2">
                        {currentSection.notes.map((note, noteIdx) => (
                          <p key={noteIdx} className={`text-base leading-relaxed ${isDarkMode ? 'text-stone-300' : 'text-stone-650'}`}>{note}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowLexicalNote(prev => !prev)} 
                    className={`w-full py-1.5 px-3 border rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors ${
                      isDarkMode 
                        ? 'bg-stone-855 border-stone-800 text-stone-400 hover:bg-stone-800' 
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Lightbulb size={14} /> Lexical Note</span>
                    <ChevronDown 
                      size={14} 
                      className={`transition-transform duration-200 ${showLexicalNote ? '' : 'rotate-180'}`} 
                    />
                  </button>
                </div>
              )}
            </div>

            <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Example {currentExIdx + 1}</span>
                {isCompleted && <span className="bg-emerald-500/10 text-emerald-500 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-emerald-500/20 flex items-center"><Check size={12} className="mr-1"/>{isActuallyListened ? 'Listened' : 'Completed'}</span>}
              </div>
              <div className="flex items-center gap-2">
                <NoteButton isDarkMode={isDarkMode} hasNote={!!notes[exId]} onClick={() => handleOpenNote(exId, `Drill: ${targetText}`, notes[exId])} />
                <button 
                  title={isManuallyRevealed ? "Hide Text (R)" : "Reveal Text (R)"}
                  onClick={toggleReveal} 
                  className={`p-2 rounded-full transition-all border shadow-sm ${
                    !isManuallyRevealed 
                      ? (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-amber-400' : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50 hover:text-amber-600') 
                      : (isDarkMode ? 'bg-amber-950/30 border-amber-500/40 text-amber-400 hover:bg-stone-800' : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-white')
                  }`}
                >
                  <Eye size={18} className={isManuallyRevealed ? "opacity-60" : ""} />
                </button>
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === exId} onClick={() => playDrill(currentExample, exId, isActuallyListened)} size={20} />
              </div>
            </div>

          </div>
        </div>

        <div className={`shrink-0 p-3 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
          <button onClick={handlePrev} disabled={currentWordIdx === 0 && currentExIdx === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentWordIdx === 0 && currentExIdx === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-855')}`}>
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
          </button>
          
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-2 w-full justify-center">
            {currentSection.examples?.map((_, idx) => (
              <button key={idx} onClick={() => { setSlideDirection(idx > currentExIdx ? 'next' : 'prev'); setCurrentExIdx(idx); }} className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${currentExIdx === idx ? (isDarkMode ? 'bg-amber-600 border-amber-500 text-stone-900 shadow-sm' : 'bg-amber-50 border-amber-400 text-stone-900 shadow-sm') : (isDarkMode ? 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-855 hover:text-stone-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800')}`}>
                {idx + 1}
              </button>
            ))}
          </div>

          <button onClick={handleNext} disabled={currentWordIdx === totalWords - 1 && currentExIdx === totalExamples - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentWordIdx === totalWords - 1 && currentExIdx === totalExamples - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
            <span className="hidden sm:inline">{currentExIdx === totalExamples - 1 ? 'Next Word' : 'Next'}</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
