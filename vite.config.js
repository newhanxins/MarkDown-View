import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';

// 读取 package.json 获取版本号
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const buildTime = new Date().toISOString();
const bannerText = `/*! MD Viewer v${pkg.version} | Build: ${buildTime} */`;

// Rollup 插件：在 terser 压缩后注入 banner（generateBundle 在 renderChunk 之后执行）
const bannerPlugin = {
  name: 'banner',
  generateBundle(options, bundle) {
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (fileName.endsWith('.js') && chunk.type === 'chunk') {
        chunk.code = bannerText + '\n' + chunk.code;
      }
    }
  }
};

// Web 模式专用插件：修改 index.html 以支持 file:// 协议
const webModeHtmlPlugin = {
  name: 'web-mode-html',
  apply: 'build', // 仅在构建时生效
  generateBundle(options, bundle) {
    // 仅在生产构建且是 Web 模式时生效
    if (process.env.BUILD_MODE !== 'web') return;
    
    // 读取源 index.html 并修改
    const srcHtml = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');
    
    let html = srcHtml;
    
    // 移除源文件中的 <script type="module" src="/src/..."> 标签
    html = html.replace(/<script\s+type="module"\s+src="\/src\/[^"]+"><\/script>/g, '');
    
    // 根据 BUILD_TARGET 决定路径类型
    const isLocalBuild = process.env.BUILD_TARGET === 'local';
    const cssPrefix = isLocalBuild ? './' : '/';
    
    // 在 </head> 前动态注入 CSS 引用（仅 Web 模式）
    const cssLinks = `
  <!-- Markdown 预览样式 -->
  <link rel="stylesheet" href="${cssPrefix}content.css">
  <!-- KaTeX 数学公式样式 -->
  <link rel="stylesheet" href="${cssPrefix}libs/katex.min.css">`;
    
    html = html.replace('</head>', `${cssLinks}\n</head>`);
    
    // 在 </body> 前添加构建后的脚本标签
    const scriptSrc = isLocalBuild ? './main.js' : '/main.js';
    html = html.replace('</body>', `\n  <script src="${scriptSrc}"></script>\n</body>`);
    
    // 将修改后的 HTML 添加到构建产物中
    bundle['index.html'] = {
      type: 'asset',
      fileName: 'index.html',
      source: html,
    };
  }
};

// Web 模式专用插件：只复制必要的静态资源（排除 manifest.json）
const webModeAssetsPlugin = {
  name: 'web-mode-assets',
  apply: 'build',
  closeBundle() {
    // 仅在生产构建且是 Web 模式时生效
    if (process.env.BUILD_MODE !== 'web') return;
    
    const outDir = process.env.BUILD_TARGET === 'local' ? 'dist-web' : 'dist-web-server';
    const publicDir = resolve(__dirname, 'public');
    const outputDir = resolve(__dirname, outDir);
    
    // 需要复制的目录
    const dirsToCopy = ['libs', 'icons'];
    
    dirsToCopy.forEach(dirName => {
      const srcPath = resolve(publicDir, dirName);
      const destPath = resolve(outputDir, dirName);
      
      if (existsSync(srcPath)) {
        // 递归复制目录
        function copyDir(src, dest) {
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          
          const entries = readdirSync(src, { withFileTypes: true });
          entries.forEach(entry => {
            const srcPath = resolve(src, entry.name);
            const destPath = resolve(dest, entry.name);
            
            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          });
        }
        
        copyDir(srcPath, destPath);
      }
    });
  }
};

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development'
  
  // Extension 模式下的构建入口
  const extensionInput = {
    content: resolve(__dirname, 'src/content.js'),
  };

  // Web 模式下的构建入口（只构建一个合并的 JS 文件）
  const webInput = {
    main: resolve(__dirname, 'src/dev-main.js'),
  };

  // 根据模式选择入口和输出目录
  const isWebMode = process.env.BUILD_MODE === 'web';
  const input = isWebMode ? webInput : { ...extensionInput, ...(!isDev ? webInput : {}) };
  
  // 根据 BUILD_TARGET 决定输出目录
  let outDir = 'dist';
  if (isWebMode) {
    outDir = process.env.BUILD_TARGET === 'local' ? 'dist-web' : 'dist-web-server';
  }
  
  // 根据目标设置 base 路径
  const base = (isWebMode && process.env.BUILD_TARGET !== 'local') ? '/' : './';

  return {
    base, // 本地使用相对路径，服务器部署使用绝对路径
    build: {
      outDir,
      emptyOutDir: true, // 每次构建前清空 dist 目录
      minify: 'terser', // 使用 terser 进行更激进的压缩
      terserOptions: {
        compress: {
          // 生产环境移除所有 console.* 调用，减小包体积并避免泄露调试信息
          drop_console: true,
        },
        format: {
          // 保留匹配此正则的注释（用于保留以 ! 开头的 banner 注释，如 /*! ... */）
          comments: /^!/,
        }
      },
      rollupOptions: {
        input,
        plugins: [
          bannerPlugin, 
          ...(isWebMode ? [webModeHtmlPlugin, webModeAssetsPlugin] : [])
        ],
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
      copyPublicDir: !isWebMode // Web 模式不复制 public 目录（避免包含 manifest.json）
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