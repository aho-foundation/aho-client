import { ViteCustomizableConfig } from '@solidjs/start/config'
import { internalIpV4 } from 'internal-ip'
import { defineConfig } from 'vite'

const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM ?? '')

export const viteConfig = defineConfig(async ({ mode }) => ({
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: mode === 'development' ? {
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
      }
    } : undefined
})) as ViteCustomizableConfig

export default viteConfig
