---
name: md-viewer-project
description: 指导 AI 快速理解 md-viewer Chrome 扩展项目的架构、代码规范和开发约定。当用户在该项目（f:\Protest\chromeplug\md-view）中工作、修改或扩展 md-viewer Chrome 插件时自动应用。包含项目结构、核心模块职责、技术栈、代码注释规范（JSDoc 中文注释要求）和常见开发模式。
---

# MD Viewer - Chrome Markdown 预览插件

## 项目概述

MD Viewer 是一个基于 **Manifest V3** 的 Chrome 浏览器扩展，用于自动检测并预览浏览器中打开的 Markdown 文件。采用 **Vite** 构建，核心解析库（marked、DOMPurify、KaTeX）本地化打包，Mermaid 图表通过在线 CDN 加载。

## 项目结构

```
md-view/
├── public/                      # 静态资源目录（构建时自动复制到 dist/）
│   ├── manifest.json            # Chrome 插件清单 (Manifest V3)
│   ├── icons/                   # 插件图标 (16x16, 48x48, 128x128)
│   └── libs/                    # 第三方库 (mermaid, katex, auto-render)
├── src/                         # 源代码目录
│   ├── content.js               # 内容脚本 - 核心逻辑 (~2400 行)
│   ├── content.css              # 样式文件 - 支持亮/暗色主题
│   ├── dev-main.js              # 开发模式入口（测试页面用）
│   └── modules/                 # 功能模块（v1.3.0 新增）
│       ├── screenshot.js        # 截图模块（自动截图 + 手动选框截图）
│       ├── recent-files.js      # 最近文件管理模块
│       └── shortcuts.js         # 快捷键说明弹窗模块
├── build-crx.js                 # .crx 打包脚本（签名生成安装包）
├── vite.config.js               # Vite 构建配置
├── index.html                   # 开发测试页面
├── dist/                        # Vite 构建输出目录（开发加载扩展时指向此目录）
├── release/                     # .crx 打包输出目录
│   ├── key.pem                  # RSA 签名私钥（复用保持扩展 ID 一致）
│   └── md-viewer-v{version}.crx # 可直接安装到 Chrome 的扩展包
└── package.json                 # 项目依赖配置
```

## 项目功能

MD Viewer 提供以下核心功能：

### v1.3.0 新增功能 (2026-10-16)

- **截图功能**：支持自动截图和手动选框截图，一键保存 PNG（html2canvas 动态加载）
- **文档搜索**：支持 Ctrl+F 快速搜索文档内容，高亮匹配并精确定位跳转
- **最近文件**：自动记录最近打开的 Markdown 文件，支持二级菜单快速切换
- **快捷键说明**：支持 Ctrl+/ 查看所有可用快捷键
- **全屏 toolbar 悬停**：鼠标移入顶部自动滑出工具栏
- **功能模块化拆分**：screenshot.js、recent-files.js、shortcuts.js

### 核心功能
- **自动检测**：识别浏览器中打开的 `.md` 和 `.markdown` 文件
- **实时预览**：即时渲染 Markdown 为美观的 HTML 页面
- **双模式切换**：一键在预览模式和源码模式之间切换
- **智能目录**：左侧自动生成导航栏，点击可平滑滚动定位
- **主题切换**：支持亮色/暗色模式一键切换，自动记忆用户偏好
- **安全防护**：使用 DOMPurify 防止 XSS 攻击

### 增强渲染
- **Mermaid 图表**：自动渲染流程图、时序图等（需联网）
- **数学公式**：支持 KaTeX 渲染行内和块级数学公式
- **代码块工具栏**：语言标签、源码切换、复制 MD/纯代码
- **表格工具栏**：源码切换、复制、导出 CSV/Excel
- **Mermaid 工具栏**：源码切换、下载 PNG/SVG

