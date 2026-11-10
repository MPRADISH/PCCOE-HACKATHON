import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      {
        name: 'dev-html-transform',
        transformIndexHtml(html, ctx) {
          if (ctx.server) {
            return html
              .replace(/\.\/assets\/main-[a-zA-Z0-9_\-]+\.js/g, '/src/main.tsx')
              .replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/main-[a-zA-Z0-9_\-]+\.css">/g, '');
          }
          return html;
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'JalMitra — AI Groundwater & Irrigation Advisory',
          short_name: 'JalMitra',
          description:
            'Multilingual AI groundwater, soil moisture, and irrigation advisory platform for Maharashtra smallholder farmers with offline advisory caching.',
          theme_color: '#182218',
          background_color: '#F9F8F3',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /\/advisory-cache\/.*\.json$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'jalmitra-advisory-data-v1',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days offline retention
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy API calls to the Express backend server
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.PORT || 3001}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

