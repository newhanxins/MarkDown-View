// 导入 CSS 文件
import './content.css';
// 直接导入库，Vite 会处理它们的打包
import { marked } from 'marked';
import DOMPurify from 'dompurify';

(function() {
  'use strict';

  // 检查是否是 Markdown 文件
  function isMarkdownFile() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) {
      return true;
    }
    
    const contentType = document.contentType;
    if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'))) {
      return true;
    }
    
    return false;
  }

  // 获取页面中的原始文本内容
  function getRawText() {
    const preElement = document.querySelector('pre');
    if (preElement) {
      return preElement.textContent;
    }
    
    const codeElement = document.querySelector('code');
    if (codeElement) {
      return codeElement.textContent;
    }
    
    return document.body.innerText;
  }

  // 解析 Markdown 内容
  function parseMarkdown(text) {
    try {
      // 直接使用导入的 marked 和 DOMPurify
      const rawHtml = marked.parse(text);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return cleanHtml;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return `<div class="md-error">解析错误: ${error.message}</div>`;
    }
  }

  // 创建切换按钮和容器
  function createUI() {
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

    const previewContainer = document.createElement('div');
    previewContainer.id = 'md-preview-container';
    previewContainer.className = 'md-preview-mode';

    const sourceContainer = document.createElement('div');
    sourceContainer.id = 'md-source-container';
    sourceContainer.className = 'md-source-mode';
    sourceContainer.style.display = 'none';

    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertBefore(previewContainer, document.body.firstChild.nextSibling);
    document.body.insertBefore(sourceContainer, previewContainer.nextSibling);

    return { toolbar, previewContainer, sourceContainer };
  }

  // 渲染 Markdown 内容
  function renderMarkdown() {
    if (!isMarkdownFile()) {
      return;
    }

    console.log('Markdown file detected, rendering...');

    const rawText = getRawText();
    window.__mdRawContent = rawText;
    window.__mdFileName = extractFileName(window.location.pathname);

    const { previewContainer, sourceContainer } = createUI();

    const fileNameElement = document.getElementById('md-file-name');
    if (fileNameElement) {
      fileNameElement.textContent = window.__mdFileName;
    }

    const sourcePre = document.createElement('pre');
    const sourceCode = document.createElement('code');
    sourceCode.textContent = rawText;
    sourcePre.appendChild(sourceCode);
    sourceContainer.appendChild(sourcePre);

    // 同步调用解析函数
    const html = parseMarkdown(rawText);
    previewContainer.innerHTML = html;

    bindEvents(previewContainer, sourceContainer, rawText);
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
    
    document.body.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = '';
      }
    });
  }

  // 绑定事件处理
  function bindEvents(previewContainer, sourceContainer, rawText) {
    let isPreviewMode = true;

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMarkdown);
  } else {
    renderMarkdown();
  }

})();