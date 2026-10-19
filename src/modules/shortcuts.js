/**
 * 快捷键模块 - 显示快捷键说明
 */

const SHORTCUTS = [
  { key: 'Ctrl + F', desc: '搜索文档内容' },
  { key: 'Ctrl + /', desc: '显示快捷键说明' },
  { key: 'Esc', desc: '关闭弹窗/退出搜索' },
  { key: '↑ / ↓', desc: '在搜索结果中导航' },
];

/**
 * 显示快捷键说明弹窗
 */
export function showShortcutsDialog() {
  // 移除已有的弹窗
  const existing = document.getElementById('md-shortcuts-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'md-shortcuts-dialog';
  dialog.className = 'md-shortcuts-dialog';
  dialog.innerHTML = `
    <div class="md-shortcuts-overlay"></div>
    <div class="md-shortcuts-content">
      <div class="md-shortcuts-header">
        <h3>⌨️ 快捷键说明</h3>
        <button class="md-shortcuts-close">&times;</button>
      </div>
      <div class="md-shortcuts-body">
        ${SHORTCUTS.map(s => `
          <div class="md-shortcuts-row">
            <kbd>${s.key}</kbd>
            <span>${s.desc}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // 绑定关闭事件
  dialog.querySelector('.md-shortcuts-close').addEventListener('click', () => {
    dialog.remove();
  });

  dialog.querySelector('.md-shortcuts-overlay').addEventListener('click', () => {
    dialog.remove();
  });

  // ESC 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      dialog.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
