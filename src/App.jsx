  import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
  import { useEffect } from 'react';
  import { invoke, isTauri } from '@tauri-apps/api/core';

  import { auth, db } from './firebase';
  import Home from './pages/Home';
  import LingoCraft from './pages/LingoCraft';
  import MigrationTool from './pages/MigrationTool';
  import BatchUpdater from './pages/BatchUpdater';
  import CharacterDrill from './pages/CharacterDrill'; // <-- Added import

  import DesktopAuth from './pages/DesktopAuth';

  // The new Config Engine
  import LanguageCourse from './pages/LanguageCourse';
  import { courseConfigs } from './config/courseConfigs';

  function App() {
    // Global theme engine (localStorage override with system prefers-color-scheme fallback).
    useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const applyTheme = () => {
        const localTheme = localStorage.getItem('lingocraft_theme');
        const isDark = localTheme ? localTheme === 'dark' : mediaQuery.matches;
        const themeColor = isDark ? '#09090b' : '#fafaf9';
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        const meta = document.getElementById('theme-color-meta');
        if (meta) meta.setAttribute('content', themeColor);

        // Sync native system bars on Android/Tauri
        if (isTauri() && /Android/i.test(navigator.userAgent)) {
          invoke('plugin:systemBars|set_theme', { isDark })
            .then(() => console.log('[ThemeSync] invoke succeeded'))
            .catch((err) => console.error('[ThemeSync] invoke error:', err));
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
      window.addEventListener('theme-changed', applyTheme);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemChange);
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('theme-changed', applyTheme);
      };
    }, []);

    // Global API-key sync: copy the Gemini keys stored in Firestore (hub user doc)
    // into localStorage as soon as the user signs in, so pages like LingoCraft and
    // LanguageCourse have them available on first load without visiting Home settings.
    useEffect(() => {
      let unsubDoc = null;
      const unsubAuth = auth.onAuthStateChanged((user) => {
        if (unsubDoc) { unsubDoc(); unsubDoc = null; }
        if (!user) return;
        const hubUserRef = db.collection('artifacts').doc('hub').collection('users').doc(user.uid);
        unsubDoc = hubUserRef.onSnapshot((snap) => {
          if (!snap.exists) return;
          const data = snap.data();
          if (data.geminiApiKey) localStorage.setItem('geminiApiKey', data.geminiApiKey);
          if (data.geminiPaidApiKey) localStorage.setItem('geminiPaidApiKey', data.geminiPaidApiKey);
        });
      });
      return () => { if (unsubDoc) unsubDoc(); unsubAuth(); };
    }, []);

    return (
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/desktop-auth" element={<DesktopAuth />} />
          <Route path="/lingocraft" element={<LingoCraft />} />
          
          {/* NEW REFACTORED ARCHITECTURE */}
          <Route path="/mandarin" element={<LanguageCourse config={courseConfigs.mandarin} />} />
          <Route path="/hungarian" element={<LanguageCourse config={courseConfigs.hungarian} />} />
          <Route path="/portuguese" element={<LanguageCourse config={courseConfigs.portuguese} />} />
          <Route path="/romanian" element={<LanguageCourse config={courseConfigs.romanian} />} />
          <Route path="/russian" element={<LanguageCourse config={courseConfigs.russian} />} />
          <Route path="/greek" element={<LanguageCourse config={courseConfigs.greek} />} />
          <Route path="/japanese" element={<LanguageCourse config={courseConfigs.japanese} />} />
          <Route path="/latin" element={<LanguageCourse config={courseConfigs.latin} />} />
          <Route path="/ancient-greek" element={<LanguageCourse config={courseConfigs.ancient_greek} />} />
          
          {/* SERVICE APPS & GAMES */}
          <Route path="/migrate" element={<MigrationTool />} />
          <Route path="/batch-updater" element={<BatchUpdater />} />
          <Route path="/character-drill" element={<CharacterDrill />} /> {/* <-- Added route */}
        </Routes>
      </Router>
    );
  }

  export default App;