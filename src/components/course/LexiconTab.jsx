// src/components/course/LexiconTab.jsx
import React, { useState, useMemo, useCallback, memo } from 'react';
import { Search, Plus, ChevronDown, Loader2, Edit, Trash2 } from 'lucide-react';
import { db } from '../../firebase';

const removeDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

const LexiconTab = memo(function LexiconTab({ isDarkMode, globalLexicon, user, config }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const [editingWord, setEditingWord] = useState(null);
  const [editListKey, setEditListKey] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editTranslit, setEditTranslit] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [editPos, setEditPos] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newWordTarget, setNewWordTarget] = useState('');
  const [newWordTranslit, setNewWordTranslit] = useState('');
  const [newWordEnglish, setNewWordEnglish] = useState('');
  const [newWordPos, setNewWordPos] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isObjectArray = config.id !== 'mandarin';
  
  const getUniqueId = useCallback((w) => w.id || (typeof w === 'string' ? w : (w.word || w[config.primaryTextKey])), [config.primaryTextKey]);

  const allTaggedWords = useMemo(() => {
    if (!globalLexicon || Object.keys(globalLexicon).length === 0) return [];
    let arr = [];
    
    const existingEntries = globalLexicon.entries || (Array.isArray(globalLexicon) ? globalLexicon : []);
    const existingAcc = globalLexicon.accumulated || [];
    
    if (isObjectArray) {
      const combined = [...existingEntries, ...existingAcc];
      const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
      unique.forEach(w => arr.push({ word: w, listKey: 'entries' }));
    } else {
      const combinedAcc = [...existingAcc, ...existingEntries];
      const uniqueAcc = Array.from(new Map(combinedAcc.map(w => [getUniqueId(w), w])).values());
      uniqueAcc.forEach(w => arr.push({ word: w, listKey: 'accumulated' }));
      
      ['hsk4', 'hsk3', 'hsk2', 'hsk1'].forEach(key => {
        const list = globalLexicon[key] || [];
        list.forEach(w => arr.push({ word: w, listKey: key }));
      });
    }
    
    return arr;
  }, [globalLexicon, isObjectArray, config, getUniqueId]);

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
        'post': 'Postposition', 'suf': 'Suffix', 'noun': 'Nouns', 'verb': 'Verbs',
        'nf': 'Feminine Nouns', 'nm': 'Masculine Nouns', 'nn': 'Neuter Nouns', 'fem': 'Feminine Nouns'
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
        const translit = config.transliterationKey ? removeDiacritics(word[config.transliterationKey] || "") : "";
        const en = removeDiacritics(word.english || word.meaning || word.translation || "");
        return searchRegex.test(target) || searchRegex.test(translit) || searchRegex.test(en);
      });
    }
    return filtered;
  }, [allTaggedWords, activeFilter, searchTerm, duplicateWords, config.primaryTextKey, config.transliterationKey]);

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
        ...(config.transliterationKey ? { [config.transliterationKey]: newWordTranslit.trim() } : {}),
        english: newWordEnglish.trim(),
        pos: newWordPos.trim()
      };

      const docName = config.lexiconDoc || 'lexicon';
      const lexRef = db.collection('lingo-hub').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
      
      const existingEntries = globalLexicon.entries || (Array.isArray(globalLexicon) ? globalLexicon : []);
      const existingAcc = globalLexicon.accumulated || [];

      if (isObjectArray) {
        const combined = [...existingEntries, ...existingAcc];
        const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
        await lexRef.set({ entries: [newEntry, ...unique] }, { merge: true });
      } else {
        const combined = [...existingAcc, ...existingEntries];
        const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
        await lexRef.set({ accumulated: [newEntry, ...unique] }, { merge: true });
      }

      setNewWordTarget(''); setNewWordTranslit(''); setNewWordEnglish(''); setNewWordPos(''); setShowAddForm(false);
    } catch (err) { console.error("Error adding word:", err); } 
    finally { setIsSubmitting(false); }
  };

  const handleOpenEdit = (word, listKey) => {
    setEditingWord(word);
    setEditListKey(listKey);
    setEditTarget(word[config.primaryTextKey] || word.word || '');
    setEditTranslit(config.transliterationKey ? (word[config.transliterationKey] || '') : '');
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
        ...(config.transliterationKey ? { [config.transliterationKey]: editTranslit.trim() } : {}),
        english: editEnglish.trim(),
        pos: editPos.trim()
    };

    const docName = config.lexiconDoc || 'lexicon';
    const lexRef = db.collection('lingo-hub').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    
    const isMatch = (w) => {
        if (w.id && editingWord.id) {
            return w.id === editingWord.id;
        }
        const targetW = w[config.primaryTextKey] || w.word;
        const targetEdit = editingWord[config.primaryTextKey] || editingWord.word;
        return targetW && targetEdit && targetW === targetEdit;
    };

    try {
      const existingEntries = globalLexicon.entries || (Array.isArray(globalLexicon) ? globalLexicon : []);
      const existingAcc = globalLexicon.accumulated || [];

      if (isObjectArray) {
          const combined = [...existingEntries, ...existingAcc];
          const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
          const newList = unique.map(w => isMatch(w) ? updatedWord : w);
          await lexRef.set({ entries: newList }, { merge: true });
      } else {
          if (editListKey === 'accumulated' || editListKey === 'entries') {
              const combined = [...existingAcc, ...existingEntries];
              const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
              const newList = unique.map(w => isMatch(w) ? updatedWord : w);
              await lexRef.set({ accumulated: newList }, { merge: true });
          } else {
              const list = globalLexicon[editListKey] || [];
              const newList = list.map(w => isMatch(w) ? updatedWord : w);
              await lexRef.set({ [editListKey]: newList }, { merge: true });
          }
      }
      setEditingWord(null);
    } catch (err) { console.error(err); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteFromEdit = async () => {
    if (!user || !globalLexicon || !editingWord) return;
    setIsSubmitting(true);
    const docName = config.lexiconDoc || 'lexicon';
    const lexRef = db.collection('lingo-hub').doc(config.dbAppId).collection('users').doc(user.uid).collection('database').doc(docName);
    
    const isMatch = (w) => {
        if (w.id && editingWord.id) {
            return w.id === editingWord.id;
        }
        const targetW = typeof w === 'string' ? w : (w[config.primaryTextKey] || w.word);
        const targetEdit = typeof editingWord === 'string' ? editingWord : (editingWord[config.primaryTextKey] || editingWord.word);
        return targetW && targetEdit && targetW === targetEdit;
    };

    try {
      const existingEntries = globalLexicon.entries || (Array.isArray(globalLexicon) ? globalLexicon : []);
      const existingAcc = globalLexicon.accumulated || [];

      if (isObjectArray) {
          const combined = [...existingEntries, ...existingAcc];
          const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
          const newList = unique.filter(w => !isMatch(w));
          await lexRef.set({ entries: newList }, { merge: true }); 
      } else {
          if (editListKey === 'accumulated' || editListKey === 'entries') {
              const combined = [...existingAcc, ...existingEntries];
              const unique = Array.from(new Map(combined.map(w => [getUniqueId(w), w])).values());
              const newList = unique.filter(w => !isMatch(w));
              await lexRef.set({ accumulated: newList }, { merge: true });
          } else {
              const list = globalLexicon[editListKey] || [];
              const newList = list.filter(w => !isMatch(w));
              await lexRef.set({ [editListKey]: newList }, { merge: true });
          }
      }
      setEditingWord(null);
    } catch (err) { console.error(err); } 
    finally { setIsSubmitting(false); }
  };

  if (!globalLexicon || Object.keys(globalLexicon).length === 0) return <div className="p-20 text-center text-stone-500 font-sans">Loading master lexicon...</div>;

  return (
    <div className="max-w-6xl mx-auto pt-3 md:pt-9 pb-12 px-4 md:px-8 font-sans relative">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
              <Search size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">
              {config.name} Lexicon
            </span>
          </div>
          
          <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 self-center mx-1"></div>

          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className={`flex items-center gap-1 transition-colors text-[10px] uppercase font-bold tracking-wider px-2 py-1 ${
              isDarkMode ? 'text-stone-400 hover:text-amber-400' : 'text-stone-550 hover:text-amber-650'
            }`}
          >
            <Plus size={12} /> Add Word
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
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
          <div className={`grid grid-cols-1 ${config.transliterationKey ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-2.5 mb-3`}>
            <input type="text" placeholder={`Target Word (${config.name})`} value={newWordTarget} onChange={e => setNewWordTarget(e.target.value)} className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-stone-700' : 'bg-white border-stone-200 focus:border-stone-400'}`} />
            {config.transliterationKey && (
              <input type="text" placeholder={`Transliteration (${(config.labels && config.labels[config.transliterationKey]) || config.transliterationKey})`} value={newWordTranslit} onChange={e => setNewWordTranslit(e.target.value)} className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-stone-700' : 'bg-white border-stone-200 focus:border-stone-400'}`} />
            )}
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
                const displayTranslit = (!isString && config.transliterationKey) ? word[config.transliterationKey] : "";
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
                      <div className="flex flex-col">
                        <span className={`${config.fontClass || 'font-sans'} ${config.scriptStyles?.lexiconCard || 'text-base md:text-lg font-semibold'}`}>{displayWord}</span>
                        {displayTranslit && (
                          <span className="text-xs font-sans text-stone-400 dark:text-stone-500 font-normal">{displayTranslit}</span>
                        )}
                      </div>
                      <button onClick={() => handleOpenEdit(word, listKey)} className="p-1.5 rounded-md text-stone-400 hover:text-amber-505 transition-colors ml-2"><Edit size={16} /></button>
                    </div>
                    
                    {(displayEn || pos) && (
                      <div className="text-sm font-sans flex items-center gap-2 mt-1 pt-2 border-t border-stone-100 dark:border-stone-700">
                         {pos && (
                           <span className={`text-[10px] uppercase font-bold tracking-widest px-1.5 rounded border ${
                             pos.toLowerCase().trim() === 'nf' 
                               ? 'text-rose-500 border-rose-500/30 bg-rose-500/10' 
                               : 'text-emerald-500 border border-emerald-500/30 bg-emerald-500/10'
                           }`}>
                             {pos}
                           </span>
                         )}
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

              {config.transliterationKey && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">
                    {(config.labels && config.labels[config.transliterationKey]) || 'Transliteration'}
                  </label>
                  <input type="text" value={editTranslit} onChange={e => setEditTranslit(e.target.value)} className={`w-full px-4 py-3 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} />
                </div>
              )}

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

export default LexiconTab;
