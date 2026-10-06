import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { version } from './package.json'

export default defineConfig({
  base: './',
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  clearScreen: false,
  // Must match devUrl in src-tauri/tauri.conf.json.
  server: { port: 5173, strictPort: true },
})
