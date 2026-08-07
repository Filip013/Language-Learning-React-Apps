import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_KEY = 'lingocraft_theme';

/**
 * Shared dark/light mode toggle button.
 *
 * Reads the persisted theme (localStorage['lingocraft_theme']) and falls back to the
 * system prefers-color-scheme. Reacts to the global 'theme-changed' event dispatched
 * by App.jsx (system color-scheme changes) and by other toggle instances, so every
 * instance stays in sync automatically.
 *
 * Icon color is inherited from the button's text-* classes via currentColor — pass
 * page-specific color/background classes through `className`.
 */
export default function ThemeToggle({ className = '', size = 16 }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const localTheme = localStorage.getItem(THEME_KEY);
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(localTheme === 'dark' || (!localTheme && systemDark));
    };
    checkTheme();
    window.addEventListener('theme-changed', checkTheme);
    return () => window.removeEventListener('theme-changed', checkTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem(THEME_KEY, newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.dispatchEvent(new Event('theme-changed'));
  };

  const label = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center p-1.5 sm:p-2 rounded-full border transition-all active:scale-95 shrink-0 ${className}`}
    >
      {isDarkMode ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}
