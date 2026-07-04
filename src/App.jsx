import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Home from './pages/Home';
import LingoCraft from './pages/LingoCraft';
import Romanian from './pages/Romanian';
import MigrationTool from './pages/MigrationTool';

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
        
        <Route path="/migrate" element={<MigrationTool />} />
      </Routes>
    </Router>
  );
}

export default App;