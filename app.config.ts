import { ViteCustomizableConfig, defineConfig } from "@solidjs/start/config"
import { internalIpV4 } from "internal-ip"
// biome-ignore lint/correctness/noNodejsModules: build context
import { readFileSync } from 'node:fs'

const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM)
let key = ''
let cert = ''
try {
    key = readFileSync("./localhost-key.pem").toString()
    cert = readFileSync("./localhost.pem").toString()
} catch(_) {
    console.warn('no certs, use `mkcert localhost` to fix')
}

export default defineConfig({
    devOverlay: true,
    server: {
        https: key ? {
            key: key,
            cert: cert
        } : undefined,
    },
    vite: {
        // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
        //
        // 1. prevent vite from obscuring rust errors
        clearScreen: false,
        // 2. tauri expects a fixed port, fail if that port is not available
        server: {
            port: 3000,
            strictPort: true,
            host: mobile ? "0.0.0.0" : false,
            hmr: mobile
                ? {
                    protocol: "ws",
                    host: await internalIpV4(),
                    port: 1421,
                }
                : undefined,
            watch: {
                // 3. tell vite to ignore watching `src-tauri`
                ignored: ["**/src-tauri/**"],
            },
        },
    } as ViteCustomizableConfig
});
