import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// modos: (padrão) web leve para o servidor · desktop = app de PC · single = prévia em arquivo único
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || process.env.SINGLE === '1'
  const desktop = mode === 'desktop'
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    define: {
      'import.meta.env.VITE_SINGLE': JSON.stringify(single ? '1' : '0'),
      'import.meta.env.VITE_TARGET': JSON.stringify(desktop ? 'desktop' : 'web'),
    },
    build: { target: 'es2022', outDir: single ? 'dist-single' : desktop ? 'dist-desktop' : 'dist', chunkSizeWarningLimit: 1500 },
  }
})
