import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { defineConfig } from 'vite';

type LocalAmapConfig = {
  key: string;
  securityJsCode: string;
};

export function readLocalAmapConfig(filePath: string): LocalAmapConfig | null {
  if (!existsSync(filePath)) return null;
  try {
    const context: { window: { LETS_EAT_CONFIG?: unknown } } = { window: {} };
    runInNewContext(readFileSync(filePath, 'utf8'), context, { filename: filePath, timeout: 100 });
    const value = context.window.LETS_EAT_CONFIG;
    if (!value || typeof value !== 'object') return null;
    const { key, securityJsCode } = value as Partial<LocalAmapConfig>;
    if (typeof key !== 'string' || typeof securityJsCode !== 'string' || !key.trim() || !securityJsCode.trim()) return null;
    return { key: key.trim(), securityJsCode: securityJsCode.trim() };
  } catch {
    return null;
  }
}

const localAmapConfig = readLocalAmapConfig(path.resolve(__dirname, '../../config.js'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.LETS_EAT_LOCAL_AMAP_CONFIG': JSON.stringify(localAmapConfig),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT ?? '3001'}`,
      '/ws': { target: `ws://localhost:${process.env.API_PORT ?? '3001'}`, ws: true },
    },
  },
});