### 交互功能
- **复制功能**：快速复制 Markdown 源码到剪贴板
- **下载功能**：下载原始 Markdown 文件
- **实时编辑**：支持在线修改 Markdown 内容，提供重置功能

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Manifest V3 | 3.0 | Chrome 扩展标准 |
| Vite | 4.4.9 | 前端构建工具 |
| marked | ^11.1.0 | Markdown 解析器 |
| DOMPurify | ^3.0.6 | HTML 安全过滤 |
| KaTeX | 0.16.x | 数学公式渲染 (本地) |
| html2canvas | ^1.4.1 | 截图功能 (动态加载) |
| Mermaid | 10.x | 图表渲染 (在线 CDN) |
| terser | ^5.48.0 | 代码压缩 |

## 核心模块职责

### modules/ 功能模块 (v1.3.0 新增)

#### screenshot.js - 截图模块
- `takeScreenshot()` - 自动截取当前预览内容并下载 PNG
- `takeManualScreenshot()` - 手动选框截图，支持拖动选框、保存/取消/重新选择
- `getHtml2Canvas()` - 动态加载 html2canvas 库（通过 libs/ 目录）
- `showToast()` - 显示操作提示

#### recent-files.js - 最近文件模块
- `getRecentFiles()` - 从 localStorage 获取最近文件列表
- `addRecentFile(path, name, content)` - 添加文件到最近列表
- `clearRecentFiles()` - 清空最近文件
- `renderRecentFiles(submenu)` - 渲染最近文件到二级菜单

#### shortcuts.js - 快捷键模块
- `showShortcutsDialog()` - 显示快捷键说明弹窗

### content.js 模块划分

1. **初始化配置与全局变量** (约 1-250 行)
   - `getAssetPath()` - 兼容插件环境和本地测试环境的资源路径获取
   - `loadExternalLib()` - 通用外部库加载器 (Fetch + Blob 模式，兼容 CSP)
   - `loadMermaid()` - 动态加载 Mermaid 库
   - `loadKaTeX()` - 动态加载 KaTeX 库

2. **核心工具函数** (约 250-530 行)
   - `isMarkdownFile()` - 检测当前页面是否为 Markdown 文件
   - `getRawText()` - 从页面提取原始 Markdown 文本
   - `parseMarkdown()` - 解析 Markdown 文本为 HTML，处理 Mermaid 图表和数学公式
   - `processHeadersAndGenerateTOC()` - 为标题添加 ID 并生成目录 HTML

3. **UI 构建与渲染** (约 530-900 行)
   - `createUI()` - 创建插件主界面结构（工具栏 + 主容器 + 目录 + 预览/编辑区域）
   - `renderMarkdown()` - 主渲染入口函数
   - `hideOriginalContent()` - 隐藏浏览器原生渲染内容
   - `addCodeCopyButtons()` - 为代码块添加顶部工具栏
   - `addTableActions()` - 为表格添加顶部工具栏

4. **工具函数** (约 900-1000 行)
   - `extractMarkdownTables()` - 从 Markdown 文本中提取表格源码
   - `tableToCSV()` - 将 HTML 表格转换为 CSV 字符串
   - `downloadSVG()` / `downloadPNG()` - 下载 SVG/PNG 图片

5. **事件绑定与交互逻辑** (约 1000-1560 行)
   - `bindEvents()` - 绑定所有交互事件（主题切换、预览/源码切换、编辑模式、目录导航、代码块/表格/Mermaid 工具栏事件、下载功能等）

6. **启动入口** (约 1560-1572 行)
   - DOMContentLoaded 触发 `renderMarkdown()`
   - 暴露 `window.__mdRenderMarkdown` 供开发模式重新触发

### content.css 关键样式

- CSS 变量定义亮/暗色主题 (`:root` / `[data-theme="dark"]`)
- 工具栏样式 (`#md-viewer-toolbar`) - 渐变背景、固定定位
- 主容器布局 (`#md-main-container`) - Flex 布局，左侧目录 + 右侧内容
- 目录样式 (`.md-toc`) - 包含选中状态高亮
- 代码块/表格/Mermaid 工具栏样式
- Loading 动画 (`#md-loading-overlay`, `.md-spinner`)
- 响应式调整 (`@media (max-width: 768px)`)

### vite.config.js 构建配置

- 入口: `src/content.js`
- 输出文件名固定: `content.js` / `content.css`
- 使用 `terser` 压缩，生产环境移除 `console`
- `copyPublicDir: true` 确保 public 目录（含 libs）被复制到 dist
- 开发模式打开 `index.html` 测试页

