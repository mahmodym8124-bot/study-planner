import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.PORT || env.PORT || '8091';
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    root: '.',
    base: env.VITE_BASE_PATH || '/',
    publicDir: 'public',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: env.VITE_SOURCEMAP === 'true',
      target: 'es2022',
      chunkSizeWarningLimit: 700
    }
  };
});
