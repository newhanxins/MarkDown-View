// 开发模式入口脚本
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name');
const uploadCard = document.getElementById('upload-card');
const previewWrapper = document.getElementById('md-preview-wrapper');
const backBtn = document.getElementById('back-btn');
const rawPre = document.getElementById('raw-md');
const dragOverlay = document.getElementById('drag-overlay');

// 内置示例数据
const demos = {
  basic: `# 欢迎使用 MD Viewer

## 基础语法演示

这是**粗体**，这是*斜体*，这是~~删除线~~。

### 列表演示

#### 无序列表
- 项目一
- 项目二
  - 子项目 A
  - 子项目 B
- 项目三

#### 有序列表
1. 第一步
2. 第二步
3. 第三步

### 代码块
\`\`\`javascript
function hello() {
  console.log("Hello, MD Viewer!");
}
\`\`\`

### 表格

| 功能 | 状态 |
|------|------|
| 预览 | 支持 |
| 编辑 | 支持 |
| 下载 | 支持 |

### 引用
> 这是引用块。
> 多行引用。

---

[链接示例](https://github.com)

![图片示例](https://via.placeholder.com/400x200/667eea/ffffff?text=MD+Viewer)`,

  mermaid: `# Mermaid 图表测试

## 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{判断条件}
    B -->|条件1| C[处理条件1]
    B -->|条件2| D[处理条件2]
    C --> E[结束]
    D --> E
\`\`\`

## 时序图

\`\`\`mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: Great!
\`\`\`

## 甘特图

\`\`\`mermaid
gantt
    title Adding GANTT diagram functionality
    section A section
    Completed task :done, des1, 2014-01-06,2014-01-08
    Active task    :active, des2, 2014-01-09, 3d
\`\`\``, 

  math: `# 数学公式测试

## 行内公式

这是一个著名的质能方程：$E=mc^2$。

## 块级公式

二次方程求根公式：

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

## 复杂公式

麦克斯韦方程组：

$$\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0 \\\\
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{aligned}$$`,

  full: `# MD Viewer 综合示例

## 标题层级测试

# H1 一级标题
## H2 二级标题
### H3 三级标题
#### H4 四级标题
##### H5 五级标题
###### H6 六级标题

## 格式化文本

**粗体文字**、*斜体文字*、~~删除线~~、\`行内代码\`。

## 列表演示

无序列表：
- 第一项
- 第二项
  - 嵌套项 1
  - 嵌套项 2
- 第三项

有序列表：
1. 第一步操作
2. 第二步操作
3. 第三步操作

任务列表：
- [x] 已完成项
- [ ] 待完成项
- [x] 另一项已完成

## 代码块

\`\`\`javascript
// JavaScript 示例
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`python
# Python 示例
def greet(name):
    return f"Hello, {name}!"
\`\`\`

## 表格

| 功能 | 描述 | 状态 |
|------|------|------|
| 自动检测 | 自动识别 md 文件 | 完成 |
| 实时预览 | 即时渲染 Markdown | 完成 |
| 主题切换 | 亮色/暗色模式 | 完成 |
| 目录导航 | 左侧 TOC 导航 | 完成 |
| 数学公式 | KaTeX 渲染 | 完成 |

## 引用块

> 这是一个引用块。
> 可以包含多行内容。
>
> > 嵌套引用。

## 分隔线

---

## 链接和图片

[MD Viewer GitHub](https://github.com)

## Mermaid 流程图

\`\`\`mermaid
graph LR
    A[用户打开文件] --> B{是否为 md?}
    B -->|是| C[自动渲染]
    B -->|否| D[跳过]
    C --> E[显示预览]
\`\`\`

## 数学公式

$E = mc^2$

$$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$`
};

// 处理文件内容
async function loadMarkdown(content, filename) {
  // 保存原始内容到 pre 标签
  rawPre.textContent = content;
  rawPre.style.display = 'none';
  
  // 显示预览区域，隐藏上传卡片
  uploadCard.style.display = 'none';
  // previewWrapper.style.display = 'block';
  previewWrapper.classList.remove('active');
  previewWrapper.style.display = 'none';
  backBtn.style.display = 'block';
  // 添加预览模式类，覆盖 body 的 flex 布局，避免影响滚动
  document.body.classList.add('preview-mode');
  
  // 设置页面标题
  document.title = filename ? `MD Viewer - \${filename}` : 'MD Viewer 预览';

  // 触发渲染（如果 content.js 已加载）
  if (window.__mdRenderMarkdown) {
    window.__mdRenderMarkdown();
  }
}

// 返回选择页面
backBtn.addEventListener('click', () => {
  // 清除预览内容
  previewWrapper.innerHTML = '';
  previewWrapper.classList.remove('active');
  previewWrapper.style.display = 'none';
  
  // 清除插件 UI
  const toolbar = document.getElementById('md-viewer-toolbar');
  const mainContainer = document.getElementById('md-main-container');
  if (toolbar) toolbar.remove();
  if (mainContainer) mainContainer.remove();
  
  // 恢复 body 布局
  document.body.classList.remove('preview-mode');
  
  // 显示上传卡片
  uploadCard.style.display = 'block';
  backBtn.style.display = 'none';
  fileNameDisplay.textContent = '';
  rawPre.textContent = '';
  document.title = 'MD Viewer - 开发测试';
});

// 文件选择
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  handleFile(file);
});

function handleFile(file) {
  if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
    alert('请选择 .md 或 .markdown 文件');
    return;
  }
  fileNameDisplay.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    loadMarkdown(e.target.result, file.name);
  };
  reader.readAsText(file);
}

// 点击选择按钮
document.getElementById('btn-select').addEventListener('click', () => {
  fileInput.click();
});

// drop-zone 内拖拽事件
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
  dragOverlay.classList.remove('active');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// 全局拖拽事件（整个页面）
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dragOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    dragOverlay.classList.remove('active');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragOverlay.classList.remove('active');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// 示例链接点击
document.querySelectorAll('.demo-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const demoKey = e.target.dataset.demo;
    const demoContent = demos[demoKey];
    if (demoContent) {
      fileNameDisplay.textContent = `\${demoKey}.md`;
      loadMarkdown(demoContent, `\${demoKey}.md`);
    }
  });
});
