// src/components/course/StoryTab.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, List, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

export default function StoryTab({ isActive, isDarkMode, activeStoryId, setActiveStoryId, storyList, config, onTabNext, onTabPrev }) {
  const [currentEpIdx, setCurrentEpIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const cardRef = useRef(null);

  const activeStoryData = storyList ? (storyList.find(s => s.id === activeStoryId) || storyList[0]) : null;
  const episodes = activeStoryData?.episodes || [];
  const currentEpisode = episodes[currentEpIdx];

  useEffect(() => {
    setCurrentEpIdx(0);
  }, [activeStoryId]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentEpIdx]);

  const handleNext = useCallback(() => {
    if (currentEpIdx < episodes.length - 1) {
      setCurrentEpIdx(prev => prev + 1);
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentEpIdx, episodes.length, onTabNext]);

  const handlePrev = useCallback(() => {
    if (currentEpIdx > 0) {
      setCurrentEpIdx(prev => prev - 1);
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentEpIdx, onTabPrev]);

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
            scrollContainer.scrollBy({ top: 120, behavior: 'smooth' });
          }
          break;
        case 'ArrowUp':
        case 'a':
        case 'A':
          if (scrollContainer) {
            e.preventDefault();
            scrollContainer.scrollBy({ top: -120, behavior: 'smooth' });
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleNext, handlePrev]);

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

  if (!storyList) return <div className="p-20 text-center font-sans opacity-50">Loading archive...</div>;
  if (storyList.length === 0) return <div className="p-20 text-center font-sans opacity-50">No stories generated yet.</div>;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
            <Book size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Story Library</span>
        </div>

        {storyList.length > 1 && (
          <div className="relative z-30 group w-full sm:max-w-xl md:max-w-3xl md:mx-auto text-left">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl border shadow-sm transition-all text-sm ${isDarkMode ? 'bg-stone-900 border-stone-800 hover:border-stone-750 text-stone-200' : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'}`}
            >
              <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                <List size={16} className={`shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className="font-bold truncate">
                  {activeStoryData?.currentTitle || activeStoryData?.id.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-xl border overflow-hidden z-50 text-left ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                <div className="max-h-60 overflow-y-auto">
                  {storyList.map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => { setActiveStoryId(s.id); setDropdownOpen(false); }} 
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b last:border-0 ${activeStoryId === s.id ? (isDarkMode ? 'bg-amber-900/30 text-amber-400 border-stone-800' : 'bg-amber-50 text-amber-700 border-stone-100') : (isDarkMode ? 'hover:bg-stone-800 text-stone-300 border-stone-800' : 'hover:bg-stone-50 text-stone-700 border-stone-100')}`}
                    >
                      {s.currentTitle || s.id.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800/80' : 'bg-white border-stone-200'}`}>
        <div {...swipeHandlers} ref={setRefs} className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar touch-pan-y">
          {currentEpisode ? (
            <article key={currentEpisode.id || currentEpIdx} className="h-full flex flex-col justify-start animate-in fade-in duration-300">
              <h3 className={`text-lg font-bold mb-3 border-b pb-2 ${config.fontClass || 'moe-font'} ${isDarkMode ? 'text-stone-100 border-stone-850' : 'text-stone-855 border-stone-200'}`}>
                {currentEpisode.title}
              </h3>
              <div className={`${config.scriptStyles?.bodyText || 'text-[28px] md:text-3xl leading-snug'} space-y-4 ${config.fontClass || 'moe-font'} ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>
                {currentEpisode.text.split('\n\n').map((p, idx) => <p key={idx}>{p}</p>)}
              </div>
            </article>
          ) : (
            <div className="p-10 text-center font-sans opacity-50">No chapters inside this story book yet.</div>
          )}
        </div>

        <div className="shrink-0 p-3 border-t text-center">
           <h2 className={`text-xl md:text-2xl font-bold ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
             {activeStoryData?.currentTitle || 'Archive'}
           </h2>
        </div>

        {episodes.length > 1 && (
          <div className={`shrink-0 p-3 border-t flex items-center justify-between gap-2 ${isDarkMode ? 'bg-stone-950/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
            <button onClick={handlePrev} disabled={currentEpIdx === 0} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentEpIdx === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-stone-800 text-stone-200' : 'hover:bg-stone-200 text-stone-855')}`}>
              <ChevronLeft size={16} /> <span className="hidden sm:inline">Prev</span>
            </button>

            <div ref={scrollContainerRef} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-2 w-full justify-center">
              {episodes.map((_, idx) => {
                const isCurrent = currentEpIdx === idx;
                return (
                  <button 
                    key={idx} 
                    data-active={isCurrent}
                    onClick={() => setCurrentEpIdx(idx)} 
                    className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${isCurrent ? (isDarkMode ? 'bg-amber-600 border-amber-500 text-stone-900 shadow-sm' : 'bg-amber-50 border-amber-400 text-stone-900 shadow-sm') : (isDarkMode ? 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-855 hover:text-stone-300' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800')}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button onClick={handleNext} disabled={currentEpIdx === episodes.length - 1} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${currentEpIdx === episodes.length - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700' : 'bg-white border-stone-300 text-amber-600 hover:bg-stone-100')}`}>
              <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
