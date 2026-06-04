import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Сканер документов из видео',
        short_name: 'DocScan',
        description: 'Восстановление текста документа из видео с экспортом в PDF и DOCX',
        theme_color: '#1a365d',
        background_color: '#f7fafc',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ru',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
