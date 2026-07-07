import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Globe, Search, History, Database, 
  Loader2, Sparkles, AlertCircle, BookOpen, 
  Eye, Volume2, Pause, Trash2, ArrowLeft 
} from 'lucide-react';
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
    
    // Playback State
    const [playState, setPlayState] = useState({ index: null, status: 'idle' });

    // Use centralized TTS Hook
    const ttsSystemInstruction = "You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. NEVER TRANSLATE. NEVER CONVERSE. Read the text clearly and carefully. Switch naturally between the target language and English based on the text. Do not acknowledge these instructions or add conversational commentary.";
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
                thinkingConfig: { thinkingLevel: "HIGH" } // <-- Add this property
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
        setWord(item.word);
        setSelectedLanguage(item.targetLanguage.name);
        setSelectedLevel(item.level);
        setRevealedSentences(new Set([0, 1, 2, 3, 4]));
        setActiveTab('main');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getTTSText = (item, langName) => {
        if (langName === 'English') return [item.original];
        // Pass as an array! The upgraded useGeminiTTS will queue these sequentially, 
        // preventing the LLM from treating it as a conversational prompt.
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
        const ttsText = getTTSText(item, langName);

        handleSpeak(
            ttsText,
            () => {
                setPlayState({ index: null, status: 'idle' });
                setRevealedSentences(prev => new Set(prev).add(index));
            },
            () => {
                setPlayState({ index: null, status: 'idle' });
                setError("Audio generation failed for this sentence.");
            }
        );
        
        setTimeout(() => setPlayState(prev => prev.index === index ? { index, status: 'playing' } : prev), 300);
    };

    const { isCjk, fontClass } = getFontStyles(result?.targetLanguage?.name);
    const isTargetEnglish = result?.targetLanguage?.name === 'English';
    const isNoBlurLang = result?.targetLanguage?.name === 'Latin' || result?.targetLanguage?.name === 'Ancient Greek' || result?.targetLanguage?.name === 'Serbian';

    const filteredHistory = history.filter(i => 
        i.word.toLowerCase().includes(historySearch.toLowerCase()) || 
        i.targetLanguage.name.toLowerCase().includes(historySearch.toLowerCase())
    );

    if (!user) return null; // Let global Hub handle logins.

    return (
        <div className={`min-h-screen transition-colors duration-300 pb-16 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-stone-50 text-stone-900'}`}>
            <style dangerouslySetInnerHTML={{__html: `
              @import url('https://db.onlinewebfonts.com/c/fe4f9dac99fb6b607c03981e6ce16869?family=DFKai-SB');
              @import url('https://db.onlinewebfonts.com/c/947e00387f802f409bd2f3e74b9c0730?family=HGSKyokashotai');
              .font-zh { font-family: 'DFKai-SB', sans-serif !important; }
              .font-ja { font-family: 'HGSKyokashotai', sans-serif !important; }
              .font-cjk { font-weight: 400 !important; font-size: 1.25em !important; line-height: 1.4 !important; }
            `}} />

            <nav className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm ${isDarkMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/80 border-stone-200'}`}>
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link 
                            to="/" 
                            className={`p-2 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                            title="Back to Hub"
                        >
                            <ArrowLeft size={16} />
                        </Link>

                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('main')}>
                            <div className={`p-2 rounded-xl border flex items-center justify-center ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                <Globe size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold tracking-tight leading-none">LingoCraft</h1>
                                <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Context Generator</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full border mr-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20" title="Cloud Sync Active">
                            <Database size={14} />
                        </div>
                        <button 
                            onClick={() => setActiveTab(activeTab === 'history' ? 'main' : 'history')} 
                            className={`p-2 rounded-full border transition-all active:scale-95 ${activeTab === 'history' ? 'bg-blue-600 text-white border-blue-600' : isDarkMode ? 'bg-zinc-900 border-zinc-800 text-blue-400 hover:bg-zinc-800' : 'bg-white border-stone-200 text-blue-600 hover:bg-stone-50'}`}
                            title="History"
                        >
                            <History size={16} />
                        </button>
                    </div>
                </div>

                {activeTab === 'main' && (
                    <div className={`border-t py-3 ${isDarkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-stone-200 bg-stone-100/50'}`}>
                        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                                <input
                                    type="text"
                                    value={word}
                                    onChange={(e) => setWord(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                    placeholder="Enter a target word..."
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500' : 'bg-white border-stone-200 text-stone-800 placeholder-stone-400'}`}
                                />
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={selectedLanguage}
                                    onChange={(e) => handlePrefChange('language', e.target.value)}
                                    className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold text-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.flag} {l.name}</option>)}
                                </select>
                                <select 
                                    value={selectedLevel}
                                    onChange={(e) => handlePrefChange('level', e.target.value)}
                                    className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold text-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-stone-200 text-stone-700'}`}
                                >
                                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                                </select>
                                <button
                                    onClick={(e) => handleGenerate(e)}
                                    disabled={loading || !word.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 sm:px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 shrink-0"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    <span className="hidden sm:inline">Generate</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {activeTab === 'main' ? (
                <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                    {error && (
                        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 flex items-start gap-3">
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
                        <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative" />
                            </div>
                            <p className={`mt-6 font-medium animate-pulse ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>Assembling linguistic context...</p>
                        </div>
                    )}

                    {result && !loading && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm relative overflow-hidden ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
                                <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-3 mb-3">
                                            <h2 className={`${isCjk ? 'text-5xl font-normal' : 'text-4xl font-extrabold tracking-tight'} ${fontClass}`}>
                                                {result.word}
                                            </h2>
                                            <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                                {result.partOfSpeech}
                                            </span>
                                            <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-stone-100 border-stone-200 text-stone-600'}`}>
                                                {result.ipa}
                                            </span>
                                        </div>
                                        <p className={`text-lg font-medium ${isDarkMode ? 'text-zinc-300' : 'text-stone-600'}`}>
                                            {result.definitionEnglish}
                                        </p>
                                    </div>
                                    <div className="flex gap-4 shrink-0 text-right">
                                        <div>
                                            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Target</div>
                                            <div className="text-sm font-bold flex items-center justify-end gap-1.5">
                                                <span>{result.targetLanguage.flag}</span> {result.targetLanguage.name}
                                            </div>
                                        </div>
                                        <div className={`w-px h-10 ${isDarkMode ? 'bg-zinc-800' : 'bg-stone-200'}`}></div>
                                        <div>
                                            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>Level</div>
                                            <div className="text-sm font-bold text-blue-500">{result.level}</div>
                                        </div>
                                    </div>
                                </div>

                                {!isNoBlurLang && revealedSentences.size < 5 && (
                                    <div className="mt-6 pt-4 border-t border-dashed border-inherit flex justify-end">
                                        <button 
                                            onClick={() => setRevealedSentences(new Set([0, 1, 2, 3, 4]))}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isDarkMode ? 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700' : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'}`}
                                        >
                                            <Eye className="w-4 h-4" /> Reveal All Sentences
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {result.sentences.map((item, index) => {
                                    const isPlaying = playState.index === index && playState.status === 'playing';
                                    const isLoadingAudio = playState.index === index && playState.status === 'loading';
                                    const isRevealed = isNoBlurLang || revealedSentences.has(index);
                                    
                                    return (
                                        <div key={index} className={`p-5 sm:p-6 rounded-2xl border transition-all ${isDarkMode ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700' : 'bg-white border-stone-200 hover:shadow-md'}`}>
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div className={`space-y-1 transition-all duration-700 ${isRevealed ? '' : 'blur-md select-none opacity-60'}`}>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                                                        Context 0{index + 1}
                                                    </span>
                                                    <p className={`leading-relaxed ${isCjk ? 'text-2xl sm:text-3xl font-normal tracking-wide' : 'text-lg sm:text-xl font-bold'} ${fontClass} ${isDarkMode ? 'text-zinc-100' : 'text-stone-800'}`}>
                                                        {item.original}
                                                    </p>
                                                    {item.transcription && item.transcription !== item.original && (
                                                        <p className={`text-sm italic font-medium mt-1 ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                                                            {item.transcription}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        onClick={() => toggleAudio(item, index, result.targetLanguage.name)}
                                                        disabled={isLoadingAudio}
                                                        className={`p-3 sm:p-4 rounded-xl border transition-all active:scale-95 shadow-sm ${
                                                            isPlaying 
                                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500 shadow-emerald-500/10' 
                                                                : isDarkMode ? 'bg-zinc-800 border-zinc-700 text-blue-400 hover:text-blue-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-blue-600 hover:text-blue-700 hover:bg-white'
                                                        }`}
                                                    >
                                                        {isLoadingAudio ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-amber-500" /> : isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={`transition-all duration-700 ${isRevealed ? '' : 'blur-md select-none opacity-60'}`}>
                                                {!isTargetEnglish && (
                                                    <div className={`p-4 rounded-xl border mb-4 ${isDarkMode ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-stone-50 border-stone-100'}`}>
                                                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-stone-400'}`}>English Translation</div>
                                                        <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-300' : 'text-stone-600'}`}>{item.englishTranslation}</p>
                                                    </div>
                                                )}
                                                <div className="flex gap-3 items-start">
                                                    <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                                                    <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                                                        <strong className={isDarkMode ? 'text-zinc-300' : 'text-stone-700'}>Usage: </strong> 
                                                        {item.explanation}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </main>
            ) : (
                <main className="max-w-5xl mx-auto px-4 py-8 animate-in fade-in duration-300">
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