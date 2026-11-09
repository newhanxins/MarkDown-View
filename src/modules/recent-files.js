/**
 * 最近文件模块 - 管理最近打开的文件列表
 * 统一使用 localStorage 键 'md-viewer-recent'，与 dev-main.js 保持一致
 */

const STORAGE_KEY = 'md-viewer-recent';
const MAX_RECENT_FILES = 10;

/**
 * 获取最近文件列表（兼容新旧格式）
 * @returns {Array<{name: string, path?: string, content?: string, time: number}>} 最近文件列表
 */
export function getRecentFiles() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const files = JSON.parse(data);
    if (!Array.isArray(files)) return [];
    // 兼容旧格式：统一转换为标准格式
    return files.map(item => {
      if (!item) return null;
      return {
        name: item.name || '未知文件',
        path: item.path || '',
        content: item.content || '',
        time: item.time || item.timestamp || Date.now()
      };
    }).filter(Boolean);
  } catch (e) {
    console.warn('MD Viewer: failed to get recent files', e);
    return [];
  }
}

/**
 * 添加文件到最近文件列表（统一格式）
 * @param {string} path - 文件路径或URL
 * @param {string} name - 文件名
 * @param {string} content - 文件内容（可选）
 */
export function addRecentFile(path, name, content = '') {
  try {
    let files = getRecentFiles();
    // 移除重复项：path 有效时按 path 去重，否则按 name 去重
    files = files.filter(f => {
      if (path && f.path) {
        return f.path !== path;
      }
      return f.name !== name;
    });
    // 添加到开头
    files.unshift({ name, path, content, time: Date.now() });
    // 限制数量
    files = files.slice(0, MAX_RECENT_FILES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (e) {
    console.warn('MD Viewer: failed to add recent file', e);
  }
}

/**
 * 清空最近文件列表
 */
export function clearRecentFiles() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('MD Viewer: failed to clear recent files', e);
  }
}

/**
 * 渲染最近文件到二级菜单
 * @param {HTMLElement} submenu - 二级菜单容器
 */
export function renderRecentFiles(submenu) {
  if (!submenu) return;

  const files = getRecentFiles();
  if (files.length === 0) {
    submenu.innerHTML = '<div class="md-more-submenu-empty">暂无最近文件</div>';
    // 清空后移除旧的事件监听器
    submenu._recentClickHandler = null;
    return;
  }

  // 检查是否已经初始化过（避免重复绑定事件）
  if (!submenu._recentInitialized) {
    submenu.innerHTML = files.map((file, index) => {
      const displayName = file.name || '未知文件';
      const timeStr = formatTime(file.time);
      return `<div class="md-more-submenu-item" data-index="${index}">
        <span class="md-more-submenu-item-name">${escapeHtml(displayName)}</span>
        <span class="md-more-submenu-item-time">${timeStr}</span>
      </div>`;
    }).join('');

    // 使用事件委托，只绑定一次
    submenu.addEventListener('click', (e) => {
      const item = e.target.closest('.md-more-submenu-item');
      if (!item) return;
      
      e.stopPropagation();
      const idx = parseInt(item.getAttribute('data-index'));
      const currentFiles = getRecentFiles();
      const file = currentFiles[idx];
      if (!file) return;

      // 如果有内容，通过 dev-main.js 的方式加载
      if (file.content) {
        if (window.__mdLoadMarkdown) {
          window.__mdLoadMarkdown(file.content, file.name);
        } else if (window.__mdRawContent !== undefined) {
          // 如果 content.js 已经加载，可以通过更新 raw content 触发重新渲染
          window.__mdRawContent = file.content;
          window.__mdFileName = file.name;
          // 触发重新渲染
          if (window.__mdRenderMarkdown) {
            window.__mdRenderMarkdown();
          }
        }
      } else if (file.path) {
        // 有路径则打开
        window.open(file.path, '_blank');
      }
    });
    
    submenu._recentInitialized = true;
  } else {
    // 已初始化，只更新内容（保留事件监听器）
    const items = submenu.querySelectorAll('.md-more-submenu-item');
    files.forEach((file, index) => {
      if (items[index]) {
        const displayName = file.name || '未知文件';
        const timeStr = formatTime(file.time);
        items[index].innerHTML = `
          <span class="md-more-submenu-item-name">${escapeHtml(displayName)}</span>
          <span class="md-more-submenu-item-time">${timeStr}</span>
        `;
      }
    });
  }
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化时间显示
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
}
