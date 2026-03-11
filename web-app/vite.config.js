import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // ขยายลิมิตการเตือนจาก 500 KB เป็น 1000 KB (1 MB)
    chunkSizeWarningLimit: 1000,

    // แยกไฟล์ Library (Firebase/React) ออกจากไฟล์โค้ดของเรา (Code Splitting)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})