// src/components/common/AiTranslatePopup.jsx
import React, { useState, useEffect } from 'react';
import { Sparkles, XCircle, Loader2 } from 'lucide-react';
import PlayButton from './PlayButton';
import { fetchGeminiContent } from '../../config/languages';

export default function AiTranslatePopup({ isDarkMode, config = {}, handleSpeak }) {
  const [selectionState, setSelectionState] = useState({ text: '', x: 0, y: 0, showIcon: false, showPanel: false });
  const [aiTranslation, setAiTranslation] = useState({ translation: '', transliteration: '', grammar: '', isLoading: false, error: '' });

  useEffect(() => {
    const handleSelection = () => {
      if (document.activeElement?.closest('#ai-translate-panel')) return;

      const selection = window.getSelection();
      if (!selection) return;

      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const text = selection.toString().trim();

      if (text.length > 0 && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          const lastRect = rects.length > 0
            ? Array.from(rects).reduce((max, r) => (r.bottom > max.bottom ? r : max))
            : range.getBoundingClientRect();

          if (lastRect.width > 0 && lastRect.height > 0) {
            setSelectionState(prev => {
              if (prev.showPanel) return prev;
              return {
                text,
                x: lastRect.left + (lastRect.width / 2),
                y: lastRect.bottom,
                showIcon: true,
                showPanel: false
              };
            });
          }
        } catch (err) {}
      } else {
        setSelectionState(prev => (prev.showPanel ? prev : { ...prev, showIcon: false }));
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setSelectionState(prev => ({ ...prev, showIcon: false, showPanel: false }));
      }
    };

    const handleClickOutside = (e) => {
      if (!selectionState.showPanel) return;

      const panel = document.getElementById('ai-translate-panel');
      if (panel && !panel.contains(e.target)) {
        setSelectionState(prev => ({ ...prev, showPanel: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [selectionState.showPanel]);

  const handleAITranslate = async () => {
    setSelectionState(prev => ({ ...prev, showIcon: false, showPanel: true }));
    setAiTranslation({ translation: '', transliteration: '', grammar: '', isLoading: true, error: '' });

    try {
      const hasTransliteration = Boolean(config.transliterationKey);
      const translitLabel = hasTransliteration 
        ? ((config.labels && config.labels[config.transliterationKey]) || config.transliterationKey)
        : null;
      const langName = config.name || 'the target language';

      const prompt = hasTransliteration
        ? `Translate the following text from ${langName} to English. Also provide its ${translitLabel} transliteration. If the selected text is a word or short phrase that has grammatical gender (e.g. feminine noun, masculine noun, neuter, de-word, het-word) or specific part of speech/grammar info in ${langName}, include a very concise note under "grammar" (e.g., "feminine noun", "de-word / common gender", "neuter noun", "verb (infinitive)", etc., or null if not applicable). Text: "${selectionState.text}"\nOutput JSON strictly with keys: {"translation": "...", "transliteration": "...", "grammar": "..."}`
        : `Translate the following text from ${langName} to English. If the selected text is a word or short phrase that has grammatical gender (e.g. feminine noun, masculine noun, neuter, de-word, het-word) or specific part of speech/grammar info in ${langName}, include a very concise note under "grammar" (e.g., "feminine noun", "de-word / common gender", "neuter noun", "verb (infinitive)", etc., or null if not applicable). Text: "${selectionState.text}"\nOutput JSON strictly with keys: {"translation": "...", "grammar": "..."}`;

      const res = await fetchGeminiContent({
          model: 'gemini-3.5-flash-lite',
          payload: {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
          },
          keyPreference: 'free'
      });

      if (!res.ok) throw new Error("Translation failed.");
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      setAiTranslation({
        translation: parsed.translation || '',
        transliteration: hasTransliteration ? (parsed.transliteration || '') : '',
        grammar: parsed.grammar || '',
        isLoading: false,
        error: ''
      });
    } catch (err) {
      setAiTranslation(prev => ({ ...prev, isLoading: false, error: err.message || 'Error executing AI translation.' }));
    }
  };

  return (
    <>
      {/* 1. Floating Icon Action Button */}
      {selectionState.showIcon && !selectionState.showPanel && (
        <button
          id="ai-translate-btn"
          style={{ 
            position: 'fixed', 
            top: Math.min(window.innerHeight - 44, selectionState.y + 14) + 'px', 
            left: Math.max(30, Math.min(window.innerWidth - 30, selectionState.x)) + 'px', 
            transform: 'translate(-50%, 0)', 
            zIndex: 9999 
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevents clearing text selection on click!
          onTouchStart={(e) => e.preventDefault()} // Prevents clearing text selection on mobile tap!
          onClick={handleAITranslate}
          className={`p-2 rounded-full shadow-xl border flex items-center justify-center cursor-pointer animate-in zoom-in duration-200 ${
            isDarkMode ? 'bg-amber-600 border-amber-500 text-stone-900' : 'bg-amber-500 border-amber-400 text-white'
          }`}
        >
          <Sparkles size={18} />
        </button>
      )}

      {/* 2. Google-Translate-Style Panel */}
      {selectionState.showPanel && (
        <div id="ai-translate-panel" className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[1000] p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className={`w-full p-5 rounded-3xl shadow-2xl border ${isDarkMode ? 'bg-stone-900 border-stone-750' : 'bg-white border-stone-200'}`}>
            
            {/* Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <span className={`text-sm font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>AI Translate</span>
              </div>
              <button 
                onClick={() => setSelectionState(prev => ({ ...prev, showPanel: false }))} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
              
              {/* Original Selected Text */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Target</p>
                  <p className={`text-xl font-bold ${config.fontClass || 'font-sans'} ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{selectionState.text}</p>
                  {aiTranslation.grammar && (
                    <div className="mt-1.5">
                      <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                        {aiTranslation.grammar}
                      </span>
                    </div>
                  )}
                </div>
                {/* Audio Button */}
                {handleSpeak && (
                  <div className="shrink-0">
                    <PlayButton 
                      isDarkMode={isDarkMode} 
                      onClick={() => {
                        const textToSpeak = (config.ttsUseTransliteration && aiTranslation.transliteration)
                          ? aiTranslation.transliteration
                          : selectionState.text;
                        handleSpeak(textToSpeak);
                      }} 
                      size={20} 
                    />
                  </div>
                )}
              </div>

              {aiTranslation.isLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="animate-spin text-amber-500" size={20} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>Translating...</span>
                </div>
              ) : aiTranslation.error ? (
                <p className="text-red-500 text-sm font-medium py-2">{aiTranslation.error}</p>
              ) : (
                <>
                  {/* Transliteration */}
                  {config.transliterationKey && aiTranslation.transliteration && (
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                        {(config.labels && config.labels[config.transliterationKey]) || 'Transliteration'}
                      </p>
                      <p className={`text-lg font-medium ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{aiTranslation.transliteration}</p>
                    </div>
                  )}
                  
                  {/* English Translation */}
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>English</p>
                    <p className={`text-xl ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>{aiTranslation.translation}</p>
                  </div>
                </>
              )}
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
