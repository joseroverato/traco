import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const VERSION = pkg.version

// modos: (padrão) web leve para o servidor · desktop = app de PC · single = prévia em arquivo único
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || process.env.SINGLE === '1'
  const desktop = mode === 'desktop'
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      'import.meta.env.VITE_SINGLE': JSON.stringify(single ? '1' : '0'),
      'import.meta.env.VITE_TARGET': JSON.stringify(desktop ? 'desktop' : 'web'),
      'import.meta.env.VITE_VERSION': JSON.stringify(VERSION),
    },
    build: { target: 'es2022', outDir: single ? 'dist-single' : desktop ? 'dist-desktop' : 'dist', chunkSizeWarningLimit: 1500 },
  }
})
