import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Home from './pages/Home';
import LingoCraft from './pages/LingoCraft';
import Mandarin from './pages/Mandarin';
import Hungarian from './pages/Hungarian';
import Portuguese from './pages/Portuguese'; // <-- Import Portuguese

function App() {
  useEffect(() => {
    if (localStorage.getItem('lingocraft_theme') === 'dark' || 
       (!localStorage.getItem('lingocraft_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lingocraft" element={<LingoCraft />} />
        <Route path="/mandarin" element={<Mandarin />} />
        <Route path="/hungarian" element={<Hungarian />} />
        <Route path="/portuguese" element={<Portuguese />} /> {/* <-- Add Route */}
      </Routes>
    </Router>
  );
}

export default App;