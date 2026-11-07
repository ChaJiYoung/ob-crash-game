import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish',
  plugins: [react(), basicSsl()],
  server: {
    host: '127.0.0.1',
    port: 5201,
    strictPort: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8801',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
