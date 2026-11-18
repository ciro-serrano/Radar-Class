import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy apunta al backend. Por defecto http://127.0.0.1:3000 (el PORT de backend/.env.example).
// Si tu backend usa otro puerto, creá frontend/.env con:  VITE_API_TARGET=http://127.0.0.1:4000
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': env.VITE_API_TARGET || 'http://127.0.0.1:3000' } },
  };
});
