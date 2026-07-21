import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Language-Learning-React-Apps/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Language Learning Hub',
        short_name: 'LingoHub',
        description: 'Multi-language study companion',
        theme_color: '#2563eb',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/Language-Learning-React-Apps/',
        launch_handler: {
          client_mode: 'focus-existing'
        },
        "icons": [
          {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ]
      }
    })
  ]
})