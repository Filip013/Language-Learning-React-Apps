import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Settings, ChevronDown, Database, Sun, Moon, Globe, LogOut, Wrench } from 'lucide-react';
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
    const [showSettings, setShowSettings] = useState(false);
    const [recentActivity, setRecentActivity] = useState({});
    const [isDarkMode, setIsDarkMode] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const localTheme = localStorage.getItem('lingocraft_theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(localTheme === 'dark' || (!localTheme && systemDark));
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
                <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome back.</h1>
                        <p className="text-stone-500 dark:text-zinc-400 font-medium">Select a master database to continue.</p>
                    </div>
                    <button onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-sm transition-all shadow-sm ${showSettings ? 'bg-stone-800 text-white dark:bg-white dark:text-zinc-900 border-transparent' : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-700'}`}>
                        <Settings size={18} /> API Config <ChevronDown size={16} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                    </button>
                </header>
                
                {showSettings && (
                    <div className="bg-stone-100/50 dark:bg-zinc-900/50 p-6 sm:p-8 rounded-[2rem] border border-stone-200 dark:border-zinc-800 mb-12 animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <ApiKeyManager user={user} title="Free Gemini Key" description="Powers TTS dictation and drills." storageKey="geminiApiKey" />
                            <ApiKeyManager user={user} title="Paid Gemini Key" description="Powers LLM context generation." storageKey="geminiPaidApiKey" />
                        </div>
                        <div className="border-t border-stone-200 dark:border-zinc-800 pt-8 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-100">Service Apps</h3>
                                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Tools for managing internal data.</p>
                            </div>
                            <div className="flex gap-3">
                                <Link to="/batch-updater" className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-5 py-2.5 rounded-2xl transition-transform hover:bg-stone-50 dark:hover:bg-zinc-800 active:scale-95"><Wrench size={16} /> Batch Updater</Link>
                                <Link to="/migrate" className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-5 py-2.5 rounded-2xl transition-transform hover:bg-stone-50 dark:hover:bg-zinc-800 active:scale-95"><Database size={16} /> Data Migration</Link>
                            </div>
                        </div>
                    </div>
                )}

                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4 ml-2">Pinned Courses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {pinnedCourses.map(c => <CourseCard key={c.id} course={c} />)}
                </div>
                
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-4 ml-2 mt-4">Other Languages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                    {dynamicCourses.map(c => <CourseCard key={c.id} course={c} />)}
                </div>
            </main>
        </div>
    );
}