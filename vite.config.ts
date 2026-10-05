import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isNativeBuild =
    process.env.TARGET === 'native' ||
    process.env.CAPACITOR_BUILD === 'true' ||
    process.env.VITE_PLATFORM === 'native' ||
    process.env.DISABLE_PWA === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: isNativeBuild,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'app-icon.svg'],
        manifest: {
          id: '/',
          name: 'ShopPOS Pro - Retail Point of Sale',
          short_name: 'ShopPOS Pro',
          description: 'Next-Generation Mobile Retail POS, Inventory & Khata Ledger',
          theme_color: '#0b0f19',
          background_color: '#0b0f19',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/app-icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: !isNativeBuild,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
