import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], build: { chunkSizeWarningLimit: 1800 }, server: { proxy: { '/api': 'http://127.0.0.1:8642', '/ws': {target:'ws://127.0.0.1:8642',ws:true} } } });
