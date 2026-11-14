import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// Set by the Tauri CLI when developing on a remote/mobile device.
const host = process.env.TAURI_DEV_HOST

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [
    vue(),
    // Tree-shakes Vuetify: only components that are actually used are bundled.
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Keep Rust compiler output visible in the terminal.
  clearScreen: false,
  server: {
    // Tauri expects a fixed port (see devUrl in src-tauri/tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Rust sources are watched by the Tauri CLI, not by Vite.
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // WebView2 (Windows) is Chromium-based; WebKitGTK/WKWebView need a Safari target.
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
    // Vite 8 minifies with Oxc by default (esbuild is no longer bundled).
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
