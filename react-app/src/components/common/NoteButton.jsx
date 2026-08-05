// src/components/common/NoteButton.jsx
import React from 'react';
import { FileText } from 'lucide-react';

export default function NoteButton({ isDarkMode, hasNote, onClick, size = 18 }) {
  return (
    <button onClick={onClick} title="User Note" className={`flex items-center justify-center rounded-full transition-colors p-2 ${hasNote ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600') : (isDarkMode ? 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-855')}`}>
      <FileText size={size} className={hasNote ? "fill-current opacity-20" : ""} />
    </button>
  );
}
