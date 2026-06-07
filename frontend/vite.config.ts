import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Travel — Organisez vos voyages',
        short_name: 'Travel',
        description: 'Planifiez vos voyages, partagez les dépenses et le planning entre amis.',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Données du voyage (infos, planning, dépenses, soldes, remboursements) en
            // NetworkFirst : réseau si dispo, sinon dernier cache (consultation hors-ligne).
            // On exclut les positions live (éphémères) et le flux SSE.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/trips') &&
              !url.pathname.endsWith('/positions'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-trips',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Vendors lourds isolés dans leurs propres chunks (chargés à la demande + bien cachés)
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet'],
          recharts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
