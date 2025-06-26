import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Set base path for GitHub Pages deployment
  // Change 'lol-cooldown-tracker' to match your GitHub repository name
  base: process.env.NODE_ENV === 'production' ? '/lol-cooldown-tracker/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'LoL Cooldown Tracker',
        short_name: 'LoL Tracker',
        description: 'Track opponent abilities and summoner spells in League of Legends',
        theme_color: '#3b82f6',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/lol-cooldown-tracker/', // Update scope for GitHub Pages
        start_url: '/lol-cooldown-tracker/', // Update start_url for GitHub Pages
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ddragon\.leagueoflegends\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lol-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
})

