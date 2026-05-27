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
  
  // Mermaid 在线 UMD 地址 (使用 jsdelivr CDN)
  const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
  
  let mermaidLoaded = false;
  let mermaidInstance = null;

  // 功能配置开关：默认为 true，方便后续通过配置文件或 UI 控制
  const CONFIG = {
    enableTOC: true,      // 是否启用左侧目录导航
    enableMermaid: true,  // 是否启用 Mermaid 图表渲染
    enableEditor: true    // 是否启用实时编辑功能
  };

  let originalContent = ''; // 用于存储文件打开时的原始内容，支持“重置”功能


  /**
   * 动态加载 Mermaid 库
   */
  async function loadMermaid() {
    if (mermaidLoaded) return mermaidInstance;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MERMAID_CDN_URL;
      script.onload = () => {
        // Mermaid UMD 版本会暴露全局 window.mermaid 对象
        mermaidInstance = window.mermaid;
        if (mermaidInstance) {
          mermaidInstance.initialize({ 
            startOnLoad: false, // 禁止自动扫描，由我们手动触发渲染
            theme: 'default',   // 使用默认主题
            securityLevel: 'loose' // 允许在图表中使用 HTML 标签（可选）
          });
          // 初始化 Mermaid 图表库
          mermaidLoaded = true;
          resolve(mermaidInstance);
        } else {
          reject(new Error('Mermaid global object not found'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Mermaid from CDN'));
      document.head.appendChild(script);
    });
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
    return contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'));
  }

  /**
   * 从页面中提取原始的 Markdown 文本
   * 通常浏览器打开 .md 文件时，内容会包裹在 <pre> 或 <code> 标签中
   * @returns {string}
   */
  function getRawText() {
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
    
    // 直接查询容器内的标题
    const headers = contentContainer.querySelectorAll('h1, h2, h3');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
    headers.forEach((header, index) => {
      // 【关键修复】直接在真实的 DOM 元素上设置 ID
      const id = `heading-${index}`;
      header.id = id; 
      
      const level = parseInt(header.tagName.substring(1));
      const indent = (level - 1) * 15;
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 5px;">
        <a href="javascript:void(0)" class="toc-link" data-target="${id}">
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
    // 提取 h1, h2, h3 标题
    const headers = tempDiv.querySelectorAll('h1, h2, h3');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
    headers.forEach((header, index) => {
      // 为每个标题生成唯一 ID，用于锚点跳转
      const id = `heading-${index}`;
      header.id = id; 
      
      const level = parseInt(header.tagName.substring(1));
      // 根据标题层级设置缩进
      const indent = (level - 1) * 15;
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 5px;">
        <a href="#${id}" class="toc-link" data-target="${id}">
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

    // 预览视图容器
    const previewContainer = document.createElement('div');
    previewContainer.id = 'md-preview-container';
    
    // 编辑视图容器（Textarea）
    const editorContainer = document.createElement('textarea');
    editorContainer.id = 'md-editor-container';
    editorContainer.placeholder = "在此输入 Markdown 内容...";
    editorContainer.style.display = 'none'; // 默认隐藏

    contentArea.appendChild(previewContainer);
    contentArea.appendChild(editorContainer);
    
    mainContainer.appendChild(tocContainer);
    mainContainer.appendChild(contentArea);

    // 将 UI 插入到 body 最前方
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertBefore(mainContainer, document.body.firstChild.nextSibling);

    return { toolbar, tocContainer, previewContainer, editorContainer };
  }

  /**
   * 主渲染入口函数
   */
  async function renderMarkdown() {
    if (!isMarkdownFile()) return;

    console.log('MD Viewer: Markdown file detected.');

    // 获取原始内容并保存
    const rawText = getRawText();
    originalContent = rawText; 
    window.__mdRawContent = rawText;
    window.__mdFileName = window.location.pathname.split('/').pop() || 'untitled.md';

    // 创建界面
    const { tocContainer, previewContainer, editorContainer } = createUI();
    
    // 设置文件名显示
    document.getElementById('md-file-name').textContent = window.__mdFileName;
    editorContainer.value = rawText;

    // 执行首次渲染
    const html = await parseMarkdown(rawText);
    previewContainer.innerHTML = html;
    
    // 生成目录
    if (CONFIG.enableTOC) {
      // tocContainer.innerHTML = generateTOC(html); 
      // 【关键修复】在内容已经插入 DOM 后，再处理标题 ID 并生成目录
      const tocHtml = processHeadersAndGenerateTOC(previewContainer);
      tocContainer.innerHTML = tocHtml;
      
      // 绑定目录点击事件（使用事件委托）
      tocContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('toc-link')) {
          e.preventDefault();
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
            // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
            if (CONFIG.enableTOC && tocSidebar) {
              tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
            }
          });
        }
      });
    }

    // --- 复制功能 ---
    document.getElementById('md-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(window.__mdRawContent || '').then(() => {
        alert('✅ Markdown 源码已复制到剪贴板');
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });

    // --- 下载功能 ---
    document.getElementById('md-download-btn').addEventListener('click', () => {
      const blob = new Blob([window.__mdRawContent || ''], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = window.__mdFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ==========================================
  // 5. 启动入口
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMarkdown);
  } else {
    renderMarkdown();
  }
})();