import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Settings, ChevronDown, Database, Sun, Moon, Globe, LogOut, Wrench, Gamepad2, History, XCircle, Trash2, DownloadCloud } from 'lucide-react';
import firebase, { auth, db } from '../firebase';

const ALL_COURSES = [
    { id: "hungarian", name: "Hungarian", url: "/hungarian", color: "hover:border-blue-500", flag: "🇭🇺" },
    { id: "lingocraft", name: "LingoCraft", url: "/lingocraft", color: "hover:border-emerald-500", flag: "🌍" },
    { id: "mandarin", name: "Mandarin", url: "/mandarin", color: "hover:border-red-500", flag: "🇹🇼" },
    { id: "portuguese", name: "Portuguese", url: "/portuguese", color: "hover:border-emerald-600", flag: "🇵🇹" },
    { id: "romanian", name: "Romanian", url: "/romanian", color: "hover:border-indigo-500", flag: "🇷🇴" },
];

const PINNED_ORDER = ["hungarian", "lingocraft", "mandarin"];

const ApiKeyManager = ({ title, description, storageKey, user }) => {
    const [savedKey, setSavedKey] = useState(localStorage.getItem(storageKey) || '');
    const [inputKey, setInputKey] = useState('');

    useEffect(() => {
        if (!user) return;
        db.collection('artifacts').doc('hub').collection('users').doc(user.uid).get().then(snap => {
            if (snap.exists && snap.data()[storageKey]) {
                const cloudKey = snap.data()[storageKey];
                localStorage.setItem(storageKey, cloudKey); 
                setSavedKey(cloudKey);
            }
        });
    }, [user, storageKey]);

    const handleSave = async () => {
        if (!inputKey.trim()) return;
        localStorage.setItem(storageKey, inputKey.trim());
        setSavedKey(inputKey.trim());
        setInputKey(''); 
        if (user) await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({ [storageKey]: inputKey.trim() }, { merge: true });
    };

    const handleRemove = async () => {
        localStorage.removeItem(storageKey);
        setSavedKey('');
        if (user) await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({ [storageKey]: firebase.firestore.FieldValue.delete() }, { merge: true });
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 transition-colors">
            <h3 className="text-md font-bold text-stone-800 dark:text-zinc-100 mb-1">{title}</h3>
            <p className="text-stone-500 dark:text-zinc-400 text-xs mb-4">{description}</p>
            {savedKey ? (
                <div className="flex items-center justify-between bg-stone-50 dark:bg-zinc-950 p-3 rounded-2xl border border-stone-200 dark:border-zinc-800">
                    <span className="text-emerald-600 dark:text-emerald-500 font-bold text-sm flex items-center gap-2">✓ Synced</span>
                    <button onClick={handleRemove} className="text-stone-400 hover:text-red-500 font-bold text-sm transition-colors">Remove</button>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                    <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} placeholder="AIzaSy..." className="flex-1 border rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-stone-500/30 bg-stone-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 outline-none transition-colors" />
                    <button onClick={handleSave} className="bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-bold px-6 py-2.5 rounded-2xl transition-transform active:scale-95">Save</button>
                </div>
            )}
        </div>
    );
};