## 代码规范（强制执行）

### 1. 注释语言

**所有代码注释必须使用中文。**

### 2. JSDoc 函数注释

**每个函数必须包含 JSDoc 注释，包含参数类型和返回值。**

正确示例:
```javascript
/**
 * 检测当前页面是否为 Markdown 文件
 * @returns {boolean} 当前页面是否为 Markdown 文件
 */
function isMarkdownFile() {
  // ...
}

/**
 * 解析 Markdown 文本为 HTML，并处理 Mermaid 图表
 * @param {string} text - 原始 Markdown 文本
 * @returns {Promise<string>} 渲染后的 HTML 字符串
 */
async function parseMarkdown(text) {
  // ...
}

/**
 * 从页面中提取原始的 Markdown 文本
 * 通常浏览器打开 .md 文件时，内容会包裹在 <pre> 或 <code> 标签中
 * @returns {string} 提取到的原始 Markdown 文本
 */
function getRawText() {
  // ...
}
```

### 3. 代码风格

- **缩进**: 2 个空格
- **字符串**: 单引号
- **分号**: 使用分号结束语句
- **变量声明**: 优先使用 `const`，需要重新赋值时使用 `let`，避免 `var`
- **函数**: 使用函数声明 (`function name()`) 而非箭头函数

### 4. 命名约定

- **函数**: 驼峰命名法，动词开头（如 `getRawText`, `renderMarkdown`）
- **变量**: 驼峰命名法
- **常量**: 全大写下划线分隔（如 `CONFIG`, `LIBS`）
- **CSS 类名**: 前缀 `md-`，使用短横线连接（如 `.md-viewer-controls`, `.md-code-block`）

### 5. 模块组织

代码按功能区域组织，使用注释分隔:
```javascript
// ==========================================
// 1. 初始化配置与全局变量
// ==========================================

// ==========================================
// 2. 核心工具函数
// ==========================================

// ==========================================
// 3. UI 构建与渲染
// ==========================================
```

## 常见开发模式

### 添加新功能的一般步骤

1. 如果涉及 UI 元素：
   - 在 `createUI()` 中添加新的 DOM 元素
   - 在 `content.css` 中添加对应的样式
   - 在 `bindEvents()` 中添加交互逻辑

2. 如果涉及 Markdown 解析增强：
   - 在 `parseMarkdown()` 中添加处理逻辑
   - 可能需要添加新的辅助函数

3. 如果涉及外部库：
   - 在 `LIBS` 对象中定义库的配置
   - 添加加载函数（如 `loadMermaid()`, `loadKaTeX()`）
   - 使用 `loadExternalLib()` 加载

### 添加/修改工具栏按钮

参考现有模式：
1. 创建包装元素 (wrapper, header, actions)
2. 设置 `data-md-source` 存储原始 Markdown
3. 添加按钮和事件监听（使用 `e.target.closest('.class-name')` 事件委托）
4. 在 `content.css` 中添加样式（命名遵循 `.md-{type}-block`, `.md-{type}-header` 等）

### 开发测试流程

1. `npm run dev` - 启动开发服务器，访问 http://localhost:5173
2. `npm run build` - 构建生产版本到 dist/
3. `npm run build:pack` - 先构建生产版本，再打包为 .crx 安装包（输出到 release/）
4. 在 Chrome 扩展管理页面加载 dist/ 目录测试
5. 修改代码后重新构建并刷新扩展

## 依赖加载说明

### manifest.json 加载顺序

```json
"js": [
  "libs/mermaid.min.js",
  "libs/katex.min.js",
  "libs/auto-render.min.js",
  "content.js"
]
```

### 动态加载策略

- **KaTeX**: 通过 `loadExternalLib()` 按顺序加载 CSS -> katex.js -> auto-render.js
- **Mermaid**: 优先使用 manifest 预加载的全局变量，否则通过 `loadExternalLib()` 动态加载
- **CSP 兼容**: 使用 `fetch` + `Blob URL` 方式绕过 `script-src` 限制
