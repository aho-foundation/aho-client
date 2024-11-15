import { defineConfig } from "@solidjs/start/config"
// biome-ignore lint/correctness/noNodejsModules: build context
import { readFileSync } from 'node:fs'

import { viteConfig } from './vite.config'

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
    vite: viteConfig
});
