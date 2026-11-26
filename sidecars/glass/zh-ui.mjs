// Non-invasive Antigravity Desktop UI Chinese localization module.
// Combines core UI entries + MIT-licensed antigravity-zh-plugin v1.7.0 full dictionary (lazy-loaded over loopback)
// and dynamic quota/time patterns. Strictly skips chats, code blocks, editors, terminals, and existing CJK text.

export const HOST_ZH_EXACT = Object.freeze({
  'Workspace': '工作区',
  'View': '视图',
  'Window': '窗口',
  'File': '文件',
  'Edit': '编辑',
  'Help': '帮助',
  'New Conversation': '新建对话',
  'Automations': '自动化',
  'Customizations': '自定义',
  'Projects': '项目',
  'Conversations': '对话',
  'Not in Project': '未归入项目',
  'Ungrouped': '未分组',
  'Ungrouped Projects': '未分组项目',
  'Settings': '设置',
  'Application': '应用设置',
  'Give Feedback': '反馈建议',
  'Ask anything, @ to mention, / for actions': '输入任何问题，使用 @ 提及，使用 / 执行操作',
  'Overview': '概览',
  'Review': '审阅',
  'Files': '文件',
  'Terminal': '终端',
  'Plugins': '插件',
  'Subagents': '子智能体',
  'Background Tasks': '后台任务',
  'Artifacts': '产物',
  'Implementation Plan': '实现计划',
  'General': '常规',
  'Apps': '应用',
  'Appearance': '外观',
  'Shortcuts': '快捷键',
  'Keybindings': '快捷键',
  'Notifications': '通知',
  'Models': '模型',
  'Browser': '浏览器',
  'Models & Usage': '模型与用量',
  'Manage your model quota and credits.': '管理您的模型配额与额度。',
  'Plan': '套餐方案',
  'Upgrade': '升级',
  'Your plan: Google AI Pro': '您的套餐：Google AI Pro',
  'Your plan: Google AI Ultra': '您的套餐：Google AI Ultra',
  'You can upgrade to a Google AI Ultra plan to receive higher rate limits.': '您可以升级至 Google AI Ultra 套餐以获得更高的速率配额。',
  'Model Credits': '模型额度',
  'Enable AI credit overages': '启用 AI 额度超额使用',
  "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": '开启后，当模型配额用尽时，Antigravity 将使用您的 AI 额度继续处理请求。系统始终优先消耗模型配额，再使用 AI 额度。',
  'Orchestrator Settings': '编排器设置',
  'Choose the models Orchestrator uses. A larger, smarter orchestrator model with a faster, cheaper executor gives high quality for fewer tokens.': '选择编排器使用的模型。更强更聪明的编排模型搭配更快更省的执行模型，能以更少的 Token 获得更高质量。',
  'Orchestrator Model': '编排模型',
  'Plans the work, makes design decisions, and reviews the result. Pick a top-tier model. You can also pick one per conversation from the Orchestrator row in the model menu.': '负责规划任务、制定设计决策并审阅结果，建议选择顶级模型；也可以在模型菜单的编排器行里为每个对话单独指定。',
  'Executor Model': '执行模型',
  'Carries out the plan: searches, edits, builds, and tests. Pick a faster, cheaper model.': '负责执行计划：搜索、编辑、构建和测试，建议选择速度更快、消耗更低的模型。',
  'Gemini Models': 'Gemini 模型',
  'Claude and GPT models': 'Claude 与 GPT 模型',
  'Weekly Limit Remaining': '每周剩余额度',
  'Five Hour Limit Remaining': '5 小时剩余额度',
  'Interface Layout': '界面布局',
  'Knowledge Work': '知识工作',
  'Software Engineering': '软件工程',
  'Permissions': '权限',
  'This computer': '本机',
  'Remote': '远程',
  'Advanced': '高级',
  'Input Box': '输入框',
  'Queued messages': '排队消息',
  'Send message': '发送消息',
  'Voice mode': '语音模式',
  'Voice': '语音',
  'Microphone': '麦克风',
  'System default': '系统默认',
  'Not set': '未设置',
  'Change': '更改',
});

function localizeDuration(str) {
  return String(str || '')
    .replace(/(\d+)\s*days?\s*,\s*(\d+)\s*hours?/gi, '$1 天 $2 小时')
    .replace(/(\d+)\s*hours?\s*,\s*(\d+)\s*minutes?/gi, '$1 小时 $2 分钟')
    .replace(/(\d+)\s*minutes?\s*,\s*(\d+)\s*seconds?/gi, '$1 分 $2 秒')
    .replace(/(\d+)\s*days?/gi, '$1 天')
    .replace(/(\d+)\s*hours?/gi, '$1 小时')
    .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
    .replace(/(\d+)\s*seconds?/gi, '$1 秒');
}

