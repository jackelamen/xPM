import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'EDGEx PM',
        short_name: 'xPM',
        description: 'The workspace built for how we actually work.',
        start_url: '/',
        display: 'standalone',
        background_color: '#042C53',
        theme_color: '#042C53',
        orientation: 'portrait-primary',
        icons: [
          { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Custom push/notificationclick handlers, merged into the generated SW.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
