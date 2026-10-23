import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The browser calls the API on the same origin (`VITE_API_URL=/api`); the dev and preview servers
// forward it, so a single tunnel (e.g. ngrok to this port) serves both the app and the API.
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    changeOrigin: true,
  },
};

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
    proxy: apiProxy,
  },
  // `pnpm live`: the built app (much lighter on players' phones than the dev server) on the same port.
  preview: {
    host: true,
    port: 5199,
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
