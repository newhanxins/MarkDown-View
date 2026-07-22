// 导入样式文件
import './content.css';
// 导入核心依赖库
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// import mermaid from 'mermaid';

(function() {
  'use strict';

  // ==========================================
  // 1. 初始化配置与全局变量
  // ==========================================

  // 【新增】兼容函数：在插件环境和本地测试环境中都能获取资源路径
  function getAssetPath(path) {
    // 如果是 Chrome 扩展环境
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    // 如果是本地测试环境 (Vite Dev Server)，直接返回相对路径
    // 假设 libs 文件夹在 public 目录下，开发时 Vite 会从 public 根目录提供
    return '/' + path;
  }

  // 库的地址配置
  const LIBS = {
    mermaid: {
      local: getAssetPath('libs/mermaid.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
      globalVar: 'mermaid'
    },
    katexCss: {
      local: getAssetPath('libs/katex.min.css'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      isCss: true
    },
    katexJs: {
      local: getAssetPath('libs/katex.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
      globalVar: 'katex'
    },
    katexAutoRender: {
      local: getAssetPath('libs/auto-render.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
      globalVar: 'renderMathInElement'
    }
  };

  let mermaidLoaded = false;
  let mermaidInstance = null;
  let katexLoaded = false;// 用于标记 KaTeX 是否已加载

  // 功能配置开关：默认为 true，方便后续通过配置文件或 UI 控制
  const CONFIG = {
    enableTOC: true,      // 是否启用左侧目录导航
    enableMermaid: true,  // 是否启用 Mermaid 图表渲染
    enableEditor: true,    // 是否启用实时编辑功能
    enableMath: true // 新增：数学公式开关
  };

  let originalContent = ''; // 用于存储文件打开时的原始内容，支持“重置”功能

  // 【新增】全局映射表：存储 { "原始文本": "heading-x" }
  let headingIdMap = {};

   /**
   * 【公共函数】通用外部库加载器 (Fetch + Blob 模式，兼容 CSP)
   * @param {string} url - 脚本或样式表的 URL (优先使用本地 chrome.runtime.getURL)
   * @param {boolean} isCss - 是否为 CSS 文件
   * @returns {Promise<void>}
   */
  async function loadExternalLib(url, isCss = false) {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. 尝试 Fetch 获取内容 (绕过 CSP 对 script-src 的限制)
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const content = await response.text();

        if (isCss) {
          // 2a. 处理 CSS: 创建 Style 标签
          const style = document.createElement('style');
          style.textContent = content;
          document.head.appendChild(style);
          resolve();
        } else {
          // 2b. 处理 JS: 创建 Blob URL 并插入 Script 标签
          const blob = new Blob([content], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          
          const script = document.createElement('script');
          script.src = blobUrl;
          
          script.onload = () => {
            URL.revokeObjectURL(blobUrl); // 清理内存
            resolve();
          };
          
          script.onerror = (e) => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Script execution failed for ${url}`));
          };
          
          document.head.appendChild(script);
        }
      } catch (error) {
        console.warn(`Failed to load lib from ${url}, trying fallback if available...`, error);
        reject(error);
      }
    });
  }

  /**
   * 动态加载 Mermaid 库
   */
  async function loadMermaid() {
    if (mermaidLoaded && mermaidInstance) return mermaidInstance;
    
    // 如果全局已存在（例如通过 manifest 预加载），直接使用
    if (window.mermaid) {
      console.log('Using existing mermaid instance...');
      mermaidInstance = window.mermaid;
      mermaidLoaded = true;
      if (!mermaidInstance.__initialized) {
        mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaidInstance.__initialized = true;
      }
      return mermaidInstance;
    }

    // 否则动态加载
    try {
      console.log('loadExternalLib Loading Mermaid...');
      await loadExternalLib(LIBS.mermaid.local);
      
      if (window.mermaid) {
        mermaidInstance = window.mermaid;
        mermaidLoaded = true;
        mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaidInstance.__initialized = true;
        return mermaidInstance;
      } else {
        throw new Error('Mermaid global object not found after loading');
      }
    } catch (e) {
      console.error('Mermaid load error:', e);
      throw e;
    }

  }





  async function loadMermaidsss() {
    if (mermaidLoaded && mermaidInstance) return mermaidInstance;
    
    // 如果全局已经存在，直接使用
    if (window.mermaid) {
      mermaidInstance = window.mermaid;
      mermaidLoaded = true;
      if (!mermaidInstance.__initialized) {
         mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
         mermaidInstance.__initialized = true;
      }
      return mermaidInstance;
    }

    try {
      // 1. 获取本地文件内容
      const response = await fetch(MERMAID_LOCAL_PATH);
      if (!response.ok) throw new Error(`Failed to fetch Mermaid: ${response.status}`);
      
      const scriptText = await response.text();
      
      // 2. 创建 Blob 对象
      const blob = new Blob([scriptText], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      
      // 3. 通过 Blob URL 加载脚本
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = blobUrl;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      // 4. 清理 Blob URL
      URL.revokeObjectURL(blobUrl);
      
      // 5. 检查全局变量
      if (window.mermaid) {
        mermaidInstance = window.mermaid;
        mermaidLoaded = true;
        mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaidInstance.__initialized = true;
        return mermaidInstance;
      } else {
        throw new Error('Mermaid global object not found after Blob load');
      }
    } catch (error) {
      console.error('Mermaid load failed:', error);
      throw error;
    }
  }

  /**
   * 动态加载 KaTeX
   */
  async function loadKaTeX() {
    if (katexLoaded) return;
    if (window.katex && window.renderMathInElement) {
      katexLoaded = true;
      console.log('KaTeX already initialized.');
      return;
    }
    try {
      // 按顺序加载：先 CSS，再 katex.js，最后 auto-render.js
      console.log('Loading KaTeX...');
      await loadExternalLib(LIBS.katexCss.local, true);
      await loadExternalLib(LIBS.katexJs.local);
      
      // 验证 katex 是否完全加载，包括 ParseError
      if (!window.katex || typeof window.katex.ParseError === 'undefined') {
        throw new Error('KaTeX loaded but ParseError is undefined');
      }
      
      await loadExternalLib(LIBS.katexAutoRender.local);
      
      // 验证 auto-render 是否加载成功
      if (typeof window.renderMathInElement !== 'function') {
        throw new Error('auto-render.min.js loaded but renderMathInElement is not available');
      }
      
      katexLoaded = true;
      console.log('KaTeX initialized successfully.');
    } catch (e) {
      console.error('KaTeX load error:', e);
      throw e;
    }
  }

  // ==========================================
  // 2. 核心工具函数
  // ==========================================

  /**
   * 检测当前页面是否为 Markdown 文件
   * @returns {boolean}
   */
  function isMarkdownFile() {
    const pathname = window.location.pathname;
    // 检查路径后缀
    if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) return true;
    
    // 检查 MIME 类型
    const contentType = document.contentType;
    if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'))) return true;

    // 【新增】兼容本地测试：如果 body 下有非空的 pre 标签（排除 raw-md）且没有插件 UI，也视为 md 文件
    const bodyPre = document.querySelector('body > pre');
    if (bodyPre && bodyPre.id !== 'raw-md' && bodyPre.textContent.trim().length > 0 && !document.getElementById('md-viewer-toolbar')) {
        return true;
    }

    // 【新增】兼容开发模式：如果存在 raw-md 元素且有内容
    const rawMd = document.getElementById('raw-md');
    if (rawMd && rawMd.textContent.trim().length > 0) {
        return true;
    }

    return false;
  }

  /**
   * 从页面中提取原始的 Markdown 文本
   * 通常浏览器打开 .md 文件时，内容会包裹在 <pre> 或 <code> 标签中
   * @returns {string}
   */
  function getRawText() {
    // 开发模式下优先使用 raw-md 元素
    const rawMd = document.getElementById('raw-md');
    if (rawMd) return rawMd.textContent;

    const preElement = document.querySelector('pre');
    if (preElement) return preElement.textContent;

    const codeElement = document.querySelector('code');
    if (codeElement) return codeElement.textContent;

    return document.body.innerText;
  }

  /**
   * 解析 Markdown 文本为 HTML，并处理 Mermaid 图表
   * @param {string} text - 原始 Markdown 文本
   * @returns {Promise<string>} - 渲染后的 HTML 字符串
   */
  async function parseMarkdown(text) {
    try {
      // 第一步：将 Markdown 转换为 HTML 并进行安全过滤
      const rawHtml = marked.parse(text);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      
      // 第二步：创建临时 DOM 容器以便操作节点
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanHtml;
      
      // 第三步：如果启用了 Mermaid，查找并渲染代码块
      if (CONFIG.enableMermaid) {
        // 查找所有语言标记为 mermaid 的代码块
        const codeBlocks = tempDiv.querySelectorAll('pre code.language-mermaid');
        if (codeBlocks.length > 0) {
          // 确保 Mermaid 已加载
          await loadMermaid();
          for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const graphDefinition = block.textContent;
            // 生成唯一 ID，避免 Mermaid 渲染冲突
            const id = `mermaid-${Date.now()}-${i}`;
            
            try {
              // 调用 Mermaid API 渲染 SVG
              const { svg } = await mermaidInstance.render(id, graphDefinition);
              const pre = block.parentElement;
              const div = document.createElement('div');
              div.className = 'mermaid-diagram'; // 添加类名方便样式控制
              div.innerHTML = svg;
              // 替换原有的代码块为渲染后的 SVG
              pre.replaceWith(div);
            } catch (e) {
              console.error('Mermaid render error:', e);
              // 渲染失败时保留原始代码块或显示错误提示
              block.parentElement.innerHTML = `<div class="md-error">Mermaid 语法错误</div>`;
            }
          }
        }
        
      }
      // 2. 处理数学公式 (KaTeX)
      if (CONFIG.enableMath) {
        // 确保 KaTeX 已加载
        if (!katexLoaded) {
          await loadKaTeX();
        }
        
        // 使用 KaTeX 的 auto-render 扩展自动查找 $...$ 和 $$...$$
        if (typeof window.renderMathInElement === 'function') {
          window.renderMathInElement(tempDiv, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        }
        
      }
      
      return tempDiv.innerHTML;
    } catch (error) {
      console.error('Parsing error:', error);
      return `<div class="md-error">解析错误: ${error.message}</div>`;
    }
  }

  /**
   * 为页面中的标题添加 ID，并生成目录 HTML
   * @param {HTMLElement} contentContainer - 包含预览内容的容器
   * @returns {string} - TOC 的 HTML 字符串
   */
  function processHeadersAndGenerateTOC(contentContainer) {
    if (!CONFIG.enableTOC) return '';
    
    // 重置映射表
    headingIdMap = {};

    // 【修改】扩大选择范围，支持 h1 到 h6
    const headers = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
    headers.forEach((header, index) => {
      // 【关键修复】直接在真实的 DOM 元素上设置 ID
      const id = `heading-${index}`;
      header.id = id; 
      
      // 【关键】建立映射：去除首尾空格后的文本 -> 新 ID
      const text = header.textContent.trim();
      headingIdMap[text] = id;

      const level = parseInt(header.tagName.substring(1));
      // 【修改】优化缩进逻辑，每层增加 12px，最大不超过 60px 防止过宽
      const indent = Math.min((level - 1) * 12, 60);
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 4px; font-size: ${14 - (level - 1)}px;">
        <a href="javascript:void(0)" class="toc-link" data-target="${id}" title="${header.textContent}">
          ${header.textContent}
        </a>
      </li>`;
    });
    tocHtml += '</ul></div>';
    return tocHtml;
  }

  /**
   * 根据 HTML 内容生成目录 (TOC)
   * @param {string} htmlContent - 已渲染的 HTML 内容
   * @returns {string} - TOC 的 HTML 字符串
   */
  function generateTOC(htmlContent) {
    if (!CONFIG.enableTOC) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    // 【修改】扩大选择范围
    const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
    headers.forEach((header, index) => {
      // 为每个标题生成唯一 ID，用于锚点跳转
      const id = `heading-${index}`;
      header.id = id; 
      
      const level = parseInt(header.tagName.substring(1));
      // 根据标题层级设置缩进
      const indent = Math.min((level - 1) * 12, 60);
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 4px; font-size: ${14 - (level - 1)}px;">
        <a href="#${id}" class="toc-link" data-target="${id}" title="${header.textContent}">
          ${header.textContent}
        </a>
      </li>`;
    });
    tocHtml += '</ul></div>';
    return tocHtml;
  }

  // ==========================================
  // 3. UI 构建与渲染
  // ==========================================

  /**
   * 创建插件的主界面结构
   * @returns {Object} 包含主要 DOM 元素的引用对象
   */
  function createUI() {
    // 1. 顶部工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'md-viewer-toolbar';
    
    let buttonsHtml = `
      <button id="md-toggle-btn" class="md-btn active">👁️ 预览</button>
      <button id="md-copy-btn" class="md-btn">📋 复制</button>
      <button id="md-download-btn" class="md-btn">💾 下载</button>
      <button id="md-theme-btn" class="md-btn">🌙 暗色</button>
    `;

    // 如果开启了编辑器功能，添加编辑和重置按钮
    if (CONFIG.enableEditor) {
      buttonsHtml += `<button id="md-edit-btn" class="md-btn">✏️ 编辑</button>`;
      buttonsHtml += `<button id="md-reset-btn" class="md-btn" style="display:none;">↩️ 重置</button>`;
    }

    toolbar.innerHTML = `
      <div class="md-viewer-controls">
        ${buttonsHtml}
        <span class="md-file-name" id="md-file-name"></span>
      </div>
    `;

    // 2. 主容器（采用 Flex 布局：左侧 TOC + 右侧内容）
    const mainContainer = document.createElement('div');
    mainContainer.id = 'md-main-container';
    
    // 左侧目录侧边栏
    const tocContainer = document.createElement('div');
    tocContainer.id = 'md-toc-sidebar';
    
    // 右侧内容区域
    const contentArea = document.createElement('div');
    contentArea.id = 'md-content-area';

    // 加载动画容器
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'md-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="md-spinner"></div>
      <div class="md-loading-text">正在渲染 Markdown...</div>
    `;

    // 预览视图容器
    const previewContainer = document.createElement('div');
    previewContainer.id = 'md-preview-container';
    
    // 编辑视图容器（Textarea）
    const editorContainer = document.createElement('textarea');
    editorContainer.id = 'md-editor-container';
    editorContainer.placeholder = "在此输入 Markdown 内容...";
    editorContainer.style.display = 'none'; // 默认隐藏

    contentArea.appendChild(loadingOverlay);
    contentArea.appendChild(previewContainer);
    contentArea.appendChild(editorContainer);
    
    mainContainer.appendChild(tocContainer);
    mainContainer.appendChild(contentArea);

    // 将 UI 插入到 body 最前方
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertBefore(mainContainer, document.body.firstChild.nextSibling);

    return { toolbar, tocContainer, previewContainer, editorContainer, loadingOverlay };
  }

  /**
   * 主渲染入口函数
   */
  async function renderMarkdown() {
    if (!isMarkdownFile()) return;

    // 清除已有 UI，防止重复创建（开发模式下多次加载时有用）
    const existingToolbar = document.getElementById('md-viewer-toolbar');
    const existingMain = document.getElementById('md-main-container');
    if (existingToolbar) existingToolbar.remove();
    if (existingMain) existingMain.remove();

    console.log('MD Viewer: Markdown file detected.');

    // 预加载 KaTeX (如果开启了数学公式支持)
    if (CONFIG.enableMath) {
      loadKaTeX().catch(err => console.error('KaTeX load failed:', err));
    }
    
    // 获取原始内容并保存
    const rawText = getRawText();

    // 开发模式下：内容为空时不渲染，等待用户上传文件
    if (!rawText || rawText.trim().length === 0) {
      console.log('MD Viewer: raw content is empty, skipping render.');
      return;
    }

    originalContent = rawText; 
    window.__mdRawContent = rawText;
    
    // 【修改】处理中文文件名乱码：先获取路径，再解码
    let fileName = window.location.pathname.split('/').pop() || 'untitled.md';
    try {
      fileName = decodeURIComponent(fileName);
    } catch (e) {
      console.warn('Filename decode error', e);
    }
    window.__mdFileName = fileName;

    // 创建界面
    const { tocContainer, previewContainer, editorContainer, loadingOverlay } = createUI();
    
    // 设置文件名显示
    document.getElementById('md-file-name').textContent = window.__mdFileName;
    editorContainer.value = rawText;

    // 执行首次渲染
    try {
      const html = await parseMarkdown(rawText);
      previewContainer.innerHTML = html;
      addCodeCopyButtons(previewContainer);
      addTableActions(previewContainer);
    } finally {
      // 渲染完成后隐藏 loading（无论成功或失败）
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
    
    // 生成目录
    if (CONFIG.enableTOC) {
      // tocContainer.innerHTML = generateTOC(html); 
      // 【关键修复】在内容已经插入 DOM 后，再处理标题 ID 并生成目录
      const tocHtml = processHeadersAndGenerateTOC(previewContainer);
      tocContainer.innerHTML = tocHtml;
      
      // 绑定目录点击事件（使用事件委托）
      tocContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.toc-link');
        if (link) {
          e.preventDefault();
          // 【新增】处理选中状态
          const allLinks = tocContainer.querySelectorAll('.toc-link');
          allLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');

          const targetId = e.target.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            // 方式一 滚动到指定元素
            targetEl.scrollIntoView({ behavior: 'smooth' });
            // 方式二 获取元素位置并减去工具栏高度（解决滚动位置偏移）
            // const elementPosition = targetEl.getBoundingClientRect().top;
            // const offsetPosition = elementPosition + window.pageYOffset - 80;

            // window.scrollTo({
            //   top: offsetPosition,
            //   behavior: "smooth"
            // });
          }
        }
      });
    }

    // 绑定交互事件
    bindEvents(previewContainer, editorContainer, rawText);
    
    // 隐藏浏览器默认的原始内容显示
    hideOriginalContent();
  }

  /**
   * 隐藏浏览器原生渲染的 <pre> 或 <code> 标签
   */
  function hideOriginalContent() {
    const pre = document.querySelector('body > pre');
    const code = document.querySelector('body > code');
    if (pre) pre.style.display = 'none';
    if (code) code.style.display = 'none';
    
    // 清理 body 下直接的文本节点
    document.body.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = '';
      }
    });
  }

  /**
   * 为代码块添加顶部工具栏（语言标签 + 操作按钮）和源码/渲染切换功能
   */
  function addCodeCopyButtons(previewContainer) {
    const codeBlocks = previewContainer.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      // 避免重复添加
      if (pre.parentElement && pre.parentElement.classList.contains('md-code-block')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'md-code-block';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // 获取代码块的语言标识
      const codeEl = pre.querySelector('code');
      let lang = '';
      if (codeEl) {
        const langMatch = codeEl.className.match(/language-(\w+)/);
        if (langMatch) {
          lang = langMatch[1];
        }
      }

      // 创建原始 Markdown 文本（包含 ``` 包裹）
      const rawCodeText = codeEl ? codeEl.textContent : '';
      const mdSource = '\`\`\`' + lang + '\n' + rawCodeText + '\n\`\`\`';
      wrapper.setAttribute('data-md-source', mdSource);

      // 顶部工具栏
      const header = document.createElement('div');
      header.className = 'md-code-header';

      // 语言标签（左侧）
      const langLabel = document.createElement('span');
      langLabel.className = 'md-code-lang';
      langLabel.textContent = lang || 'code';
      header.appendChild(langLabel);

      // 操作按钮容器（右侧）
      const actions = document.createElement('div');
      actions.className = 'md-code-actions';

      // 源码/渲染切换按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'md-code-toggle';
      toggleBtn.textContent = '源码';
      toggleBtn.type = 'button';
      actions.appendChild(toggleBtn);

      // 复制 MD 格式按钮
      const mdBtn = document.createElement('button');
      mdBtn.className = 'md-copy-md-btn';
      mdBtn.textContent = '复制 MD';
      mdBtn.type = 'button';
      actions.appendChild(mdBtn);

      // 复制纯代码按钮
      const btn = document.createElement('button');
      btn.className = 'md-copy-code-btn';
      btn.textContent = '复制';
      btn.type = 'button';
      actions.appendChild(btn);

      header.appendChild(actions);
      wrapper.insertBefore(header, pre);

      // 源码显示区域（默认隐藏）
      const sourceArea = document.createElement('textarea');
      sourceArea.className = 'md-code-source';
      sourceArea.value = mdSource;
      sourceArea.readOnly = true;
      wrapper.appendChild(sourceArea);
    });
  }

  /**
   * 从 Markdown 文本中提取所有表格源码
   */
  function extractMarkdownTables(mdText) {
    if (!mdText) return [];
    const lines = mdText.split('\n');
    const tables = [];
    let currentTable = [];

    for (const line of lines) {
      if (line.trim().startsWith('|')) {
        currentTable.push(line);
      } else {
        if (currentTable.length >= 2) {
          tables.push(currentTable.join('\n'));
        }
        currentTable = [];
      }
    }

    if (currentTable.length >= 2) {
      tables.push(currentTable.join('\n'));
    }

    return tables;
  }

  /**
   * 为表格添加顶部工具栏（类型标签 + 操作按钮）
   */
  function addTableActions(previewContainer) {
    const tables = previewContainer.querySelectorAll('table');
    const tableSources = extractMarkdownTables(window.__mdRawContent || '');

    tables.forEach((table, index) => {
      // 避免重复添加
      if (table.parentElement && table.parentElement.classList.contains('md-table-block')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'md-table-block';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      // 获取原始 Markdown 表格源码
      const mdSource = tableSources[index] || '';
      wrapper.setAttribute('data-md-source', mdSource);

      // 顶部工具栏
      const header = document.createElement('div');
      header.className = 'md-table-header';

      // 类型标签（左侧）
      const typeLabel = document.createElement('span');
      typeLabel.className = 'md-table-type';
      typeLabel.textContent = 'Table';
      header.appendChild(typeLabel);

      // 操作按钮容器（右侧）
      const actions = document.createElement('div');
      actions.className = 'md-table-actions';

      // 源码/渲染切换按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'md-table-toggle';
      toggleBtn.textContent = '源码';
      toggleBtn.type = 'button';
      actions.appendChild(toggleBtn);

      // 复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'md-copy-table-btn';
      copyBtn.textContent = '复制';
      copyBtn.type = 'button';
      actions.appendChild(copyBtn);

      // 下载 CSV 按钮
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'md-download-csv-btn';
      downloadBtn.textContent = '下载 CSV';
      downloadBtn.type = 'button';
      actions.appendChild(downloadBtn);

      // 下载 Excel 按钮
      const downloadExcelBtn = document.createElement('button');
      downloadExcelBtn.className = 'md-download-excel-btn';
      downloadExcelBtn.textContent = '下载 Excel';
      downloadExcelBtn.type = 'button';
      actions.appendChild(downloadExcelBtn);

      header.appendChild(actions);
      wrapper.insertBefore(header, table);

      // 源码显示区域（默认隐藏）
      const sourceArea = document.createElement('textarea');
      sourceArea.className = 'md-table-source';
      sourceArea.value = mdSource;
      sourceArea.readOnly = true;
      wrapper.appendChild(sourceArea);
    });
  }

  /**
   * 将 HTML 表格数据转换为 CSV 字符串
   */
  function tableToCSV(table) {
    const rows = table.querySelectorAll('tr');
    const csvLines = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowData = [];
      cells.forEach(cell => {
        let text = cell.textContent.trim();
        // 处理包含逗号、引号或换行的单元格
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        rowData.push(text);
      });
      csvLines.push(rowData.join(','));
    });
    return csvLines.join('\n');
  }

  // ==========================================
  // 4. 事件绑定与交互逻辑
  // ==========================================

  function bindEvents(previewContainer, editorContainer, initialRawText) {
    let isPreviewMode = true; // 当前是否为预览模式
    let isEditMode = false;   // 当前是否为编辑模式

    const toggleBtn = document.getElementById('md-toggle-btn');
    const editBtn = document.getElementById('md-edit-btn');
    const resetBtn = document.getElementById('md-reset-btn');
    const themeBtn = document.getElementById('md-theme-btn');
    const tocSidebar = document.getElementById('md-toc-sidebar');

    // --- 主题切换逻辑 ---
    if (themeBtn) {
      // 检查本地存储的主题偏好
      const savedTheme = localStorage.getItem('md-viewer-theme');
      if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️ 亮色';
      }

      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          document.documentElement.removeAttribute('data-theme');
          themeBtn.textContent = '🌙 暗色';
          localStorage.setItem('md-viewer-theme', 'light');
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          themeBtn.textContent = '☀️ 亮色';
          localStorage.setItem('md-viewer-theme', 'dark');
        }
      });
    }

    // --- 切换 预览/源码 模式 ---
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (isEditMode) return; // 编辑模式下禁用此切换
        
        isPreviewMode = !isPreviewMode;
        previewContainer.style.display = isPreviewMode ? 'block' : 'none';
        editorContainer.style.display = isPreviewMode ? 'none' : 'block';
        
        toggleBtn.innerHTML = isPreviewMode ? '👁️ 预览' : '📝 源码';
        toggleBtn.classList.toggle('active', isPreviewMode);
        
        // 源码模式下暂时隐藏 TOC 以提供更宽的视野
        if (tocSidebar) tocSidebar.style.display = isPreviewMode ? 'block' : 'none';
      });
    }

    // --- 进入/退出 编辑模式 ---
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        
        if (isEditMode) {
          // 进入编辑状态
          editorContainer.style.display = 'block';
          previewContainer.style.display = 'none';
          editorContainer.value = window.__mdRawContent; // 加载当前内容
          
          editBtn.innerHTML = '✅ 完成';
          editBtn.classList.add('active');
          
          if (resetBtn) resetBtn.style.display = 'inline-block';
          if (toggleBtn) toggleBtn.style.display = 'none';
          if (tocSidebar) tocSidebar.style.display = 'none';
        } else {
          // 退出编辑状态，同步最终结果
          window.__mdRawContent = editorContainer.value;
          parseMarkdown(editorContainer.value).then(html => {
            previewContainer.innerHTML = html;
            addCodeCopyButtons(previewContainer);
            addTableActions(previewContainer);
            // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
            if (CONFIG.enableTOC && tocSidebar) {
              tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
            }
          });

          isPreviewMode = true;
          previewContainer.style.display = 'block';
          editorContainer.style.display = 'none';
          
          editBtn.innerHTML = '✏️ 编辑';
          editBtn.classList.remove('active');
          
          if (resetBtn) resetBtn.style.display = 'none';
          if (toggleBtn) toggleBtn.style.display = 'inline-block';
          if (tocSidebar) tocSidebar.style.display = 'block';
        }
      });
    }

    // --- 实时编辑监听 (带防抖) ---
    if (editorContainer) {
      editorContainer.addEventListener('input', () => {
        if (isEditMode) {
          window.__mdRawContent = editorContainer.value;
          
          // 防抖处理：停止输入 500ms 后再重新渲染，提升性能
          clearTimeout(window.__mdRenderTimer);
          window.__mdRenderTimer = setTimeout(() => {
            parseMarkdown(editorContainer.value).then(html => {
              previewContainer.innerHTML = html;
              addCodeCopyButtons(previewContainer);
              addTableActions(previewContainer);
              // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
              // 实时更新目录
              if (CONFIG.enableTOC && tocSidebar) {
                tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
              }
            });
          }, 500);
        }
      });
    }

    // --- 重置功能 ---
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('确定要放弃所有修改并重置到原始内容吗？')) {
          editorContainer.value = originalContent;
          window.__mdRawContent = originalContent;
          // 立即触发一次渲染更新
          parseMarkdown(originalContent).then(html => {
            previewContainer.innerHTML = html;
            addCodeCopyButtons(previewContainer);
            addTableActions(previewContainer);
            // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
            if (CONFIG.enableTOC && tocSidebar) {
              tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
            }
          });
        }
      });
    }


    // --- 【新增】处理内容区域内的锚点跳转 (解决右侧点击目录无反应的问题) ---
    // 使用事件委托，监听整个 previewContainer 内的点击
    previewContainer.addEventListener('click', (e) => {
      // 查找最近的 <a> 标签
      const link = e.target.closest('a');
      if (link) {
        const hash = link.getAttribute('href');
        // 如果链接是以 # 开头的内部锚点
        if (hash && hash.startsWith('#')) {
          e.preventDefault(); // 阻止默认跳转行为
          let targetEl = null;
          let rawTarget  = hash.substring(1); // 去掉 # 号
          console.log('rawTarget:', decodeURIComponent(hash));
          // 1. 优先尝试直接通过 ID 查找（适用于插件生成的目录链接 #heading-x）
          targetEl = document.getElementById(rawTarget);

          // 2. 如果没找到，尝试解码后查找（适用于 Marked 生成的中文链接 #功能特性）
          if (!targetEl) {
            try {
              const decodedTarget = decodeURIComponent(rawTarget);
              targetEl = document.getElementById(decodedTarget);
            } catch (err) {
              // 忽略解码错误
            }
          }
          // 3. 【核心修复】如果还是没找到，尝试通过“文本内容”匹配
          if (!targetEl) {
            const decodedText = decodeURIComponent(rawTarget).replace(/-/g, ' '); // 有些解析器会把空格变成 -
            
            // 遍历所有标题，看是否有文本匹配的
            const allHeaders = previewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            for (let h of allHeaders) {
              if (h.textContent.trim() === decodedText || headingIdMap[decodedText]) {
                targetEl = h;
                break;
              }
            }
            
            // 如果映射表里有，直接用映射表的 ID
            if (!targetEl && headingIdMap[decodedText]) {
               targetEl = document.getElementById(headingIdMap[decodedText]);
            }
          }
          console.log('Target element:', targetEl);
          if (targetEl) {
            // 执行平滑滚动，并减去工具栏的高度 (约 60px)
            const offsetTop = targetEl.getBoundingClientRect().top + window.pageYOffset - 70;
            window.scrollTo({
              top: offsetTop,
              behavior: 'smooth'
            });

            // 【新增】同步更新左侧目录的选中状态
            const tocSidebar = document.getElementById('md-toc-sidebar');
            if (tocSidebar) {
              const allLinks = tocSidebar.querySelectorAll('.toc-link');
              allLinks.forEach(l => l.classList.remove('active'));
              // 找到对应的目录链接并高亮
              const targetId = targetEl.id;
              const activeLink = tocSidebar.querySelector(`.toc-link[data-target="${targetId}"]`);
              if (activeLink) {
                activeLink.classList.add('active');
                // 可选：将选中的目录项滚动到可视区域
                activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }
            
          }else{
            console.warn(`Target element not found for ID: ${targetId}`);
          }
        }
      }
    });

    
    // --- 复制功能 ---
    const copyBtn = document.getElementById('md-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.__mdRawContent || '').then(() => {
          alert('✅ Markdown 源码已复制到剪贴板');
        }).catch(err => {
          console.error('Copy failed:', err);
        });
      });
    }

    // --- 代码块复制功能 ---
    previewContainer.addEventListener('click', (e) => {
      const copyCodeBtn = e.target.closest('.md-copy-code-btn');
      if (copyCodeBtn) {
        e.preventDefault();
        const wrapper = copyCodeBtn.closest('.md-code-block');
        const codeBlock = wrapper ? wrapper.querySelector('pre code') : null;
        const codeText = codeBlock ? codeBlock.textContent : '';
        navigator.clipboard.writeText(codeText).then(() => {
          const originalText = copyCodeBtn.textContent;
          copyCodeBtn.textContent = '已复制';
          copyCodeBtn.classList.add('copied');
          setTimeout(() => {
            copyCodeBtn.textContent = originalText;
            copyCodeBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Code copy failed:', err);
        });
      }

      // --- 代码块复制 MD 格式功能 ---
      const copyMdBtn = e.target.closest('.md-copy-md-btn');
      if (copyMdBtn) {
        e.preventDefault();
        const wrapper = copyMdBtn.closest('.md-code-block');
        const codeBlock = wrapper ? wrapper.querySelector('pre code') : null;
        const codeText = codeBlock ? codeBlock.textContent : '';
        // 提取语言标识，例如 "language-javascript" -> "javascript"
        let lang = '';
        if (codeBlock) {
          const langMatch = codeBlock.className.match(/language-(\w+)/);
          if (langMatch) {
            lang = langMatch[1];
          }
        }
        const mdText = '\`\`\`' + lang + '\n' + codeText + '\n\`\`\`';
        navigator.clipboard.writeText(mdText).then(() => {
          const originalText = copyMdBtn.textContent;
          copyMdBtn.textContent = '已复制';
          copyMdBtn.classList.add('copied');
          setTimeout(() => {
            copyMdBtn.textContent = originalText;
            copyMdBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('MD copy failed:', err);
        });
      }

      // --- 代码块源码/渲染切换功能 ---
      const toggleBtn = e.target.closest('.md-code-toggle');
      if (toggleBtn) {
        e.preventDefault();
        const wrapper = toggleBtn.closest('.md-code-block');
        if (!wrapper) return;
        const pre = wrapper.querySelector('pre');
        const sourceArea = wrapper.querySelector('.md-code-source');
        if (pre && sourceArea) {
          if (pre.style.display === 'none') {
            // 当前是源码模式，切换到渲染模式
            pre.style.display = 'block';
            sourceArea.style.display = 'none';
            toggleBtn.textContent = '源码';
          } else {
            // 当前是渲染模式，切换到源码模式
            pre.style.display = 'none';
            sourceArea.style.display = 'block';
            toggleBtn.textContent = '渲染';
          }
        }
      }
    });

    // --- 表格下载 CSV 功能 ---
    previewContainer.addEventListener('click', (e) => {
      const downloadCsvBtn = e.target.closest('.md-download-csv-btn');
      if (downloadCsvBtn) {
        e.preventDefault();
        const wrapper = downloadCsvBtn.closest('.md-table-block');
        const table = wrapper ? wrapper.querySelector('table') : null;
        if (table) {
          const csvText = tableToCSV(table);
          const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'table.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    });

    // --- 表格下载 Excel 功能 ---
    previewContainer.addEventListener('click', (e) => {
      const downloadExcelBtn = e.target.closest('.md-download-excel-btn');
      if (downloadExcelBtn) {
        e.preventDefault();
        const wrapper = downloadExcelBtn.closest('.md-table-block');
        const table = wrapper ? wrapper.querySelector('table') : null;
        if (table) {
          const excelText = tableToExcelXML(table);
          const blob = new Blob([excelText], { type: 'application/vnd.ms-excel' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'table.xls';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    });

    // --- 表格源码/渲染切换功能 ---
    previewContainer.addEventListener('click', (e) => {
      const tableToggleBtn = e.target.closest('.md-table-toggle');
      if (tableToggleBtn) {
        e.preventDefault();
        const wrapper = tableToggleBtn.closest('.md-table-block');
        if (!wrapper) return;
        const table = wrapper.querySelector('table');
        const sourceArea = wrapper.querySelector('.md-table-source');
        if (table && sourceArea) {
          if (table.style.display === 'none') {
            // 当前是源码模式，切换到渲染模式
            table.style.display = '';
            sourceArea.style.display = 'none';
            tableToggleBtn.textContent = '源码';
          } else {
            // 当前是渲染模式，切换到源码模式
            table.style.display = 'none';
            sourceArea.style.display = 'block';
            tableToggleBtn.textContent = '渲染';
          }
        }
      }
    });

    // --- 表格复制功能 ---
    previewContainer.addEventListener('click', (e) => {
      const copyTableBtn = e.target.closest('.md-copy-table-btn');
      if (copyTableBtn) {
        e.preventDefault();
        const wrapper = copyTableBtn.closest('.md-table-block');
        const mdSource = wrapper ? wrapper.getAttribute('data-md-source') : '';
        if (mdSource) {
          navigator.clipboard.writeText(mdSource).then(() => {
            const originalText = copyTableBtn.textContent;
            copyTableBtn.textContent = '已复制';
            copyTableBtn.classList.add('copied');
            setTimeout(() => {
              copyTableBtn.textContent = originalText;
              copyTableBtn.classList.remove('copied');
            }, 2000);
          }).catch(err => {
            console.error('Table copy failed:', err);
          });
        }
      }
    });

    // --- 下载功能 ---
    const downloadBtn = document.getElementById('md-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([window.__mdRawContent || ''], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = window.__mdFileName || 'document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  }

  // ==========================================
  // 5. 启动入口
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMarkdown);
  } else {
    renderMarkdown();
  }

  // 暴露到 window，供开发模式重新触发
  window.__mdRenderMarkdown = renderMarkdown;
})();