import { useState, useEffect, useRef, useMemo, useCallback, Fragment, memo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Volume2, Pause, RotateCcw, MessageSquare, Sun, Moon, BookMarked, 
  Eye, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Check, AlertCircle, Search, 
  Book, Trash2, XCircle, Copy, Award, Upload, Download, List, Loader2, ArrowLeft, PenTool, 
  Activity, Lightbulb, ClipboardPaste, Sparkles, Plus, Edit, FileText } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { auth, db } from '../firebase';
import { useGeminiTTS } from '../hooks/useGeminiTTS';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

const removeDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

function PlayButton({ isDarkMode, onClick, size = 18, isLoading = false, isPlaying = false }) {
  const colorClasses = isDarkMode ? 'bg-stone-700 text-stone-300 hover:bg-stone-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200';
  return (
    <button disabled={isLoading} onClick={onClick} className={`flex items-center justify-center rounded-full transition-colors p-2 ${colorClasses} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {isLoading ? <Loader2 size={size} className="animate-spin text-amber-500" /> : isPlaying ? <Pause size={size} className="text-amber-500 animate-pulse" /> : <Volume2 size={size} />}
    </button>
  );
}

function NoteButton({ isDarkMode, hasNote, onClick, size = 18 }) {
  return (
    <button onClick={onClick} title="User Note" className={`flex items-center justify-center rounded-full transition-colors p-2 ${hasNote ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600') : (isDarkMode ? 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-855')}`}>
      <FileText size={size} className={hasNote ? "fill-current opacity-20" : ""} />
    </button>
  );
}

function UserNoteModal({ isDarkMode, isOpen, noteTitle, initialText, onClose, onSave }) {
  const [text, setText] = useState(initialText || '');

  useEffect(() => {
    if (isOpen) setText(initialText || '');
  }, [isOpen, initialText]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl border ${isDarkMode ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
            <FileText size={20} className="text-amber-500" /> User Note
          </h3>
          <button onClick={onClose} className="p-2 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
             <XCircle size={20} />
          </button>
        </div>
        <p className={`text-sm mb-4 truncate ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{noteTitle}</p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              onSave(text);
            }
          }}
          placeholder="Log your mistake, note, or mnemonic here (Ctrl + Enter to save)..."
          rows="2"
          className={`w-full p-4 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all mb-6 resize-y ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'}`}
        />
        <div className="flex justify-end gap-3">
           <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-855'}`}>Cancel</button>
           <button onClick={() => onSave(text)} className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm ${isDarkMode ? 'bg-amber-600 hover:bg-amber-500 text-stone-950' : 'bg-amber-50 hover:bg-amber-400 text-stone-900'}`}>
             Save Note
           </button>
        </div>
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

function EpisodeTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, onTabNext, onTabPrev }) {
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

    if (config.transliterationKey) {
      list.push({ 
        id: config.transliterationKey, 
        title: getTabLabel(config.transliterationKey), 
        fontClass: 'font-sans text-lg md:text-xl leading-relaxed', 
        text: activeEpisode.story[config.transliterationKey] 
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

  // Initialized early so hooks and render logic can safely reference it
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

function ReadingTab({ isActive, isDarkMode, activeEpisode, handleSpeak, stopSpeak, config, progressState, updateFirebase, handleOpenNote, onTabNext, onTabPrev }) {
  const [playingId, setPlayingId] = useState(null);
  const [slideDirection, setSlideDirection] = useState('next');
  const cardRef = useRef(null);
  const [activeView, setActiveView] = useState('');

  const reading = activeEpisode?.reading;

  const pages = useMemo(() => {
    if (!reading) return [];
    const list = [];
    const targetText = reading[config.primaryTextKey];
    if (Array.isArray(reading.definitions) && reading.definitions.length > 0) list.push({ id: 'defs', label: 'Definitions' });
    if (targetText) list.push({ id: 'read', label: 'Reading' });
    if (reading.english) list.push({ id: 'eng', label: 'Translation' });
    if (Array.isArray(reading.focus) && reading.focus.length > 0) list.push({ id: 'focus', label: 'Focus & Grammar' });
    return list;
  }, [reading, config.primaryTextKey]);

  const defaultView = useMemo(() => {
    if (pages.length === 0) return 'read';
    const hasDefs = pages.some(p => p.id === 'defs');
    return hasDefs ? 'defs' : pages[0].id;
  }, [pages]);

  useEffect(() => {
    setActiveView('');
  }, [activeEpisode?.id]);

  useEffect(() => {
    if (pages.length > 0 && !activeView) {
      const unlistened = pages.find(p => !(progressState?.listenedReading || []).includes(p.id));
      setActiveView(unlistened ? unlistened.id : defaultView);
    }
  }, [pages, activeView, progressState?.listenedReading, defaultView]);

  useEffect(() => {
    if (isActive && activeView && progressState && updateFirebase) {
      const listened = progressState.listenedReading || [];
      if (!listened.includes(activeView)) {
        updateFirebase({ listenedReading: [...listened, activeView] });
      }
    }
  }, [isActive, activeView, progressState, updateFirebase]);

  const currentIndex = pages.findIndex(p => p.id === activeView);

  // Declared early to avoid initialization scope conflicts with keyboard handlers
  const targetText = reading ? reading[config.primaryTextKey] : '';
  const notes = progressState?.notes || {};

  const playAudio = useCallback((id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  }, [playingId, stopSpeak, handleSpeak]);

  const handleNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      stopSpeak();
      setSlideDirection('next');
      setActiveView(pages[currentIndex + 1].id);
    } else if (onTabNext) {
      onTabNext();
    }
  }, [currentIndex, pages, stopSpeak, onTabNext]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stopSpeak();
      setSlideDirection('prev');
      setActiveView(pages[currentIndex - 1].id);
    } else if (onTabPrev) {
      onTabPrev();
    }
  }, [currentIndex, pages, stopSpeak, onTabPrev]);

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
          if (activeView === 'defs' && reading?.definitions) {
            playAudio('defs', reading.definitions.map(d => d.word + ". " + d.text).join(' '));
          } else if (activeView === 'read' && targetText) {
            playAudio('read', targetText);
          } else if (activeView === 'eng' && reading?.english) {
            playAudio('eng', reading.english);
          }
          break;
        case 'n':
        case 'N':
          if (activeView === 'focus') {
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
  }, [isActive, handleNext, handlePrev, activeView, reading, targetText, playingId, notes, handleOpenNote, playAudio]);

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
                stopSpeak();
                setSlideDirection(idx > currentIndex ? 'next' : 'prev');
                setActiveView(p.id);
              }}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 text-center ${
                activeView === p.id 
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
          <div key={activeView} className={`absolute inset-0 flex flex-col animate-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
            
            {activeView === 'defs' && (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar">
                  <ul className="space-y-3 text-lg leading-relaxed">
                    {reading.definitions.map((def, idx) => (
                      <li key={idx}><span className={`${config.scriptStyles?.vocabTerm || 'text-lg md:text-xl font-semibold'} ${config.fontClass || ''} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{def.word}</span>: {def.text}</li>
                    ))}
                  </ul>
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Definitions</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'defs'} onClick={() => playAudio('defs', reading.definitions.map(d=>d.word + ". " + d.text).join(' '))} />
                </div>
              </>
            )}

            {activeView === 'read' && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar ${config.fontClass || ''} ${config.scriptStyles?.bodyText || 'text-lg md:text-xl font-normal leading-relaxed'}`}>
                  {targetText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Target Text</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'read'} onClick={() => playAudio('read', targetText)} />
                </div>
              </>
            )}

            {activeView === 'eng' && (
              <>
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 no-scrollbar text-lg italic leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-650'}`}>
                  {reading.english.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                  <h2 className="text-base font-bold tracking-wide">Translation</h2>
                  <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === 'eng'} onClick={() => playAudio('eng', reading.english)} />
                </div>
              </>
            )}

            {activeView === 'focus' && (
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

function DrillTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, isLatestEpisode, handleOpenNote, onTabNext, onTabPrev }) {
  const listenedIds = progressState.listenedDrills || [];
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
          if (!listenedIds.includes(`drill_${wIdx}_${eIdx}`)) {
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
  }, [isActive, activeEpisode, listenedIds, autoNavigatedEpisodeId]);

  const totalWords = activeEpisode?.drills?.length || 0;
  const currentSection = activeEpisode?.drills?.[currentWordIdx];
  const totalExamples = currentSection?.examples?.length || 0;
  const currentExample = currentSection?.examples?.[currentExIdx];

  const exId = `drill_${currentWordIdx}_${currentExIdx}`;
  const isListened = !isLatestEpisode || listenedIds.includes(exId);
  const targetText = currentExample ? currentExample[config.primaryTextKey] : '';
  const hasNotes = currentSection?.notes && currentSection.notes.length > 0;

  const playDrill = useCallback((ex, id, listened) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    const text = ex[config.primaryTextKey]; 
    handleSpeak([text, ex.english, text], () => { setPlayingId(null); if (!listened) updateFirebase({ listenedDrills: [...listenedIds, id] }); }, () => setPlayingId(null));
  }, [playingId, listenedIds, config.primaryTextKey, handleSpeak, stopSpeak, updateFirebase]);

  const handleNext = useCallback(() => {
    stopSpeak();
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
  }, [currentExIdx, currentWordIdx, totalExamples, totalWords, stopSpeak, onTabNext]);

  const handlePrev = useCallback(() => {
    stopSpeak();
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
  }, [currentExIdx, currentWordIdx, activeEpisode, stopSpeak, onTabPrev]);

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
          if (currentWordIdx < totalWords - 1) { stopSpeak(); setSlideDirection('next'); setCurrentWordIdx(p => p + 1); }
          break;
        case 'ArrowUp':
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentWordIdx > 0) { stopSpeak(); setSlideDirection('prev'); setCurrentWordIdx(p => p - 1); }
          break;
        case ' ':
          e.preventDefault();
          playDrill(currentExample, exId, isListened);
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
  }, [isActive, currentExample, exId, isListened, currentWordIdx, totalWords, hasNotes, targetText, notes, handleNext, handlePrev, playDrill, stopSpeak, handleOpenNote]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const isWordCompleted = (wordIdx) => {
    if (!isLatestEpisode) return true;
    const section = activeEpisode.drills[wordIdx];
    return section.examples?.every((_, idx) => listenedIds.includes(`drill_${wordIdx}_${idx}`));
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
            const wordFontClass = config.useLargeDrillFont ? 'moe-font text-sm md:text-base pt-0.5' : `${config.fontClass || 'font-sans'} text-xs md:text-sm`;
            
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
                onClick={() => { stopSpeak(); setSlideDirection(idx > currentWordIdx ? 'next' : 'prev'); setCurrentWordIdx(idx); setCurrentExIdx(0); setShowLexicalNote(false); }} 
                className={cardClasses}
              >
                {drill.word}
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
                  {currentSection.word}
                </h2>
                {config.transliterationKey && currentSection[config.transliterationKey] && (
                  <p className="mt-1 font-sans text-base opacity-70">{currentSection[config.transliterationKey]}</p>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-start relative min-h-[120px] pt-4">
                <div className={`space-y-3 transition-all ${!isListened ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'}`}>
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
                {!isListened && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playDrill(currentExample, exId, isListened)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-sans text-sm font-bold border transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-amber-600 text-stone-900 border-amber-500 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 border-amber-400 hover:bg-amber-400'}`}>
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
                {isListened && <span className="bg-emerald-500/10 text-emerald-500 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-emerald-500/20 flex items-center"><Check size={12} className="mr-1"/>Listened</span>}
              </div>
              <div className="flex items-center gap-2">
                <NoteButton isDarkMode={isDarkMode} hasNote={!!notes[exId]} onClick={() => handleOpenNote(exId, `Drill: ${targetText}`, notes[exId])} />
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === exId} onClick={() => playDrill(currentExample, exId, isListened)} size={20} />
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
              <button key={idx} onClick={() => { stopSpeak(); setSlideDirection(idx > currentExIdx ? 'next' : 'prev'); setCurrentExIdx(idx); }} className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${currentExIdx === idx ? (isDarkMode ? 'bg-amber-600 border-amber-500 text-stone-900 shadow-sm' : 'bg-amber-50 border-amber-400 text-stone-900 shadow-sm') : (isDarkMode ? 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-855 hover:text-stone-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800')}`}>
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

function QuizTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, handleOpenNote, onTabNext, onTabPrev }) {
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
        return { ...q, id: i, sentence: q.sentence || q.text, answer: answer, englishHint: q.englishHint || q.translation, options: opts };
      }));
    }
  }, [activeEpisode?.quiz]);

  const handleSelect = useCallback((qId, choice) => {
    if (gradedIds.includes(qId)) return;
    updateFirebase({ selections: { ...userSelections, [qId]: choice } });
  }, [gradedIds, userSelections, updateFirebase]);

  const playAnswer = useCallback((id, text) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => setPlayingId(null), () => setPlayingId(null));
  }, [playingId, stopSpeak, handleSpeak]);

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
            playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer));
          } else if (userChoice) {
            updateFirebase({ gradedIds: [...gradedIds, qId] });
            playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer));
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
                     <button disabled={!userChoice} onClick={() => { if(userChoice) { updateFirebase({ gradedIds: [...gradedIds, qId] }); playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer)); } }} className={`w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors ${!userChoice ? (isDarkMode ? 'bg-stone-800 text-stone-600' : 'bg-stone-200 text-stone-400') : (isDarkMode ? 'bg-amber-600 text-stone-950 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 hover:bg-amber-400' || 'bg-amber-50 text-stone-900 hover:bg-amber-400')}`}>
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
                    <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === `quiz-audio-${qId}`} onClick={() => playAnswer(`quiz-audio-${qId}`, q.sentence.replace(/(_{2,}|\.{3,}|(?:_\s*){2,})/, q.answer))} size={20} />
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

function TestTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, handleOpenNote, onTabNext, onTabPrev }) {
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

  const mst = progressState.testMastered || {};
  const rev = progressState.testRevealed || {};
  const notes = progressState.notes || {};

  useEffect(() => {
    if (isActive && activeEpisode?.id && autoNavigatedEpisodeId !== activeEpisode.id && activeEpisode.test) {
      const firstUnfinished = activeEpisode.test.findIndex((_, idx) => !rev[`test_${idx}`]);
      
      if (firstUnfinished !== -1) {
        setCurrentIdx(firstUnfinished);
      } else if (activeEpisode.test.length > 0) {
        setCurrentIdx(activeEpisode.test.length - 1);
      }
      
      setAutoNavigatedEpisodeId(activeEpisode.id);
    }
  }, [isActive, activeEpisode, rev, autoNavigatedEpisodeId]);

  const totalItems = activeEpisode?.test?.length || 0;
  const item = activeEpisode?.test?.[currentIdx];
  const qId = `test_${currentIdx}`;

  const playAnswer = useCallback((id, text, isRev) => {
    if (playingId === id) { stopSpeak(); setPlayingId(null); return; }
    setPlayingId(id);
    handleSpeak(text, () => { setPlayingId(null); updateFirebase({ testMastered: { ...mst, [id]: true }, testRevealed: { ...rev, [id]: true } }); }, () => setPlayingId(null));
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
  
  const resetTest = () => { updateFirebase({ testMastered: {}, testRevealed: {} }); setShowConfirmReset(false); setCurrentIdx(0); };

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
          playAnswer(qId, item[config.primaryTextKey], rev[qId]);
          break;
        case 'n': case 'N':
          e.preventDefault();
          handleOpenNote(qId, `Translate: ${item.english}`, notes[qId]);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, item, qId, rev, notes, handleNext, handlePrev, playAnswer, handleOpenNote, config.primaryTextKey]);

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

  if (!activeEpisode?.test?.length) return null;
  if (!item) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-3 relative font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
              <PenTool size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Active Translation</span>
          </div>

          <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 self-center mx-1"></div>

          <div className="inline-block relative">
            {!showConfirmReset ? (
              <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-1 text-stone-400 hover:text-red-500 text-[10px] uppercase font-bold tracking-wider px-2 py-1"><RotateCcw size={12} /> Reset</button>
            ) : (
              <div className={`flex items-center gap-2 px-2 py-0.5 rounded border text-[10px] font-bold ${isDarkMode ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
                <span className="text-red-500">Reset?</span>
                <button onClick={resetTest} className="text-red-600">Yes</button>
                <button onClick={() => setShowConfirmReset(false)} className="text-stone-500">No</button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-stone-200/50 dark:bg-stone-900/60 rounded-xl border dark:border-stone-800 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {activeEpisode.test.map((_, idx) => {
            const iterQid = `test_${idx}`;
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

      <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800/85' : 'bg-white border-stone-200'}`}>
        <div {...swipeHandlers} ref={setRefs} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
          <div key={qId} className={`absolute inset-0 flex flex-col animate-in fade-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 no-scrollbar flex flex-col justify-start pt-6">
              <p className={`text-lg md:text-xl font-normal leading-relaxed mb-4 ${isDarkMode ? 'text-stone-355' : 'text-stone-600'}`}>{item.english}</p>

              <div className="relative min-h-[80px] flex flex-col justify-start pt-2">
                <div className={`transition-all ${!rev[qId] ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'}`}>
                  <p className={`text-xl md:text-2xl font-semibold tracking-wide ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>{item[config.primaryTextKey]}</p>
                </div>
                {!rev[qId] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button onClick={() => playAnswer(qId, item[config.primaryTextKey], false)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-sans text-sm font-bold border transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-amber-600 text-stone-900 border-amber-500 hover:bg-amber-500' : 'bg-amber-50 text-stone-900 border-amber-400 hover:bg-amber-400'}`}>
                      {playingId === qId ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />} Play to Reveal
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`shrink-0 flex items-center justify-between p-3 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Sentence {currentIdx + 1}</div>
              <div className="flex items-center gap-2">
                <NoteButton isDarkMode={isDarkMode} hasNote={!!notes[qId]} onClick={() => handleOpenNote(qId, `Translate: ${item.english}`, notes[qId])} />
                <PlayButton isDarkMode={isDarkMode} isPlaying={playingId === qId} onClick={() => playAnswer(qId, item[config.primaryTextKey], rev[qId])} size={20} />
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

function SweepTab({ isActive, isDarkMode, activeEpisode, progressState, updateFirebase, handleSpeak, stopSpeak, config, handleOpenNote, onTabNext, onTabPrev }) {
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

const LexiconTab = memo(function LexiconTab({ isDarkMode, globalLexicon, user, config }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const [editingWord, setEditingWord] = useState(null);
  const [editListKey, setEditListKey] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [editPos, setEditPos] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newWordTarget, setNewWordTarget] = useState('');
  const [newWordEnglish, setNewWordEnglish] = useState('');
  const [newWordPos, setNewWordPos] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isObjectArray = Array.isArray(globalLexicon) || (globalLexicon && globalLexicon.entries && Array.isArray(globalLexicon.entries));

  const allTaggedWords = useMemo(() => {
    if (!globalLexicon || Object.keys(globalLexicon).length === 0) return [];
    let arr = [];
    if (isObjectArray) {
      const list = globalLexicon.entries || globalLexicon || [];
      list.forEach(w => arr.push({ word: w, listKey: 'entries' }));
    } else {
      ['accumulated', 'hsk4', 'hsk3', 'hsk2', 'hsk1'].forEach(key => {
        const list = globalLexicon[key] || [];
        list.forEach(w => arr.push({ word: w, listKey: key }));
      });
    }
    return arr;
  }, [globalLexicon, isObjectArray]);

  const duplicateWords = useMemo(() => {
    const counts = {};
    const duplicates = new Set();
    allTaggedWords.forEach(({ word }) => {
      const text = word[config.primaryTextKey] || word.word;
      if (text) {
        const norm = text.toLowerCase().trim();
        counts[norm] = (counts[norm] || 0) + 1;
        if (counts[norm] > 1) duplicates.add(norm);
      }
    });
    return duplicates;
  }, [allTaggedWords, config.primaryTextKey]);

  const filterOptions = useMemo(() => {
    const options = [{ id: 'all', label: 'All Words' }];
    
    if (!isObjectArray) {
      options.push(
        { id: 'accumulated', label: 'Accumulated' },
        { id: 'hsk4', label: 'HSK 4' },
        { id: 'hsk3', label: 'HSK 3' },
        { id: 'hsk2', label: 'HSK 2' },
        { id: 'hsk1', label: 'HSK 1' }
      );
    } else {
      const posTags = new Set();
      allTaggedWords.forEach(({ word }) => {
        if (word.pos) posTags.add(word.pos.toLowerCase().trim());
      });
      
      const posLabels = {
        'n': 'Nouns', 'v': 'Verbs', 'adj': 'Adjectives', 'adv': 'Adverbs',
        'pron': 'Pronouns', 'prep': 'Prepositions', 'conj': 'Conjunctions',
        'part': 'Particles', 'mw': 'Measure Words', 'num': 'Numeral',
        'post': 'Postposition', 'suf': 'Suffix'
      };

      Array.from(posTags).sort().forEach(pos => {
        if (pos) {
          options.push({ id: `pos_${pos}`, label: posLabels[pos] || `POS: ${pos}` });
        }
      });
    }
    options.push({ id: 'duplicates', label: 'Duplicates' });
    return options;
  }, [isObjectArray, allTaggedWords]);

  const displayedTaggedWords = useMemo(() => {
    let filtered = allTaggedWords;

    if (activeFilter === 'duplicates') {
      filtered = filtered.filter(({ word }) => {
        const text = word[config.primaryTextKey] || word.word;
        return duplicateWords.has((text || '').toLowerCase().trim());
      });
    } else if (activeFilter.startsWith('pos_')) {
      const targetPos = activeFilter.replace('pos_', '');
      filtered = filtered.filter(({ word }) => word.pos?.toLowerCase().trim() === targetPos);
    } else if (activeFilter !== 'all') {
      filtered = filtered.filter(({ listKey }) => listKey === activeFilter);
    }

    const term = removeDiacritics(searchTerm);
    if (term) {
      const escapedTerm = term.replace(/[-\/\\^$*+?()|[\]{}]/g, '\\$&');
      const searchRegex = new RegExp('^' + escapedTerm.replace(/\./g, '.*') + '$', 'i');

      filtered = filtered.filter(({ word }) => {
        const target = removeDiacritics(word[config.primaryTextKey] || word.word || "");
        const en = removeDiacritics(word.english || word.meaning || word.translation || "");
        return searchRegex.test(target) || searchRegex.test(en);
      });
    }
    return filtered;
  }, [allTaggedWords, activeFilter, searchTerm, duplicateWords, config.primaryTextKey]);

  const groupedWords = useMemo(() => {
    const groups = {};
    displayedTaggedWords.forEach(item => {
      let groupKey;
      if (!isObjectArray) {
        groupKey = item.listKey === 'accumulated' ? 'Accumulated Words' : item.listKey.toUpperCase();
      } else {
        groupKey = filterOptions.find(o => o.id === activeFilter)?.label || 'All Vocabulary';
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [displayedTaggedWords, activeFilter, isObjectArray, filterOptions]);

  const handleManualAdd = async () => {
    if (!newWordTarget.trim() || !globalLexicon || !user) return;
    setIsSubmitting(true);
    try {
      const newEntry = {
        id: `dict_manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [config.primaryTextKey]: newWordTarget.trim(),
        word: newWordTarget.trim(),
        english: newWordEnglish.trim(),
        pos: newWordPos.trim()
      };

      const docName = config.lexiconDoc || 'lexicon';
      const lexRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);

      if (isObjectArray) {
        const list = globalLexicon.entries || globalLexicon;
        await lexRef.set({ entries: [newEntry, ...list] }, { merge: true });
      } else {
        const list = globalLexicon.accumulated || [];
        await lexRef.set({ accumulated: [newEntry, ...list] }, { merge: true });
      }

      setNewWordTarget(''); setNewWordEnglish(''); setNewWordPos(''); setShowAddForm(false);
    } catch (err) { console.error("Error adding word:", err); } 
    finally { setIsSubmitting(false); }
  };

  const handleOpenEdit = (word, listKey) => {
    setEditingWord(word);
    setEditListKey(listKey);
    setEditTarget(word[config.primaryTextKey] || word.word || '');
    setEditEnglish(word.english || word.meaning || word.translation || '');
    setEditPos(word.pos || '');
  };

  const handleSaveEdit = async () => {
    if (!editTarget.trim() || !user || !globalLexicon || !editingWord) return;
    setIsSubmitting(true);
    
    const updatedWord = {
        ...editingWord,
        [config.primaryTextKey]: editTarget.trim(),
        word: editTarget.trim(), 
        english: editEnglish.trim(),
        pos: editPos.trim()
    };

    const docName = config.lexiconDoc || 'lexicon';
    const lexRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    
    const isMatch = (w) => {
        if (w.id && editingWord.id) {
            return w.id === editingWord.id;
        }
        const targetW = w[config.primaryTextKey] || w.word;
        const targetEdit = editingWord[config.primaryTextKey] || editingWord.word;
        return targetW && targetEdit && targetW === targetEdit;
    };

    try {
      if (isObjectArray) {
          const list = globalLexicon.entries || globalLexicon || [];
          const newList = list.map(w => isMatch(w) ? updatedWord : w);
          await lexRef.set({ entries: newList }, { merge: true });
      } else {
          const list = globalLexicon[editListKey] || [];
          const newList = list.map(w => isMatch(w) ? updatedWord : w);
          await lexRef.set({ [editListKey]: newList }, { merge: true });
      }
      setEditingWord(null);
    } catch (err) { console.error(err); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteFromEdit = async () => {
    if (!user || !globalLexicon || !editingWord) return;
    setIsSubmitting(true);
    const docName = config.lexiconDoc || 'lexicon';
    const lexRef = db.collection('artifacts').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    
    const isMatch = (w) => {
        if (w.id && editingWord.id) {
            return w.id === editingWord.id;
        }
        const targetW = w[config.primaryTextKey] || w.word;
        const targetEdit = editingWord[config.primaryTextKey] || editingWord.word;
        return targetW && targetEdit && targetW === targetEdit;
    };

    try {
      if (isObjectArray) {
          const list = globalLexicon.entries || globalLexicon || [];
          const newList = list.filter(w => !isMatch(w));
          await lexRef.set({ entries: newList }, { merge: true }); 
      } else {
          const list = globalLexicon[editListKey] || [];
          const newList = list.filter(w => !isMatch(w));
          await lexRef.set({ [editListKey]: newList }, { merge: true });
      }
      setEditingWord(null);
    } catch (err) { console.error(err); } 
    finally { setIsSubmitting(false); }
  };

  if (!globalLexicon || Object.keys(globalLexicon).length === 0) return <div className="p-20 text-center text-stone-500 font-sans">Loading master lexicon...</div>;

  return (
    <div className="max-w-6xl mx-auto pt-3 md:pt-9 pb-12 px-4 md:px-8 font-sans relative">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        {/* Line 1: Title and Add Word action button separated by a fixed divider */}
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
              <Search size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">
              {config.name} Lexicon
            </span>
          </div>
          
          {/* Fixed-height divider */}
          <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 self-center mx-1"></div>

          {/* Elegant tracking-style Add button */}
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className={`flex items-center gap-1 transition-colors text-[10px] uppercase font-bold tracking-wider px-2 py-1 ${
              isDarkMode ? 'text-stone-400 hover:text-amber-400' : 'text-stone-550 hover:text-amber-650'
            }`}
          >
            <Plus size={12} /> Add Word
          </button>
        </div>

        {/* Line 2: Centered Search Input and Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          {/* Compact Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder="Search vocabulary..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-colors ${
                isDarkMode 
                  ? 'bg-stone-900 border-stone-800 text-stone-100 focus:border-stone-700' 
                  : 'bg-white border-stone-200 text-stone-900 focus:border-stone-300'
              }`} 
            />
          </div>

          {/* Compact Filter Select */}
          <div className="relative w-32 sm:w-36 shrink-0">
            <select 
              value={activeFilter} 
              onChange={e => setActiveFilter(e.target.value)}
              className={`w-full pl-3.5 pr-9 py-2 rounded-xl border text-sm font-bold outline-none cursor-pointer appearance-none transition-colors ${
                isDarkMode 
                  ? 'bg-stone-800 border-stone-750 text-stone-200 focus:border-stone-600' 
                  : 'bg-stone-50 border-stone-200 text-stone-700 focus:border-stone-300'
              }`}
            >
              {filterOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        </div>
      </header>

      {/* Streamlined Add Word Form */}
      {showAddForm && (
        <div className={`mb-6 p-4 rounded-xl border animate-in slide-in-from-top-2 duration-300 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
            <input type="text" placeholder={`Target Word (${config.name})`} value={newWordTarget} onChange={e => setNewWordTarget(e.target.value)} className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-stone-700' : 'bg-white border-stone-200 focus:border-stone-400'}`} />
            <input type="text" placeholder="English Translation" value={newWordEnglish} onChange={e => setNewWordEnglish(e.target.value)} className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-stone-700' : 'bg-white border-stone-200 focus:border-stone-400'}`} />
            <input type="text" placeholder="Part of Speech (e.g. noun)" value={newWordPos} onChange={e => setNewWordPos(e.target.value)} className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-stone-700' : 'bg-white border-stone-200 focus:border-stone-400'}`} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-855'}`}>Cancel</button>
            <button onClick={handleManualAdd} disabled={isSubmitting || !newWordTarget.trim()} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}>
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save Word
            </button>
          </div>
        </div>
      )}

      {/* Vocabulary Lists */}
      <div className="space-y-10">
        {Object.entries(groupedWords).map(([groupTitle, items]) => (
          <section key={groupTitle} className="animate-in duration-500">
            <h2 className={`text-2xl font-bold font-sans mb-6 border-b-2 pb-2 flex items-baseline gap-2 ${isDarkMode ? 'text-stone-300 border-stone-700' : 'text-stone-700 border-stone-200'}`}>
              {groupTitle} <span className="text-lg font-medium opacity-50">({items.length})</span>
            </h2>
            
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {items.map(({ word, listKey }, idx) => {
                const isString = typeof word === 'string';
                const displayWord = isString ? word : (word[config.primaryTextKey] || word.word);
                const displayEn = isString ? "" : (word.english || word.meaning || word.translation || "");
                const pos = isString ? "" : (word.pos || "");
                const wId = isString ? `raw_${idx}_${displayWord}` : word.id;
                const isDuplicate = duplicateWords.has((displayWord || "").toLowerCase().trim());

                return (
                  <div key={wId} className={`flex flex-col gap-2 p-4 border rounded-xl shadow-sm ${
                    isDuplicate 
                      ? (isDarkMode ? 'bg-amber-950/30 border-amber-500/40 text-stone-200' : 'bg-amber-50 border-amber-300 text-stone-805')
                      : (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800')
                  }`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className={`${config.fontClass || 'font-sans'} ${config.scriptStyles?.lexiconCard || 'text-base md:text-lg font-semibold'}`}>{displayWord}</span>
                      <button onClick={() => handleOpenEdit(word, listKey)} className="p-1.5 rounded-md text-stone-400 hover:text-amber-505 transition-colors ml-2"><Edit size={16} /></button>
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
        ))}
      </div>

      {/* Editing Word Modal */}
      {editingWord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl border ${isDarkMode ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}`}>
            <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Edit Word</h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Target Language</label>
                <input type="text" value={editTarget} onChange={e => setEditTarget(e.target.value)} className={`w-full px-4 py-3 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">English Translation</label>
                <input type="text" value={editEnglish} onChange={e => setEditEnglish(e.target.value)} className={`w-full px-4 py-3 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Part of Speech</label>
                <input type="text" value={editPos} onChange={e => setEditPos(e.target.value)} placeholder="noun, verb, adjective..." className={`w-full px-4 py-3 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} />
              </div>
            </div>

            <div className="flex justify-between items-center border-t pt-4 dark:border-stone-800">
              <button disabled={isSubmitting} onClick={handleDeleteFromEdit} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg font-bold text-sm px-3 py-2 flex items-center gap-2 transition-colors disabled:opacity-50">
                <Trash2 size={16} /> Delete Word
              </button>
              
              <div className="flex gap-2">
                <button disabled={isSubmitting} onClick={() => setEditingWord(null)} className="text-stone-500 hover:text-stone-700 dark:hover:text-stone-350 font-bold text-sm px-4 py-2">Cancel</button>
                <button disabled={isSubmitting || !editTarget.trim()} onClick={handleSaveEdit} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function StoryTab({ isActive, isDarkMode, activeStoryId, setActiveStoryId, storyList, config, onTabNext, onTabPrev }) {
  const [currentEpIdx, setCurrentEpIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const cardRef = useRef(null);

  // Derive active story data safely at top-level
  const activeStoryData = storyList ? (storyList.find(s => s.id === activeStoryId) || storyList[0]) : null;
  const episodes = activeStoryData?.episodes || [];
  const currentEpisode = episodes[currentEpIdx];

  // 1. Unconditional Reset Hook
  useEffect(() => {
    setCurrentEpIdx(0);
  }, [activeStoryId]);

  // 2. Unconditional Scroll Hook
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentEpIdx]);

  // 3. Unconditional Callback Hooks
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

  // 4. Unconditional Keyboard listener Hook
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

  // 5. Unconditional Swipe Hook
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

  // Early returns are placed safely AFTER all hooks are initiated
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
              <h3 className={`text-lg font-bold mb-3 border-b pb-2 moe-font ${isDarkMode ? 'text-stone-100 border-stone-850' : 'text-stone-855 border-stone-200'}`}>
                {currentEpisode.title}
              </h3>
              <div className={`${config.scriptStyles?.bodyText || 'text-[28px] md:text-3xl leading-snug'} space-y-4 moe-font ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>
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
  const [autoNavigatedTabEpisodeId, setAutoNavigatedTabEpisodeId] = useState(null);
  const [episodesList, setEpisodesList] = useState([]);
  
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [genError, setGenError] = useState('');
  const [deletingEpisodeId, setDeletingEpisodeId] = useState(null);
  const fileInputRef = useRef(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  const [noteModal, setNoteModal] = useState({ isOpen: false, id: null, title: '', initialText: '' });

  // 1. Identify script text requirements dynamically
  const isLargeText = config.textSizeMode === 'large';
  
  const scriptStyles = useMemo(() => ({
    isLargeText,
    mainHeader: isLargeText ? 'text-5xl md:text-6xl font-normal' : 'text-2xl md:text-3xl font-bold tracking-tight',
    bodyText: isLargeText ? 'text-[28px] md:text-3xl font-normal leading-snug' : 'text-lg md:text-xl font-normal leading-relaxed',
    vocabTerm: isLargeText ? 'text-[28px] md:text-3xl font-normal leading-snug' : 'text-lg md:text-xl font-semibold',
    interactive: isLargeText ? 'text-[28px] md:text-3xl font-normal' : 'text-base md:text-lg font-medium',
    lexiconCard: isLargeText ? 'text-[28px] md:text-3xl font-normal' : 'text-base md:text-lg font-semibold'
  }), [isLargeText]);

  // 2. Wrap config and programmatically append dynamic styles
  const activeConfig = useMemo(() => ({ ...config, scriptStyles }), [config, scriptStyles]);

  const handleOpenNote = useCallback((id, title, existingNote) => {
    setNoteModal({ isOpen: true, id, title, initialText: existingNote || '' });
  }, []);

  const handleSaveNote = useCallback((newText) => {
    if (noteModal.id && activeEpisodeId && user) {
       const currentNotes = progressState.notes || {};
       const updatedNotes = { ...currentNotes, [noteModal.id]: newText.trim() };
       setProgressState(prev => ({ ...prev, notes: updatedNotes }));
       db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set({ notes: updatedNotes }, { merge: true });
    }
    setNoteModal({ isOpen: false, id: null, title: '', initialText: '' });
  }, [noteModal.id, progressState.notes, activeEpisodeId, user, activeConfig]);

  const generatePromptString = async (isForAPI = false) => {
    let prioritizedWords = [];
    let otherWords = [];
    
    const lex = globalLexicon || {};
    if (lex.accumulated) prioritizedWords = [...lex.accumulated];
    else if (lex.entries) prioritizedWords = [...lex.entries];
    
    Object.keys(lex).forEach(key => {
      if (key !== 'accumulated' && key !== 'entries' && Array.isArray(lex[key])) {
        otherWords = [...otherWords, ...lex[key]];
      }
    });

    const flatLexicon = [...prioritizedWords, ...otherWords].map(w => {
        if (typeof w === 'string') return w;
        if (w && typeof w === 'object') return w.word || w[activeConfig.primaryTextKey] || w.targetText || '';
        return '';
    }).filter(Boolean).join(', ');
    
    let currentStoryText = "";
    if (activeConfig.hasStories) {
        const activeBackendStoryId = userPrefs.activeStoryId || 'season_3';
        const currentStoryData = storyList.find(s => s.id === activeBackendStoryId) || { episodes: [] };
        currentStoryText = (currentStoryData.episodes || []).map(e => `[Chapter: ${e.title}]\n${e.text}`).join('\n\n');
    }
    
    let pastContext = '';
    const pastEps = episodesList.slice(0, 10).reverse();
    
    const progressPromises = pastEps.map(ep => 
      db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('progress').doc(ep.id).get()
    );
    const progressSnaps = await Promise.all(progressPromises);
    
    for (let i = 0; i < pastEps.length; i++) {
      const ep = pastEps[i];
      let epContext = '';
      
      const progSnap = progressSnaps[i];
      const prog = progSnap.exists ? progSnap.data() : {};
      const notes = { ...(prog.mistakes || prog.test?.mistakes || {}), ...(prog.notes || {}) };

      if (ep.userPrompt) epContext += `User Request: ${ep.userPrompt}\n`;
      if (ep.tutorIntroduction) epContext += `Tutor Response: ${ep.tutorIntroduction}\n\n`;

      if (!activeConfig.hasStories && ep.reading) {
          const targetText = ep.reading[activeConfig.primaryTextKey] || "";
          if (targetText) epContext += `Reading Passage:\n${targetText}\n\n`;
          if (ep.reading.focus && ep.reading.focus.length > 0) {
              const focusNotes = ep.reading.focus.map(f => `- ${f.word}: ${f.explanation || f.text}`).join('\n');
              epContext += `Focus:\n${focusNotes}\n`;
              if (notes['reading_focus']) epContext += `User Note: ${notes['reading_focus']}\n`;
              epContext += `\n`;
          }
      }
      
      if (ep.drills) {
        let drillNotes = [];
        ep.drills.forEach((section, sIdx) => {
            section.examples?.forEach((ex, eIdx) => {
                const exId = `drill_${sIdx}_${eIdx}`;
                if (notes[exId]) {
                    const targetText = ex[activeConfig.primaryTextKey];
                    drillNotes.push(`- Drill "${targetText}": ${notes[exId]}`);
                }
            });
        });
        if (drillNotes.length > 0) epContext += `Drill Notes:\n${drillNotes.join('\n')}\n\n`;
      }

      if (ep.quiz) {
        let quizDetails = [];
        const selections = prog.selections || {};
        const legacy1 = prog.quizAnswers || {};
        const legacy2 = prog.quiz?.answers || {};

        ep.quiz.forEach((q, idx) => {
            const qId = `quiz_${idx}`; 
            let userAns = selections[qId] || selections[idx] || selections[String(idx)] ||
                          legacy1[qId] || legacy1[idx] || legacy1[String(idx)] ||
                          legacy2[qId] || legacy2[idx] || legacy2[String(idx)];
                          
            if (typeof userAns === 'string') userAns = userAns.trim();
            const rawQuestion = q.sentence || q.text || "";
            const correctAns = (q.answer || q.correct || "").trim();
            const distractorsList = q.distractors && Array.isArray(q.distractors) 
                ? q.distractors.join(', ') 
                : (q.options ? q.options.filter(o => o !== correctAns).join(', ') : 'None');

            let noteStr = notes[qId] ? ` | User Note: ${notes[qId]}` : '';

            if (userAns) {
                const isCorrect = (userAns === correctAns);
                quizDetails.push(`- Q: ${rawQuestion} | Correct Answer: ${correctAns} | Distractors: [${distractorsList}] | Result: ${isCorrect ? 'Correct' : 'Incorrect (Guessed: ' + userAns + ')'}${noteStr}`);
            } else {
                quizDetails.push(`- Q: ${rawQuestion} | Correct Answer: ${correctAns} | Distractors: [${distractorsList}] | Result: Not answered${noteStr}`);
            }
        });
        
        if (quizDetails.length > 0) epContext += `Quiz Performance:\n${quizDetails.join('\n')}\n\n`;
      }

      if (ep.sweep) {
         let sweepSentences = [];
         ep.sweep.forEach((s, sIdx) => {
             const text = s[activeConfig.primaryTextKey] || s.hungarian;
             const sId = `sweep_${sIdx}`;
             let noteStr = notes[sId] ? ` (User Note: ${notes[sId]})` : '';
             if (text) sweepSentences.push(text + noteStr);
         });
         if (sweepSentences.length > 0) epContext += `Sweep Sentences:\n- ${sweepSentences.join('\n- ')}\n\n`;
      }
      
      if (ep.test) {
        let testSentences = [];
        ep.test.forEach((t, tIdx) => {
            const qId = `test_${tIdx}`;
            const m = notes[qId];
            const correctAns = t[activeConfig.primaryTextKey] || t.hungarian;
            if (m && m.trim()) testSentences.push(`EN: ${t.english} -> Correct: ${correctAns} | User Note: ${m.trim()}`);
            else testSentences.push(`EN: ${t.english} -> Correct: ${correctAns}`);
        });
        if (testSentences.length > 0) epContext += `Test Translations & Notes:\n- ${testSentences.join('\n- ')}\n\n`;
      }
      
      if (epContext) pastContext += `\n--- Past Episode: ${ep.title} ---\n${epContext}`;
    }

    const storyContextBlock = activeConfig.hasStories && currentStoryText ? `\nCURRENT STORY SO FAR:\n${currentStoryText}\n` : '';
    const pastContextBlock = pastContext ? `\nRECENT CONTEXT & PERFORMANCE (Last 10 lessons):\n${pastContext}\n` : '';
    const outputInstruction = isForAPI 
        ? `OUTPUT FORMAT (Provide response strictly as raw JSON, without any markdown formatting or backticks. Do NOT wrap in \`\`\`json):\n${activeConfig.promptOutputFormat}`
        : `OUTPUT FORMAT (Provide response as JSON inside a \`\`\`json codeblock):\n${activeConfig.promptOutputFormat}`;

    return `SYSTEM INSTRUCTION:\n${activeConfig.promptSystemInstruction}\n\nKNOWN VOCABULARY:\n[${flatLexicon}]\n${storyContextBlock}${pastContextBlock}\nUSER REQUEST:\n${topicInput}\n\n---\n\n${outputInstruction}`;
  };

  const handleExportPrompt = async () => {
    if (!topicInput.trim() || !user) return;
    setIsExporting(true);
    setGenError('');
    
    try {
      const exportedText = await generatePromptString(false);

      // 1. COPY TO CLIPBOARD (The Desktop Magic)
      try {
        await navigator.clipboard.writeText(exportedText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500); // Change back after 2.5s
      } catch (clipboardErr) {
        console.warn("Could not copy to clipboard:", clipboardErr);
      }

      // 2. HANDLE FILE FOR MOBILE / BACKUP
      const fileName = `${activeConfig.name.replace(/\s+/g, '_')}_Prompt_${Date.now()}.txt`;
      const file = new File([exportedText], fileName, { type: 'text/plain' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Prompt Export',
          files: [file]
        });
      } else {
        // Desktop Fallback Download
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setGenError("Failed to build prompt: " + err.message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateLLM = async () => {
    if (!topicInput.trim() || !user) return;
    
    if (!globalLexicon) {
      setGenError("Database is still syncing. Please wait a few seconds and try again.");
      setShowGenerateConfirm(false);
      return;
    }

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
      const promptText = await generatePromptString(true);
      
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

  const { handleSpeak, stopSpeak } = useGeminiTTS(activeConfig.ttsSystemInstruction);

  useEffect(() => { const unsub = auth.onAuthStateChanged(setUser); return () => unsub(); }, []);
  
  useEffect(() => {
    const checkTheme = () => {
      const localTheme = localStorage.getItem('lingocraft_theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(localTheme === 'dark' || (!localTheme && systemDark));
    };
    checkTheme();
    window.addEventListener('theme-changed', checkTheme);
    return () => {
      window.removeEventListener('theme-changed', checkTheme);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const docName = activeConfig.lexiconDoc || 'lexicon';
    const lexRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    const unsubLex = lexRef.onSnapshot(snap => setGlobalLexicon(snap.exists ? snap.data() : {}));
    
    if (activeConfig.hasStories) {
      const prefsRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs');
      const unsubPrefs = prefsRef.onSnapshot(snap => { if (snap.exists) { setUserPrefs(snap.data()); setViewingStoryId(prev => prev === 'season_3' ? (snap.data().activeStoryId || 'season_3') : prev); }});
      const storiesRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('stories');
      const unsubStories = storiesRef.onSnapshot(snap => setStoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))));
      return () => { unsubLex(); unsubPrefs(); unsubStories(); };
    }
    return () => unsubLex();
  }, [user, activeConfig]);

  useEffect(() => {
    if (!user) return;
    const epsRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('episodes').orderBy('timestamp', 'desc').limit(10);
    return epsRef.onSnapshot(snap => {
      const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEpisodesList(eps);
      setActiveEpisodeId(prevId => !prevId && eps.length > 0 ? eps[0].id : prevId);
    });
  }, [user, activeConfig]);

  useEffect(() => {
    if (!activeEpisodeId || !user) { setActiveEpisode(null); setProgressState({}); return; }
    const epRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId);
    const unsubEp = epRef.onSnapshot(snap => { if (snap.exists) setActiveEpisode({ id: snap.id, ...snap.data() }); });
    const progRef = db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId);
    
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
            notes: { ...(d.mistakes || d.test?.mistakes || {}), ...(d.notes || {}) },
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
  }, [activeEpisodeId, user, activeConfig]);

  const updateFirebase = useCallback(async (updates) => {
    if (!activeEpisodeId || !user) return;
    setProgressState(prev => ({ ...prev, ...updates }));
    await db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId).set(updates, { merge: true });
  }, [activeEpisodeId, user, activeConfig]);

  const handleTabSwitch = (newTab) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(newTab);
    setTimeout(() => { window.scrollTo({ top: scrollPositions.current[newTab] || 0, behavior: 'instant' }); }, 0);
  };

  useEffect(() => {
    if (!activeEpisode || !progressState || autoNavigatedTabEpisodeId === activeEpisode.id) return;

    // Subsequent progress indicators
    const hasReadingProgress = (progressState.listenedReading || []).length > 0;
    const hasDrillProgress = (progressState.listenedDrills || []).length > 0;
    const hasQuizProgress = (progressState.gradedIds || []).length > 0;
    const hasTestProgress = Object.keys(progressState.testRevealed || {}).length > 0;
    const hasSweepProgress = Object.keys(progressState.sweepRevealed || {}).length > 0;

    const hasSubsequentProgressForEpisode = hasReadingProgress || hasDrillProgress || hasQuizProgress || hasTestProgress || hasSweepProgress;
    const hasSubsequentProgressForReading = hasDrillProgress || hasQuizProgress || hasTestProgress || hasSweepProgress;

    // Episode versions
    const getTabLabel = (key) => {
      return (activeConfig.labels && activeConfig.labels[key]) || (key.charAt(0).toUpperCase() + key.slice(1));
    };
    const versions = [];
    if (activeEpisode.story) {
      if (activeEpisode.story[activeConfig.primaryTextKey]) {
        versions.push({ id: activeConfig.primaryTextKey, label: getTabLabel(activeConfig.primaryTextKey) });
      }
      if (activeEpisode.story[activeConfig.transliterationKey]) {
        versions.push({ id: activeConfig.transliterationKey, label: getTabLabel(activeConfig.transliterationKey) });
      }
      if (activeEpisode.story.english) {
        versions.push({ id: 'english', label: getTabLabel('english') });
      }
    }
    const isEpisodeCompleted = !activeConfig.hasStories || versions.length === 0 ||
      versions.every(v => (progressState.listenedEpisodes || []).includes(v.id)) ||
      hasSubsequentProgressForEpisode;

    // Reading pages
    const pages = [];
    if (activeEpisode.reading) {
      if (activeEpisode.reading.definitions && activeEpisode.reading.definitions.length > 0) pages.push({ id: 'defs' });
      if (activeEpisode.reading.target) pages.push({ id: 'read' });
      if (activeEpisode.reading.english) pages.push({ id: 'eng' });
      if (activeEpisode.reading.focus && activeEpisode.reading.focus.length > 0) pages.push({ id: 'focus' });
    }
    const isReadingCompleted = !activeConfig.hasReading || pages.length === 0 ||
      pages.every(p => (progressState.listenedReading || []).includes(p.id)) ||
      hasSubsequentProgressForReading;

    // Drill completed
    const totalDrillItems = activeEpisode.drills ? activeEpisode.drills.reduce((acc, d) => acc + (d.examples?.length || 0), 0) : 0;
    const isDrillCompleted = totalDrillItems === 0 || (progressState.listenedDrills || []).length >= totalDrillItems ||
      hasQuizProgress || hasTestProgress || hasSweepProgress;

    // Quiz completed
    const totalQuizItems = activeEpisode.quiz?.length || 0;
    const isQuizCompleted = totalQuizItems === 0 || (progressState.gradedIds || []).length >= totalQuizItems ||
      hasTestProgress || hasSweepProgress;

    // Test completed
    const totalTestItems = activeEpisode.test?.length || 0;
    const isTestCompleted = !activeConfig.hasTestTab || totalTestItems === 0 || 
      Object.keys(progressState.testRevealed || {}).length >= totalTestItems ||
      hasSweepProgress;

    // Sweep completed
    const totalSweepItems = activeEpisode.sweep?.length || 0;
    const isSweepCompleted = !activeConfig.hasSweepTab || totalSweepItems === 0 || 
      Object.keys(progressState.sweepRevealed || {}).length >= totalSweepItems;

    // Find the first uncompleted tab in order of lesson progression
    let initialTab = 'studio';
    
    if (activeConfig.hasStories && !isEpisodeCompleted) {
      initialTab = 'episode';
    } else if (activeConfig.hasReading && !isReadingCompleted) {
      initialTab = 'reading';
    } else if (totalDrillItems > 0 && !isDrillCompleted) {
      initialTab = 'drill';
    } else if (totalQuizItems > 0 && !isQuizCompleted) {
      initialTab = 'quiz';
    } else if (activeConfig.hasTestTab && totalTestItems > 0 && !isTestCompleted) {
      initialTab = 'test';
    } else if (activeConfig.hasSweepTab && totalSweepItems > 0 && !isSweepCompleted) {
      initialTab = 'sweep';
    } else {
      initialTab = 'studio';
    }

    handleTabSwitch(initialTab);
    setAutoNavigatedTabEpisodeId(activeEpisode.id);
  }, [activeEpisode, progressState, autoNavigatedTabEpisodeId, activeConfig]);

  const processImportedJSON = async (textToParse) => {
    if (!globalLexicon) {
      setGenError("Error: Database is still syncing. Please wait a moment and try again.");
      setIsGenerating(false);
      return;
    }

    try {
      if (textToParse.startsWith('```json')) textToParse = textToParse.replace(/^```json\n?/, '');
      else if (textToParse.startsWith('```')) textToParse = textToParse.replace(/^```\n?/, '');
      if (textToParse.endsWith('```')) textToParse = textToParse.replace(/\n?```$/, '');

      const lessonJSON = JSON.parse(textToParse);
      const newEpisodeId = `ep_${Date.now()}`;
      
      if (lessonJSON.drills) lessonJSON.drills.forEach(d => { if (d.examples) d.examples = d.examples.slice(0, 5); });
      
      const validNewLemmas = (lessonJSON.newLemmas || []).map(w => {
          const uniqueId = `dict_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          
          if (typeof w === 'string') {
              return {
                  id: uniqueId,
                  [activeConfig.primaryTextKey]: w.trim(),
                  word: w.trim(),
                  english: "",
                  pos: ""
              };
          }
          
          if (typeof w === 'object' && w !== null) {
              const targetText = w[activeConfig.primaryTextKey] || w.word || w.target || w.Target || w.lemma || Object.values(w)[0] || '';
              
              return { 
                  ...w, 
                  id: uniqueId,
                  [activeConfig.primaryTextKey]: targetText,
                  word: targetText
              };
          }
          return null;
      }).filter(Boolean);

      const episodeDoc = { ...lessonJSON, newLemmas: validNewLemmas, id: newEpisodeId, timestamp: Date.now(), userPrompt: topicInput || "Imported JSON Lesson" };
      
      const batch = db.batch();
      batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(newEpisodeId), episodeDoc);
      
      const docName = activeConfig.lexiconDoc || 'lexicon';
      if (Array.isArray(globalLexicon) || globalLexicon?.entries) {
          const existingEntries = globalLexicon.entries || globalLexicon || [];
          const newEntries = [...validNewLemmas, ...existingEntries];
          batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries }, { merge: true });
      } else {
          const newAcc = [...validNewLemmas, ...(globalLexicon?.accumulated || [])];
          batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { ...globalLexicon, accumulated: newAcc }, { merge: true });
      }
      
      if (activeConfig.hasStories) {
          let targetStoryId = userPrefs.activeStoryId || 'season_3';
          if (lessonJSON.storyStatus === 'new_story') {
            targetStoryId = `season_${Date.now()}`;
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('settings').doc('prefs'), { activeStoryId: targetStoryId }, { merge: true });
          }
          const targetStoryData = storyList.find(s => s.id === targetStoryId) || { episodes: [] };
          const targetEps = [...(targetStoryData.episodes || [])];
          if (lessonJSON.story?.traditional) targetEps.push({ id: newEpisodeId, title: lessonJSON.title, text: lessonJSON.story.traditional });
          batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStoryId), { currentTitle: lessonJSON.storyTitle || "Story", episodes: targetEps, timestamp: targetStoryData.timestamp || Date.now() }, { merge: true });
      }
      
      await batch.commit();
      try {
          await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).collection('logs').add({
              appId: activeConfig.dbAppId,
              courseName: activeConfig.name,
              action: 'import',
              episodeTitle: lessonJSON.title || lessonJSON.storyTitle || "Untitled Lesson",
              timestamp: Date.now()
          });
      } catch(e) { console.error("Failed to log import", e); }
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
      batch.delete(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('episodes').doc(activeEpisodeId));
      batch.delete(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('progress').doc(activeEpisodeId));
      
      if (activeConfig.hasStories) {
          let targetStory = null;
          for (const story of storyList) {
            if (story.episodes && story.episodes.some(e => e.id === activeEpisodeId)) { targetStory = story; break; }
          }
          if (targetStory) {
            const updatedEps = targetStory.episodes.filter(e => e.id !== activeEpisodeId);
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('stories').doc(targetStory.id), { episodes: updatedEps }, { merge: true });
          }
      }

      if (activeEpisode?.newLemmas && activeEpisode.newLemmas.length > 0) {
        const docName = activeConfig.lexiconDoc || 'lexicon';
        if (Array.isArray(globalLexicon) || globalLexicon?.entries) {
            const list = globalLexicon.entries || globalLexicon;
            const toDeleteIds = activeEpisode.newLemmas.map(l => l.id).filter(Boolean);
            const newEntries = list.filter(w => !toDeleteIds.includes(w.id));
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries }, { merge: true });
        } else {
            const newAcc = (globalLexicon?.accumulated || []).filter(w => !activeEpisode.newLemmas.some(lemma => lemma.id === w.id));
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { accumulated: newAcc }, { merge: true });
        }
      }

      await batch.commit();
      try {
          await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).collection('logs').add({
              appId: activeConfig.dbAppId,
              courseName: activeConfig.name,
              action: 'delete',
              episodeTitle: activeEpisode?.title || "Untitled Lesson",
              timestamp: Date.now()
          });
      } catch(e) { console.error("Failed to log deletion", e); }
      setDeletingEpisodeId(null);
      const nextEp = episodesList.find(e => e.id !== activeEpisodeId) || null;
      setActiveEpisodeId(nextEp ? nextEp.id : null);
    } catch (e) { console.error("Delete failed", e); }
  };

  const navItems = useMemo(() => [
    { id: 'studio', label: 'Studio', icon: MessageSquare },
    ...(activeConfig.hasStories ? [{ id: 'episode', label: 'Audio', icon: Volume2 }] : []),
    ...(activeConfig.hasReading ? [{ id: 'reading', label: 'Reading', icon: BookOpen }] : []),
    { id: 'drill', label: 'Drills', icon: BookMarked },
    { id: 'quiz', label: 'Quiz', icon: CheckCircle2 },
    ...(activeConfig.hasTestTab ? [{ id: 'test', label: 'Test', icon: PenTool }] : []),
    ...(activeConfig.hasSweepTab ? [{ id: 'sweep', label: 'Sweep', icon: Activity }] : []),
    { id: 'lexicon', label: 'Lexicon', icon: Search },
    ...(activeConfig.hasStories ? [{ id: 'story', label: 'Story', icon: Book }] : [])
  ], [activeConfig]);

  const handleTabNext = useCallback(() => {
    const idx = navItems.findIndex(item => item.id === activeTab);
    if (idx !== -1 && idx < navItems.length - 1) {
      handleTabSwitch(navItems[idx + 1].id);
    }
  }, [navItems, activeTab]);

  const handleTabPrev = useCallback(() => {
    const idx = navItems.findIndex(item => item.id === activeTab);
    if (idx > 0) {
      handleTabSwitch(navItems[idx - 1].id);
    }
  }, [navItems, activeTab]);

  const studioSwipeHandlers = useSwipeable({
    onSwipedLeft: handleTabNext,
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const lexiconSwipeHandlers = useSwipeable({
    onSwipedLeft: handleTabNext,
    onSwipedRight: handleTabPrev,
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < navItems.length) {
          e.preventDefault();
          handleTabSwitch(navItems[index].id);
        }
      }

      if (['studio', 'lexicon'].includes(activeTab)) {
        if (e.key === 'ArrowRight' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          handleTabNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          handleTabPrev();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navItems, activeTab, handleTabNext, handleTabPrev]);

  const isLatestEpisode = episodesList.length > 0 && activeEpisodeId === episodesList[0].id;
  const isStudyTab = ['episode', 'reading', 'drill', 'quiz', 'test', 'sweep', 'story'].includes(activeTab);

  if (!user) return null;
  
  // Base stylesheet containing structural and layout overrides
  const baseStyles = `
    html, body { scrollbar-width: none; -ms-overflow-style: none; }
    html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
    .no-scrollbar::-webkit-scrollbar { display: none !important; }
    .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  `;

  // Assembly order: active configuration webfonts are placed first
  // to ensure @import statements are evaluated correctly by the browser.
  const dynamicStyles = `${activeConfig.webFontsCss || ''}\n${baseStyles}`;

  return (
    <div className={`flex flex-col transition-colors duration-300 font-sans ${isStudyTab ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} ${isDarkMode ? 'bg-stone-950 text-stone-100 selection:bg-stone-750' : 'bg-stone-50 text-stone-900 selection:bg-stone-200'}`} lang={activeConfig.id === 'mandarin' ? 'zh-Hant' : activeConfig.id.substring(0, 2)}>
      <style dangerouslySetInnerHTML={{__html: dynamicStyles}} />    
      <nav className={`shrink-0 sticky top-0 z-50 border-b backdrop-blur-md px-3 py-1.5 md:py-2 flex justify-between shadow-sm ${isDarkMode ? 'bg-stone-900/85 border-stone-850' : 'bg-white/90 border-stone-200'}`}>
        <div className="flex gap-1 md:gap-2 overflow-x-auto no-scrollbar mask-edges pr-8 flex-1">
          <Link to="/" className={`p-1.5 rounded-lg border transition-all active:scale-95 shrink-0 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-700 hover:text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-800'}`}><ArrowLeft size={14} /></Link>
          {navItems.map(item => (
            <button key={item.id} onClick={() => handleTabSwitch(item.id)} className={`flex items-center gap-1.5 px-2.5 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === item.id ? (isDarkMode ? 'bg-stone-700 text-amber-400' : 'bg-stone-800 text-white') : (isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100')}`}>
              <item.icon size={14} /> <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className={`flex-1 w-full ${isStudyTab ? 'min-h-0 flex flex-col justify-center items-center md:py-6' : ''}`}>

        {activeTab === 'studio' && (
          <div {...studioSwipeHandlers} className="max-w-6xl mx-auto pt-3 md:pt-9 pb-12 px-4 md:px-8 animate-in fade-in duration-300">
            <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2 justify-center">
                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
                  <MessageSquare size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Studio Control</span>
              </div>

              <div className="relative z-20 group w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl border shadow-sm transition-all text-sm ${isDarkMode ? 'bg-stone-900 border-stone-800 hover:border-stone-750 text-stone-200' : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'}`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <List size={16} className={`shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                    <span className="font-bold truncate">{activeEpisode ? activeEpisode.title : 'Archive'}</span>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-xl border overflow-hidden z-50 text-left ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                    <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
                    <div className="max-h-60 overflow-y-auto">
                      {episodesList.map(ep => (
                        <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b last:border-0 ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-amber-900/30 text-amber-400 border-stone-800' : 'bg-amber-50 text-amber-700 border-stone-100') : (isDarkMode ? 'hover:bg-stone-800 text-stone-300 border-stone-800' : 'hover:bg-stone-50 text-stone-700 border-stone-100')}`}>
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
                <textarea 
                  value={topicInput} onChange={e => setTopicInput(e.target.value)} disabled={isGenerating} 
                  placeholder="e.g., Focus on grammar. Review words: table, sky." 
                  rows="2"
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all resize-y min-h-[80px] ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:focus:border-stone-400'}`} 
                />
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

                  <button 
                    onClick={handleExportPrompt} 
                    disabled={isGenerating || isExporting || !topicInput.trim()} 
                    title="Download detailed prompt file for LLM Web App" 
                    className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                    {isExporting ? (
                        <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
                    ) : isCopied ? (
                        <Check className="w-5 h-5 shrink-0 text-emerald-500" />
                    ) : (
                        <Download className="w-5 h-5 shrink-0" />
                    )}
                    
                    <span className="truncate hidden sm:inline">
                        {isCopied ? "Copied!" : "Export Prompt"}
                    </span>
                    <span className="truncate sm:hidden">
                        {isCopied ? "Copied!" : "Export"}
                    </span>
                </button>

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
                            <button onClick={() => handleTabSwitch(activeConfig.hasStories ? 'episode' : 'reading')} className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-stone-800 hover:bg-stone-700 text-amber-400' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}>
                              Go to {activeConfig.hasStories ? 'Audio' : 'Reading'}
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

        {activeConfig.hasStories && <div className={activeTab === 'episode' ? 'flex-1 min-h-0 w-full animate-in fade-in duration-300' : 'hidden'}><EpisodeTab isActive={activeTab === 'episode'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}
        {activeConfig.hasReading && <div className={activeTab === 'reading' ? 'flex-1 min-h-0 w-full animate-in fade-in duration-300' : 'hidden'}><ReadingTab isActive={activeTab === 'reading'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} progressState={progressState} updateFirebase={updateFirebase} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}

        <div className={activeTab === 'drill' ? 'flex-1 min-h-0 w-full' : 'hidden'}><DrillTab isActive={activeTab === 'drill'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} isLatestEpisode={isLatestEpisode} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>
        <div className={activeTab === 'quiz' ? 'flex-1 min-h-0 w-full' : 'hidden'}><QuizTab isActive={activeTab === 'quiz'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>
        {activeConfig.hasTestTab && <div className={activeTab === 'test' ? 'flex-1 min-h-0 w-full' : 'hidden'}><TestTab isActive={activeTab === 'test'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}
        {activeConfig.hasSweepTab && <div className={activeTab === 'sweep' ? 'flex-1 min-h-0 w-full' : 'hidden'}><SweepTab isActive={activeTab === 'sweep'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}
        
        <div {...lexiconSwipeHandlers} className={activeTab === 'lexicon' ? 'block animate-in fade-in duration-300' : 'hidden'}><LexiconTab isDarkMode={isDarkMode} globalLexicon={globalLexicon} user={user} config={activeConfig} /></div>
        {activeConfig.hasStories && <div className={activeTab === 'story' ? 'flex-1 min-h-0 w-full animate-in fade-in duration-300' : 'hidden'}><StoryTab isActive={activeTab === 'story'} isDarkMode={isDarkMode} activeStoryId={viewingStoryId} setActiveStoryId={setViewingStoryId} storyList={storyList} config={activeConfig} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}      </main>

      <UserNoteModal 
        isDarkMode={isDarkMode}
        isOpen={noteModal.isOpen}
        noteTitle={noteModal.title}
        initialText={noteModal.initialText}
        onClose={() => setNoteModal({ isOpen: false, id: null, title: '', initialText: '' })}
        onSave={handleSaveNote}
      />
    </div>
  );
}
