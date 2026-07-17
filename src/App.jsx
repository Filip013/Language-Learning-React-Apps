import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Home from './pages/Home';
import LingoCraft from './pages/LingoCraft';
import MigrationTool from './pages/MigrationTool';
import BatchUpdater from './pages/BatchUpdater';
import CharacterDrill from './pages/CharacterDrill'; // <-- Added import

// The new Config Engine
import LanguageCourse from './pages/LanguageCourse';
import { courseConfigs } from './config/courseConfigs';

function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const localTheme = localStorage.getItem('lingocraft_theme');
      const isDark = localTheme ? localTheme === 'dark' : mediaQuery.matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      localStorage.removeItem('lingocraft_theme');
      applyTheme();
      window.dispatchEvent(new Event('theme-changed'));
    };

    const handleStorageChange = (e) => {
      if (e.key === 'lingocraft_theme') {
        applyTheme();
        window.dispatchEvent(new Event('theme-changed'));
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lingocraft" element={<LingoCraft />} />
        
        {/* NEW REFACTORED ARCHITECTURE */}
        <Route path="/mandarin" element={<LanguageCourse config={courseConfigs.mandarin} />} />
        <Route path="/hungarian" element={<LanguageCourse config={courseConfigs.hungarian} />} />
        <Route path="/portuguese" element={<LanguageCourse config={courseConfigs.portuguese} />} />
        <Route path="/romanian" element={<LanguageCourse config={courseConfigs.romanian} />} />
        <Route path="/russian" element={<LanguageCourse config={courseConfigs.russian} />} />
        
        {/* SERVICE APPS & GAMES */}
        <Route path="/migrate" element={<MigrationTool />} />
        <Route path="/batch-updater" element={<BatchUpdater />} />
        <Route path="/character-drill" element={<CharacterDrill />} /> {/* <-- Added route */}
      </Routes>
    </Router>
  );
}

export default App;