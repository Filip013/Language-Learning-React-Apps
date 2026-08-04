// src/components/course/EpisodeTab.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import PlayButton from '../common/PlayButton';

export default function EpisodeTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, onTabNext, onTabPrev }) {
  const [playingId, setPlayingId] = useState(null);
  const [activeView, setActiveView] = useState('');
  const [slideDirection, setSlideDirection] = useState('next');
  const cardRef = useRef(null);

  const versions = useMemo(() => {
    if (!activeEpisode?.story) return [];
    
    const targetSizeClass = config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed';

    const getTabLabel = (key) => {
      return (config.labels && config.labels[key]) || (key.charAt(0).toUpperCase() + key.slice(1));
    };

    const list = [
      { 
        id: config.primaryTextKey, 
        title: getTabLabel(config.primaryTextKey), 
        fontClass: `${config.fontClass || 'font-sans'} ${targetSizeClass}`, 
        text: activeEpisode.story[config.primaryTextKey] 
      },
      { 
        id: 'english', 
        title: getTabLabel('english'), 
        fontClass: 'font-sans text-lg md:text-xl leading-relaxed', 
        text: activeEpisode.story.english 
      }
    ];

    if (config.secondaryScriptKey) {
      list.push({ 
        id: config.secondaryScriptKey, 
        title: getTabLabel(config.secondaryScriptKey), 
        fontClass: `${config.secondaryFontClass || config.fontClass} ${targetSizeClass}`, 
        text: activeEpisode.story[config.secondaryScriptKey] 
      });
    }

    return list.filter(v => v.text);
  }, [activeEpisode, config]);

  useEffect(() => {
    setActiveView('');
  }, [activeEpisode?.id]);

  useEffect(() => {
    if (versions.length > 0 && !activeView) {
      const unlistened = versions.find(v => !(progressState?.listenedEpisodes || []).includes(v.id));
      setActiveView(unlistened ? unlistened.id : versions[0].id);
    }
  }, [versions, activeView, progressState?.listenedEpisodes]);

  useEffect(() => {
    if (isActive && activeView && progressState && updateFirebase) {
      const listened = progressState.listenedEpisodes || [];
      if (!listened.includes(activeView)) {
        updateFirebase({ listenedEpisodes: [...listened, activeView] });
      }
    }
  }, [isActive, activeView, progressState, updateFirebase]);

  const currentIndex = versions.findIndex(v => v.id === activeView);

  const activeVersion = versions.find(v => v.id === activeView) || versions[0];

  const playAudio = useCallback((id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  }, [playingId, stopSpeak, handleSpeak]);

  const handleNext = useCallback(() => {
    if (currentIndex < versions.length - 1) {
      stopSpeak();
      setSlideDirection('next');
      setActiveView(versions[currentIndex + 1].id);
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentIndex, versions, stopSpeak, onTabNext]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stopSpeak();
      setSlideDirection('prev');
      setActiveView(versions[currentIndex - 1].id);
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentIndex, versions, stopSpeak, onTabPrev]);

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
          if (activeVersion && activeVersion.id !== config.transliterationKey) {
            playAudio(activeVersion.id, activeVersion.text);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleNext, handlePrev, activeVersion, playingId, playAudio, config.transliterationKey]);

  if (!activeEpisode?.story || versions.length === 0) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
            <Volume2 size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Audio Companion</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {versions.map((v, idx) => (
            <button 
              key={v.id} 
              onClick={() => {
                stopSpeak();
                setSlideDirection(idx > currentIndex ? 'next' : 'prev');
                setActiveView(v.id);
              }}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 text-center ${
                activeView === v.id 
                  ? (isDarkMode ? 'bg-stone-800 text-amber-400 shadow-sm border border-stone-750' : 'bg-white text-amber-700 shadow-sm border border-stone-105') 
                  : (isDarkMode ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-stone-500 hover:bg-stone-200 hover:text-stone-800')
              }`}
            >
              {v.title}
            </button>
          ))}
        </div>
      </header>

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
        {activeVersion && (
          <div {...swipeHandlers} ref={setRefs} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
            <div key={activeView} className={`absolute inset-0 flex flex-col animate-in fade-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
              
              <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar ${activeVersion.fontClass} ${activeVersion.id !== 'english' && activeVersion.id !== config.transliterationKey ? (isDarkMode ? 'text-stone-100' : 'text-stone-800') : (isDarkMode ? 'text-stone-300' : 'text-stone-700')}`}>
                {activeVersion.text.split('\n\n').map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
              </div>

              <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                <h2 className={`text-base font-bold tracking-wide font-sans ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{activeVersion.title}</h2>
                {activeVersion.id !== config.transliterationKey && (
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === activeVersion.id} onClick={() => playAudio(activeVersion.id, activeVersion.text)} />
                )}
              </div>

            </div>
          </div>
        )}

        {versions.length > 1 && (
          <div className={`shrink-0 p-2 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
            <button onClick={handlePrev} disabled={currentIndex === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-800')}`}>
              <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
            </button>
            <div className="text-xs font-bold opacity-60">
              {currentIndex + 1} / {versions.length}
            </div>
            <button onClick={handleNext} disabled={currentIndex === versions.length - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentIndex === versions.length - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
              <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
