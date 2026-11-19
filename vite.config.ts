import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-lifras.jpg', 'favicon.svg'],
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Carnet de Bord Digital CMN - LIFRAS',
        short_name: 'CMN LIFRAS',
        description: 'Suivi et évaluation des Candidats Moniteurs Nationaux (LIFRAS)',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        lang: 'fr',
        icons: [
          {
            src: 'logo-lifras.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: 'logo-lifras.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
