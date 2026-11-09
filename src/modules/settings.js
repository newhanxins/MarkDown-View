/**
 * 设置管理模块 - 管理用户偏好设置
 * 使用 localStorage 持久化存储
 */

const SETTINGS_KEY = 'md-viewer-settings';

/** 默认设置 */
const DEFAULTS = {
  showLineNumbers: false,   // 代码块行号显示（默认关闭）
  tocCollapsible: true,     // 目录折叠/展开（默认开启）
  autoSaveDraft: false,     // 自动保存编辑草稿（默认关闭）
};

/**
 * 获取所有设置
 * @returns {Object} 当前设置
 */
export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

/**
 * 获取单个设置项
 * @param {string} key - 设置键名
 * @returns {any} 设置值
 */
export function getSetting(key) {
  const settings = getSettings();
  return settings[key];
}

/**
 * 设置单个设置项
 * @param {string} key - 设置键名
 * @param {any} value - 设置值
 */
export function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * 重置所有设置到默认值
 */
export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}
