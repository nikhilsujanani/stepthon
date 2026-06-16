import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
            manifest: {
                name: 'Stepathon',
                short_name: 'Stepathon',
                description: 'Walk Together. Win Together.',
                theme_color: '#10b981',
                background_color: '#0b1120',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallback: '/index.html',
                runtimeCaching: [
                    {
                        // Cache GET reads from Supabase REST for offline viewing of leaderboards.
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.pathname.startsWith('/rest/v1/');
                        },
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-rest',
                            networkTimeoutSeconds: 4,
                            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
            devOptions: { enabled: false },
        }),
    ],
    server: { port: 5173 },
});
