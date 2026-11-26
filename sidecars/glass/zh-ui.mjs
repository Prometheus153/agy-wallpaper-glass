// Non-invasive Antigravity Desktop UI Chinese localization module.
// Strictly skips conversation content, code blocks, editors, terminals, and already-localized CJK text.

export const HOST_ZH_EXACT = Object.freeze({
  // Top menu bar
  'Workspace': '工作区',
  'View': '视图',
  'Window': '窗口',
  'File': '文件',
  'Edit': '编辑',
  'Help': '帮助',

  // Left sidebar navigation & sections
  'New Conversation': '新建对话',
  'Automations': '自动化',
  'Customizations': '自定义',
  'Projects': '项目',
  'Conversations': '对话',
  'Ungrouped': '未分组',
  'Ungrouped Projects': '未分组项目',
  'Settings': '设置',
  'Give Feedback': '反馈建议',
  'Search': '搜索',
  'Archived': '已归档',
  'Pinned': '已置顶',
  'Starred': '已星标',
  'History': '历史记录',

  // Composer & input bar
  'Ask anything, @ to mention, / for actions': '输入任何问题，使用 @ 提及，使用 / 执行操作',
  'Queued messages': '排队消息',
  'Queue': '排队',
  'Send immediately': '立即发送',
  'Send message': '发送消息',
  'Send': '发送',
  'Speak': '语音输入',
  'Stop': '停止',
  'Cancel': '取消',
  'Planning': '规划',
  'Fast': '极速',

  // Overview / split panes / toolbars
  'Overview': '概览',
  'Review': '审阅',
  'Files': '文件',
  'Terminal': '终端',
  'Plugins': '插件',
  'Subagents': '子智能体',
  'Background Tasks': '后台任务',
  'Artifacts': '产物',
  'Implementation Plan': '实现计划',
  'Task': '任务',
  'Walkthrough': '演练总结',
  'Changes': '更改',
  'No changes': '暂无更改',
  'Explorer': '资源管理器',
  'Browser': '浏览器',
  'Open': '打开',
  'Copy': '复制',
  'Copied': '已复制',
  'Reject': '拒绝',
  'Accept': '接受',
  'Proceed': '继续执行',
  'Approve': '批准',

  // Settings sidebar & tabs
  'General': '常规',
  'Apps': '应用',
  'Appearance': '外观',
  'Shortcuts': '快捷键',
  'Keybindings': '快捷键',
  'Notifications': '通知',
  'Models': '模型',
  'Account': '账号',
  'MCP Servers': 'MCP 服务器',
  'Skills': '技能',
  'Rules': '规则',
  'Workflows': '工作流',
  'Hooks': '钩子',
  'Installed': '已安装',
  'Marketplace': '应用市场',
  'Manage': '管理',

  // Settings content headings & controls
  'Interface Layout': '界面布局',
  'Knowledge Work': '知识工作',
  'Software Engineering': '软件工程',
  'Permissions': '权限',
  'This computer': '本机',
  'Remote': '远程',
  'Advanced': '高级',
  'Input Box': '输入框',
  'Voice mode': '语音模式',
  'Voice': '语音',
  'Microphone': '麦克风',
  'System default': '系统默认',
  'Not set': '未设置',
  'Change': '更改',
  'Theme': '主题',
  'Dark': '深色',
  'Light': '浅色',
  'System': '跟随系统',
  'Language': '语言',
  'Close': '关闭',
  'Save': '保存',
  'Reset': '重置',
  'Delete': '删除',
  'Remove': '移除',
  'Uninstall': '卸载',
  'Install': '安装',
  'Update': '更新',
  'Enable': '启用',
  'Disable': '停用',
  'Enabled': '已启用',
  'Disabled': '已停用',
  'Refresh': '刷新',
  'Sign in': '登录',
  'Sign out': '退出登录',
  'Learn more.': '了解更多。',
  'Learn more': '了解更多',
  'Keyboard shortcut': '键盘快捷键',
  'Keyboard shortcuts': '键盘快捷键',

  // Settings descriptions
  'Configure agent execution, queued messages, and permissions.': '配置智能体执行、排队消息发送以及权限。',
  'Simplified interface for research, writing, and everyday tasks.': '面向研究、写作与日常任务的精简界面。',
  'Full interface for coding, developer tools, and managing agents.': '面向编程、开发工具与多智能体管理的完整界面。',
  'Configure what the agent can do in local and remote conversations.': '配置智能体在本地和远程对话中的可执行权限。',
  'Controls what the agent can do in local conversations.': '控制智能体在本地对话中的可执行权限。',
  'Controls what the agent can do in remote conversations.': '控制智能体在远程对话中的可执行权限。',
  'Choose which key sends a message in the chat composer.': '选择在聊天输入框中发送消息的按键。',
  'The voice used in Voice mode. Powered by Gemini Live.': '语音模式下使用的声线，由 Gemini Live 驱动。',
  'Input device for voice mode and dictation.': '用于语音模式与听写的输入设备。',
  'Configure when queued messages are sent.': '配置排队消息的发送时机。',
});

