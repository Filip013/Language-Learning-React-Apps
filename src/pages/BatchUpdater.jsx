import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { courseConfigs } from '../config/courseConfigs';
import { ArrowLeft, Copy, Save, Database, AlertTriangle, CheckCircle2, FileEdit, Eye, PlusCircle } from 'lucide-react';

const COURSES = Object.keys(courseConfigs).map(key => ({
    id: key,
    label: courseConfigs[key].name,
    config: courseConfigs[key]
}));

export default function BatchUpdater() {
    const [user, setUser] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState('mandarin');
    
    const [originalData, setOriginalData] = useState(null);
    const [allWords, setAllWords] = useState([]);
    const [markdownText, setMarkdownText] = useState('');
    const [pastedMarkdown, setPastedMarkdown] = useState('');
    
    const [changes, setChanges] = useState([]);
    const [isReviewing, setIsReviewing] = useState(false);
    
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
    }, []);

    const fetchDatabase = async () => {
        if (!user) return;
        setIsFetching(true);
        setStatus(null);
        setChanges([]);
        setIsReviewing(false);
        setPastedMarkdown('');

        try {
            const config = courseConfigs[selectedCourseId];
            const dbAppId = config.dbAppId;
            const docName = config.lexiconDoc || 'lexicon';
            
            const docRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
            const snap = await docRef.get();
            
            if (!snap.exists) {
                setStatus({ type: 'error', msg: `No lexicon found for ${config.name}.` });
                setMarkdownText('');
                setOriginalData(null);
                setAllWords([]);
            } else {
                const data = snap.data();
                setOriginalData(data);
                
                let flattened = [];
                Object.keys(data).forEach(listKey => {
                    if (Array.isArray(data[listKey])) {
                        data[listKey].forEach((wordItem, index) => {
                            // Handle legacy strings (common in Mandarin HSK lists)
                            if (typeof wordItem === 'string') {
                                flattened.push({
                                    id: `str_${index}_${Math.random().toString(36).substring(7)}`,
                                    word: wordItem,
                                    [config.primaryTextKey || 'word']: wordItem,
                                    _originalList: listKey,
                                    _originalType: 'string',
                                    _originalIndex: index
                                });
                            } 
                            // Handle standard objects
                            else if (typeof wordItem === 'object' && wordItem !== null) {
                                if (!wordItem.id) wordItem.id = `dict_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                                flattened.push({ ...wordItem, _originalList: listKey, _originalType: 'object' });
                            }
                        });
                    }
                });
                
                setAllWords(flattened);
                generateMarkdown(flattened, config);
                setStatus({ type: 'success', msg: `Successfully fetched ${flattened.length} words.` });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: `Fetch failed: ${err.message}` });
        } finally {
            setIsFetching(false);
        }
    };

    const cleanCell = (str) => {
        if (!str) return '';
        return String(str).replace(/\|/g, '/').replace(/\n/g, ' ').trim();
    };

    const generateMarkdown = (words, config) => {
        const primaryKey = config.primaryTextKey || 'word';
        let md = `| ID | List | Target | English | POS |\n`;
        md += `|---|---|---|---|---|\n`;
        
        words.forEach(w => {
            const target = cleanCell(w[primaryKey] || w.word);
            const en = cleanCell(w.english || w.meaning || w.translation);
            const pos = cleanCell(w.pos);
            const id = cleanCell(w.id);
            const listKey = cleanCell(w._originalList);
            
            md += `| ${id} | ${listKey} | ${target} | ${en} | ${pos} |\n`;
        });
        
        setMarkdownText(md);
    };

    const handleCopyPrompt = () => {
        const prompt = `I have a Markdown table containing my language learning lexicon. Please analyze it and strictly fix any inconsistent 'POS' (Part of Speech) column tags to be uniform (e.g., 'noun', 'verb', 'adjective', 'adverb', 'phrase', 'conjunction', 'pronoun', 'particle', 'measure word'). 

RULES:
1. Do NOT add or remove any rows or columns for existing words.
2. Preserve all IDs, Lists, Target words, and English translations exactly as they are.
3. IF I asked you to add NEW words, add them as new rows at the bottom of the table. For new words, set the ID column to "NEW" and the List column to "accumulated".
4. Only output the raw, modified Markdown table so I can paste it back.

Here is the table:\n\n${markdownText}`;

        navigator.clipboard.writeText(prompt);
        setStatus({ type: 'success', msg: 'Prompt + Markdown Table copied to clipboard!' });
    };

    const handleReviewChanges = () => {
        if (!pastedMarkdown.trim()) return;
        const config = courseConfigs[selectedCourseId];
        const primaryKey = config.primaryTextKey || 'word';
        
        try {
            // Filter out empty lines, headers, and separator lines
            const lines = pastedMarkdown.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && !l.includes('|---|') && !l.toLowerCase().includes('| id |'));
            
            const parsedList = lines.map(line => {
                const cols = line.split('|').map(c => c.trim());
                return {
                    id: cols[1],
                    _originalList: cols[2],
                    target: cols[3],
                    english: cols[4],
                    pos: cols[5]
                };
            }).filter(item => item.target); // Ensure there's actually a target word

            const detectedChanges = [];

            parsedList.forEach(parsedWord => {
                const isNew = !parsedWord.id || parsedWord.id.toUpperCase() === 'NEW';
                const origWord = allWords.find(w => w.id === parsedWord.id);

                if (isNew || (!origWord && parsedWord.target)) {
                    // Treat as an ADDITION
                    detectedChanges.push({
                        type: 'add',
                        id: 'NEW',
                        targetList: parsedWord._originalList || 'accumulated', // Default to accumulated
                        wordDisplay: parsedWord.target,
                        diffs: {
                            target: { from: null, to: parsedWord.target },
                            english: { from: null, to: parsedWord.english },
                            pos: { from: null, to: parsedWord.pos }
                        }
                    });
                } else if (origWord) {
                    // Treat as a MODIFICATION (Upgrade string -> object or object -> object)
                    let diffs = {};
                    
                    // Legacy string upgrade detection
                    const isLegacyString = origWord._originalType === 'string';
                    
                    const origTarget = origWord[primaryKey] || origWord.word || '';
                    const origEn = origWord.english || origWord.meaning || origWord.translation || '';
                    const origPos = origWord.pos || '';

                    if (origTarget !== parsedWord.target || isLegacyString) diffs.target = { from: origTarget, to: parsedWord.target };
                    if (origEn !== parsedWord.english || isLegacyString) diffs.english = { from: origEn, to: parsedWord.english };
                    if (origPos !== parsedWord.pos || isLegacyString) diffs.pos = { from: origPos, to: parsedWord.pos };

                    if (Object.keys(diffs).length > 0) {
                        detectedChanges.push({
                            type: 'modify',
                            id: parsedWord.id,
                            wordDisplay: origTarget,
                            isLegacyString: isLegacyString,
                            diffs
                        });
                    }
                }
            });

            setChanges(detectedChanges);
            setIsReviewing(true);
            
            const additions = detectedChanges.filter(c => c.type === 'add').length;
            const modifications = detectedChanges.filter(c => c.type === 'modify').length;
            
            if (detectedChanges.length === 0) {
                setStatus({ type: 'success', msg: 'No changes detected. Everything matches the database.' });
            } else {
                setStatus({ type: 'success', msg: `Found ${modifications} modifications and ${additions} new additions.` });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: `Error parsing markdown: Check for formatting issues.` });
        }
    };

    const handleSave = async () => {
        if (!user || changes.length === 0) return;
        setIsSaving(true);
        setStatus(null);

        try {
            const config = courseConfigs[selectedCourseId];
            const primaryKey = config.primaryTextKey || 'word';
            let updatedData = JSON.parse(JSON.stringify(originalData || {})); 

            changes.forEach(change => {
                if (change.type === 'add') {
                    // Logic for ADDING new words
                    const listKey = change.targetList === 'entries' && !updatedData.entries ? 'accumulated' : change.targetList;
                    
                    if (!updatedData[listKey]) updatedData[listKey] = [];
                    
                    const newObj = {
                        id: `dict_manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        [primaryKey]: change.diffs.target?.to || '',
                        word: change.diffs.target?.to || '',
                        english: change.diffs.english?.to || '',
                        pos: change.diffs.pos?.to || ''
                    };
                    
                    updatedData[listKey].unshift(newObj); // Add to the top of the list
                } 
                else if (change.type === 'modify') {
                    // Logic for MODIFYING (or upgrading) existing words
                    const origWord = allWords.find(w => w.id === change.id);
                    const listKey = origWord._originalList;
                    
                    if (origWord._originalType === 'string') {
                        const idx = origWord._originalIndex;
                        let newObj = {
                            id: origWord.id, // Make the temporary string ID permanent
                            [primaryKey]: change.diffs.target ? change.diffs.target.to : origWord.word,
                            word: change.diffs.target ? change.diffs.target.to : origWord.word,
                        };
                        
                        if (change.diffs.english?.to) newObj.english = change.diffs.english.to;
                        if (change.diffs.pos?.to) newObj.pos = change.diffs.pos.to;
                        
                        updatedData[listKey][idx] = newObj; // Overwrite string with object
                    } else {
                        const idx = updatedData[listKey].findIndex(w => typeof w === 'object' && w !== null && w.id === change.id);
                        if (idx !== -1) {
                            if (change.diffs.target?.to) {
                                updatedData[listKey][idx][primaryKey] = change.diffs.target.to;
                                updatedData[listKey][idx].word = change.diffs.target.to;
                            }
                            if (change.diffs.english?.to !== undefined) updatedData[listKey][idx].english = change.diffs.english.to;
                            if (change.diffs.pos?.to !== undefined) updatedData[listKey][idx].pos = change.diffs.pos.to;
                        }
                    }
                }
            });

            const dbAppId = config.dbAppId;
            const docName = config.lexiconDoc || 'lexicon';
            const docRef = db.collection('artifacts').doc(dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
            
            await docRef.set(updatedData); // Overwrite entirely to clean out legacy strings
            
            setStatus({ type: 'success', msg: `Successfully applied ${changes.length} updates/additions in ${config.name}!` });
            
            setPastedMarkdown('');
            setChanges([]);
            setIsReviewing(false);
            fetchDatabase(); // Refresh data to get the new true state
            
        } catch (err) {
            setStatus({ type: 'error', msg: `Update failed: ${err.message}` });
            setIsSaving(false);
        }
    };

    if (!user) return <div className="p-10 text-center font-sans">Please sign in from the Home Hub.</div>;

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 transition-colors duration-500 font-sans text-stone-900 dark:text-zinc-100">
            <nav className="border-b px-6 py-4 flex items-center border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <Link to="/" className="flex items-center gap-2 font-bold text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} /> Back to Hub
                </Link>
            </nav>

            <main className="max-w-6xl mx-auto py-10 px-6">
                <header className="mb-8">
                    <h1 className="text-3xl font-extrabold flex items-center gap-3">
                        <Database className="text-emerald-500" size={32} /> Markdown Batch Updater
                    </h1>
                    <p className="text-stone-500 dark:text-zinc-400 mt-2 font-medium">
                        Export your database, fix inconsistences or add new words using an LLM, paste it back, and review the Diff before saving.
                    </p>
                </header>

                {status && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 font-bold text-sm ${
                        status.type === 'error' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' 
                                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                    }`}>
                        {status.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                        {status.msg}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LEFT COLUMN: EXPORT */}
                    <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Database size={20}/> 1. Export Data</h2>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Select Course Lexicon</label>
                            <select 
                                value={selectedCourseId} 
                                onChange={(e) => setSelectedCourseId(e.target.value)}
                                className="w-full border rounded-xl px-4 py-3 text-sm font-bold bg-stone-50 dark:bg-zinc-950 dark:border-zinc-800 outline-none"
                            >
                                {COURSES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>

                        <button 
                            onClick={fetchDatabase} 
                            disabled={isFetching}
                            className="w-full bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 font-bold py-3 rounded-xl mb-4 disabled:opacity-50 transition-transform active:scale-95"
                        >
                            {isFetching ? 'Fetching...' : 'Fetch Database'}
                        </button>

                        <textarea 
                            readOnly 
                            value={markdownText} 
                            placeholder="Markdown table will appear here..."
                            className="w-full h-64 p-4 text-xs font-mono bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl outline-none resize-none whitespace-pre overflow-x-auto"
                        />

                        {markdownText && (
                            <button 
                                onClick={handleCopyPrompt} 
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold py-3 rounded-xl transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                            >
                                <Copy size={18} /> Copy Prompt + Markdown
                            </button>
                        )}
                    </section>


                    {/* RIGHT COLUMN: IMPORT & DIFF */}
                    <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 flex flex-col">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileEdit size={20}/> 2. Import & Review</h2>
                        
                        {!isReviewing ? (
                            <>
                                <div className="mb-4 text-sm text-stone-500 dark:text-zinc-400">
                                    Paste the updated Markdown table here.
                                </div>
                                <textarea 
                                    value={pastedMarkdown} 
                                    onChange={(e) => setPastedMarkdown(e.target.value)}
                                    placeholder="| ID | List | Target | English | POS |&#10;|---|---|---|---|---|"
                                    className="w-full flex-1 min-h-[16rem] p-4 text-xs font-mono bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl outline-none resize-none whitespace-pre overflow-x-auto focus:ring-2 focus:ring-stone-500/30"
                                />
                                <button 
                                    onClick={handleReviewChanges} 
                                    disabled={!pastedMarkdown.trim() || !originalData}
                                    className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-transform active:scale-[0.98] hover:bg-emerald-600"
                                >
                                    <Eye size={18} /> Analyze Changes
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{changes.length} Changes Detected</span>
                                    <button onClick={() => setIsReviewing(false)} className="text-sm font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">Cancel</button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6 max-h-[20rem]">
                                    {changes.map((c, i) => (
                                        <div key={i} className={`p-3 border rounded-xl text-sm ${c.type === 'add' ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40' : 'bg-stone-50 dark:bg-zinc-950 border-stone-200 dark:border-zinc-800'}`}>
                                            <div className="flex items-center gap-2 font-bold text-stone-800 dark:text-zinc-200 mb-2 border-b dark:border-zinc-800/80 pb-1">
                                                {c.type === 'add' && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded tracking-widest uppercase"><PlusCircle size={10} className="inline mr-1" />New</span>}
                                                {c.isLegacyString && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded tracking-widest uppercase">Upgrading</span>}
                                                {c.wordDisplay}
                                            </div>
                                            {Object.entries(c.diffs).map(([key, diff]) => (
                                                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs mb-1">
                                                    <span className="font-bold uppercase tracking-widest text-stone-400 w-16">{key}</span>
                                                    {c.type === 'modify' && (
                                                        <>
                                                            <span className="bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">{diff.from || '(empty)'}</span>
                                                            <span className="text-stone-400">→</span>
                                                        </>
                                                    )}
                                                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded font-bold truncate max-w-[120px] sm:max-w-none">{diff.to || '(empty)'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {changes.length === 0 && (
                                        <div className="p-10 text-center text-stone-500 font-medium border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-xl">
                                            Everything looks exactly the same!
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleSave} 
                                    disabled={isSaving || changes.length === 0}
                                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-transform active:scale-[0.98] hover:bg-emerald-600"
                                >
                                    {isSaving ? 'Applying Changes...' : <><Save size={18} /> Commit Updates to Database</>}
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}