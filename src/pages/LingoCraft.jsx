import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Globe, Search, History, Database, 
  Loader2, Sparkles, AlertCircle, BookOpen, 
  Volume2, Pause, Trash2, ArrowLeft,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { auth, db } from '../firebase';
import { useGeminiTTS } from '../hooks/useGeminiTTS';

const dbAppId = 'lingocraft';

// --- APP DATA ---
const LANGUAGES = [
    { name: 'English', code: 'en-US', flag: '🇬🇧' },
    { name: 'French', code: 'fr-FR', flag: '🇫🇷' },
    { name: 'German', code: 'de-DE', flag: '🇩🇪' },
    { name: 'Spanish', code: 'es-ES', flag: '🇪🇸' },
    { name: 'Italian', code: 'it-IT', flag: '🇮🇹' },
    { name: 'Portuguese', code: 'pt-PT', flag: '🇵🇹' },
    { name: 'Dutch', code: 'nl-NL', flag: '🇳🇱' },
    { name: 'Norwegian', code: 'no-NO', flag: '🇳🇴' },
    { name: 'Romanian', code: 'ro-RO', flag: '🇷🇴' },
    { name: 'Russian', code: 'ru-RU', flag: '🇷🇺' },
    { name: 'Serbian', code: 'sr-RS', flag: '🇷🇸' },
    { name: 'Greek', code: 'el-GR', flag: '🇬🇷' },
    { name: 'Hungarian', code: 'hu-HU', flag: '🇭🇺' },
    { name: 'Chinese (Traditional)', code: 'zh-TW', flag: '🇹🇼' }, 
    { name: 'Japanese', code: 'ja-JP', flag: '🇯🇵' },
    { name: 'Latin', code: 'la', flag: '🏛️' },
    { name: 'Ancient Greek', code: 'grc', flag: '📜' }
];

const LEVELS = [
    { id: 'Beginner', label: 'A1-A2' },
    { id: 'Intermediate', label: 'B1-B2' },
    { id: 'Advanced', label: 'C1-C2' }
];

const getFontStyles = (langName) => {
    if (!langName) return { isCjk: false, fontClass: '' };
    if (langName.includes('Chinese')) return { isCjk: true, fontClass: 'font-zh' };
    if (langName.includes('Japanese')) return { isCjk: true, fontClass: 'font-ja' };
    return { isCjk: false, fontClass: '' };
};

const getApiKey = () => localStorage.getItem('geminiApiKey') || localStorage.getItem('geminiPaidApiKey') || '';

