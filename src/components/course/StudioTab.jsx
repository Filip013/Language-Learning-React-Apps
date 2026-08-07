// src/components/course/StudioTab.jsx
import React, { useRef } from 'react';
import { 
  MessageSquare, List, ChevronDown, Loader2, 
  Sparkles, Check, Download, ClipboardPaste, 
  Upload, Award, Book, Trash2 
} from 'lucide-react';

export default function StudioTab({ 
  isDarkMode, activeEpisode, episodesList, dropdownOpen, setDropdownOpen,
  setActiveEpisodeId, activeEpisodeId, topicInput, setTopicInput,
  isGenerating, isExporting, showGenerateConfirm, setShowGenerateConfirm,
  handleGenerateLLM, handleExportPrompt, isCopied, handlePasteLesson,
  handleFileUpload, genError, activeConfig, handleTabSwitch,
  deletingEpisodeId, setDeletingEpisodeId, handleDeleteEpisode, studioSwipeHandlers
}) {
  const fileInputRef = useRef(null);

  return (
    <div {...studioSwipeHandlers} className="max-w-6xl mx-auto pt-3 md:pt-9 pb-12 px-4 md:px-8 animate-in fade-in duration-300 font-sans">
      <header className={`shrink-0 mb-3 pb-3 border-b flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:justify-center md:items-center gap-3 md:gap-4 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-2 justify-center">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-amber-600'}`}>
            <MessageSquare size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 select-none">Studio Control</span>
        </div>

        <div className="relative z-20 group w-full sm:max-w-xl md:max-w-3xl md:mx-auto">
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl border shadow-sm transition-all text-sm ${isDarkMode ? 'bg-stone-900 border-stone-800 hover:border-stone-750 text-stone-200' : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'}`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <List size={16} className={`shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className="font-bold truncate">{activeEpisode ? activeEpisode.title : 'Archive'}</span>
            </div>
            <ChevronDown size={16} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-xl border overflow-hidden z-50 text-left ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
              <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-stone-950 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>Past Episodes</div>
              <div className="max-h-60 overflow-y-auto">
                {episodesList.map(ep => (
                  <button key={ep.id} onClick={() => { setActiveEpisodeId(ep.id); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b last:border-0 ${activeEpisodeId === ep.id ? (isDarkMode ? 'bg-amber-900/30 text-amber-400 border-stone-800' : 'bg-amber-50 text-amber-700 border-stone-100') : (isDarkMode ? 'hover:bg-stone-800 text-stone-300 border-stone-800' : 'hover:bg-stone-50 text-stone-700 border-stone-100')}`}>
                    {ep.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <section className={`p-6 md:p-8 rounded-3xl shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
        <h3 className="text-xl font-bold mb-4 font-sans">Prompt the AI</h3>
        <div className="flex flex-col gap-4">
          <textarea 
            value={topicInput} onChange={e => setTopicInput(e.target.value)} disabled={isGenerating} 
            placeholder="e.g., Focus on grammar. Review words: table, sky." 
            rows="2"
            className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all resize-y min-h-[80px] ${isDarkMode ? 'bg-stone-950 border-stone-700 text-stone-100 focus:border-stone-500' : 'bg-stone-50 border-stone-200 focus:border-stone-400'}`} 
          />
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {!showGenerateConfirm ? (
              <button 
                  onClick={() => setShowGenerateConfirm(true)} 
                  disabled={isGenerating || isExporting || !topicInput.trim()} 
                  title="Generate instantly via Gemini API" 
                  className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${isDarkMode ? 'bg-amber-600/20 border-amber-600/30 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50'}`}
              >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  <span className="truncate hidden sm:inline">Generate</span>
                  <span className="truncate sm:hidden">Gen API</span>
              </button>
            ) : (
              <div className={`flex items-center justify-between gap-1 py-1 px-2 rounded-xl border shadow-sm ${isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider pl-1 hidden sm:inline">Sure?</span>
                  <button onClick={handleGenerateLLM} className="px-3 py-2 sm:py-1.5 bg-amber-500 text-stone-900 text-xs font-bold rounded-lg hover:bg-amber-400 w-full sm:w-auto">Yes</button>
                  <button onClick={() => setShowGenerateConfirm(false)} className="px-3 py-2 sm:py-1.5 text-xs font-bold opacity-70 hover:opacity-100 w-full sm:w-auto">No</button>
              </div>
            )}

            <button 
              onClick={handleExportPrompt} 
              disabled={isGenerating || isExporting || !topicInput.trim()} 
              title="Download detailed prompt file for LLM Web App" 
              className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
            >
              {isExporting ? (
                  <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
              ) : isCopied ? (
                  <Check className="w-5 h-5 shrink-0 text-emerald-500" />
              ) : (
                  <Download className="w-5 h-5 shrink-0" />
              )}
              
              <span className="truncate hidden sm:inline">
                  {isCopied ? "Copied!" : "Export Prompt"}
              </span>
              <span className="truncate sm:hidden">
                  {isCopied ? "Copied!" : "Export"}
              </span>
            </button>

            <button 
                onClick={handlePasteLesson} 
                disabled={isGenerating || isExporting} 
                title="Paste copied JSON from clipboard" 
                className={`font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
            >
                <ClipboardPaste className="w-5 h-5 shrink-0" />
                <span className="truncate hidden sm:inline">Paste JSON</span>
                <span className="truncate sm:hidden">Paste</span>
            </button>
            
            <label className={`cursor-pointer font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border shadow-sm active:scale-95 ${(isGenerating || isExporting) ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
              <Upload className="w-5 h-5 shrink-0" /> 
              <span className="truncate hidden sm:inline">Import File</span>
              <span className="truncate sm:hidden">Import</span>
              <input 
                type="file" accept=".json,.txt" ref={fileInputRef} onChange={handleFileUpload} disabled={isGenerating || isExporting} className="hidden" 
              />
            </label>
          </div>
        </div>
        {genError && <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-medium">{genError}</div>}
      </section>

      {activeEpisode && (activeEpisode.userPrompt || activeEpisode.tutorIntroduction) && (
        <div className="space-y-6 pt-10 font-sans">
          {activeEpisode.userPrompt && (
            <div className="flex flex-col items-end">
              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>You</span>
              <div className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tr-sm shadow-sm border ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
                <p className="text-lg leading-relaxed">{activeEpisode.userPrompt}</p>
              </div>
            </div>
          )}
          {(activeEpisode.tutorIntroduction) && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-1 ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>Tutor</span>
              <div className={`w-full max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-3xl rounded-tl-sm shadow-sm border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100' : 'bg-stone-100 border-stone-200 text-stone-900'}`}>
                <p className="text-lg leading-relaxed mb-6">{activeEpisode.tutorIntroduction}</p>
                
                {(activeEpisode.story || activeEpisode.reading) && (
                  <>
                    {activeEpisode.storyStatus === 'finale' && (
                      <div className={`mb-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                        <span className="font-bold flex items-center gap-2"><Award size={18} /> Story Finale!</span>
                        <p className="text-sm mt-1 opacity-80">The LLM has concluded the current storybook.</p>
                      </div>
                    )}
                    {activeEpisode.storyStatus === 'new_story' && (
                      <div className={`mb-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        <span className="font-bold flex items-center gap-2"><Book size={18} /> New Story Started!</span>
                        <p className="text-sm mt-1 opacity-80">Title: {activeEpisode.storyTitle || "Untitled"}</p>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-3 border-t pt-5 border-stone-200 dark:border-stone-700">
                      <button onClick={() => handleTabSwitch(activeConfig.hasStories ? 'episode' : 'reading')} className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-stone-800 hover:bg-stone-700 text-amber-400' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}>
                        Go to {activeConfig.hasStories ? 'Audio' : 'Reading'}
                      </button>
                      
                      {deletingEpisodeId === activeEpisode.id ? (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border ${isDarkMode ? 'bg-red-950/30 border-red-900' : 'bg-red-50 border-red-200'}`}>
                          <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Are you sure?</span>
                          <button onClick={handleDeleteEpisode} className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">Yes, Delete</button>
                          <button onClick={() => setDeletingEpisodeId(null)} className="px-2 py-1 text-stone-500 hover:text-stone-700 text-xs font-bold">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingEpisodeId(activeEpisode.id)} className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all border ${isDarkMode ? 'border-stone-700 text-stone-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20' : 'border-stone-200 text-stone-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200'}`}>
                          <Trash2 size={16} /> Delete Lesson
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
