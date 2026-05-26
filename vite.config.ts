import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    publicDir: false,
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'public',
        emptyOutDir: false,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/main.tsx'),
            output: {
                entryFileNames: 'main.js',
                chunkFileNames: '[name].js',
                assetFileNames: 'main.[ext]',
            },
        },
    },
});