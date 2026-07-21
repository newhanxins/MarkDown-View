import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development'
  return {
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
          // 【新增】将测试页也作为一个入口，方便开发时直接访问
          ...(isDev && { 'index': resolve(__dirname, 'index.html') }),
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
    publicDir: 'public',
    server: {
      // 确保测试页能正确访问
      host: true,
      port: 5173,
      open: '/index.html' // 启动时自动打开开发测试页
    }
  }
  
});