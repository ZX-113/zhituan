import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? './' : '/',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } } } }
});
