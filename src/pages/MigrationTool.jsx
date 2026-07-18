import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import firebase, { auth, db } from '../firebase';

const CANVAS_UID = "08417378469304972096";

const APPS_TO_MIGRATE = [
    { id: 'greek-master', name: 'Modern Greek', collections: ['episodes', 'progress'], docs: ['database/lexicon'] },
    { id: 'hungarian-master', name: 'Hungarian', collections: ['episodes', 'progress'], docs: ['database/dictionary'] },
    { id: 'mandarin-master', name: 'Mandarin', collections: ['episodes', 'progress', 'stories'], docs: ['database/lexicon', 'settings/prefs'] },
    { id: 'portuguese-master', name: 'Portuguese', collections: ['episodes', 'progress'], docs: ['database/lexicon'] },
    { id: 'romanian-master', name: 'Romanian', collections: ['episodes', 'progress'], docs: ['database/lexicon'] },
    { id: 'russian-master', name: 'Russian', collections: ['episodes', 'progress'], docs: ['database/lexicon'] },
    { id: 'lingocraft', name: 'LingoCraft', collections: [], docs: ['data/history', 'config/preferences'] }
];

export default function MigrationTool() {
    const [user, setUser] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isActionRunning, setIsActionRunning] = useState(false);
    // Initialize all to false as requested
    const [selectedApps, setSelectedApps] = useState(
        APPS_TO_MIGRATE.reduce((acc, app) => ({ ...acc, [app.id]: false }), {})
    );

    const log = (msg) => setLogs(prev => [...prev, msg]);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
    }, []);

    const toggleApp = (appId) => {
        setSelectedApps(prev => ({ ...prev, [appId]: !prev[appId] }));
    };

    // --- MIGRATE DATA ---
    const runMigration = async () => {
        if (!user) return;
        
        // Ensure at least one is selected
        const anySelected = Object.values(selectedApps).some(v => v);
        if (!anySelected) {
            alert("Please select at least one app to migrate.");
            return;
        }

        setIsActionRunning(true);
        setLogs([]); 
        log(`🚀 Starting migration for Secure Account: ${user.email || 'Hidden Email'}`);

        try {
            for (const app of APPS_TO_MIGRATE) {
                if (!selectedApps[app.id]) {
                    log(`⏭️ Skipping ${app.name}...`);
                    continue;
                }

                log(`\n--- Migrating ${app.name} ---`);
                const oldUserRef = db.collection('artifacts').doc(app.id).collection('users').doc(CANVAS_UID);
                const newUserRef = db.collection('artifacts').doc(app.id).collection('users').doc(user.uid);
                
                let appCount = 0;

                // Migrate Collections
                for (const colName of app.collections) {
                    const snap = await oldUserRef.collection(colName).get();
                    if (!snap.empty) {
                        const promises = snap.docs.map(doc => newUserRef.collection(colName).doc(doc.id).set(doc.data()));
                        await Promise.all(promises);
                        appCount += snap.size;
                        log(`✅ Copied ${snap.size} files in '${colName}'`);
                    }
                }

                // Migrate Specific Documents
                for (const docPath of app.docs) {
                    const [subCol, docId] = docPath.split('/');
                    const docSnap = await oldUserRef.collection(subCol).doc(docId).get();
                    if (docSnap.exists) {
                        await newUserRef.collection(subCol).doc(docId).set(docSnap.data());
                        appCount++;
                        log(`✅ Copied document '${docPath}'`);
                    }
                }

                if (appCount === 0) log(`⚠️ No data found for ${app.name} in holding pen.`);
                else log(`🎉 Successfully migrated ${appCount} total files for ${app.name}.`);
            }

            log("\n🌟 MIGRATION COMPLETELY FINISHED! 🌟");

        } catch (err) {
            log(`❌ ERROR: ${err.message}`);
            console.error(err);
        } finally {
            setIsActionRunning(false);
        }
    };

    // --- DELETE DATA ---
    const deleteOldData = async () => {
        const confirmed = window.confirm("🚨 WARNING: Are you SURE you want to delete all old data from the Canvas Holding Pen? Please make sure you verified your migration was successful first!");
        if (!confirmed) return;

        setIsActionRunning(true);
        setLogs([]);
        log(`🔥 STARTING DELETION OF OLD CANVAS DATA...`);

        try {
            for (const app of APPS_TO_MIGRATE) {
                const oldUserRef = db.collection('artifacts').doc(app.id).collection('users').doc(CANVAS_UID);
                
                // Delete Collections
                for (const colName of app.collections) {
                    const snap = await oldUserRef.collection(colName).get();
                    if (!snap.empty) {
                        const promises = snap.docs.map(doc => doc.ref.delete());
                        await Promise.all(promises);
                        log(`🗑️ Deleted ${snap.size} files in '${app.name}/${colName}'`);
                    }
                }

                // Delete Specific Documents
                for (const docPath of app.docs) {
                    const [subCol, docId] = docPath.split('/');
                    const docRef = oldUserRef.collection(subCol).doc(docId);
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        await docRef.delete();
                        log(`🗑️ Deleted document '${app.name}/${docPath}'`);
                    }
                }
            }

            log("\n✨ DELETION COMPLETE. Canvas Holding Pen is now empty.");

        } catch (err) {
            log(`❌ DELETION ERROR: ${err.message}`);
            console.error(err);
        } finally {
            setIsActionRunning(false);
        }
    };

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950 p-4">
            <p className="text-stone-500 dark:text-zinc-400">Loading authentication...</p>
        </div>
    );

    return (
        <div className="min-h-screen font-sans bg-stone-100 dark:bg-zinc-950 text-stone-900 dark:text-zinc-300 py-12 px-4 transition-colors">
            <div className="max-w-2xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/" className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition-all shadow-sm">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-500">Universal Migration Tool</h1>
                        <p className="text-stone-500 dark:text-zinc-400 text-sm">Move legacy data into your secure Google Account.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 space-y-6">
                    
                    {/* Auth Status */}
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                                {user.isAnonymous ? "⚠️ Warning: Anonymous Session" : "Signed in via Google"}
                            </p>
                            <p className="font-medium text-emerald-900 dark:text-emerald-100">{user.email || "Hidden/Anonymous Email"}</p>
                            <p className="text-xs font-mono text-emerald-700 dark:text-emerald-500 mt-1">UID: {user.uid}</p>
                        </div>
                    </div>

                    {user.isAnonymous && (
                        <p className="text-sm text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            You are currently using an Anonymous browser cache. Please sign out and sign in with Google!
                        </p>
                    )}

                    {/* App Selection */}
                    <div className="border border-stone-200 dark:border-zinc-800 p-6 rounded-2xl bg-stone-50/50 dark:bg-zinc-900/50">
                        <h2 className="font-bold mb-4 dark:text-white">Select Apps to Migrate</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            {APPS_TO_MIGRATE.map(app => (
                                <label key={app.id} className="flex items-center gap-3 p-4 border border-stone-200 dark:border-zinc-700 rounded-xl cursor-pointer bg-white dark:bg-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedApps[app.id]} 
                                        onChange={() => toggleApp(app.id)}
                                        className="w-5 h-5 text-blue-600 bg-stone-100 border-stone-300 rounded focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                                    />
                                    <span className="font-medium dark:text-zinc-200">{app.name}</span>
                                </label>
                            ))}
                        </div>

                        <button 
                            onClick={runMigration} 
                            disabled={isActionRunning}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"
                        >
                            {isActionRunning ? "Processing Migration..." : "Start Migration"}
                        </button>
                    </div>

                    {/* DANGER ZONE */}
                    <div className="border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/10 p-6 rounded-2xl mt-8">
                        <h2 className="font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                            <AlertTriangle size={18} />
                            Danger Zone
                        </h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">Only do this AFTER you have verified that your migration succeeded in the individual apps.</p>
                        <button 
                            onClick={deleteOldData} 
                            disabled={isActionRunning}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-bold py-3 rounded-xl transition-all shadow-sm"
                        >
                            Delete Old Canvas Data
                        </button>
                    </div>

                    {/* Terminal Logs */}
                    <div className="bg-stone-900 dark:bg-black text-emerald-400 p-4 rounded-xl h-64 overflow-y-auto font-mono text-sm shadow-inner whitespace-pre-wrap border border-stone-800 dark:border-zinc-800">
                        {logs.length === 0 ? <span className="opacity-50">Waiting to start...</span> : logs.join('\n')}
                    </div>
                    
                </div>
            </div>
        </div>
    );
}