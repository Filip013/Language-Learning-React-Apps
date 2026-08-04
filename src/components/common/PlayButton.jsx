// src/components/common/PlayButton.jsx
import React from 'react';
import { Volume2, Pause, Loader2 } from 'lucide-react';

export default function PlayButton({ isDarkMode, onClick, size = 18, isLoading = false, isPlaying = false }) {
  const colorClasses = isDarkMode ? 'bg-stone-700 text-stone-300 hover:bg-stone-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200';
  return (
    <button disabled={isLoading} onClick={onClick} className={`flex items-center justify-center rounded-full transition-colors p-2 ${colorClasses} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {isLoading ? <Loader2 size={size} className="animate-spin text-amber-500" /> : isPlaying ? <Pause size={size} className="text-amber-500 animate-pulse" /> : <Volume2 size={size} />}
    </button>
  );
}
