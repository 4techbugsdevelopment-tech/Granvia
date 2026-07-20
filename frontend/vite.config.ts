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
