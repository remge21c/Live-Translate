import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  // 환경 변수 파일 위치 명시
  envDir: '.',
  server: {
    host: true,
    proxy: {
      '/deepl-free': {
        target: 'https://api-free.deepl.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deepl-free/, ''),
      },
      '/deepl-pro': {
        target: 'https://api.deepl.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deepl-pro/, ''),
      },
    },
  },
})
