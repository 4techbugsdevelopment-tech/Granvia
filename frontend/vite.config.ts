import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where the dev server forwards /api during `npm run dev`.
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Pull only the large, STABLE, eagerly-used libs into their own
          // cacheable chunks to shrink the main app bundle. Everything else
          // (notably three.js, imported solely by the lazy Globe/ThreeScene)
          // returns undefined so Rollup keeps its automatic lazy code-splitting
          // — a catch-all vendor chunk would force those eager and bloat the
          // initial APK load.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('lucide-react')) return 'icons';
            if (
              id.includes('/react-dom/') ||
              id.includes('/react/') ||
              id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      proxy: {
        // Same-origin API calls in dev: /api/* -> backend/api/*
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
