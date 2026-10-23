import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'QuiziciuS',
        short_name: 'QuiziciuS',
        description: 'Real-time pub quiz platform',
        theme_color: '#080a12',
        background_color: '#080a12',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  // @quizicius/shared-types is a linked workspace package compiled to CommonJS (the API needs
  // that); let Vite convert it like a regular dependency so runtime exports such as hasRole work.
  optimizeDeps: {
    include: ['@quizicius/shared-types'],
  },
  build: {
    commonjsOptions: {
      include: [/shared-types/, /node_modules/],
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
