import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDark = document.documentElement.classList.contains('dark');
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-sm ${
            isDark ? 'bg-stone-900 border-stone-800 text-stone-200' : 'bg-white border-stone-200 text-stone-800'
          }`}>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 mx-auto flex items-center justify-center mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold mb-1">Content Rendering Error</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 leading-relaxed">
              {this.props.fallbackMessage || 'This section encountered an issue rendering data for this lesson.'}
            </p>
            {this.state.error?.message && (
              <div className="text-[11px] font-mono bg-stone-100 dark:bg-stone-950 p-2.5 rounded-lg mb-4 text-left overflow-x-auto text-red-600 dark:text-red-400">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors shadow-sm cursor-pointer"
            >
              <RotateCcw size={14} /> Retry View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
