import { ViteCustomizableConfig } from '@solidjs/start/config'
import { internalIpV4 } from 'internal-ip'
import { defineConfig } from 'vite'
import { PolyfillOptions, nodePolyfills } from 'vite-plugin-node-polyfills'

const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM ?? '')

const polyfillOptions = {
  include: ['path', 'stream', 'util', 'ws'],
  exclude: ['http'],
  globals: { Buffer: true, WebSocket: true },
  overrides: { fs: 'memfs' },
  protocolImports: true
} as PolyfillOptions

export const viteConfig = defineConfig(async ({ mode }) => ({
  plugins: [nodePolyfills(polyfillOptions)],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server:
    mode === 'development'
      ? {
          port: 3000,
          strictPort: true,
          host: mobile ? '0.0.0.0' : false,
          hmr: mobile
            ? {
                protocol: 'ws',
                host: await internalIpV4(),
                port: 1421
            }
            : undefined,
          watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ['**/src-tauri/**']
          },
          websocket: {
            timeout: 30000,
            pingInterval: 15000,
            pingTimeout: 10000
          }
        }
      : undefined,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  }
}) as ViteCustomizableConfig)

export default viteConfig
