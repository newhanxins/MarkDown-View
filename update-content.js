const fs = require('fs');

const jsPath = 'f:/Protest/chromeplug/md-view/src/content.js';
const cssPath = 'f:/Protest/chromeplug/md-view/src/content.css';

let content = fs.readFileSync(jsPath, 'utf8');

// 替换1: Emoji 替换 + 优化外部链接判断
content = content.replace(
  '      // 第二步：创建临时 DOM 容器以便操作节点\n" +
  "      const tempDiv = document.createElement('div');\n" +
  "      tempDiv.innerHTML = cleanHtml;\n" +
  "      \n" +
  "      // 第三步：如果启用了 Mermaid，查找并渲染代码块",
  "      // 第二步：创建临时 DOM 容器以便操作节点\n" +
  "      const tempDiv = document.createElement('div');\n" +
  "      tempDiv.innerHTML = cleanHtml;\n" +
  "\n" +
  "      // 2.5 Emoji 短代码替换（排除 code、pre 等标签内部）\n" +
  "      if (CONFIG.enableEmoji) {\n" +
  "        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, {\n" +
  "          acceptNode: (node) => {\n" +
  "            const parent = node.parentElement;\n" +
  "            if (parent && (parent.tagName === 'CODE' || parent.tagName === 'PRE' || parent.closest('code, pre'))) {\n" +
  "              return NodeFilter.FILTER_REJECT;\n" +
  "            }\n" +
  "            return NodeFilter.FILTER_ACCEPT;\n" +
  "          }\n" +
  "        });\n" +
  "        const textNodes = [];\n" +
  "        let node;\n" +
  "        while ((node = walker.nextNode()) !== null) {\n" +
  "          textNodes.push(node);\n" +
  "        }\n" +
  "        textNodes.forEach(node => {\n" +
  "          const newText = node.textContent.replace(/:[a-zA-Z0-9_+-]+:/g, match => {\n" +
  "            return EMOJI_MAP[match] || match;\n" +
  "          });\n" +
  "          if (newText !== node.textContent) {\n" +
  "            node.textContent = newText;\n" +
  "          }\n" +
  "        });\n" +
  "      }\n" +
  "      \n" +
  "      // 第三步：如果启用了 Mermaid，查找并渲染代码块"
);

// 替换2: 优化外部链接判断
content = content.replace(
  "      // 2. 处理外部链接：为所有外部链接添加 target=\"_blank\" 和 rel=\"noopener noreferrer\"\n" +
  "      const links = tempDiv.querySelectorAll('a');\n" +
  "      links.forEach(link => {\n" +
  "        const href = link.getAttribute('href');\n" +
  "        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {\n" +
  "          link.setAttribute('target', '_blank');\n" +
  "          link.setAttribute('rel', 'noopener noreferrer');\n" +
  "        }\n" +
  "      });",
  "      // 2. 处理外部链接：为所有外部链接添加 target=\"_blank\" 和 rel=\"noopener noreferrer\"\n" +
  "      const links = tempDiv.querySelectorAll('a');\n" +
  "      links.forEach(link => {\n" +
  "        const href = link.getAttribute('href');\n" +
  "        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {\n" +
  "          link.setAttribute('target', '_blank');\n" +
  "          link.setAttribute('rel', 'noopener noreferrer');\n" +
  "        }\n" +
  "      });"
);

