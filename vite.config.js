import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '8080';
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    root: '.',
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
      sourcemap: true
    }
  };
});