export default function Home() {
    const [user, setUser] = useState(null);
    const [activePanel, setActivePanel] = useState(null); // null | 'tools' | 'settings'
    const [recentActivity, setRecentActivity] = useState({});
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);

    useEffect(() => {
        if (!user || !isLogModalOpen) return;
        const unsub = db.collection('artifacts').doc('hub').collection('users').doc(user.uid).collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(50) // Fetch the last 50 actions
            .onSnapshot(snap => {
                setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        return () => unsub();
    }, [user, isLogModalOpen]);

    const navigate = useNavigate();

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // 1. On Load: Check if they have a manual preference, otherwise use system
        const localTheme = localStorage.getItem('lingocraft_theme');
        const isDark = localTheme ? localTheme === 'dark' : mediaQuery.matches;
        
        setIsDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        // 2. The OS System Theme just changed (e.g., sunset or sunrise)
        const handleSystemChange = (e) => {
            // Clear their manual override so we resume tracking the system
            localStorage.removeItem('lingocraft_theme'); 
            
            // Update the UI to match the new system theme
            setIsDarkMode(e.matches);
            if (e.matches) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        };

        // Listen for OS changes
        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, []);

    const toggleTheme = () => {
        const newTheme = isDarkMode ? 'light' : 'dark';
        setIsDarkMode(!isDarkMode);
        localStorage.setItem('lingocraft_theme', newTheme);
        if (newTheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        window.dispatchEvent(new Event('theme-changed'));
    };

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;
        const unsub = db.collection('artifacts').doc('hub').collection('users').doc(user.uid).onSnapshot(snap => {
            if (snap.exists) setRecentActivity(snap.data().recentAccess || {});
        });
        return () => unsub();
    }, [user]);

    const handleLogin = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());

    const handleCourseClick = async (e, course) => {
        e.preventDefault();
        if (user) await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({ recentAccess: { ...recentActivity, [course.id]: Date.now() } }, { merge: true });
        navigate(course.url);
    };

    const pinnedCourses = PINNED_ORDER.map(id => ALL_COURSES.find(c => c.id === id)).filter(Boolean);
    const dynamicCourses = ALL_COURSES.filter(c => !PINNED_ORDER.includes(c.id)).sort((a, b) => (recentActivity[b.id] || 0) - (recentActivity[a.id] || 0));
    
    let mostRecentCourseId = null;
    Object.entries(recentActivity).reduce((max, [id, time]) => { if (time > max) { mostRecentCourseId = id; return time; } return max; }, 0);

    const CourseCard = ({ course }) => (
        <a href={course.url} onClick={e => handleCourseClick(e, course)} className={`group flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all border border-stone-200 dark:border-zinc-800 ${course.color} active:scale-[0.98]`}>
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-100 dark:border-zinc-800 text-xl shadow-inner">
                    {course.flag}
                </div>
                <h2 className="text-lg font-bold text-stone-800 dark:text-zinc-100">{course.name}</h2>
            </div>
            <div className="flex items-center gap-3">
                {course.id === mostRecentCourseId && (
                    <span className="bg-stone-100 dark:bg-zinc-800 text-[9px] font-black uppercase tracking-widest text-stone-500 dark:text-zinc-400 px-2 py-1 rounded-md hidden sm:block">Recent</span>
                )}
                <span className="text-stone-300 dark:text-zinc-600 font-bold group-hover:translate-x-1 group-hover:text-stone-500 dark:group-hover:text-zinc-400 transition-all">&rarr;</span>
            </div>
        </a>
    );

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 dark:bg-zinc-950 transition-colors duration-500 font-sans">
            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-sm border border-stone-200 dark:border-zinc-800 text-center max-w-sm w-full">
                <div className="flex justify-center mb-6"><div className="bg-stone-100 dark:bg-zinc-800 p-4 rounded-3xl"><Globe size={40} className="text-stone-800 dark:text-zinc-100" /></div></div>
                <h1 className="text-3xl font-bold mb-3 text-stone-800 dark:text-zinc-100 tracking-tight">Cloud Hub</h1>
                <p className="text-stone-500 dark:text-zinc-400 text-sm mb-8 font-medium">Access your language databases.</p>
                <button onClick={handleLogin} className="w-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 font-bold py-4 rounded-2xl active:scale-95 transition-transform">Sign in to sync</button>
            </div>
        </div>
    );

    const ActivityLogModal = () => {
        if (!isLogModalOpen) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in">
                <div className="w-full max-w-xl h-[80vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
                    
                    <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="bg-stone-100 dark:bg-zinc-800 p-2 rounded-xl">
                                <History size={20} className="text-stone-700 dark:text-zinc-300" />
                            </div>
                            <h3 className="text-xl font-bold text-stone-800 dark:text-zinc-100">Activity Log</h3>
                        </div>
                        <button onClick={() => setIsLogModalOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
                            <XCircle size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50 dark:bg-zinc-950/50">
                        {activityLogs.length === 0 ? (
                            <p className="text-center text-stone-500 dark:text-zinc-500 mt-10 text-sm font-medium">No activity recorded yet.</p>
                        ) : (
                            activityLogs.map(log => (
                                <div key={log.id} className="flex items-start gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm">
                                    <div className={`p-2 rounded-full shrink-0 ${log.action === 'import' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-500' : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-500'}`}>
                                        {log.action === 'import' ? <DownloadCloud size={16} /> : <Trash2 size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                                                {log.courseName}
                                            </span>
                                            <span className="text-xs text-stone-400 dark:text-zinc-500 whitespace-nowrap ml-2">
                                                {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-stone-800 dark:text-zinc-200 truncate">
                                            {log.action === 'import' ? 'Imported' : 'Deleted'}: {log.episodeTitle}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 transition-colors duration-500 font-sans text-stone-900 dark:text-zinc-100">
            <nav className="sticky top-0 z-50 border-b backdrop-blur-md px-6 py-4 flex justify-between items-center border-stone-200/80 dark:border-zinc-800/80 bg-stone-50/80 dark:bg-zinc-950/80">
                <div className="flex items-center gap-3">
                    <div className="bg-stone-800 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 rounded-xl"><Globe size={18} /></div>
                    <span className="font-bold tracking-tight text-lg">Cloud Hub</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 rounded-full border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors">
                        {isDarkMode ? <Sun size={18} className="text-stone-300" /> : <Moon size={18} className="text-stone-600" />}
                    </button>
                    <button onClick={() => auth.signOut()} className="p-2 rounded-full border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-500">
                <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome back.</h1>
                        <p className="text-stone-500 dark:text-zinc-400 font-medium">Select a master database to continue.</p>
                    </div>
                    
                    {/* Toggle Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={() => setActivePanel(activePanel === 'tools' ? null : 'tools')} 
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-sm transition-all shadow-sm ${activePanel === 'tools' ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent' : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-700 dark:text-zinc-300'}`}
                        >
                            <Gamepad2 size={18} /> Games & Tools <ChevronDown size={16} className={`transition-transform ${activePanel === 'tools' ? 'rotate-180' : ''}`} />
                        </button>
                        
                        <button 
                            onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')} 
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-sm transition-all shadow-sm ${activePanel === 'settings' ? 'bg-stone-800 text-white dark:bg-white dark:text-zinc-900 border-transparent' : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-700 text-stone-700 dark:text-zinc-300'}`}
                        >
                            <Settings size={18} /> API & Config <ChevronDown size={16} className={`transition-transform ${activePanel === 'settings' ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </header>
                
                {/* Tools Panel */}
                {activePanel === 'tools' && (
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 sm:p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 mb-12 animate-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Interactive Experiments</h3>
                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1 mb-5">Supplemental learning mini-games and tools.</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <Link to="/character-drill" className="flex flex-col p-5 bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all active:scale-95 group">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                                    <Gamepad2 size={20} />
                                </div>
                                <h4 className="font-bold text-stone-800 dark:text-zinc-100 mb-1">Character Drills</h4>
                                <p className="text-xs text-stone-500 dark:text-zinc-400">AI-generated radical assembly and visual discrimination.</p>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Settings Panel */}
                {activePanel === 'settings' && (
                    <div className="bg-stone-100/50 dark:bg-zinc-900/50 p-6 sm:p-8 rounded-[2rem] border border-stone-200 dark:border-zinc-800 mb-12 animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <ApiKeyManager user={user} title="Free Gemini Key" description="Powers TTS dictation and voice." storageKey="geminiApiKey" />
                            <ApiKeyManager user={user} title="Paid Gemini Key" description="Powers LLM context generation." storageKey="geminiPaidApiKey" />
                        </div>
                        
                        <div className="border-t border-stone-200 dark:border-zinc-800 pt-8">
                            <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-100">Service Apps</h3>
                            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 mb-4">Tools for managing internal master data.</p>
                            <div className="flex gap-3 flex-wrap">
                                <button onClick={() => setIsLogModalOpen(true)} className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-5 py-2.5 rounded-2xl transition-transform hover:bg-stone-50 dark:hover:bg-zinc-800 active:scale-95">
                                    <History size={16} /> Activity Log
                                </button>
                                <Link to="/batch-updater" className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-5 py-2.5 rounded-2xl transition-transform hover:bg-stone-50 dark:hover:bg-zinc-800 active:scale-95"><Wrench size={16} /> Batch Updater</Link>
                                <Link to="/migrate" className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-5 py-2.5 rounded-2xl transition-transform hover:bg-stone-50 dark:hover:bg-zinc-800 active:scale-95"><Database size={16} /> Data Migration</Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Course Grid */}
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4 ml-2">Pinned Courses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {pinnedCourses.map(c => <CourseCard key={c.id} course={c} />)}
                </div>
                
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4 ml-2 mt-4">Other Languages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                    {dynamicCourses.map(c => <CourseCard key={c.id} course={c} />)}
                </div>
            </main>
            <ActivityLogModal />
        </div>
    );
}