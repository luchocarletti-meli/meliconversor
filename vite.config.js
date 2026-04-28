import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    // Preferimos 5177 porque 5173 suele estar ocupado por otro Vite en tu máquina.
    // strictPort: false → si 5177 está ocupado, Vite usa 5178, 5179… (mirá la URL en la terminal).
    port: 5177,
    strictPort: false,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
