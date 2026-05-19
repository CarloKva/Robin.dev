import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const TAURI_DEV_HOST = process.env['TAURI_DEV_HOST'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reactPlugin = react() as any;

const hmrConfig = TAURI_DEV_HOST
  ? { protocol: 'ws' as const, host: TAURI_DEV_HOST, port: 1421 }
  : undefined;

export default defineConfig(() => ({
  plugins: [reactPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: TAURI_DEV_HOST || false,
    ...(hmrConfig ? { hmr: hmrConfig } : {}),
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env['TAURI_ENV_PLATFORM'] === 'windows' ? 'chrome105' : 'safari15',
    minify: !process.env['TAURI_ENV_DEBUG'] ? ('esbuild' as const) : false,
    sourcemap: !!process.env['TAURI_ENV_DEBUG'],
  },
}));