const CJK_RE = /[\u4e00-\u9fff]/;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'PRE', 'CODE', 'SVG', 'CANVAS', 'VIDEO', 'IMG', 'IFRAME']);
const SKIP_SELECTOR = [
  '[data-testid="conversation-view"]',
  '[data-testid="user-message-bubble"]',
  'pre', 'code', '.monaco-editor', '.monaco-diff-editor', '.cm-editor', '.xterm',
  '[contenteditable="true"]',
  '#agy-glass-pet-root', '#agy-glass-pill-root', '#agy-glass-drawer-host',
  '#agy-glass-pet-menu', '#agy-glass-wallpaper',
].join(', ');
const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label', 'title'];

export function translateHostText(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  if (CJK_RE.test(raw)) return null; // Never double-translate external Chinese packs
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 160) return null;
  const hit = Object.hasOwn(HOST_ZH_EXACT, trimmed) ? HOST_ZH_EXACT[trimmed] : null;
  if (!hit) return null;
  const lead = raw.slice(0, raw.indexOf(trimmed));
  const tail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  return `${lead}${hit}${tail}`;
}

function isInsideSkipped(node) {
  let el = node?.nodeType === 1 ? node : node?.parentElement || node?.parentNode;
  while (el && el.nodeType === 1) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (typeof el.matches === 'function') {
      try { if (el.matches(SKIP_SELECTOR)) return true; } catch {}
    } else if (
      el.id === 'agy-glass-pet-root' || el.id === 'agy-glass-pill-root' ||
      el.id === 'agy-glass-drawer-host' || el.id === 'agy-glass-pet-menu' ||
      el.id === 'agy-glass-wallpaper' ||
      el.getAttribute?.('data-testid') === 'conversation-view' ||
      el.getAttribute?.('data-testid') === 'user-message-bubble' ||
      el.getAttribute?.('contenteditable') === 'true'
    ) {
      return true;
    }
    el = el.parentElement || el.parentNode;
  }
  return false;
}

export function createHostLocalizer({ root = typeof document !== 'undefined' ? document.body : null } = {}) {
  let enabled = false;
  let observer = null;
  let timer = 0;
  const pendingRoots = new Set();
  const origText = new Map();
  const origAttrs = new Map();

  function localizeElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (isInsideSkipped(el)) return;

    for (const attr of TRANSLATABLE_ATTRS) {
      const val = el.getAttribute?.(attr);
      if (typeof val !== 'string' || !val) continue;
      const mapped = origAttrs.get(el);
      if (mapped?.has(attr)) continue;
      const translated = translateHostText(val);
      if (translated && translated !== val) {
        if (!mapped) origAttrs.set(el, new Map([[attr, val]]));
        else mapped.set(attr, val);
        el.setAttribute(attr, translated);
      }
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;

    const children = el.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      if (child.nodeType === 3) {
        if (origText.has(child)) continue;
        const raw = child.nodeValue;
        const translated = translateHostText(raw);
        if (translated && translated !== raw) {
          origText.set(child, raw);
          child.nodeValue = translated;
        }
      } else if (child.nodeType === 1) {
        localizeElement(child);
      }
    }
  }

  function restoreAll() {
    for (const [textNode, original] of origText.entries()) {
      try { textNode.nodeValue = original; } catch {}
    }
    origText.clear();
    for (const [el, attrMap] of origAttrs.entries()) {
      for (const [attr, original] of attrMap.entries()) {
        try { el.setAttribute(attr, original); } catch {}
      }
    }
    origAttrs.clear();
  }

  function flushPending() {
    timer = 0;
    if (!enabled) { pendingRoots.clear(); return; }
    for (const node of pendingRoots) {
      if (node.nodeType === 1) localizeElement(node);
      else if (node.nodeType === 3 && node.parentElement) localizeElement(node.parentElement);
    }
    pendingRoots.clear();
  }

  function startObserver() {
    if (observer || !root || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      if (!enabled) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const added = m.addedNodes[i];
            if (added && !isInsideSkipped(added)) pendingRoots.add(added);
          }
        }
      }
      if (pendingRoots.size && !timer) {
        timer = setTimeout(flushPending, 120);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (timer) { clearTimeout(timer); timer = 0; }
    pendingRoots.clear();
    observer?.disconnect();
    observer = null;
  }

  function setEnabled(next) {
    const want = Boolean(next);
    if (want === enabled) return;
    enabled = want;
    if (enabled) {
      if (root) localizeElement(root);
      startObserver();
    } else {
      stopObserver();
      restoreAll();
    }
  }

  function dispose() {
    setEnabled(false);
  }

  return {
    setEnabled,
    dispose,
    isEnabled: () => enabled,
    refresh: () => { if (enabled && root) localizeElement(root); },
  };
}
