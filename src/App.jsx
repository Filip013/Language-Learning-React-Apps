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
    if (localStorage.getItem('lingocraft_theme') === 'dark' || 
       (!localStorage.getItem('lingocraft_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
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
        
        {/* SERVICE APPS & GAMES */}
        <Route path="/migrate" element={<MigrationTool />} />
        <Route path="/batch-updater" element={<BatchUpdater />} />
        <Route path="/character-drill" element={<CharacterDrill />} /> {/* <-- Added route */}
      </Routes>
    </Router>
  );
}

export default App;