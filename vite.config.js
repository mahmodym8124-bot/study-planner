import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '8080';
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    root: '.',
    base: env.VITE_BASE_PATH || '/',
    publicDir: 'public',
    server: {
      port: 5173,
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget
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
