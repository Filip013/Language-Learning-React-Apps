import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ChevronDown, Globe } from 'lucide-react';
import firebase, { auth, db } from '../firebase';

// --- COURSES DATABASE ---
const ALL_COURSES = [
    { id: "lingocraft", name: "LingoCraft", description: "Advanced multilingual context & grammar generator.", url: "/lingocraft", color: "border-emerald-500", reqKey: "Paid API" },
    { id: "hungarian", name: "Hungarian Master", description: "B1/B2 Reading, Drills, and Vocab with AI Live TTS.", url: "/hungarian", color: "border-blue-500", reqKey: "Free API" },
    { id: "mandarin", name: "Mandarin Master", description: "Character reading, Pinyin, and pronunciation drills.", url: "/mandarin", color: "border-red-500", reqKey: "Free API" },
    { id: "portuguese", name: "Portuguese Master", description: "B1/B2 European Portuguese Reading & Drills.", url: "/portuguese", color: "border-emerald-600", reqKey: "Free API" },
];

// --- API KEY MANAGER ---
const ApiKeyManager = ({ title, description, storageKey, badgeColor, user }) => {
    const [savedKey, setSavedKey] = useState(localStorage.getItem(storageKey) || '');
    const [inputKey, setInputKey] = useState('');

    useEffect(() => {
        if (!user) return;
        const docRef = db.collection('artifacts').doc('hub').collection('users').doc(user.uid);
        docRef.get().then(snap => {
            if (snap.exists && snap.data()[storageKey]) {
                const cloudKey = snap.data()[storageKey];
                localStorage.setItem(storageKey, cloudKey); 
                setSavedKey(cloudKey);
            }
        });
    }, [user, storageKey]);

    const handleSave = async () => {
        if (!inputKey.trim()) return;
        const keyToSave = inputKey.trim();
        
        localStorage.setItem(storageKey, keyToSave);
        setSavedKey(keyToSave);
        setInputKey(''); 
        
        if (user) {
            await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({
                [storageKey]: keyToSave
            }, { merge: true });
        }
    };

    const handleRemove = async () => {
        localStorage.removeItem(storageKey);
        setSavedKey('');
        
        if (user) {
            await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({
                [storageKey]: firebase.firestore.FieldValue.delete()
            }, { merge: true });
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 transition-colors">
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${badgeColor}`}></span>
                <h3 className="text-md font-bold text-stone-800 dark:text-zinc-100">{title}</h3>
            </div>
            <p className="text-stone-500 dark:text-zinc-400 text-sm mb-4">{description}</p>
            
            {savedKey ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 gap-4">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">✅ Key is securely synced to cloud.</span>
                    <button onClick={handleRemove} className="bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 px-4 py-2 rounded-lg text-sm font-bold transition w-full sm:w-auto">Remove</button>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                    <input type="password" value={inputKey} onChange={(e) => setInputKey(e.target.value)} placeholder="AIzaSy..." className="flex-1 border border-stone-300 dark:border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-stone-50 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-500 transition-colors" />
                    <button onClick={handleSave} className="bg-stone-800 dark:bg-zinc-100 hover:bg-stone-900 dark:hover:bg-white text-white dark:text-zinc-900 font-bold px-5 py-2 rounded-xl transition shadow-sm w-full sm:w-auto">Save</button>
                </div>
            )}
        </div>
    );
};

export default function Home() {
    const [user, setUser] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [recentActivity, setRecentActivity] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;
        const unsub = db.collection('artifacts').doc('hub').collection('users').doc(user.uid)
            .onSnapshot(snap => {
                if (snap.exists) setRecentActivity(snap.data().recentAccess || {});
            });
        return () => unsub();
    }, [user]);

    const handleLogin = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(err => alert("Login Failed: " + err.message));
    };

    const handleCourseClick = async (e, course) => {
        e.preventDefault();
        if (user) {
            await db.collection('artifacts').doc('hub').collection('users').doc(user.uid).set({
                recentAccess: { ...recentActivity, [course.id]: Date.now() }
            }, { merge: true });
        }
        navigate(course.url); // Use React Router instead of page reload!
    };

    const sortedCourses = [...ALL_COURSES].sort((a, b) => {
        const timeA = recentActivity[a.id] || 0;
        const timeB = recentActivity[b.id] || 0;
        if (timeA !== timeB) return timeB - timeA; 
        return a.name.localeCompare(b.name); 
    });

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-2xl text-center max-w-sm w-full border border-stone-200 dark:border-zinc-800">
                    <div className="text-6xl mb-6">🌍</div>
                    <h1 className="text-3xl font-bold mb-3 dark:text-white tracking-tight">Language Hub</h1>
                    <p className="text-stone-500 dark:text-zinc-400 mb-8 font-medium">Sign in to access your master databases and lesson history.</p>
                    <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-md active:scale-95 text-lg">
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-12 px-4 animate-in fade-in duration-500">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-500 tracking-tight mb-2">
                        Language Learning Hub
                    </h1>
                    <p className="text-stone-500 dark:text-zinc-400 font-medium">Welcome back, {user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${showSettings ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-white dark:text-zinc-900' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}
                    >
                        <Settings size={16} /> Settings & Keys 
                        <ChevronDown size={16} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => auth.signOut()} className="text-sm font-bold text-red-500 hover:text-red-600 underline px-2">Sign Out</button>
                </div>
            </header>
            
            {showSettings && (
                <div className="bg-stone-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-stone-200 dark:border-zinc-800 mb-10 transition-colors animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold mb-4 text-stone-800 dark:text-zinc-100 flex items-center gap-2">
                        <Settings size={18} /> API Configurations
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ApiKeyManager user={user} title="Free Gemini Key" description="Used for basic TTS and drills in language courses." storageKey="geminiApiKey" badgeColor="bg-blue-500" />
                        <ApiKeyManager user={user} title="Paid Gemini Key" description="Used for Advanced generation and Aoede TTS in LingoCraft." storageKey="geminiPaidApiKey" badgeColor="bg-emerald-500" />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedCourses.map((course, index) => {
                    const isMostRecent = index === 0 && Object.keys(recentActivity).length > 0;
                    return (
                        <a 
                            key={course.id} href={course.url} onClick={(e) => handleCourseClick(e, course)}
                            className={`relative group bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm hover:shadow-xl dark:shadow-black/20 transition-all duration-300 border-t-4 cursor-pointer hover:-translate-y-1 flex flex-col h-full ${course.color}`}
                        >
                            {isMostRecent && (
                                <span className="absolute -top-3 right-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                                    Last Accessed
                                </span>
                            )}
                            <div className="flex justify-between items-start mb-3 mt-2">
                                <h2 className="text-xl font-extrabold text-stone-800 dark:text-zinc-100">{course.name}</h2>
                            </div>
                            <p className="text-stone-500 dark:text-zinc-400 text-sm mb-6 flex-1 leading-relaxed">{course.description}</p>
                            
                            <div className="flex items-center justify-between mt-auto border-t pt-4 dark:border-zinc-800/50">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${course.reqKey === 'Paid API' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'}`}>
                                    Req: {course.reqKey}
                                </span>
                                <div className="text-sm font-bold text-stone-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Open &rarr;
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}