// 替换3: 在 bindEvents 之前添加新函数
content = content.replace(
  "  }\n" +
  "\n" +
  "  // ==========================================\n" +
  "  // 4. 事件绑定与交互逻辑\n" +
  "  // ==================================================",
  "  }\n" +
  "\n" +
  "  // ==========================================\n" +
  "  // 3.5 新增功能辅助函数\n" +
  "  // ==========================================\n" +
  "\n" +
  "  function escapeHtml(unsafe) {\n" +
  "    return unsafe\n" +
  "      .replace(/&/g, '\\u0026amp;')\n" +
  "      .replace(/</g, '\\u0026lt;')\n" +
  "      .replace(/>/g, '\\u0026gt;')\n" +
  "      .replace(/\"/g, '\\u0026quot;')\n" +
  "      .replace(/'/g, '\\u0026#039;');\n" +
  "  }\n" +
  "\n" +
  "  function applyHighlighting(container) {\n" +
  "    if (!CONFIG.enableHighlight) return;\n" +
  "    const codeBlocks = container.querySelectorAll('pre code');\n" +
  "    codeBlocks.forEach(block => {\n" +
  "      const langMatch = block.className.match(/language-(\\\\w+)/);\n" +
  "      const lang = langMatch ? langMatch[1] : '';\n" +
  "      if (!lang) return;\n" +
  "      const code = block.textContent;\n" +
  "      let html = escapeHtml(code);\n" +
  "      const kwMap = {\n" +
  "        'js': ['const','let','var','function','return','if','else','for','while','class','import','export','async','await','new','this','try','catch'],\n" +
  "        'javascript': ['const','let','var','function','return','if','else','for','while','class','import','export','async','await','new','this','try','catch'],\n" +
  "        'py': ['def','class','if','else','elif','for','while','return','import','from','as','try','except'],\n" +
  "        'python': ['def','class','if','else','elif','for','while','return','import','from','as','try','except']\n" +
  "      };\n" +
  "      const keywords = kwMap[lang];\n" +
  "      if (keywords) {\n" +
  "        keywords.forEach(kw => {\n" +
  "          html = html.split(kw).join('\\u003cspan class=\"hljs-keyword\"\\u003e' + kw + '\\u003c/span\\u003e');\n" +
  "        });\n" +
  "      }\n" +
  "      block.innerHTML = html;\n" +
  "    });\n" +
  "  }\n" +
  "\n" +
  "  function initImageLightbox(container) {\n" +
  "    let lightbox = document.getElementById('md-lightbox-overlay');\n" +
  "    if (!lightbox) {\n" +
  "      lightbox = document.createElement('div');\n" +
  "      lightbox.id = 'md-lightbox-overlay';\n" +
  "      lightbox.className = 'md-lightbox-overlay';\n" +
  "      lightbox.innerHTML = '\\u003cimg src=\"\" alt=\"\"\\u003e';\n" +
  "      document.body.appendChild(lightbox);\n" +
  "      lightbox.addEventListener('click', () => {\n" +
  "        lightbox.classList.remove('active');\n" +
  "      });\n" +
  "    }\n" +
  "    const lightboxImg = lightbox.querySelector('img');\n" +
  "    const images = container.querySelectorAll('img');\n" +
  "    images.forEach(img => {\n" +
  "      img.style.cursor = 'zoom-in';\n" +
  "      img.addEventListener('click', (e) => {\n" +
  "        e.preventDefault();\n" +
  "        e.stopPropagation();\n" +
  "        lightboxImg.src = img.src;\n" +
  "        lightbox.classList.add('active');\n" +
  "      });\n" +
  "    });\n" +
  "  }\n" +
  "\n" +
  "  function initSearchBox() {\n" +
  "    let searchOverlay = document.getElementById('md-search-overlay');\n" +
  "    if (!searchOverlay) {\n" +
  "      searchOverlay = document.createElement('div');\n" +
  "      searchOverlay.id = 'md-search-overlay';\n" +
  "      searchOverlay.className = 'md-search-overlay';\n" +
  "      searchOverlay.innerHTML = '\\u003cdiv class=\"md-search-box\"\\u003e\\u003cdiv class=\"md-search-input-wrapper\"\\u003e\\u003cinput type=\"text\" class=\"md-search-input\" placeholder=\"搜索文档内容...\" autocomplete=\"off\"\\u003e\\u003c/div\\u003e\\u003cdiv class=\"md-search-results\"\\u003e\\u003c/div\\u003e\\u003c/div\\u003e';\n" +
  "      document.body.appendChild(searchOverlay);\n" +
  "      const input = searchOverlay.querySelector('.md-search-input');\n" +
  "      const resultsContainer = searchOverlay.querySelector('.md-search-results');\n" +
  "      searchOverlay.addEventListener('click', (e) => {\n" +
  "        if (e.target === searchOverlay) {\n" +
  "          searchOverlay.classList.remove('active');\n" +
  "        }\n" +
  "      });\n" +
  "      searchOverlay.addEventListener('keydown', (e) => {\n" +
  "        if (e.key === 'Escape') {\n" +
  "          searchOverlay.classList.remove('active');\n" +
  "        }\n" +
  "      });\n" +
  "      let searchTimer = null;\n" +
  "      input.addEventListener('input', () => {\n" +
  "        clearTimeout(searchTimer);\n" +
  "        searchTimer = setTimeout(() => {\n" +
  "          performSearch(input.value, resultsContainer);\n" +
  "        }, 300);\n" +
  "      });\n" +
  "    }\n" +
  "    document.addEventListener('keydown', (e) => {\n" +
  "      if ((e.ctrlKey || e.metaKey) \u0026\u0026 e.key === 'f') {\n" +
  "        e.preventDefault();\n" +
  "        searchOverlay.classList.add('active');\n" +
  "        setTimeout(() => {\n" +
  "          searchOverlay.querySelector('.md-search-input').focus();\n" +
  "        }, 50);\n" +
  "      }\n" +
  "    });\n" +
  "  }\n" +
  "\n" +
  "  function performSearch(query, resultsContainer) {\n" +
  "    if (!query || query.length \u003c 2) {\n" +
  "      resultsContainer.innerHTML = '';\n" +
  "      return;\n" +
  "    }\n" +
  "    const previewContainer = document.getElementById('md-preview-container');\n" +
  "    if (!previewContainer) return;\n" +
  "    previewContainer.querySelectorAll('.md-search-highlight').forEach(el => {\n" +
  "      const parent = el.parentNode;\n" +
  "      parent.insertBefore(document.createTextNode(el.textContent), el);\n" +
  "      parent.removeChild(el);\n" +
  "    });\n" +
  "    const text = previewContainer.innerText;\n" +
  "    const regex = new RegExp(escapeRegExp(query), 'gi');\n" +
  "    const matches = [];\n" +
  "    let match;\n" +
  "    while ((match = regex.exec(text)) !== null) {\n" +
  "      const before = text.substring(Math.max(0, match.index - 30), match.index);\n" +
  "      const after = text.substring(match.index + query.length, Math.min(text.length, match.index + query.length + 30));\n" +
  "      matches.push({ before: before, match: match[0], after: after });\n" +
  "    }\n" +
  "    if (matches.length === 0) {\n" +
  "      resultsContainer.innerHTML = '\\u003cdiv style=\"padding: 16px; color: var(--text-color);\"\\u003e未找到匹配结果\\u003c/div\\u003e';\n" +
  "      return;\n" +
  "    }\n" +
  "    const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT, null, false);\n" +
  "    const textNodes = [];\n" +
  "    let node;\n" +
  "    while ((node = walker.nextNode()) !== null) {\n" +
  "      if (node.parentElement \u0026\u0026 !node.parentElement.closest('.md-code-block, .md-mermaid-block')) {\n" +
  "        textNodes.push(node);\n" +
  "      }\n" +
  "    }\n" +
  "    textNodes.forEach(node => {\n" +
  "      const nodeText = node.textContent;\n" +
  "      if (regex.test(nodeText)) {\n" +
  "        regex.lastIndex = 0;\n" +
  "        const span = document.createElement('span');\n" +
  "        span.innerHTML = nodeText.replace(regex, '\\u003cmark class=\"md-search-highlight\"\\u003e$\u0026\\u003c/mark\\u003e');\n" +
  "        const parent = node.parentNode;\n" +
  "        const tempDiv = document.createElement('div');\n" +
  "        tempDiv.innerHTML = span.innerHTML;\n" +
  "        const fragment = document.createDocumentFragment();\n" +
  "        while (tempDiv.firstChild) {\n" +
  "          fragment.appendChild(tempDiv.firstChild);\n" +
  "        }\n" +
  "        parent.replaceChild(fragment, node);\n" +
  "      }\n" +
  "    });\n" +
  "    let html = '';\n" +
  "    matches.slice(0, 20).forEach((m, index) => {\n" +
  "      html += '\\u003cdiv class=\"md-search-result-item\" data-index=\"' + index + '\"\\u003e' + escapeHtml(m.before) + '\\u003cspan class=\"highlight\"\\u003e' + escapeHtml(m.match) + '\\u003c/span\\u003e' + escapeHtml(m.after) + '\\u003c/div\\u003e';\n" +
  "    });\n" +
  "    if (matches.length \u003e 20) {\n" +
  "      html += '\\u003cdiv style=\"padding: 10px 16px; color: var(--text-color);\"\\u003e还有 ' + (matches.length - 20) + ' 个结果...\\u003c/div\\u003e';\n" +
  "    }\n" +
  "    resultsContainer.innerHTML = html;\n" +
  "    resultsContainer.querySelectorAll('.md-search-result-item').forEach(item => {\n" +
  "      item.addEventListener('click', () => {\n" +
  "        const highlights = previewContainer.querySelectorAll('.md-search-highlight');\n" +
  "        if (highlights.length \u003e 0) {\n" +
  "          highlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });\n" +
  "        }\n" +
  "        searchOverlay.classList.remove('active');\n" +
  "      });\n" +
  "    });\n" +
  "  }\n" +
  "\n" +
  "  function escapeRegExp(string) {\n" +
  "    return string.replace(/[.*+?^$\\{\\}()|[\\]\\\\\\\\]/g, '\\\\$\\u0026');\n" +
  "  }\n" +
  "\n" +
  "  function initScrollTopButton() {\n" +
  "    let btn = document.getElementById('md-scroll-top-btn');\n" +
  "    if (!btn) {\n" +
  "      btn = document.createElement('button');\n" +
  "      btn.id = 'md-scroll-top-btn';\n" +
  "      btn.className = 'md-scroll-top-btn';\n" +
  "      btn.innerHTML = '↑';\n" +
  "      btn.title = '回到顶部';\n" +
  "      document.body.appendChild(btn);\n" +
  "      btn.addEventListener('click', () => {\n" +
  "        window.scrollTo({ top: 0, behavior: 'smooth' });\n" +
  "      });\n" +
  "    }\n" +
  "    window.addEventListener('scroll', () => {\n" +
  "      if (window.pageYOffset \u003e 300) {\n" +
  "        btn.classList.add('visible');\n" +
  "      } else {\n" +
  "        btn.classList.remove('visible');\n" +
  "      }\n" +
  "    });\n" +
  "  }\n" +
  "\n" +
  "  // ==========================================\n" +
  "  // 4. 事件绑定与交互逻辑\n" +
  "  // =================================================="
);

// 替换4: renderMarkdown 中添加调用
content = content.replace(
  "      previewContainer.innerHTML = html;\n" +
  "      addCodeCopyButtons(previewContainer);\n" +
  "      addTableActions(previewContainer);\n" +
  "    } finally {",
  "      previewContainer.innerHTML = html;\n" +
  "      addCodeCopyButtons(previewContainer);\n" +
  "      addTableActions(previewContainer);\n" +
  "      applyHighlighting(previewContainer);\n" +
  "      initImageLightbox(previewContainer);\n" +
  "    } finally {"
);

// 替换5: bindEvents 后添加初始化
content = content.replace(
  "    // 绑定交互事件\n" +
  "    bindEvents(previewContainer, editorContainer, rawText);",
  "    // 绑定交互事件\n" +
  "    bindEvents(previewContainer, editorContainer, rawText);\n" +
  "\n" +
  "    // 初始化搜索功能和回到顶部按钮\n" +
  "    initSearchBox();\n" +
  "    initScrollTopButton();"
);

fs.writeFileSync(jsPath, content, 'utf8');
console.log('content.js updated successfully');