export default function LingoCraft() {
    const [user, setUser] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [activeTab, setActiveTab] = useState('main'); 
    const [historySearch, setHistorySearch] = useState('');

    // Data State
    const [word, setWord] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].name);
    const [selectedLevel, setSelectedLevel] = useState(LEVELS[1].id);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [revealedSentences, setRevealedSentences] = useState(new Set());
    
    // Playback & Layout State
    const [playState, setPlayState] = useState({ index: null, status: 'idle' });
    const [currentIdx, setCurrentIdx] = useState(0);
    const [slideDirection, setSlideDirection] = useState('next');
    const [showSearchOverlay, setShowSearchOverlay] = useState(false);
    const cardRef = useRef(null);

    // Use centralized TTS Hook
    const ttsSystemInstruction = `You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. 
        CRITICAL RULES:
        1. NEVER TRANSLATE. NEVER CONVERSE.
        2. If the text is in English, read it in English.
        3. If the text is in a foreign language, read it in that exact language.
        4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.`;
    const { handleSpeak, stopSpeak } = useGeminiTTS(ttsSystemInstruction);

    // Global Theme Initialization
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

    // Handle Authentication
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
    }, []);

    // Firebase Synchronization
    useEffect(() => {
        if (!user) return;

        const prefsRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('config').doc('preferences');
        const unsubPrefs = prefsRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data.language) setSelectedLanguage(data.language);
                if (data.level) setSelectedLevel(data.level);
            }
        });

        const historyRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history');
        const unsubHistory = historyRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
                setHistory(docSnap.data().items || []);
            }
        });

        return () => { unsubPrefs(); unsubHistory(); };
    }, [user]);

    const handlePrefChange = async (type, value) => {
        if (!user) return;
        if (type === 'language') setSelectedLanguage(value);
        if (type === 'level') setSelectedLevel(value);
        
        try {
            await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('config').doc('preferences').set({
                [type]: value
            }, { merge: true });
        } catch (e) { console.error(e) }
    };

    const handleGenerate = async (e, customWord = null) => {
        if (e) e.preventDefault();
        const queryWord = (customWord || word).trim();
        if (!queryWord || !user) return;

        const apiKey = getApiKey();
        if (!apiKey) {
            setError("No Gemini API Key found. Please add it in your Hub settings.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        stopSpeak();
        setPlayState({ index: null, status: 'idle' });
        
        // Reset Layout States
        setCurrentIdx(0);
        setRevealedSentences(new Set()); 

        setWord('');

        const langObj = LANGUAGES.find(l => l.name === selectedLanguage);
        
        const responseSchema = {
            type: "OBJECT",
            properties: {
                word: { type: "STRING" },
                partOfSpeech: { type: "STRING" },
                ipa: { type: "STRING" },
                definitionEnglish: { type: "STRING" },
                sentences: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        original: { type: "STRING" },
                        transcription: { type: "STRING" },
                        englishTranslation: { type: "STRING" },
                        explanation: { type: "STRING" }
                    },
                    required: ["original", "englishTranslation", "explanation"]
                }
                }
            },
            required: ["word", "partOfSpeech", "ipa", "definitionEnglish", "sentences"]
        };

        const systemInstruction = `You are a professional linguist and polyglot educator. Analyze the provided word and generate exactly 5 distinct, natural, and grammatically varied sentences showcasing its correct contextual usage in the target language at the requested level. 
        1. Provide a reliable International Phonetic Alphabet (IPA) representation.
        2. If the target language utilizes a non-Latin script, you MUST provide an accurate Latin character transliteration/phonetic transcription in the 'transcription' field. If it uses a Latin script, leave the 'transcription' field empty.
        3. IMPORTANT: If the target language is Chinese, you MUST use Traditional Chinese characters (繁體中文) exclusively, and provide Pinyin in the 'transcription' field.
        4. IMPORTANT: If the target language is Serbian, you MUST use Serbian Cyrillic exclusively.
        5. Ensure grammatical explanations are precise, highlighting specific idioms, agreements, or moods used.`;

        const promptText = `Analyze the word "${queryWord}" in the context of the "${langObj.name}" language at a "${selectedLevel}" level. Generate 5 accurate example sentences.`;

        const payload = {
            contents: [{ parts: [{ text: promptText }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { 
                responseMimeType: "application/json", 
                responseSchema: responseSchema,
                thinkingConfig: { thinkingLevel: "HIGH" } 
            }
        };

        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error("API Connection Failed");

            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) throw new Error("Empty response received.");

            const parsedResult = JSON.parse(rawText);
            const enrichedResult = {
                ...parsedResult,
                id: Date.now().toString(),
                targetLanguage: langObj,
                level: selectedLevel,
                timestamp: Date.now()
            };

            setResult(enrichedResult);
            setActiveTab('main');

            const newHistory = [enrichedResult, ...history.filter(h => h.word.toLowerCase() !== enrichedResult.word.toLowerCase() || h.targetLanguage.name !== enrichedResult.targetLanguage.name)].slice(0, 40);
            setHistory(newHistory);
            
            await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history').set({ items: newHistory });

        } catch (err) {
            console.error(err);
            setError("Unable to generate contexts. Please check your connection or try again later.");
        } finally {
            setLoading(false);
        }
    };

    const deleteHistoryItem = async (id, e) => {
        if (!user) return;
        e.stopPropagation();
        const newHistory = history.filter(item => item.id !== id);
        setHistory(newHistory);
        try {
            await db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('data').doc('history').set({ items: newHistory });
        } catch (e) {}
        if (result && result.id === id) setResult(null);
    };

    const loadHistoryItem = (item) => {
        setResult(item);
        setWord('');
        setSelectedLanguage(item.targetLanguage.name);
        setSelectedLevel(item.level);
        setCurrentIdx(0);
        setRevealedSentences(new Set([0, 1, 2, 3, 4]));
        setActiveTab('main');
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    const getTTSText = (item, langName) => {
        if (langName === 'English') return [item.original];
        return [item.original, item.englishTranslation, item.original];
    };

    const toggleAudio = (item, index, langName) => {
        if (playState.index === index && playState.status === 'playing') {
            stopSpeak();
            setPlayState({ index: null, status: 'idle' });
            return;
        }

        stopSpeak();
        setPlayState({ index, status: 'loading' });
        
        // Immediately reveal
        setRevealedSentences(prev => new Set(prev).add(index));

        const ttsText = getTTSText(item, langName);

        handleSpeak(
            ttsText,
            () => {
                setPlayState({ index: null, status: 'idle' });
            },
            () => {
                setPlayState({ index: null, status: 'idle' });
                setError("Audio generation failed for this sentence.");
            }
        );
        
        setTimeout(() => setPlayState(prev => prev.index === index ? { index, status: 'playing' } : prev), 300);
    };

    // --- Navigation Logic for Cards ---
    const handleNext = useCallback(() => {
        if (result && currentIdx < result.sentences.length - 1) {
            stopSpeak();
            setPlayState({ index: null, status: 'idle' });
            setSlideDirection('next');
            setCurrentIdx(prev => prev + 1);
        }
    }, [currentIdx, result, stopSpeak]);

    const handlePrev = useCallback(() => {
        if (result && currentIdx > 0) {
            stopSpeak();
            setPlayState({ index: null, status: 'idle' });
            setSlideDirection('prev');
            setCurrentIdx(prev => prev - 1);
        }
    }, [currentIdx, result, stopSpeak]);

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

    // Handle global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Hitting Escape should close the pop-up, even when typing in input
            if (e.key === 'Escape') {
                setShowSearchOverlay(false);
                return;
            }

            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

            const scrollContainer = cardRef.current?.querySelector('.overflow-y-auto');

            switch (e.key) {
                case 'ArrowRight':
                case 'w':
                case 'W':
                case 'd':
                case 'D':
                    if (result) handleNext();
                    break;
                case 'ArrowLeft':
                case 'q':
                case 'Q':
                case 'a':
                case 'A':
                    if (result) handlePrev();
                    break;
                case 'ArrowDown':
                    if (scrollContainer) {
                        e.preventDefault();
                        scrollContainer.scrollBy({ top: 100, behavior: 'smooth' });
                    }
                    break;
                case 'ArrowUp':
                    if (scrollContainer) {
                        e.preventDefault();
                        scrollContainer.scrollBy({ top: -100, behavior: 'smooth' });
                    }
                    break;
                case 's':
                case 'S':
                    e.preventDefault();
                    setWord(''); // Empty search bar
                    setShowSearchOverlay(prev => !prev);
                    break;
                case ' ':
                    if (result) {
                        e.preventDefault();
                        toggleAudio(result.sentences[currentIdx], currentIdx, result.targetLanguage.name);
                    }
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, result, currentIdx, handleNext, handlePrev]);

    const { isCjk, fontClass } = getFontStyles(result?.targetLanguage?.name);
    const isTargetEnglish = result?.targetLanguage?.name === 'English';
    const isNoBlurLang = result?.targetLanguage?.name === 'Latin' || result?.targetLanguage?.name === 'Ancient Greek' || result?.targetLanguage?.name === 'Serbian';

    const filteredHistory = history.filter(i => 
        i.word.toLowerCase().includes(historySearch.toLowerCase()) || 
        i.targetLanguage.name.toLowerCase().includes(historySearch.toLowerCase())
    );

    if (!user) return null;

    const showCardLayout = activeTab === 'main' && result && !loading;
    const currentSentence = result?.sentences?.[currentIdx];
    const isRevealed = isNoBlurLang || revealedSentences.has(currentIdx);
    const isPlaying = playState.index === currentIdx && playState.status === 'playing';
    const isLoadingAudio = playState.index === currentIdx && playState.status === 'loading';

    // Search bar is visible only on main launch screen (when result & loading are absent)
    const showDefaultSearchBar = activeTab === 'main' && !result && !loading;

    return (
        <div className={`flex flex-col transition-colors duration-300 ${showCardLayout ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
            <style dangerouslySetInnerHTML={{__html: `
              @import url('https://db.onlinewebfonts.com/c/fe4f9dac99fb6b607c03981e6ce16869?family=DFKai-SB');
              @import url('https://db.onlinewebfonts.com/c/947e00387f802f409bd2f3e74b9c0730?family=HGSKyokashotai');
              .font-zh { font-family: 'DFKai-SB', sans-serif !important; }
              .font-ja { font-family: 'HGSKyokashotai', sans-serif !important; }
              html, body { scrollbar-width: none; -ms-overflow-style: none; }
              html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
              .no-scrollbar::-webkit-scrollbar { display: none !important; }
              .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            `}} />

            {/* TOP NAVIGATION BAR */}
            <nav className={`shrink-0 z-50 sticky top-0 backdrop-blur-md shadow-sm border-b ${isDarkMode ? 'bg-zinc-950/85 border-zinc-800' : 'bg-white/85 border-stone-200'}`}>
                <div className="max-w-5xl mx-auto px-4 py-2 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link 
                            to="/" 
                            className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                            title="Back to Hub"
                        >
                            <ArrowLeft size={16} />
                        </Link>

                        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => { setActiveTab('main'); setResult(null); }}>
                            <div className={`p-1.5 sm:p-2 rounded-xl border flex items-center justify-center ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                <Globe size={18} className="sm:w-5 sm:h-5" />
                            </div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-none">LingoCraft</h1>
                                <p className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider mt-0.5 hidden sm:block ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Context Generator</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Search Icon on Header - resets search input state upon toggle */}
                        {(result || loading) && (
                            <button 
                                onClick={() => { setWord(''); setShowSearchOverlay(!showSearchOverlay); }} 
                                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-full border transition-all active:scale-95 ${showSearchOverlay ? 'bg-blue-600 text-white border-blue-600' : isDarkMode ? 'bg-zinc-900 border-zinc-800 text-blue-400 hover:bg-zinc-800' : 'bg-white border-stone-200 text-blue-600 hover:bg-stone-50'}`}
                                title="Search Word"
                            >
                                <Search size={16} />
                            </button>
                        )}

                        <button 
                            onClick={() => { setActiveTab(activeTab === 'history' ? 'main' : 'history'); setShowSearchOverlay(false); }} 
                            className={`p-1.5 sm:p-2 rounded-lg sm:rounded-full border transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-blue-600 text-white border-blue-600' : isDarkMode ? 'bg-zinc-900 border-zinc-800 text-blue-400 hover:bg-zinc-800' : 'bg-white border-stone-200 text-blue-600 hover:bg-stone-50'}`}
                        >
                            <History size={16} /> <span className="hidden sm:inline">History</span>
                        </button>
                    </div>
                </div>

                {/* APP LAUNCH PERSISTENT SEARCH BAR */}
                {showDefaultSearchBar && (
                    <div className={`border-t py-2 sm:py-3 ${isDarkMode ? 'border-zinc-800 bg-zinc-900/30' : 'border-stone-200 bg-stone-50/50'}`}>
                        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                                <input
                                    type="text"
                                    value={word}
                                    onChange={(e) => setWord(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                    placeholder="Enter target word..."
                                    className={`w-full pl-9 sm:pl-10 pr-4 py-1.5 sm:py-2.5 rounded-xl border text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder-zinc-500' : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'}`}
                                />
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={selectedLanguage}
                                    onChange={(e) => handlePrefChange('language', e.target.value)}
                                    className={`flex-1 sm:min-w-[100px] px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold text-xs sm:text-sm ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.flag} {l.name}</option>)}
                                </select>
                                <select 
                                    value={selectedLevel}
                                    onChange={(e) => handlePrefChange('level', e.target.value)}
                                    className={`flex-1 sm:min-w-[80px] px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold text-xs sm:text-sm ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                                </select>
                                <button
                                    onClick={(e) => handleGenerate(e)}
                                    disabled={loading || !word.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-500 disabled:opacity-50 text-white font-bold py-1.5 sm:py-2.5 px-3 sm:px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    <span className="hidden sm:inline">Generate</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* OVERLAID SEARCH POP-UP PANEL - Center Aligned on Desktop */}
            {showSearchOverlay && (
                <div className="fixed inset-0 z-[100] bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowSearchOverlay(false)}>
                    <div 
                        className={`absolute top-16 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[480px] p-4 rounded-2xl border shadow-xl z-50 animate-in slide-in-from-top-4 duration-200 ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                                <input
                                    type="text"
                                    value={word}
                                    onChange={(e) => setWord(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleGenerate();
                                            setShowSearchOverlay(false);
                                        }
                                    }}
                                    placeholder="Enter target word..."
                                    className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder-zinc-500' : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'}`}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={selectedLanguage}
                                    onChange={(e) => handlePrefChange('language', e.target.value)}
                                    className={`flex-1 px-3 py-2 rounded-xl border focus:outline-none text-xs font-semibold ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.flag} {l.name}</option>)}
                                </select>
                                <select 
                                    value={selectedLevel}
                                    onChange={(e) => handlePrefChange('level', e.target.value)}
                                    className={`flex-1 px-3 py-2 rounded-xl border focus:outline-none text-xs font-semibold ${isDarkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={(e) => {
                                    handleGenerate(e);
                                    setShowSearchOverlay(false);
                                }}
                                disabled={loading || !word.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Generate Context</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'main' ? (
                <main className={`flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 ${showCardLayout ? 'flex flex-col min-h-0 pt-3 pb-3' : 'py-8'}`}>
                    
                    {error && (
                        <div className="p-3 sm:p-4 mb-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="font-medium text-sm">{error}</p>
                        </div>
                    )}

                    {!result && !loading && (
                        <div className={`p-12 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center min-h-[400px] ${isDarkMode ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-stone-200'}`}>
                            <BookOpen className={`w-16 h-16 mb-4 opacity-20 ${isDarkMode ? 'text-zinc-400' : 'text-stone-400'}`} />
                            <h2 className="text-2xl font-bold mb-2">No Context Active</h2>
                            <p className={`max-w-md text-sm leading-relaxed mb-8 ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                                Enter a word in the toolbar above, configure your target language and difficulty, and map it into distinct grammatical structures.
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="p-12 flex flex-col items-center justify-center min-h-[400px] flex-1">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative" />
                            </div>
                            <p className={`mt-6 font-medium animate-pulse ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>Assembling linguistic context...</p>
                        </div>
                    )}

                    {showCardLayout && (
                        <>
                            {/* 1. TOP CARD (Remains rigid and unscrollable) */}
                            <div className={`shrink-0 p-4 mb-2 sm:mb-3 rounded-2xl border shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-start gap-3 ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                                <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <h2 className={`truncate ${isCjk ? 'text-3xl font-normal' : 'text-2xl sm:text-3xl font-extrabold tracking-tight'} ${fontClass}`}>
                                            {result.word}
                                        </h2>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shrink-0 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                            {result.partOfSpeech}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-lg border shrink-0 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-stone-100 border-stone-200 text-stone-600'}`}>
                                            {result.ipa}
                                        </span>
                                    </div>
                                    <p className={`text-sm sm:text-base font-medium leading-snug ${isDarkMode ? 'text-zinc-300' : 'text-stone-600'}`}>
                                        {result.definitionEnglish}
                                    </p>
                                </div>
                                <div className="flex gap-4 shrink-0 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-inherit">
                                    <div className="flex items-center sm:items-end flex-row sm:flex-col gap-2 sm:gap-0.5 w-full sm:w-auto justify-between sm:justify-center">
                                        <div className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Target</div>
                                        <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                                            <span>{result.targetLanguage.flag}</span> {result.targetLanguage.name}
                                        </div>
                                        <div className="text-xs sm:text-sm font-bold text-blue-500 flex items-center gap-1.5">
                                            <span className={`w-1 h-1 rounded-full bg-current opacity-50 sm:hidden`}></span>
                                            {result.level}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. COMPACT NAVIGATION PAGINATOR BAR (Vertically placed between cards) */}
                            <div className={`shrink-0 p-1 sm:p-1.5 mb-2 sm:mb-3 rounded-xl flex items-center justify-between gap-1 border shadow-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                                <button 
                                    onClick={handlePrev} 
                                    disabled={currentIdx === 0} 
                                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentIdx === 0 ? 'opacity-30 cursor-not-allowed border-transparent' : (isDarkMode ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-stone-105 text-stone-800')}`}
                                >
                                    <ChevronLeft size={14} /> <span className="hidden sm:inline">Prev</span>
                                </button>
                                
                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-1 w-full justify-center">
                                    {result.sentences.map((_, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => { stopSpeak(); setSlideDirection(idx > currentIdx ? 'next' : 'prev'); setCurrentIdx(idx); }} 
                                            className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${currentIdx === idx ? (isDarkMode ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm') : (isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800')}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    ))}
                                </div>

                                <button 
                                    onClick={handleNext} 
                                    disabled={currentIdx === result.sentences.length - 1} 
                                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${currentIdx === result.sentences.length - 1 ? 'opacity-30 cursor-not-allowed border-transparent' : (isDarkMode ? 'bg-zinc-800 border-zinc-700 text-blue-400 hover:bg-zinc-700' : 'bg-white border-stone-300 text-blue-600 hover:bg-stone-50')}`}
                                >
                                    <span className="hidden sm:inline">Next</span> <ChevronRight size={14} />
                                </button>
                            </div>

                            {/* 3. INTERNALLY SCROLLABLE CONTEXT CARD */}
                            <div className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-sm border overflow-hidden relative ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                                <div {...swipeHandlers} ref={setRefs} className="flex-1 min-h-0 relative touch-pan-y flex flex-col w-full">
                                    <div key={currentIdx} className={`absolute inset-0 flex flex-col animate-in duration-300 fill-mode-both ${slideDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}>
                                        
                                        {/* This container dynamically takes full space and handles overflow scrolling */}
                                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-8 no-scrollbar flex flex-col justify-start pt-6">
                                            
                                            <div className="relative min-h-[140px] flex flex-col justify-start">
                                                <div className={`transition-all ${!isRevealed ? 'duration-0 blur-md opacity-40 select-none pointer-events-none' : 'duration-700 blur-0 opacity-100'} space-y-4`}>
                                                    
                                                    <div>
                                                        <p className={`leading-tight ${isCjk ? 'text-2xl sm:text-3xl font-normal tracking-wide' : 'text-xl sm:text-2xl font-bold'} ${fontClass} ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                                                            {currentSentence.original}
                                                        </p>
                                                        {currentSentence.transcription && currentSentence.transcription !== currentSentence.original && (
                                                            <p className={`text-base italic font-medium mt-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                                                                {currentSentence.transcription}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {!isTargetEnglish && (
                                                        <div className={`p-4 rounded-xl border mt-4 ${isDarkMode ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-stone-50 border-stone-100'}`}>
                                                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Translation</div>
                                                            <p className={`text-sm sm:text-base font-medium ${isDarkMode ? 'text-zinc-300' : 'text-stone-600'}`}>{currentSentence.englishTranslation}</p>
                                                        </div>
                                                    )}

                                                    {/* EXPLANATION BLOCK WITH SEPARATE HEADER LINE */}
                                                    <div className="mt-4 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 flex flex-col gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Sparkles className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Explanation</span>
                                                        </div>
                                                        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-stone-600'}`}>
                                                            {currentSentence.explanation}
                                                        </p>
                                                    </div>
                                                </div>

                                                {!isRevealed && (
                                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                                        <button 
                                                            onClick={() => toggleAudio(currentSentence, currentIdx, result.targetLanguage.name)} 
                                                            className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg text-sm sm:text-base font-bold border transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                                        >
                                                            {isLoadingAudio ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />} Play to Reveal
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                        </div>

                                        {/* COMPACT BOTTOM BAR */}
                                        <div className={`shrink-0 flex items-center justify-between py-2 px-3 border-t ${isDarkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-stone-105 bg-stone-50/50'}`}>
                                            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                                                Context 0{currentIdx + 1}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleAudio(currentSentence, currentIdx, result.targetLanguage.name)}
                                                    disabled={isLoadingAudio}
                                                    className={`p-1.5 rounded-full border transition-all active:scale-95 shadow-sm ${
                                                        isPlaying 
                                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500 shadow-emerald-500/10' 
                                                            : isDarkMode ? 'bg-zinc-800 border-zinc-700 text-blue-400 hover:text-blue-300 hover:bg-zinc-700' : 'bg-white border-stone-200 text-blue-600 hover:text-blue-700 hover:bg-stone-50'
                                                    }`}
                                                >
                                                    {isLoadingAudio ? <Loader2 size={16} className="animate-spin text-amber-500" /> : isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            ) : (
                <main className="max-w-5xl mx-auto px-4 py-8 animate-in fade-in duration-300 flex-1">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
                        <h2 className={`text-2xl font-extrabold flex items-center gap-3 ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                            <History className="w-6 h-6 text-blue-500" /> Session History
                        </h2>
                        <div className="relative">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Search history..."
                                className={`w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium text-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500' : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'}`}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredHistory.length === 0 ? (
                            <div className={`text-center py-12 text-sm border border-dashed rounded-3xl ${isDarkMode ? 'text-zinc-500 border-zinc-800' : 'text-stone-500 border-stone-200'}`}>
                                {historySearch ? 'No matching items found.' : 'Your generated vocabulary will appear here.'}
                            </div>
                        ) : (
                            filteredHistory.map((item) => {
                                const { isCjk: isHistCjk, fontClass: histFontClass } = getFontStyles(item.targetLanguage.name);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => loadHistoryItem(item)}
                                        className={`group p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${
                                            result?.id === item.id 
                                                ? (isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200')
                                                : (isDarkMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-stone-200 hover:shadow-md hover:border-stone-300')
                                        }`}
                                    >
                                        <div className="truncate pr-4">
                                            <div className={`truncate ${isHistCjk ? 'text-2xl font-normal' : 'text-lg font-bold'} ${histFontClass} ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                                                {item.word}
                                            </div>
                                            <div className={`text-xs mt-1 font-medium flex items-center gap-2 ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                                                <span>{item.targetLanguage.flag} {item.targetLanguage.name}</span>
                                                <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                                                <span>{item.level}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => deleteHistoryItem(item.id, e)}
                                            className={`p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all ${isDarkMode ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400' : 'hover:bg-red-50 text-stone-400 hover:text-red-600'}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </main>
            )}
        </div>
    );
}