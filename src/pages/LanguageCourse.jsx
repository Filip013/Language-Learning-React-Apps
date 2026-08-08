import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, Volume2, BookOpen, BookMarked, 
  CheckCircle2, PenTool, Activity, Search, 
  Book, ArrowLeft
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import firebase, { auth, db } from '../firebase';
import { useGeminiTTS } from '../hooks/useGeminiTTS';

// Shared Common Components
import UserNoteModal from '../components/common/UserNoteModal';
import AiTranslatePopup from '../components/common/AiTranslatePopup';
import ThemeToggle from '../components/common/ThemeToggle';

// Modular Course Tabs
import EpisodeTab from '../components/course/EpisodeTab';
import ReadingTab from '../components/course/ReadingTab';
import DrillTab from '../components/course/DrillTab';
import QuizTab from '../components/course/QuizTab';
import TestTab from '../components/course/TestTab';
import SweepTab from '../components/course/SweepTab';
import LexiconTab from '../components/course/LexiconTab';
import StoryTab from '../components/course/StoryTab';
import StudioTab from '../components/course/StudioTab';

const mergeLexiconLists = (lists) => {
  const seenIds = new Set();
  const result = [];
  for (const list of lists) {
    for (const w of list || []) {
      if (w && typeof w === 'object' && w.id) {
        if (seenIds.has(w.id)) continue;
        seenIds.add(w.id);
      }
      result.push(w);
    }
  }
  return result;
};

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
    const lex = globalLexicon || {};

    const listValues = [
      ...(lex.accumulated || []),
      ...(lex.entries || []),
      ...(Array.isArray(lex) ? lex : []),
      ...Object.entries(lex)
        .filter(([key, value]) => key !== 'accumulated' && key !== 'entries' && Array.isArray(value))
        .flatMap(([, value]) => value)
    ];

    const flatLexicon = listValues.map(w => {
        if (typeof w === 'string') return w;
        if (w && typeof w === 'object') return w.word || w[activeConfig.primaryTextKey] || w.targetText || '';
        return '';
    }).filter(Boolean).filter((text, index, arr) => arr.indexOf(text) === index).join(', ');
    
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
    const jsonFormatString = JSON.stringify(activeConfig.promptOutputFormat, null, 2);
    const outputInstruction = isForAPI 
        ? `OUTPUT FORMAT (Provide response strictly as raw JSON, without any markdown formatting or backticks. Do NOT wrap in \`\`\`json):\n${jsonFormatString}`
        : `OUTPUT FORMAT (Provide response as JSON inside a \`\`\`json codeblock):\n${jsonFormatString}`;
    return `SYSTEM INSTRUCTION:\n${activeConfig.promptSystemInstruction}\n\nKNOWN VOCABULARY:\n[${flatLexicon}]\n${storyContextBlock}${pastContextBlock}\nUSER REQUEST:\n${topicInput}\n\n---\n\n${outputInstruction}`;
  };

  const handleExportPrompt = async () => {
    if (!topicInput.trim() || !user) return;
    setIsExporting(true);
    setGenError('');
    
    try {
      const exportedText = await generatePromptString(false);

      try {
        await navigator.clipboard.writeText(exportedText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch (clipboardErr) {
        console.warn("Could not copy to clipboard:", clipboardErr);
      }

      const fileName = `${activeConfig.name.replace(/\s+/g, '_')}_Prompt_${Date.now()}.txt`;
      const file = new File([exportedText], fileName, { type: 'text/plain' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Prompt Export',
          files: [file]
        });
      } else {
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

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
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
            drillRevealed: d.drillRevealed || Object.keys(d.drills?.revealed || {}), 
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

    const hasReadingProgress = (progressState.listenedReading || []).length > 0;
    const hasDrillProgress = (progressState.listenedDrills || []).length > 0;
    const hasQuizProgress = (progressState.gradedIds || []).length > 0;
    const hasTestProgress = Object.keys(progressState.testRevealed || {}).length > 0;
    const hasSweepProgress = Object.keys(progressState.sweepRevealed || {}).length > 0;

    const hasSubsequentProgressForEpisode = hasReadingProgress || hasDrillProgress || hasQuizProgress || hasTestProgress || hasSweepProgress;
    const hasSubsequentProgressForReading = hasDrillProgress || hasQuizProgress || hasTestProgress || hasSweepProgress;

    const getTabLabel = (key) => {
      return (activeConfig.labels && activeConfig.labels[key]) || (key.charAt(0).toUpperCase() + key.slice(1));
    };
    const versions = [];
    if (activeEpisode.story) {
      if (activeEpisode.story[activeConfig.primaryTextKey]) {
        versions.push({ id: activeConfig.primaryTextKey, label: getTabLabel(activeConfig.primaryTextKey) });
      }
      if (activeEpisode.story.english) {
        versions.push({ id: 'english', label: getTabLabel('english') });
      }
    }
    const isEpisodeCompleted = !activeConfig.hasStories || versions.length === 0 ||
      versions.every(v => (progressState.listenedEpisodes || []).includes(v.id)) ||
      hasSubsequentProgressForEpisode;

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

    const totalDrillItems = activeEpisode.drills ? activeEpisode.drills.reduce((acc, d) => acc + (d.examples?.length || 0), 0) : 0;
    const completedDrillItems = activeEpisode.drills ? activeEpisode.drills.reduce((acc, d, wIdx) => acc + (d.examples || []).filter((_, eIdx) => {
      const id = `drill_${wIdx}_${eIdx}`;
      return (progressState.listenedDrills || []).includes(id) || (progressState.drillRevealed || []).includes(id);
    }).length, 0) : 0;
    const isDrillCompleted = totalDrillItems === 0 || completedDrillItems >= totalDrillItems ||
      hasQuizProgress || hasTestProgress || hasSweepProgress;

    const totalQuizItems = activeEpisode.quiz?.length || 0;
    const isQuizCompleted = totalQuizItems === 0 || (progressState.gradedIds || []).length >= totalQuizItems ||
      hasTestProgress || hasSweepProgress;

    const totalTestItems = activeEpisode.test?.length || 0;
    const isTestCompleted = !activeConfig.hasTestTab || totalTestItems === 0 || 
      Object.keys(progressState.testRevealed || {}).length >= totalTestItems ||
      hasSweepProgress;

    const totalSweepItems = activeEpisode.sweep?.length || 0;
    const isSweepCompleted = !activeConfig.hasSweepTab || totalSweepItems === 0 || 
      Object.keys(progressState.sweepRevealed || {}).length >= totalSweepItems;

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
      if (activeConfig.id === 'mandarin') {
          const newAcc = [...validNewLemmas, ...(globalLexicon?.accumulated || [])];
          batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { accumulated: newAcc }, { merge: true });
      } else {
          const existingEntries = globalLexicon?.entries || (Array.isArray(globalLexicon) ? globalLexicon : []);
          const existingAcc = globalLexicon?.accumulated || [];
          const newEntries = mergeLexiconLists([validNewLemmas, existingEntries, existingAcc]);
          batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries, accumulated: firebase.firestore.FieldValue.delete() }, { merge: true });
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
        const toDeleteIds = activeEpisode.newLemmas.map(l => l.id).filter(Boolean);
        if (activeConfig.id === 'mandarin') {
            const newAcc = (globalLexicon?.accumulated || []).filter(w => !toDeleteIds.includes(w.id));
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { accumulated: newAcc }, { merge: true });
        } else {
            const merged = mergeLexiconLists([globalLexicon?.entries || (Array.isArray(globalLexicon) ? globalLexicon : []), globalLexicon?.accumulated || []]);
            const newEntries = merged.filter(w => !toDeleteIds.includes(w.id));
            batch.set(db.collection('artifacts').doc(activeConfig.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName), { entries: newEntries, accumulated: firebase.firestore.FieldValue.delete() }, { merge: true });
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

  const isStudyTab = ['episode', 'reading', 'drill', 'quiz', 'test', 'sweep', 'story'].includes(activeTab);
  const isLatestEpisode = episodesList.length > 0 && activeEpisodeId === episodesList[0].id;

  return (
    <div className={`w-full font-sans selection:bg-amber-500/20 selection:text-amber-500 ${isStudyTab ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen flex flex-col'} ${isDarkMode ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900'}`}>
      
      {activeConfig.webFontsCss && (
        <style dangerouslySetInnerHTML={{ __html: activeConfig.webFontsCss }} />
      )}

      {/* Top Navigation Bar */}
      <nav className={`shrink-0 border-b overflow-x-auto no-scrollbar flex items-center justify-start md:justify-center gap-1.5 px-3 py-2 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-sm'}`}>
        <Link 
          to="/" 
          className={`flex items-center justify-center p-2 md:px-2.5 md:py-1.5 rounded-lg border transition-all shrink-0 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:text-white hover:bg-stone-700' : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200 hover:text-stone-900'}`}
          title="Back to Hub"
        >
          <ArrowLeft size={16} />
          <span className="hidden md:inline text-xs md:text-sm font-bold ml-1.5">Home</span>
        </Link>

        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button 
              key={item.id} 
              onClick={() => handleTabSwitch(item.id)} 
              title={item.label}
              className={`flex items-center justify-center p-2 md:px-2.5 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${activeTab === item.id ? (isDarkMode ? 'bg-stone-700 text-amber-400' : 'bg-stone-800 text-white') : (isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100')}`}
            >
              <Icon size={16} />
              <span className="hidden md:inline ml-1.5">{item.label}</span>
            </button>
          );
        })}

        <ThemeToggle className="ml-auto md:ml-0 bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-700" />
      </nav>

      <main className={`flex-1 w-full min-h-0 ${isStudyTab ? 'flex flex-col h-full overflow-hidden md:py-4' : ''}`}>

        {activeTab === 'studio' && (
          <StudioTab 
            isDarkMode={isDarkMode}
            activeEpisode={activeEpisode}
            episodesList={episodesList}
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
            setActiveEpisodeId={setActiveEpisodeId}
            activeEpisodeId={activeEpisodeId}
            topicInput={topicInput}
            setTopicInput={setTopicInput}
            isGenerating={isGenerating}
            isExporting={isExporting}
            showGenerateConfirm={showGenerateConfirm}
            setShowGenerateConfirm={setShowGenerateConfirm}
            handleGenerateLLM={handleGenerateLLM}
            handleExportPrompt={handleExportPrompt}
            isCopied={isCopied}
            handlePasteLesson={handlePasteLesson}
            handleFileUpload={handleFileUpload}
            genError={genError}
            activeConfig={activeConfig}
            handleTabSwitch={handleTabSwitch}
            deletingEpisodeId={deletingEpisodeId}
            setDeletingEpisodeId={setDeletingEpisodeId}
            handleDeleteEpisode={handleDeleteEpisode}
            studioSwipeHandlers={studioSwipeHandlers}
          />
        )}

        {activeConfig.hasStories && <div className={activeTab === 'episode' ? 'flex-1 min-h-0 w-full h-full flex flex-col animate-in fade-in duration-300' : 'hidden'}><EpisodeTab isActive={activeTab === 'episode'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}
        {activeConfig.hasReading && <div className={activeTab === 'reading' ? 'flex-1 min-h-0 w-full h-full flex flex-col animate-in fade-in duration-300' : 'hidden'}><ReadingTab isActive={activeTab === 'reading'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} progressState={progressState} updateFirebase={updateFirebase} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}

        <div className={activeTab === 'drill' ? 'flex-1 min-h-0 w-full h-full flex flex-col' : 'hidden'}><DrillTab isActive={activeTab === 'drill'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} isLatestEpisode={isLatestEpisode} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>
        <div className={activeTab === 'quiz' ? 'flex-1 min-h-0 w-full h-full flex flex-col' : 'hidden'}><QuizTab isActive={activeTab === 'quiz'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>
        {activeConfig.hasTestTab && <div className={activeTab === 'test' ? 'flex-1 min-h-0 w-full h-full flex flex-col' : 'hidden'}><TestTab isActive={activeTab === 'test'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}
        {activeConfig.hasSweepTab && <div className={activeTab === 'sweep' ? 'flex-1 min-h-0 w-full h-full flex flex-col' : 'hidden'}><SweepTab isActive={activeTab === 'sweep'} isDarkMode={isDarkMode} activeEpisode={activeEpisode} progressState={progressState} updateFirebase={updateFirebase} handleSpeak={handleSpeak} stopSpeak={stopSpeak} config={activeConfig} handleOpenNote={handleOpenNote} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}

        <div {...lexiconSwipeHandlers} className={activeTab === 'lexicon' ? 'block animate-in fade-in duration-300' : 'hidden'}><LexiconTab isDarkMode={isDarkMode} globalLexicon={globalLexicon} user={user} config={activeConfig} /></div>
        {activeConfig.hasStories && <div className={activeTab === 'story' ? 'flex-1 min-h-0 w-full h-full flex flex-col animate-in fade-in duration-300' : 'hidden'}><StoryTab isActive={activeTab === 'story'} isDarkMode={isDarkMode} activeStoryId={viewingStoryId} setActiveStoryId={setViewingStoryId} storyList={storyList} config={activeConfig} onTabNext={handleTabNext} onTabPrev={handleTabPrev} /></div>}      
      </main>

      {/* Reusable User Notes Modal */}
      <UserNoteModal
        isDarkMode={isDarkMode}
        isOpen={noteModal.isOpen}
        noteTitle={noteModal.title}
        initialText={noteModal.initialText}
        onClose={() => setNoteModal({ isOpen: false, id: null, title: '', initialText: '' })}
        onSave={handleSaveNote}
      />

      {/* Global Shared AI Translate Popup */}
      <AiTranslatePopup 
        isDarkMode={isDarkMode} 
        config={activeConfig} 
        handleSpeak={handleSpeak} 
      />

    </div>
  );
}