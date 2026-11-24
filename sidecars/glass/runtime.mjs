export function installGlass(payload) {
  const KEY = '__agyGlass';
  const previous = globalThis[KEY];
  if (previous?.owner === payload.owner) return previous.update(payload);
  if (!document.querySelector('.agy-shell') || !document.getElementById('root')) return { mounted: false };
  if (!payload.settings.enabled) return { mounted: false };
  previous?.dispose();

  const html = document.documentElement;
  const originalAttribute = html.getAttribute('data-agy-glass');
  const titlebar = document.querySelector('[data-testid="title-menu-bar"]');
  const nativeOverlay = globalThis.electronNative?.setTitleBarOverlay;
  const originalOverlay = titlebar && nativeOverlay ? {
    color: getComputedStyle(titlebar).backgroundColor,
    symbolColor: getComputedStyle(titlebar).color,
  } : null;
  function setOverlay(colors) {
    if (originalOverlay) Promise.resolve(nativeOverlay(colors)).catch(() => {});
  }

  const layer = document.createElement('div');
  layer.id = 'agy-glass-wallpaper';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  const backdrop = document.createElement('div');
  backdrop.className = 'agy-glass-backdrop';
  const scrim = document.createElement('div');
  scrim.className = 'agy-glass-scrim';
  layer.append(backdrop, scrim);
  const style = document.createElement('style');
  style.id = 'agy-glass-styles';
  document.head.append(style);
  document.body.prepend(layer);
  html.setAttribute('data-agy-glass', payload.owner);

  let settings;
  let sceneProps = {};
  let mediaElement;
  let mediaSource = null;
  let mediaKind = null;
  let mediaOrigin = '*';
  let lastReloadNonce = payload.reloadNonce || '';
  let mediaError = false;
  let lastHeartbeat = Date.now();
  let leaseMs = payload.leaseMs || 15000;
  let disposed = false;
  let lastPointerSent = 0;
  let pet = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const palettes = {
    midnight: {
      rgb: '17 23 37',
      scrimRgb: '6 10 18',
      text: '#e7ecf5',
      secondary: '#dce5f2',
      muted: '#c5d2e4',
      accent: '#7dd3fc',
      specular: '255 255 255',
      background: 'radial-gradient(ellipse at 15% 20%, #264b65 0%, transparent 52%), radial-gradient(ellipse at 85% 65%, #66568b 0%, transparent 55%), linear-gradient(140deg, #0c1728, #263344 65%, #121c2f)',
    },
    frost: {
      rgb: '239 244 246',
      scrimRgb: '244 248 253',
      text: '#0f172a',
      secondary: '#1c2b3d',
      muted: '#33465c',
      accent: '#2563eb',
      specular: '255 255 255',
      background: 'radial-gradient(ellipse at 10% 25%, #b5d8d6 0%, transparent 55%), radial-gradient(ellipse at 85% 70%, #bbc0e2 0%, transparent 60%), linear-gradient(140deg, #ecedf2, #c6d8df)',
    },
    ember: {
      rgb: '44 26 22',
      scrimRgb: '22 11 9',
      text: '#fdf0e6',
      secondary: '#f2d9c9',
      muted: '#dabaa7',
      accent: '#f6ad7b',
      specular: '255 226 198',
      background: 'radial-gradient(ellipse at 15% 20%, #8a4f3d 0%, transparent 52%), radial-gradient(ellipse at 85% 70%, #b57b4c 0%, transparent 55%), linear-gradient(135deg, #271718, #4d2e28 60%, #221417)',
    },
  };

  function postPlayer(msg) {
    if (mediaElement?.tagName !== 'IFRAME' || !mediaElement.contentWindow) return;
    try { mediaElement.contentWindow.postMessage(msg, mediaOrigin); } catch {}
  }

  function syncPlayerState() {
    if (!settings) return;
    postPlayer({
      type: 'agy-glass-player-update',
      payload: {
        fit: settings.fit || 'cover',
        paused: Boolean(settings.paused),
        pauseWhenHidden: settings.pauseWhenHidden !== false,
        volume: settings.volume ?? 0,
        playbackRate: settings.playbackRate || 1,
        posX: settings.posX ?? 50,
        posY: settings.posY ?? 50,
        zoom: settings.zoom ?? 100,
        flipX: Boolean(settings.flipX),
        pointerParallax: settings.pointerParallax !== false,
        hidden: Boolean(document.hidden),
        properties: sceneProps || {},
      },
    });
  }

  function syncPlayback() {
    if (!settings || !mediaElement) return;
    if (mediaElement.tagName === 'IFRAME') {
      syncPlayerState();
      return;
    }
    if (mediaElement.tagName !== 'VIDEO') return;
    const vol = Math.max(0, Math.min(1, (settings.volume ?? 0) / 100));
    mediaElement.volume = vol;
    mediaElement.muted = vol <= 0;
    try { mediaElement.playbackRate = settings.playbackRate || 1; } catch {}
    if (settings.paused || reducedMotion.matches || (settings.pauseWhenHidden && document.hidden)) {
      mediaElement.pause();
    } else {
      mediaElement.play().catch(() => { mediaError = true; });
    }
  }

  function releaseMedia() {
    if (!mediaElement) return;
    if (mediaElement.tagName === 'VIDEO') mediaElement.pause();
    mediaElement.removeAttribute('src');
    if (mediaElement.tagName === 'VIDEO') mediaElement.load();
    mediaElement.remove();
    mediaElement = null;
    mediaKind = null;
  }

  function onPointer(event) {
    if (disposed || !settings?.pointerParallax || settings.paused || mediaElement?.tagName !== 'IFRAME') return;
    const now = Date.now();
    if (event.type === 'pointermove' && now - lastPointerSent < 24) return;
    lastPointerSent = now;
    const w = globalThis.innerWidth || 1;
    const h = globalThis.innerHeight || 1;
    const u = Math.max(0, Math.min(1, event.clientX / w));
    const v = Math.max(0, Math.min(1, event.clientY / h));
    const mods = (event.ctrlKey ? 1 : 0) | (event.shiftKey ? 2 : 0) | (event.altKey ? 4 : 0) | (event.metaKey ? 8 : 0);
    postPlayer({ type: 'agy-glass-player-pointer', u, v, buttons: event.buttons || 0, mods });
  }
  function onPointerLeave() {
    if (!disposed && mediaElement?.tagName === 'IFRAME') postPlayer({ type: 'agy-glass-player-pointer-leave' });
  }

  function heartbeat() {
    lastHeartbeat = Date.now();
    return { mounted: !disposed, mediaError };
  }

  function update(next) {
    if (disposed) return { mounted: false };
    if (!next.settings.enabled) { dispose(); return { mounted: false }; }
    settings = next.settings;
    sceneProps = next.sceneProperties && typeof next.sceneProperties === 'object' ? next.sceneProperties : {};
    leaseMs = next.leaseMs || leaseMs;

    const p = palettes[settings.theme] || palettes.midnight;
    const isLight = settings.theme === 'frost';
    const scope = 'html[data-agy-glass]';
    const op = (settings.opacity ?? 58) / 100;
    const opEff = isLight ? Math.max(op, 0.72) : op;
    const opSoft = Math.max(0.08, opEff * 0.78).toFixed(3);
    const opHi = Math.min(0.95, opEff * 1.1).toFixed(3);
    const glass = `rgb(${p.rgb} / ${opEff})`;
    const glassSoft = `rgb(${p.rgb} / ${opSoft})`;
    const glassGrad = `linear-gradient(160deg, rgb(${p.rgb} / ${opHi}), rgb(${p.rgb} / ${opSoft}))`;
    const composerBg = isLight
      ? `linear-gradient(160deg, rgb(248 251 254 / ${Math.min(0.92, Math.max(0.78, op + 0.22)).toFixed(2)}), rgb(236 243 249 / ${Math.min(0.88, Math.max(0.72, op + 0.14)).toFixed(2)}))`
      : glassGrad;
    const solid = `rgb(${p.rgb} / .96)`;
    const readable = `rgb(${p.rgb} / ${Math.max(settings.opacity ?? 58, isLight ? 82 : 72) / 100})`;
    const dialogBg = `rgb(${p.rgb} / ${isLight ? '.92' : '.84'})`;
    const glassSat = settings.glassSaturation ?? 150;
    const blurPx = settings.blur ?? 16;
    const radiusPx = settings.radius ?? 18;
    const borderAlpha = (settings.border ?? 18) / 100;
    const line = `rgb(${isLight ? '30 48 72' : '255 255 255'} / ${isLight ? Math.max(0.18, borderAlpha) : borderAlpha})`;
    const splitLine = `rgb(${isLight ? '30 48 72' : p.specular} / ${Math.min(0.42, Math.max(0.2, borderAlpha + 0.08)).toFixed(2)})`;
    const nonChatPaneBg = `rgb(${p.rgb} / ${Math.min(0.9, Math.max(isLight ? 0.84 : 0.74, opEff + 0.18)).toFixed(2)})`;
    const reviewBg = `rgb(${p.rgb} / ${Math.min(0.93, Math.max(isLight ? 0.88 : 0.82, opEff + 0.24)).toFixed(2)})`;
    const uiTextShadow = isLight ? '0 1px 1px rgba(255,255,255,0.92)' : '0 1px 2px rgba(0,0,0,0.78)';
    const specularTop = `rgb(${p.specular} / ${Math.min(0.65, borderAlpha + (isLight ? 0.35 : 0.1)).toFixed(2)})`;
    const specularInner = `inset 0 1px 0 ${specularTop}, inset 0 -1px 0 rgb(${p.specular} / ${(borderAlpha * 0.35).toFixed(2)})`;
    const scrimAlpha = isLight
      ? ((settings.scrim ?? 40) === 0 ? 0 : Math.min(0.88, ((settings.scrim ?? 40) + 22) / 100))
      : (settings.scrim ?? 40) / 100;
    const textShadow = isLight
      ? '0 0 12px rgba(255,255,255,0.96), 0 0 4px rgba(255,255,255,0.98), 0 1px 1px rgba(255,255,255,0.92)'
      : '0 1px 2px #000, 0 0 6px rgba(0,0,0,0.45)';
    const font = settings.fontFamily
      ? settings.fontFamily.split(',').map(name => JSON.stringify(name.trim())).join(',') + ', system-ui, sans-serif'
      : 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

    const wpBlur = settings.wallpaperBlur ?? 0;
    const bright = settings.brightness ?? 100;
    const contr = settings.contrast ?? 100;
    const sat = settings.saturation ?? 100;
    const wpAlpha = Math.max(0, Math.min(1, (100 - (settings.wallpaperTransparency ?? 0)) / 100));
    const fitCss = settings.fit === 'contain' ? 'contain' : settings.fit === 'stretch' ? 'fill' : settings.fit === 'center' ? 'none' : 'cover';
    const posX = settings.posX ?? 50;
    const posY = settings.posY ?? 50;
    const zoomScale = (settings.zoom ?? 100) / 100;
    const scaleX = settings.flipX ? -zoomScale : zoomScale;
    const portSel = Number.isInteger(next.sidecarPort) && next.sidecarPort > 0 ? `, iframe[src*="127.0.0.1:${next.sidecarPort}/"]` : '';
    const agyFrame = `:is(iframe[src*="agy-glass"], iframe[title*="AGY Glass"], webview[src*="agy-glass"]${portSel})`;
    const frostOverrides = isLight ? `
${scope} .bg-sidebar :is([aria-current="page"],[data-active="true"],[data-selected="true"],[data-state="open"],[class*="bg-accent"],[class*="bg-sidebar-accent"],[class*="bg-zinc-"],[class*="bg-neutral-"],[class*="bg-slate-9"],[class*="bg-gray-9"],[class*="bg-[#0"],[class*="bg-[#1"],[class*="bg-[#2"]) { background: rgba(255,255,255,0.78) !important; color: #0f172a !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 6px rgba(15,23,42,0.08) !important; }
${scope} .bg-sidebar :is([aria-current="page"],[data-active="true"],[data-selected="true"]) * { color: #0f172a !important; }
${scope} [data-testid="conversation-view"] { color: ${p.text} !important; }
${scope} [data-testid="conversation-view"] :is(p,li,h1,h2,h3,h4,strong,blockquote) { color: ${p.text} !important; }
${scope} [data-testid="conversation-view"] :not(pre) > code { background: rgba(255,255,255,0.78) !important; color: #0f172a !important; border: 1px solid rgba(15,23,42,0.14) !important; }
${scope} [data-testid="conversation-view"] pre { background: rgba(246,250,254,0.88) !important; color: #0f172a !important; }
${scope} [data-testid="agent-input-box"] button:not([class*="rounded-full"]):not([class*="bg-foreground"]):not([class*="bg-white"]):not([class*="bg-black"]):not([class*="bg-primary"]):not([class*="bg-secondary"]):not([class*="bg-muted"]):not([class*="bg-blue"]):not([class*="bg-indigo"]):not([class*="bg-red"]):not([class*="bg-zinc"]):not([class*="bg-neutral"]):not([class*="bg-slate"]):not([class*="bg-gray"]):not([class*="bg-[#"]) { color: ${p.secondary} !important; }
` : '';

    style.textContent = `
${scope} { color-scheme: ${isLight ? 'light' : 'dark'}; --background: transparent !important; --shell: transparent !important; --shell-canvas: transparent !important; --sidebar: ${glass} !important; --sidebar-secondary: ${glassSoft} !important; --sidebar-muted: ${glassSoft} !important; --sidebar-foreground: ${p.text} !important; --sidebar-accent: ${isLight ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.12)'} !important; --sidebar-accent-foreground: ${p.text} !important; --card: ${glass} !important; --card-foreground: ${p.text} !important; --card-border: ${line} !important; --popover: ${dialogBg} !important; --popover-foreground: ${p.text} !important; --input: ${isLight ? 'rgba(255,255,255,0.78)' : glassSoft} !important; --accent: ${isLight ? 'rgba(255,255,255,0.74)' : 'rgba(255,255,255,0.12)'} !important; --accent-foreground: ${p.text} !important; --glass: ${glass} !important; --glass-border: ${line} !important; --glass-highlight: ${specularTop} !important; --secondary: ${glassSoft} !important; --muted: ${glassSoft} !important; --border: ${line} !important; --foreground: ${p.text} !important; --secondary-foreground: ${p.secondary} !important; --muted-foreground: ${p.muted} !important; --placeholder: ${p.muted} !important; --link: ${p.accent} !important; }
${scope} body { isolation: isolate; background: transparent !important; color: ${p.text}; }
${scope} #root { background: transparent !important; }
${scope} #agy-glass-wallpaper { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; background: ${p.background}; }
${scope} .agy-glass-backdrop { position: absolute; inset: -${wpBlur * 2}px; filter: blur(${wpBlur}px) brightness(${bright}%) contrast(${contr}%) saturate(${sat}%); opacity: ${wpAlpha}; transition: opacity .2s ease; }
${scope} .agy-glass-backdrop > :is(img,video) { width: 100%; height: 100%; object-fit: ${fitCss}; object-position: ${posX}% ${posY}%; transform: scale(${scaleX}, ${zoomScale}); transform-origin: center center; pointer-events: none; display: block; }
${scope} .agy-glass-backdrop > iframe.agy-glass-player-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; display: block; background: transparent; }
${scope} .agy-glass-scrim { position: absolute; inset: 0; background: rgb(${p.scrimRgb} / ${scrimAlpha}); }
${scope} .agy-shell { font-family: ${font}; font-size: ${settings.fontSize}px; color: ${p.text}; }
${scope} :is([data-testid="conversation-view"], [data-testid="agent-input-box"]) :is(p,textarea,[contenteditable="true"]) { font-family: ${font}; font-size: ${settings.fontSize}px; }
${scope} :is(input,textarea,[contenteditable="true"]) { caret-color: ${settings.caret}; }
${scope} .bg-sidebar:has([data-testid="sidebar-navigation-items"]) { background: ${glassGrad} !important; color: ${p.text} !important; backdrop-filter: blur(${blurPx}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${blurPx}px) saturate(${glassSat}%); border-right: 1px solid ${line}; box-shadow: inset -1px 0 0 ${specularTop}, 6px 0 24px rgba(0,0,0,${isLight ? '0.08' : '0.16'}); }
${scope} [data-testid="title-menu-bar"] { background: linear-gradient(180deg, rgb(${p.rgb} / ${Math.min(0.75, opEff * 0.88).toFixed(2)}), rgb(${p.rgb} / ${Math.min(0.35, opEff * 0.4).toFixed(2)})) !important; color: ${p.text} !important; backdrop-filter: blur(${Math.max(6, Math.round(blurPx * 0.65))}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(6, Math.round(blurPx * 0.65))}px) saturate(${glassSat}%); border-bottom: 1px solid rgb(${p.specular} / ${(borderAlpha * 0.45).toFixed(2)}); }
${scope} :is(button,[role="button"]) { --background: ${isLight ? '#f8fafc' : '#0f172a'} !important; }
${scope} [data-testid="agent-input-box"] { background: ${composerBg} !important; color: ${p.text} !important; backdrop-filter: blur(${blurPx}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${blurPx}px) saturate(${glassSat}%); border: 1px solid ${line} !important; border-radius: ${radiusPx}px !important; box-shadow: ${specularInner}, 0 12px 34px rgba(0,0,0,${isLight ? '0.12' : '0.22'}) !important; }
${scope} [data-testid="agent-input-box"] :is(form,textarea,[contenteditable="true"],[role="textbox"]) { background-color: transparent !important; background-image: none !important; }
${scope} [data-testid="agent-input-box"] div:not(button):not([role="button"]):not(button *):not([role="button"] *):not([class*="rounded-full"]):not([role="progressbar"]) { background-color: transparent !important; background-image: none !important; }
${scope} [data-testid="agent-input-box"] :is(textarea,input,[contenteditable="true"],[role="textbox"]) { color: ${p.text} !important; }
${scope} [data-testid="agent-input-box"] :is(textarea,input)::placeholder, ${scope} [data-testid="agent-input-box"] [data-placeholder]::before { color: ${p.muted} !important; opacity: 0.92 !important; }
${scope} [data-pane-id].group\\/pane:has([data-testid="conversation-view"]) { background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border: 0 !important; box-shadow: none !important; }
${scope} [data-pane-id]:not(:has([data-testid="conversation-view"])):not(:has(${agyFrame})) { background: ${nonChatPaneBg} !important; color: ${p.text} !important; backdrop-filter: blur(${Math.max(14, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(14, blurPx)}px) saturate(${glassSat}%); border-left: 1px solid ${splitLine} !important; box-shadow: inset 1px 0 0 ${specularTop}, -8px 0 24px rgba(0,0,0,${isLight ? '0.07' : '0.22'}) !important; }
${scope} [data-pane-id]:not(:has([data-testid="conversation-view"])):not(:has(${agyFrame})) :is([role="tab"],[role="treeitem"],button,a,label,span,h1,h2,h3,h4):not(:is(pre,code,pre *,code *)) { text-shadow: ${uiTextShadow}; }
${scope} .agy-shell :is([role="tablist"] [role="tab"], [role="tree"] [role="treeitem"], [data-testid*="explorer"] button, [data-testid*="file-tree"] button) { color: ${p.secondary} !important; text-shadow: ${uiTextShadow}; }
${scope} .agy-shell :is([role="tablist"] [role="tab"][aria-selected="true"], [role="tree"] [role="treeitem"][aria-selected="true"]) { color: ${p.text} !important; font-weight: 500; }
${scope} :is([data-testid*="review"],[data-testid*="diff"],[data-testid*="changes"],[data-testid*="editor"],[data-testid*="terminal"],.monaco-editor,.monaco-diff-editor,.cm-editor,.xterm):not(:has(${agyFrame})) { background-color: ${reviewBg} !important; backdrop-filter: blur(${Math.max(16, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(16, blurPx)}px) saturate(${glassSat}%); }
${scope} [data-pane-id]:not(:has([data-testid="conversation-view"])):not(:has(${agyFrame})):has(:is(.monaco-editor,.monaco-diff-editor,.cm-editor,.xterm,[data-testid*="diff"],[data-testid*="review"],table)) { background: ${reviewBg} !important; }
${scope} :is([data-pane-id],[data-panel]) ~ :is([data-pane-id],[data-panel]):not(:has(${agyFrame})) { border-left: 1px solid ${splitLine} !important; box-shadow: inset 1px 0 0 ${specularTop}, -1px 0 12px rgba(0,0,0,${isLight ? '0.06' : '0.2'}) !important; }
${scope} :is([data-panel-resize-handle-id],[data-resize-handle],[role="separator"][aria-orientation="vertical"]) { position: relative; background: transparent !important; }
${scope} :is([data-panel-resize-handle-id],[data-resize-handle],[role="separator"][aria-orientation="vertical"])::after { content: ""; position: absolute; inset: 8px auto 8px 50%; width: 1px; transform: translateX(-50%); background: linear-gradient(180deg, transparent 0%, ${splitLine} 10%, ${splitLine} 90%, transparent 100%); box-shadow: 0 0 8px rgba(0,0,0,${isLight ? '0.08' : '0.32'}); pointer-events: none; transition: background 0.15s ease, width 0.15s ease; }
${scope} :is([data-panel-resize-handle-id],[data-resize-handle],[role="separator"][aria-orientation="vertical"]):hover::after { width: 2px; background: ${p.accent}; }
${scope} :is([data-pane-id],[data-panel],[data-testid="aux-sidebar"],[data-testid="auxiliary-sidebar"]):not(:has([data-testid="conversation-view"])):has(${agyFrame}),
${scope} div:not(#agy-glass-wallpaper):not(:has([data-testid="conversation-view"])):has(> :is([data-pane-id],[data-panel]):has(${agyFrame})) { flex: 0 0 clamp(296px, 24vw, 344px) !important; flex-basis: clamp(296px, 24vw, 344px) !important; width: clamp(296px, 24vw, 344px) !important; max-width: 356px !important; min-width: 280px !important; }
${scope}:has([data-pane-id]:not(:has([data-testid="conversation-view"])):has(${agyFrame})) :is([data-pane-id],[data-panel]):has([data-testid="conversation-view"]):not(:has(${agyFrame})) { flex: 1 1 0% !important; max-width: none !important; }
${scope} [data-testid="conversation-view"] { text-shadow: ${textShadow}; }
${scope} [data-testid="conversation-view"] :is(pre,code,button,input,textarea,[contenteditable="true"]) { text-shadow: none; }
${scope} [data-testid="conversation-view"] pre { background: rgb(${p.rgb} / ${Math.min(0.88, opEff + 0.16).toFixed(2)}) !important; backdrop-filter: blur(${Math.min(20, blurPx)}px); border: 1px solid ${line}; border-radius: ${Math.max(8, Math.round(radiusPx * 0.65))}px; }
${scope} :is([data-testid="pane-titlebar-toolbar"],[data-testid="toggle-overview-panel"],[data-testid="toggle-aux-sidebar"]) { background: ${readable} !important; backdrop-filter: blur(${Math.min(18, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.min(18, blurPx)}px) saturate(${glassSat}%); border: 1px solid ${line}; border-radius: 10px; box-shadow: ${specularInner}; }
${scope} :is([data-testid="pane-titlebar-toolbar"] button,[data-testid="toggle-overview-panel"],[data-testid="toggle-aux-sidebar"]) { color: ${p.text} !important; }
${scope} :is([data-testid="pane-titlebar-toolbar"] button,[data-testid="toggle-overview-panel"],[data-testid="toggle-aux-sidebar"]):is(:hover,:focus-visible) { background: ${solid} !important; }
${scope} [data-testid="user-message-bubble"] { background: ${composerBg} !important; color: ${p.text} !important; backdrop-filter: blur(${Math.min(20, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.min(20, blurPx)}px) saturate(${glassSat}%); border: 1px solid ${line}; border-radius: ${Math.max(10, Math.round(radiusPx * 0.8))}px; box-shadow: ${specularInner}; }
${scope} :is([role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]) { --background: ${dialogBg} !important; --card: ${dialogBg} !important; --sidebar: ${dialogBg} !important; --muted: ${glass} !important; color: ${p.text} !important; }
${scope} :is([role="menu"],[role="listbox"]) { background-color: ${dialogBg} !important; backdrop-filter: blur(${Math.max(18, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(18, blurPx)}px) saturate(${glassSat}%); border: 1px solid ${line}; box-shadow: ${specularInner}, 0 14px 36px rgba(0,0,0,${isLight ? '0.16' : '0.34'}); }
${scope} [role="dialog"] { border-radius: ${radiusPx}px; background: ${dialogBg} !important; backdrop-filter: blur(${Math.max(20, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(20, blurPx)}px) saturate(${glassSat}%); border: 1px solid ${line}; box-shadow: ${specularInner}, 0 24px 60px rgba(0,0,0,${isLight ? '0.2' : '0.42'}); }
${frostOverrides}
${scope} #agy-glass-pet-root { position: fixed; z-index: 2147482000; pointer-events: none; user-select: none; transition: left 0.24s cubic-bezier(0.22, 1, 0.36, 1), top 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease; filter: drop-shadow(0 6px 14px rgba(15, 18, 36, 0.34)); }
${scope} #agy-glass-pet-root.dragging { transition: none !important; }
${scope} #agy-glass-pet-root[hidden] { display: none !important; }
${scope} #agy-glass-pet-canvas { width: 100%; height: 100%; display: block; pointer-events: none; }
${scope} #agy-glass-pet-hit { position: absolute; pointer-events: auto; cursor: pointer; touch-action: none; border-radius: 42% 14% 26% 44% / 28% 12% 24% 38%; outline: none; }
${scope} #agy-glass-pet-root.dragging #agy-glass-pet-hit { cursor: grabbing; }
${scope} #agy-glass-drawer-host { position: fixed; top: 44px; bottom: 14px; z-index: 2147481990; border-radius: ${radiusPx}px; overflow: hidden; background: ${dialogBg}; backdrop-filter: blur(${Math.max(22, blurPx)}px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(${Math.max(22, blurPx)}px) saturate(${glassSat}%); border: 1px solid ${line}; box-shadow: ${specularInner}, 0 22px 60px rgba(0,0,0,0.44); transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease, left 0.24s cubic-bezier(0.22, 1, 0.36, 1); }
${scope} #agy-glass-drawer-host[data-open="false"] { opacity: 0; pointer-events: none; transform: translateX(28px) scale(0.98); }
${scope} #agy-glass-drawer-host[data-open="true"] { opacity: 1; pointer-events: auto; transform: translateX(0) scale(1); }
${scope} #agy-glass-drawer-frame { width: 100%; height: 100%; border: 0; display: block; background: transparent; }
${scope} #agy-glass-drawer-close { position: absolute; top: 9px; right: 58px; z-index: 5; width: 24px; height: 24px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(16,20,30,0.52); color: #eef5fb; font-size: 14px; line-height: 1; display: grid; place-items: center; cursor: pointer; }
${scope} #agy-glass-drawer-close:hover { background: rgba(255,255,255,0.2); }
${scope} #agy-glass-pet-menu { position: fixed; z-index: 2147482100; min-width: 152px; padding: 6px; border-radius: 12px; background: ${dialogBg}; backdrop-filter: blur(22px) saturate(${glassSat}%); -webkit-backdrop-filter: blur(22px) saturate(${glassSat}%); border: 1px solid ${line}; box-shadow: ${specularInner}, 0 14px 36px rgba(0,0,0,0.38); display: flex; flex-direction: column; gap: 3px; }
${scope} #agy-glass-pet-menu[hidden] { display: none !important; }
${scope} .agy-pet-menu-item { text-align: left; font: inherit; font-size: 12px; padding: 6px 10px; border-radius: 7px; border: 0; background: transparent; color: ${p.text}; cursor: pointer; white-space: nowrap; }
${scope} .agy-pet-menu-item:hover { background: ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.12)'}; }
@media (prefers-reduced-transparency: reduce) { ${scope} [role="dialog"], ${scope} .bg-sidebar, ${scope} [data-testid="agent-input-box"] { background: ${solid} !important; backdrop-filter: none; } }
`;

    setOverlay({ color: '#00000000', symbolColor: p.text });

    const source = next.media?.url || next.media?.dataUrl || null;
    const kind = next.media?.kind || null;
    const reloadChanged = Boolean(next.reloadNonce && next.reloadNonce !== lastReloadNonce);
    lastReloadNonce = next.reloadNonce || lastReloadNonce;

    if (source !== mediaSource || kind !== mediaKind) {
      releaseMedia();
      mediaSource = source;
      mediaKind = kind;
      mediaError = false;
      mediaOrigin = '*';
      if (source) {
        if (kind === 'scene' || kind === 'web') {
          try { mediaOrigin = new URL(source).origin; } catch { mediaOrigin = '*'; }
          mediaElement = document.createElement('iframe');
          mediaElement.className = 'agy-glass-player-frame';
          mediaElement.setAttribute('allow', 'autoplay');
          mediaElement.addEventListener('load', syncPlayerState);
          mediaElement.src = source;
          backdrop.append(mediaElement);
        } else {
          mediaElement = document.createElement(kind === 'video' ? 'video' : 'img');
          if (mediaElement.tagName === 'VIDEO') {
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.playsInline = true;
            mediaElement.preload = 'auto';
            mediaElement.addEventListener('loadeddata', syncPlayback);
          } else {
            mediaElement.alt = '';
          }
          const element = mediaElement;
          mediaElement.addEventListener('error', () => {
            if (mediaElement === element) { mediaError = true; element.style.visibility = 'hidden'; }
          });
          mediaElement.src = source;
          backdrop.append(mediaElement);
        }
      }
    } else if (reloadChanged && mediaElement) {
      if (mediaElement.tagName === 'IFRAME') postPlayer({ type: 'agy-glass-player-reload' });
      else if (mediaElement.tagName === 'VIDEO') {
        try { mediaElement.currentTime = 0; } catch {}
        syncPlayback();
      }
    }

    syncPlayback();
    if (!pet && typeof createCatPet === 'function' && next.petAssets) {
      pet = createCatPet({
        getSettings: () => settings,
        assets: next.petAssets,
        drawerUrl: next.drawerUrl || '',
        isPreview: payload.owner === 'agy-glass-preview',
        onPatch: patch => { settings = { ...settings, ...patch }; },
      });
    } else {
      pet?.update(settings);
    }
    return heartbeat();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(watchdog);
    pet?.dispose();
    pet = null;
    document.removeEventListener('visibilitychange', syncPlayback);
    reducedMotion.removeEventListener('change', syncPlayback);
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('pointermove', onPointer);
      globalThis.removeEventListener('pointerdown', onPointer);
      globalThis.removeEventListener('pointerup', onPointer);
      globalThis.removeEventListener('mouseleave', onPointerLeave);
    }
    releaseMedia();
    mediaSource = null;
    style.remove();
    layer.remove();
    if (originalOverlay) setOverlay(originalOverlay);
    if (html.getAttribute('data-agy-glass') === payload.owner) {
      if (originalAttribute === null) html.removeAttribute('data-agy-glass');
      else html.setAttribute('data-agy-glass', originalAttribute);
    }
    if (globalThis[KEY]?.owner === payload.owner) delete globalThis[KEY];
  }

  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('pointermove', onPointer, { passive: true });
    globalThis.addEventListener('pointerdown', onPointer, { passive: true });
    globalThis.addEventListener('pointerup', onPointer, { passive: true });
    globalThis.addEventListener('mouseleave', onPointerLeave, { passive: true });
  }
  const watchdog = setInterval(() => { if (Date.now() - lastHeartbeat > leaseMs) dispose(); }, 3000);
  globalThis[KEY] = { owner: payload.owner, update, heartbeat, dispose };
  return update(payload);
}
