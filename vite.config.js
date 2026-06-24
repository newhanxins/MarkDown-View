import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true, // 每次构建前清空 dist 目录
    minify: 'terser', // 使用 terser 进行更激进的压缩
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
      },
    },
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.js'),
      },
      output: {
        // 确保 JS 文件名与 manifest 中引用的一致
        entryFileNames: '[name].js', 
        chunkFileNames: '[name].js',
        // 确保 CSS 文件名与 manifest 中引用的一致
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'content.css';
          }
          return '[name].[ext]';
        },
      }
    },
    copyPublicDir: true // 确保 public 目录下的所有内容（包括 libs）都被拷贝
  },
  publicDir: 'public'
});