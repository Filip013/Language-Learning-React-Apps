import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isTauri } from '@tauri-apps/api/core'

if (isTauri()) {
  // Inside Tauri (desktop WebView2), the PWA service worker's precached assets
  // persist in %LOCALAPPDATA% and serve stale app bundles on every launch.
  // Unregister it and clear its caches so the app always loads the bundled assets.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
} else {
  // Web/browser deployment: register the PWA service worker as usual.
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
