import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish',
  plugins: [react(), basicSsl()],
  server: {
    host: '127.0.0.1',
    port: 5203,
    strictPort: true,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8803',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
