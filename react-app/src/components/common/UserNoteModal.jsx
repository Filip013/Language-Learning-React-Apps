// src/components/common/UserNoteModal.jsx
import React, { useState, useEffect } from 'react';
import { FileText, XCircle } from 'lucide-react';

export default function UserNoteModal({ isDarkMode, isOpen, noteTitle, initialText, onClose, onSave }) {
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
