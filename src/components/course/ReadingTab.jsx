// src/components/course/ReadingTab.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BookOpen, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import PlayButton from '../common/PlayButton';
import NoteButton from '../common/NoteButton';

export default function ReadingTab({ isActive, isDarkMode, activeEpisode, handleSpeak, stopSpeak, config, progressState, updateFirebase, handleOpenNote, onTabNext, onTabPrev }) {
  const [playingId, setPlayingId] = useState(null);
  const [slideDirection, setSlideDirection] = useState('next');
  const cardRef = useRef(null);
  const [activeView, setActiveView] = useState('');

  const reading = activeEpisode?.reading;

  const targetText = reading ? (reading[config.primaryTextKey] || reading.target || '') : '';

  const pages = useMemo(() => {
    if (!reading) return [];
    const list = [];
    const text = reading[config.primaryTextKey] || reading.target;
    if (Array.isArray(reading.definitions) && reading.definitions.length > 0) list.push({ id: 'defs', label: 'Definitions' });
    if (text) list.push({ id: 'read', label: 'Reading' });
    if (config.transliterationKey && reading[config.transliterationKey]) {
      list.push({ id: 'transliteration', label: (config.labels && config.labels[config.transliterationKey]) || 'Transliteration' });
    }
    if (reading.english) list.push({ id: 'eng', label: 'Translation' });
    if (Array.isArray(reading.focus) && reading.focus.length > 0) list.push({ id: 'focus', label: 'Focus & Grammar' });
    return list;
  }, [reading, config.primaryTextKey, config.labels, config.transliterationKey]);

  const defaultView = useMemo(() => {
    if (pages.length === 0) return 'read';
    const hasDefs = pages.some(p => p.id === 'defs');
    return hasDefs ? 'defs' : pages[0].id;
  }, [pages]);

  const effectiveActiveView = useMemo(() => {
    if (pages.length === 0) return '';
    if (activeView && pages.some(p => p.id === activeView)) return activeView;
    const unlistened = pages.find(p => !(progressState?.listenedReading || []).includes(p.id));
    return unlistened ? unlistened.id : defaultView;
  }, [pages, activeView, progressState?.listenedReading, defaultView]);

  useEffect(() => {
    setActiveView('');
  }, [activeEpisode?.id]);

  useEffect(() => {
    if (effectiveActiveView && activeView !== effectiveActiveView) {
      setActiveView(effectiveActiveView);
    }
  }, [effectiveActiveView, activeView]);

  useEffect(() => {
    if (isActive && effectiveActiveView && progressState && updateFirebase) {
      const listened = progressState.listenedReading || [];
      if (!listened.includes(effectiveActiveView)) {
        updateFirebase({ listenedReading: [...listened, effectiveActiveView] });
      }
    }
  }, [isActive, effectiveActiveView, progressState, updateFirebase]);

  const currentIndex = pages.findIndex(p => p.id === effectiveActiveView);
  const notes = progressState?.notes || {};

  const playAudio = useCallback((id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  }, [playingId, stopSpeak, handleSpeak]);

  const handleNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      setSlideDirection('next');
      setActiveView(pages[currentIndex + 1].id);
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentIndex, pages, onTabNext]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('prev');
      setActiveView(pages[currentIndex - 1].id);
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentIndex, pages, onTabPrev]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActive || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

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
          if (effectiveActiveView === 'defs' && Array.isArray(reading?.definitions)) {
            playAudio('defs', reading.definitions.map(d => d.word + ". " + d.text).join(' '));
          } else if (effectiveActiveView === 'read' && targetText) {
            const textToSpeak = (config.ttsUseTransliteration && config.transliterationKey && reading?.[config.transliterationKey])
              ? reading[config.transliterationKey]
              : targetText;
            playAudio('read', textToSpeak);
          } else if (effectiveActiveView === 'transliteration' && reading?.[config.transliterationKey]) {
            playAudio('transliteration', reading[config.transliterationKey]);
          } else if (effectiveActiveView === 'eng' && reading?.english) {
            playAudio('eng', reading.english);
          }
          break;
        case 'n':
        case 'N':
          if (effectiveActiveView === 'focus') {
            e.preventDefault();
            handleOpenNote('reading_focus', 'Focus & Grammar Notes', notes['reading_focus']);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleNext, handlePrev, effectiveActiveView, reading, targetText, playingId, notes, handleOpenNote, playAudio, config]);

  if (!reading || pages.length === 0) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
            <BookOpen size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Reading Practice</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {pages.map((p, idx) => (
            <button 
              key={p.id} 
              onClick={() => {
                setSlideDirection(idx > currentIndex ? 'next' : 'prev');
                setActiveView(p.id);
              }}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 text-center ${
                effectiveActiveView === p.id 
                  ? (isDarkMode ? 'bg-stone-800 text-amber-400 shadow-sm border border-stone-750' : 'bg-white text-amber-700 shadow-sm border border-stone-105') 
                  : (isDarkMode ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800')
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
        <div {...swipeHandlers} ref={setRefs} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
          <div key={effectiveActiveView} className={`absolute inset-0 flex flex-col animate-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
            
            {effectiveActiveView === 'defs' && Array.isArray(reading?.definitions) && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar ${config.fontClass || ''}`}>
                  <ul className={`space-y-3 ${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'}`}>
                    {reading.definitions.map((def, idx) => (
                      <li key={idx}>
                        <span className={`${config.scriptStyles?.vocabTerm || 'text-lg md:text-xl font-semibold'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{def.word}</span>
                        <span className={isDarkMode ? 'text-stone-300' : 'text-stone-700'}>: {def.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Definitions</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'defs'} onClick={() => playAudio('defs', (reading.definitions || []).map(d=>d.word + ". " + d.text).join(' '))} />
                </div>
              </>
            )}

            {effectiveActiveView === 'read' && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar ${config.fontClass || ''} ${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'}`}>
                  {(targetText || '').split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Target Text</h2>
                  <PlayButton 
                    isDarkMode={isDarkMode} 
                    isPlaying={playingId === 'read'} 
                    onClick={() => {
                      const textToSpeak = (config.ttsUseTransliteration && config.transliterationKey && reading?.[config.transliterationKey])
                        ? reading[config.transliterationKey]
                        : targetText;
                      playAudio('read', textToSpeak);
                    }} 
                  />
                </div>
              </>
            )}

            {effectiveActiveView === 'transliteration' && config.transliterationKey && reading?.[config.transliterationKey] && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar font-sans text-lg md:text-xl leading-relaxed ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                  {(reading[config.transliterationKey] || '').split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">{(config.labels && config.labels[config.transliterationKey]) || 'Transliteration'}</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'transliteration'} onClick={() => playAudio('transliteration', reading[config.transliterationKey])} />
                </div>
              </>
            )}

            {effectiveActiveView === 'eng' && reading?.english && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar text-lg italic leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-650'}`}>
                  {(reading.english || '').split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Translation</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'eng'} onClick={() => playAudio('eng', reading.english)} />
                </div>
              </>
            )}

            {effectiveActiveView === 'focus' && Array.isArray(reading?.focus) && (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-6 no-scrollbar text-lg">
                  {reading.focus.map((item, idx) => (
                    <div key={idx}>
                      <span className={`font-normal ${config.fontClass || ''} ${config.scriptStyles?.vocabTerm || 'text-lg md:text-xl font-semibold'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{idx + 1}. {item.word}</span>
                      <p className="mt-1 text-base">{item.explanation || item.text}</p>
                    </div>
                  ))}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="text-amber-500" size={20} />
                    <h2 className="text-base font-bold tracking-wide">Focus & Grammar</h2>
                  </div>
                  <NoteButton isDarkMode={isDarkMode} hasNote={!!notes['reading_focus']} onClick={() => handleOpenNote('reading_focus', 'Focus & Grammar Notes', notes['reading_focus'])} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`shrink-0 p-2 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
          <button onClick={handlePrev} disabled={currentIndex === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-855')}`}>
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
          </button>
          <div className="text-xs font-bold opacity-60">
            {currentIndex + 1} / {pages.length}
          </div>
          <button onClick={handleNext} disabled={currentIndex === pages.length - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentIndex === pages.length - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
