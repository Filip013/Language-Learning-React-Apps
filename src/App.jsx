import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Home from './pages/Home';
import LingoCraft from './pages/LingoCraft';
import Mandarin from './pages/Mandarin';
import Hungarian from './pages/Hungarian';
import Portuguese from './pages/Portuguese';
import Romanian from './pages/Romanian';
import MigrationTool from './pages/MigrationTool'; // <-- Added MigrationTool

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
        <Route path="/mandarin" element={<Mandarin />} />
        <Route path="/hungarian" element={<Hungarian />} />
        <Route path="/portuguese" element={<Portuguese />} />
        <Route path="/romanian" element={<Romanian />} />
        <Route path="/migrate" element={<MigrationTool />} /> {/* <-- Added Route */}
      </Routes>
    </Router>
  );
}

export default App;