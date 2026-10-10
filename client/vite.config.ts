import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on its own port in development; proxying lets the client
    // always call relative /api URLs (same as production, where Express serves it).
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { flow: ['@xyflow/react', '@dagrejs/dagre'] } },
    },
  },
});
