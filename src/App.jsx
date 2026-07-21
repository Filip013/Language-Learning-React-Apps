import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import Home from './pages/Home';
import LingoCraft from './pages/LingoCraft';
import MigrationTool from './pages/MigrationTool';
import BatchUpdater from './pages/BatchUpdater';
import CharacterDrill from './pages/CharacterDrill';

// The new Config Engine
import LanguageCourse from './pages/LanguageCourse';
import { courseConfigs } from './config/courseConfigs';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fafaf9', color: '#1c1917' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#dc2626', fontSize: '14px', maxWidth: '360px', wordBreak: 'break-word', marginBottom: '16px' }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => { try { localStorage.clear(); } catch(e){} window.location.href = '/'; }}
            style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
          >
            Reset App & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RoutePersister() {
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  useEffect(() => {
    const sanitizePath = (path) => {
      if (!path) return '/';
      const clean = path.replace(/^\/Language-Learning-React-Apps/, '');
      return clean === '' ? '/' : clean;
    };

    if (isInitialMount.current) {
      isInitialMount.current = false;
      const cleanCurrent = sanitizePath(location.pathname);
      if (cleanCurrent === '/') {
        try {
          const lastRoute = localStorage.getItem('lingocraft_last_route');
          if (lastRoute) {
            const cleanLast = sanitizePath(lastRoute);
            if (cleanLast !== '/') {
              navigate(cleanLast, { replace: true });
              return;
            }
          }
        } catch (e) {
          console.warn('LocalStorage access error:', e);
        }
      }
    }

    const cleanPath = sanitizePath(location.pathname);
    if (cleanPath !== '/') {
      try {
        localStorage.setItem('lingocraft_last_route', cleanPath + location.search);
      } catch (e) {
        console.warn('LocalStorage write error:', e);
      }
    } else {
      try {
        localStorage.removeItem('lingocraft_last_route');
      } catch (e) {
        console.warn('LocalStorage remove error:', e);
      }
    }
  }, [location, navigate]);

  return null;
}

function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      try {
        const localTheme = localStorage.getItem('lingocraft_theme');
        const isDark = localTheme ? localTheme === 'dark' : mediaQuery.matches;
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        if (mediaQuery.matches) {
          document.documentElement.classList.add('dark');
        }
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      try { localStorage.removeItem('lingocraft_theme'); } catch(e){}
      applyTheme();
      window.dispatchEvent(new Event('theme-changed'));
    };

    const handleStorageChange = (e) => {
      if (e.key === 'lingocraft_theme') {
        applyTheme();
        window.dispatchEvent(new Event('theme-changed'));
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemChange);
    }
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleSystemChange);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router basename={import.meta.env.BASE_URL}>
        <RoutePersister />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lingocraft" element={<LingoCraft />} />
          
          {/* NEW REFACTORED ARCHITECTURE */}
          <Route path="/mandarin" element={<LanguageCourse config={courseConfigs.mandarin} />} />
          <Route path="/hungarian" element={<LanguageCourse config={courseConfigs.hungarian} />} />
          <Route path="/portuguese" element={<LanguageCourse config={courseConfigs.portuguese} />} />
          <Route path="/romanian" element={<LanguageCourse config={courseConfigs.romanian} />} />
          <Route path="/russian" element={<LanguageCourse config={courseConfigs.russian} />} />
          <Route path="/greek" element={<LanguageCourse config={courseConfigs.greek} />} />
          
          {/* SERVICE APPS & GAMES */}
          <Route path="/migrate" element={<MigrationTool />} />
          <Route path="/batch-updater" element={<BatchUpdater />} />
          <Route path="/character-drill" element={<CharacterDrill />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;