const HOST_ZH_PATTERNS = [
  [/^Your plan:\s*(.+)$/i, (_, plan) => `您的套餐：${plan}`],
  [/^You have used some of your weekly limit,?\s*it will fully refresh in\s*(.+?)\.?$/i, (_, dur) => `您已使用部分每周额度，将在 ${localizeDuration(dur)}后完全刷新。`],
  [/^You have used some of your 5-?hour limit,?\s*it will fully refresh in\s*(.+?)\.?$/i, (_, dur) => `您已使用部分 5 小时额度，将在 ${localizeDuration(dur)}后完全刷新。`],
  [/^Resets? in\s*(.+?)\.?$/i, (_, dur) => `${localizeDuration(dur)}后重置`],
  [/^Refreshes? in\s*(.+?)\.?$/i, (_, dur) => `${localizeDuration(dur)}后刷新`],
  [/^(\d+)\s*(?:minutes?|mins?)\s+ago$/i, '$1 分钟前'],
  [/^(\d+)\s*(?:hours?|hrs?)\s+ago$/i, '$1 小时前'],
  [/^(\d+)\s*days?\s+ago$/i, '$1 天前'],
  [/^(\d+)\s+files?\s+changed$/i, '$1 个文件已更改'],
];

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

let externalExact = null;
let externalLower = null;
let externalLoading = null;

export function setExternalHostDict(dict) {
  if (!dict || typeof dict !== 'object') return;
  externalExact = dict;
  externalLower = new Map();
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v !== 'string' || !v) continue;
    const lk = k.trim().toLowerCase();
    if (lk && !externalLower.has(lk)) externalLower.set(lk, v);
  }
}

export function loadExternalHostDict(url) {
  if (!url || typeof fetch !== 'function') return Promise.resolve(false);
  if (externalExact) return Promise.resolve(true);
  if (externalLoading) return externalLoading;
  externalLoading = fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (data && typeof data === 'object') { setExternalHostDict(data); return true; }
      return false;
    })
    .catch(() => false)
    .finally(() => { externalLoading = null; });
  return externalLoading;
}

function lookupDict(trimmed) {
  if (Object.hasOwn(HOST_ZH_EXACT, trimmed)) return HOST_ZH_EXACT[trimmed];
  if (externalExact && Object.hasOwn(externalExact, trimmed)) return externalExact[trimmed];
  const lower = trimmed.toLowerCase();
  if (externalLower?.has(lower)) return externalLower.get(lower);
  const punc = /([:：.。?？!！…]|\.\.\.)$/.exec(trimmed);
  if (punc) {
    const core = trimmed.slice(0, -punc[0].length).trim();
    const hit = Object.hasOwn(HOST_ZH_EXACT, core)
      ? HOST_ZH_EXACT[core]
      : (externalExact && Object.hasOwn(externalExact, core) ? externalExact[core] : externalLower?.get(core.toLowerCase()));
    if (hit) {
      const zhPunc = punc[0] === ':' ? '：' : punc[0] === '.' ? '。' : punc[0] === '?' ? '？' : punc[0] === '!' ? '！' : punc[0];
      return hit.endsWith(zhPunc) ? hit : `${hit}${zhPunc}`;
    }
  }
  for (const [re, repl] of HOST_ZH_PATTERNS) {
    if (re.test(trimmed)) return trimmed.replace(re, repl);
  }
  return null;
}

export function translateHostText(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  if (CJK_RE.test(raw)) return null; // Never double-translate external Chinese packs
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 480) return null;
  const hit = lookupDict(trimmed);
  if (!hit || hit === trimmed) return null;
  const idx = raw.indexOf(trimmed);
  return `${raw.slice(0, idx)}${hit}${raw.slice(idx + trimmed.length)}`;
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

export function createHostLocalizer({ root = typeof document !== 'undefined' ? document.body : null, dictUrl = '' } = {}) {
  let enabled = false;
  let observer = null;
  let timer = 0;
  let currentDictUrl = dictUrl;
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

  function setEnabled(next, nextDictUrl = '') {
    if (nextDictUrl) currentDictUrl = nextDictUrl;
    const want = Boolean(next);
    if (want === enabled) {
      if (enabled && currentDictUrl && !externalExact) {
        void loadExternalHostDict(currentDictUrl).then(ok => { if (ok && enabled && root) localizeElement(root); });
      }
      return;
    }
    enabled = want;
    if (enabled) {
      if (root) localizeElement(root);
      startObserver();
      if (currentDictUrl && !externalExact) {
        void loadExternalHostDict(currentDictUrl).then(ok => { if (ok && enabled && root) localizeElement(root); });
      }
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
