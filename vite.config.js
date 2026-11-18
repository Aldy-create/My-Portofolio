import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
    base: './',
    server: {
        host: true,
        port: 5173
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false
    },
    plugins: [
        wasm()
    ]
})
