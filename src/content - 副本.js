// 导入 CSS 文件，这样 Vite 才会处理它
import './content.css';
// Content Script - 自动检测并渲染 Markdown 文件

(function() {
  'use strict';

  // 检查是否是 Markdown 文件
  function isMarkdownFile() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    // 检查 URL 是否以 .md 或 .markdown 结尾
    if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) {
      return true;
    }
    
    // 检查 Content-Type
    const contentType = document.contentType;
    if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'))) {
      return true;
    }
    
    return false;
  }

  // 获取页面中的原始文本内容
  function getRawText() {
    // 尝试从 <pre> 标签获取
    const preElement = document.querySelector('pre');
    if (preElement) {
      return preElement.textContent;
    }
    
    // 尝试从 <code> 标签获取
    const codeElement = document.querySelector('code');
    if (codeElement) {
      return codeElement.textContent;
    }
    
    // 尝试从 body 获取纯文本
    return document.body.innerText;
  }

  // 简单的 Markdown 解析器（使用 marked）
  async function parseMarkdown(text) {
    // 获取扩展内部资源的 URL
    const getLibUrl = (path) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL(path);
      }
      return path; 
    };

    // 1. 加载 marked
    if (typeof window.marked === 'undefined') {
      try {
        const markedUrl = getLibUrl('libs/marked.umd.js');
        console.log('Loading marked from:', markedUrl);
        await loadScript(markedUrl);
        
        // 再次检查是否加载成功
        if (typeof window.marked === 'undefined') {
          throw new Error('marked library loaded but not defined on window');
        }
      } catch (e) {
        console.error('Failed to load marked:', e);
        return '<div class="md-error">加载解析库失败 (marked)</div>';
      }
    }
    
    // 2. 加载 DOMPurify
    if (typeof window.DOMPurify === 'undefined') {
      try {
        const purifyUrl = getLibUrl('libs/purify.min.js');
        console.log('Loading DOMPurify from:', purifyUrl);
        await loadScript(purifyUrl);

        // 再次检查是否加载成功
        if (typeof window.DOMPurify === 'undefined') {
          throw new Error('DOMPurify library loaded but not defined on window');
        }
      } catch (e) {
        console.error('Failed to load DOMPurify:', e);
        return '<div class="md-error">加载安全库失败 (DOMPurify)</div>';
      }
    }
    
    // 3. 执行解析
    try {
      // 使用 window.marked 确保访问的是全局对象
      const rawHtml = window.marked.parse(text);
      const cleanHtml = window.DOMPurify.sanitize(rawHtml);
      return cleanHtml;
    } catch (err) {
      console.error('Parsing error:', err);
      return `<div class="md-error">解析出错: ${err.message}</div>`;
    }
  }

  // 动态加载脚本
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // 确保按顺序执行
      script.onload = () => {
        console.log(`Script loaded successfully: ${src}`);
        resolve();
      };
      script.onerror = (e) => {
        console.error(`Script load failed: ${src}`, e);
        reject(e);
      };
      document.head.appendChild(script);
    });
  }

  // 创建切换按钮和容器
  function createUI() {
    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'md-viewer-toolbar';
    toolbar.innerHTML = `
      <div class="md-viewer-controls">
        <button id="md-toggle-btn" class="md-btn active" title="切换预览/源码模式">
          <span id="md-toggle-icon">👁️</span>
          <span id="md-toggle-text">预览</span>
        </button>
        <button id="md-copy-btn" class="md-btn" title="复制源码">
          📋 复制
        </button>
        <button id="md-download-btn" class="md-btn" title="下载 Markdown 文件">
          💾 下载
        </button>
        <span class="md-file-name" id="md-file-name"></span>
      </div>
    `;

    // 创建预览容器
    const previewContainer = document.createElement('div');
    previewContainer.id = 'md-preview-container';
    previewContainer.className = 'md-preview-mode';

    // 创建源码容器
    const sourceContainer = document.createElement('div');
    sourceContainer.id = 'md-source-container';
    sourceContainer.className = 'md-source-mode';
    sourceContainer.style.display = 'none';

    // 插入到页面顶部
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertBefore(previewContainer, document.body.firstChild.nextSibling);
    document.body.insertBefore(sourceContainer, previewContainer.nextSibling);

    return { toolbar, previewContainer, sourceContainer };
  }

  // 渲染 Markdown 内容
  async function renderMarkdown() {
    if (!isMarkdownFile()) {
      console.log('Not a markdown file, skipping...');
      return;
    }

    console.log('Markdown file detected, rendering...');

    // 获取原始文本
    const rawText = getRawText();
    
    // 保存原始文本供后续使用
    window.__mdRawContent = rawText;
    window.__mdFileName = extractFileName(window.location.pathname);

    // 创建 UI
    const { previewContainer, sourceContainer } = createUI();

    // 设置文件名显示
    const fileNameElement = document.getElementById('md-file-name');
    if (fileNameElement) {
      fileNameElement.textContent = window.__mdFileName;
    }

    // 设置源码视图
    const sourcePre = document.createElement('pre');
    const sourceCode = document.createElement('code');
    sourceCode.textContent = rawText;
    sourcePre.appendChild(sourceCode);
    sourceContainer.appendChild(sourcePre);

    // 渲染预览视图
    try {
      const html = await parseMarkdown(rawText);
      previewContainer.innerHTML = html;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      previewContainer.innerHTML = `<div class="md-error">解析错误: ${error.message}</div>`;
    }

    // 绑定事件
    bindEvents(previewContainer, sourceContainer, rawText);

    // 隐藏原始的 <pre> 或 <code> 元素
    hideOriginalContent();
  }

  // 提取文件名
  function extractFileName(pathname) {
    const parts = pathname.split('/');
    return parts[parts.length - 1] || 'untitled.md';
  }

  // 隐藏原始内容
  function hideOriginalContent() {
    const preElement = document.querySelector('body > pre');
    const codeElement = document.querySelector('body > code');
    
    if (preElement) {
      preElement.style.display = 'none';
    }
    if (codeElement) {
      codeElement.style.display = 'none';
    }
    
    // 隐藏 body 的直接文本节点
    document.body.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = '';
      }
    });
  }

  // 绑定事件处理
  function bindEvents(previewContainer, sourceContainer, rawText) {
    let isPreviewMode = true;

    // 切换按钮
    const toggleBtn = document.getElementById('md-toggle-btn');
    const toggleIcon = document.getElementById('md-toggle-icon');
    const toggleText = document.getElementById('md-toggle-text');

    toggleBtn.addEventListener('click', () => {
      isPreviewMode = !isPreviewMode;
      
      if (isPreviewMode) {
        previewContainer.style.display = 'block';
        sourceContainer.style.display = 'none';
        toggleIcon.textContent = '👁️';
        toggleText.textContent = '预览';
        toggleBtn.classList.add('active');
      } else {
        previewContainer.style.display = 'none';
        sourceContainer.style.display = 'block';
        toggleIcon.textContent = '📝';
        toggleText.textContent = '源码';
        toggleBtn.classList.remove('active');
      }
    });

    // 复制按钮
    const copyBtn = document.getElementById('md-copy-btn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(rawText).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ 已复制';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
        alert('复制失败');
      });
    });

    // 下载按钮
    const downloadBtn = document.getElementById('md-download-btn');
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([rawText], { type: 'text/markdown' });
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

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMarkdown);
  } else {
    renderMarkdown();
  }

})();