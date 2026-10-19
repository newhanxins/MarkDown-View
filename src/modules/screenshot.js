/**
 * 截图模块 - 支持自动截图和手动选框截图
 */

// 保留原始 import 作为注释（当前通过 libs/ 目录动态加载）
// import html2canvas from 'html2canvas';

/**
 * 动态加载 html2canvas 库
 * 优先使用 window.html2canvas，否则通过 fetch 加载
 */
async function getHtml2Canvas() {
  if (window.html2canvas) {
    return window.html2canvas;
  }

  try {
    // 尝试通过 fetch 加载 html2canvas
    const url = '/libs/html2canvas.min.js';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load html2canvas: ${response.status}`);

    const scriptContent = await response.text();
    const blob = new Blob([scriptContent], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = blobUrl;
      script.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load html2canvas script'));
      };
      document.head.appendChild(script);
    });

    if (window.html2canvas) {
      return window.html2canvas;
    } else {
      throw new Error('html2canvas not found after loading');
    }
  } catch (error) {
    console.error('MD Viewer: failed to load html2canvas', error);
    throw error;
  }
}

/**
 * 截取当前页面（自动全量截图）
 */
export async function takeScreenshot() {
  try {
    const previewContainer = document.getElementById('md-preview-container');
    if (!previewContainer) {
      console.warn('MD Viewer: preview container not found');
      return;
    }
    showToast('正在生成截图...');

    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(previewContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-color') || '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `md-screenshot-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    showToast('截图已下载');
  } catch (error) {
    console.error('MD Viewer: screenshot failed', error);
    showToast('截图失败: ' + error.message);
  }
}

/**
 * 手动选框截图 - 用户拖动选框后截图
 */
export function takeManualScreenshot() {
  const previewContainer = document.getElementById('md-preview-container');
  if (!previewContainer) {
    showToast('找不到预览内容');
    return;
  }

  // 创建截图覆盖层
  const overlay = document.createElement('div');
  overlay.id = 'md-screenshot-overlay';
  overlay.className = 'md-screenshot-overlay';
  overlay.innerHTML = `
    <div class="md-screenshot-hint">拖动鼠标选择截图区域</div>
    <div class="md-screenshot-box" id="md-screenshot-box"></div>
    <div class="md-screenshot-toolbar" id="md-screenshot-toolbar">
      <span class="md-screenshot-size" id="md-screenshot-size">0 x 0</span>
      <div class="md-screenshot-btns">
        <button class="md-screenshot-btn md-screenshot-btn-reselect" id="md-screenshot-reselect">重新选择</button>
        <button class="md-screenshot-btn md-screenshot-btn-cancel" id="md-screenshot-cancel">取消</button>
        <button class="md-screenshot-btn md-screenshot-btn-save" id="md-screenshot-save">保存截图</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const box = document.getElementById('md-screenshot-box');
  const toolbar = document.getElementById('md-screenshot-toolbar');
  const sizeEl = document.getElementById('md-screenshot-size');

  let isDragging = false;
  let startX, startY, endX, endY;
  let selected = false;
  let isOnToolbar = false;

  function getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onMouseDown(e) {
    if (selected || isOnToolbar) return;
    const pt = getPoint(e);
    isDragging = true;
    startX = pt.x;
    startY = pt.y;
    box.style.display = 'block';
    updateBox(startX, startY, startX, startY);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const pt = getPoint(e);
    endX = pt.x;
    endY = pt.y;
    updateBox(startX, startY, endX, endY);
    if (sizeEl) {
      sizeEl.textContent = `${Math.abs(endX - startX)} x ${Math.abs(endY - startY)}`;
    }
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    if (Math.abs(endX - startX) < 10 || Math.abs(endY - startY) < 10) {
      box.style.display = 'none';
      return;
    }
    selected = true;
    toolbar.style.display = 'flex';
  }

  function updateBox(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
  }

  function clearSelection() {
    selected = false;
    isDragging = false;
    box.style.display = 'none';
    toolbar.style.display = 'none';
    if (sizeEl) sizeEl.textContent = '0 x 0';
  }

  function cleanup() {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }

  // 工具栏 hover 检测
  toolbar.addEventListener('mouseenter', () => { isOnToolbar = true; });
  toolbar.addEventListener('mouseleave', () => { isOnToolbar = false; });

  // 绑定工具栏按钮事件
  document.getElementById('md-screenshot-cancel').addEventListener('click', cleanup);
  document.getElementById('md-screenshot-reselect').addEventListener('click', () => {
    clearSelection();
  });
  document.getElementById('md-screenshot-save').addEventListener('click', async () => {
    if (!selected) return;
    try {
      showToast('正在生成截图...');
      const rect = box.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;

      // 隐藏选框、工具栏和覆盖层，避免截到边框线
      box.style.display = 'none';
      toolbar.style.display = 'none';
      overlay.style.background = 'transparent';
      overlay.style.pointerEvents = 'none';

      // 加载 html2canvas
      const html2canvas = await getHtml2Canvas();

      // 先截取整个页面
      const fullCanvas = await html2canvas(document.body, {
        scale: scale,
        useCORS: true,
        logging: false,
      });

      // 计算选框在完整截图中的像素位置
      const cropX = Math.round(rect.left * scale);
      const cropY = Math.round(rect.top * scale);
      const cropWidth = Math.round(rect.width * scale);
      const cropHeight = Math.round(rect.height * scale);

      // 裁剪出选中区域
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const ctx = croppedCanvas.getContext('2d');

      ctx.drawImage(
        fullCanvas,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      const dataUrl = croppedCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `md-screenshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      showToast('截图已下载');
      cleanup();
    } catch (error) {
      console.error('MD Viewer: manual screenshot failed', error);
      showToast('截图失败: ' + error.message);
    }
  });

  // 绑定鼠标事件
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // ESC 退出
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 显示提示消息
 * @param {string} message - 提示消息
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 100000;
    font-size: 14px;
    pointer-events: none;
    animation: fadeInOut 2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
