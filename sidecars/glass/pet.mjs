export function createCatPet({ onPatch, getSettings, assets, drawerUrl, isPreview = false } = {}) {
  if (typeof document === 'undefined' || !document.body) return null;

  const ASPECT = 493 / 320;
  const SEAM_RATIO = 0.9413;
  const DRAWER_W = 336;
  const ENTRY_MODES = ['pet', 'pill'];
  const getLang = () => (typeof resolveLanguage === 'function' ? resolveLanguage(settings?.language) : 'zh-CN');
  const L = (key, vars) => (typeof tr === 'function' ? tr(getLang(), key, vars) : key);
  const entryLabel = m => L(m === 'pill' ? 'entryPill' : 'entryPet');
  const resolveEntryMode = s => {
    if (ENTRY_MODES.includes(s?.entryMode)) return s.entryMode;
    return s?.petEnabled === false ? 'pill' : 'pet';
  };

  let settings = getSettings();
  let disposed = false;
  let drawerOpen = false;
  let dragging = false;
  let pointerDown = false;
  let dragMoved = false;
  let dragStartY = 0;
  let dragStartTop = 0;
  let hovered = false;
  let hoverT = 0;
  let excitedT = 0;
  let winkUntil = 0;
  let nextWinkAt = Date.now() + 5500 + Math.random() * 3500;
  let tailPhase = 0;
  let lastFrameAt = 0;
  let lastLayoutAt = 0;
  let lastPaneRight = -1;
  let rafId = 0;
  let currentLeft = 0;
  let currentTop = 200;
  let drawerLoaded = false;
  let obscured = false;

  // Floating liquid-glass drawer host (only used in live Antigravity Desktop, not preview iframe)
  let drawerHost = null;
  let drawerFrame = null;
  let closeBtn = null;
  if (!isPreview && drawerUrl) {
    drawerHost = document.createElement('div');
    drawerHost.id = 'agy-glass-drawer-host';
    drawerHost.setAttribute('data-open', 'false');
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'agy-glass-drawer-close';
    closeBtn.textContent = '×';
    closeBtn.title = L('petCloseDrawer');
    closeBtn.addEventListener('click', () => setDrawerOpen(false));
    drawerFrame = document.createElement('iframe');
    drawerFrame.id = 'agy-glass-drawer-frame';
    drawerFrame.title = L('petFrameTitle');
    drawerFrame.src = drawerUrl;
    drawerFrame.addEventListener('load', () => { drawerLoaded = true; });
    drawerHost.append(closeBtn, drawerFrame);
    document.body.append(drawerHost);
  }

  // Pet root (click-through canvas container) & tight body hit target
  const root = document.createElement('div');
  root.id = 'agy-glass-pet-root';
  const canvas = document.createElement('canvas');
  canvas.id = 'agy-glass-pet-canvas';
  const hit = document.createElement('div');
  hit.id = 'agy-glass-pet-hit';
  hit.setAttribute('role', 'button');
  hit.setAttribute('tabindex', '0');
  hit.setAttribute('aria-label', L('petAria'));
  hit.title = L('petTitle');
  root.append(canvas, hit);
  document.body.append(root);

  // Minimal Liquid Glass floating pill entry (for entryMode === 'pill')
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.id = 'agy-glass-pill-root';
  pill.hidden = true;
  pill.textContent = '✦';
  pill.setAttribute('aria-label', L('pillAria'));
  pill.title = L('pillTitle');
  document.body.append(pill);

  // Right-click mini glass context menu
  const menu = document.createElement('div');
  menu.id = 'agy-glass-pet-menu';
  menu.hidden = true;
  document.body.append(menu);

  // Load transparent WebP images (gracefully guarded for minimal VM tests)
  const imgOpen = typeof Image === 'function' ? new Image() : null;
  const imgWink = typeof Image === 'function' ? new Image() : null;
  const imgTail = typeof Image === 'function' ? new Image() : null;
  let openReady = false;
  let winkReady = false;
  let tailReady = false;
  if (imgOpen && assets?.open) {
    imgOpen.crossOrigin = 'anonymous';
    imgOpen.onload = () => { openReady = true; };
    imgOpen.src = assets.open;
  }
  if (imgWink && assets?.wink) {
    imgWink.crossOrigin = 'anonymous';
    imgWink.onload = () => { winkReady = true; };
    imgWink.src = assets.wink;
  }
  if (imgTail && assets?.tail) {
    imgTail.crossOrigin = 'anonymous';
    imgTail.onload = () => { tailReady = true; };
    imgTail.src = assets.tail;
  }

  function dims() {
    const bodyW = Math.max(60, Math.min(140, settings?.petSize || 92));
    const bodyH = Math.round(bodyW * ASPECT);
    const padL = Math.round(bodyW * 0.72);
    const padT = Math.round(bodyW * 0.08);
    const padB = Math.round(bodyW * 0.86);
    const canvasW = bodyW + padL;
    const canvasH = bodyH + padT + padB;
    const seamInCanvas = padL + bodyW * SEAM_RATIO;
    return { bodyW, bodyH, padL, padT, padB, canvasW, canvasH, seamInCanvas };
  }

  function findChatPaneRect() {
    const vw = globalThis.innerWidth || 1280;
    const vh = globalThis.innerHeight || 800;
    const conv = document.querySelector?.('[data-testid="conversation-view"]');
    const pane = conv?.closest?.('[data-pane-id]') || document.querySelector?.('[data-pane-id]:has([data-testid="conversation-view"])') || conv;
    if (pane && typeof pane.getBoundingClientRect === 'function') {
      const r = pane.getBoundingClientRect();
      if (r && r.width > 120 && r.height > 120) return r;
    }
    return { left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh };
  }

  function dispatchPatch(patch) {
    settings = { ...settings, ...patch };
    if (typeof onPatch === 'function') onPatch(patch);
    if (drawerFrame?.contentWindow && drawerLoaded) {
      try { drawerFrame.contentWindow.postMessage({ type: 'agy-glass-pet-patch', patch }, new URL(drawerUrl).origin); } catch {}
    } else if (isPreview && globalThis.parent && globalThis.parent !== globalThis) {
      try { globalThis.parent.postMessage({ type: 'agy-glass-pet-patch', patch }, globalThis.location.origin); } catch {}
    }
  }

  function layout(instant = false) {
    if (disposed) return;
    const d = dims();
    const rect = findChatPaneRect();
    const vh = globalThis.innerHeight || 800;
    const drawerW = Math.min(DRAWER_W, Math.max(260, Math.round(rect.width - 52)));
    const anchorX = drawerHost && drawerOpen ? Math.round(rect.right - 8 - drawerW) : Math.round(rect.right);
    currentLeft = Math.max(4, Math.round(anchorX - d.seamInCanvas));
    if (!dragging) {
      const minY = 52;
      const maxY = Math.max(minY, vh - d.canvasH - 44);
      const ratio = Math.max(0, Math.min(1, ((settings?.petY ?? 46) - 10) / 76));
      currentTop = Math.round(minY + ratio * (maxY - minY));
    }
    root.style.width = `${d.canvasW}px`;
    root.style.height = `${d.canvasH}px`;
    root.style.left = `${currentLeft}px`;
    root.style.top = `${currentTop}px`;
    root.classList.toggle('dragging', dragging || instant);
    hit.style.left = `${d.padL + Math.round(d.bodyW * 0.14)}px`;
    hit.style.top = `${d.padT + Math.round(d.bodyH * 0.06)}px`;
    hit.style.width = `${Math.round(d.bodyW * 0.82)}px`;
    hit.style.height = `${Math.round(d.bodyH * 0.90)}px`;
    const pillSize = 36;
    const pillMinY = 56;
    const pillMaxY = Math.max(pillMinY, vh - pillSize - 56);
    const pillRatio = Math.max(0, Math.min(1, ((settings?.petY ?? 46) - 10) / 76));
    const pillTop = dragging ? Math.max(pillMinY, Math.min(pillMaxY, currentTop)) : Math.round(pillMinY + pillRatio * (pillMaxY - pillMinY));
    pill.style.left = `${Math.max(8, Math.round(anchorX - pillSize - 10))}px`;
    pill.style.top = `${pillTop}px`;
    pill.classList.toggle('dragging', dragging || instant);
    if (drawerHost) {
      let safeTop = 84;
      if (typeof document.querySelectorAll === 'function') {
        const bars = document.querySelectorAll('[data-testid="pane-titlebar-toolbar"], [data-testid="toggle-aux-sidebar"], [data-testid="toggle-overview-panel"]');
        for (const el of bars) {
          const r = el.getBoundingClientRect?.();
          if (r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.bottom < 160) {
            safeTop = Math.max(safeTop, Math.ceil(r.bottom + 8));
          }
        }
      }
      drawerHost.style.top = `${Math.min(136, safeTop)}px`;
      drawerHost.style.width = `${drawerW}px`;
      drawerHost.style.left = `${Math.round(rect.right - 8 - drawerW)}px`;
      drawerHost.setAttribute('data-open', String(drawerOpen));
    }
    syncObscured();
  }

  function isObscuredByModal() {
    if (typeof document.querySelectorAll !== 'function') return false;
    const d = dims();
    const petLeft = currentLeft + d.padL;
    const petRight = petLeft + d.bodyW;
    const petTop = currentTop + d.padT;
    const petBottom = petTop + d.bodyH;
    const vw = globalThis.innerWidth || 1280;
    const vh = globalThis.innerHeight || 800;
    const overlays = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-testid*="settings-modal"], [data-testid*="settings-dialog"]');
    for (const el of overlays) {
      if (!el || el === root || el === pill || el === menu || el === drawerHost) continue;
      if (el.hidden || el.getAttribute?.('aria-hidden') === 'true') continue;
      const r = el.getBoundingClientRect?.();
      if (!r || r.width < 120 || r.height < 100) continue;
      const cs = globalThis.getComputedStyle?.(el);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0)) continue;
      const coversLargeArea = r.width > vw * 0.42 && r.height > vh * 0.42;
      const overlapsPet = r.left < petRight + 16 && r.right > petLeft - 16 && r.top < petBottom + 16 && r.bottom > petTop - 16;
      if (coversLargeArea || overlapsPet) return true;
    }
    return false;
  }

  function syncObscured() {
    const nextObscured = isObscuredByModal();
    if (nextObscured === obscured) return;
    obscured = nextObscured;
    root.classList.toggle('obscured', obscured);
    pill.classList.toggle('obscured', obscured);
    drawerHost?.classList.toggle('obscured', obscured);
    if (obscured) {
      hovered = false;
      hideMenu();
    }
  }

  function triggerWink(duration = 340) {
    winkUntil = Math.max(winkUntil, Date.now() + duration);
  }

  function setDrawerOpen(next) {
    if (!drawerHost) {
      excitedT = 1;
      return;
    }
    drawerOpen = Boolean(next);
    excitedT = 1;
    layout(false);
  }

  function hideMenu() { menu.hidden = true; }

  function showMenu(clientX, clientY) {
    menu.replaceChildren();
    const curEntry = resolveEntryMode(settings);
    const nextEntry = curEntry === 'pet' ? 'pill' : 'pet';
    const items = [
      ...(drawerHost ? [{ label: L(drawerOpen ? 'petMenuClose' : 'petMenuOpen'), run: () => setDrawerOpen(!drawerOpen) }] : []),
      { label: L(settings?.paused ? 'petMenuResume' : 'petMenuPause'), run: () => dispatchPatch({ paused: !settings?.paused }) },
      { label: L('petMenuEntry', { mode: entryLabel(nextEntry) }), run: () => dispatchPatch({ entryMode: nextEntry, petEnabled: nextEntry === 'pet' }) },
    ];
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agy-pet-menu-item';
      btn.textContent = item.label;
      btn.addEventListener('click', () => { hideMenu(); item.run(); });
      menu.append(btn);
    }
    menu.hidden = false;
    const vw = globalThis.innerWidth || 1280;
    const vh = globalThis.innerHeight || 800;
    const mw = 176, mh = items.length * 32 + 12;
    menu.style.left = `${Math.max(8, Math.min(vw - mw - 8, clientX - mw - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(vh - mh - 8, clientY - 12))}px`;
  }

  function drawTexturedTri(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    const denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(denom) < 1e-5) return;
    const m11 = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / denom;
    const m12 = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / denom;
    const m13 = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / denom;
    const m21 = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / denom;
    const m22 = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / denom;
    const m23 = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / denom;

    // Expand clip slightly from centroid (0.35px) to seal hairline seams without double-blending slices
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const expand = (px, py) => {
      const dx = px - cx, dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [px + (dx / len) * 0.35, py + (dy / len) * 0.35];
    };
    const [cx0, cy0] = expand(x0, y0);
    const [cx1, cy1] = expand(x1, y1);
    const [cx2, cy2] = expand(x2, y2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.closePath();
    ctx.clip();
    ctx.transform(m11, m21, m12, m22, m13, m23);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function drawFluffyTail(ctx, rx, ry, bodyW, phase) {
    if (!tailReady || !imgTail) return;
    const N = 26;
    const totalLen = bodyW * 1.13;
    const ds = totalLen / N;
    const tw = imgTail.naturalWidth || 256;
    const th = imgTail.naturalHeight || 128;
    const halfH = totalLen * (th / tw) * 0.43;

    const topPts = [];
    const botPts = [];
    let x = rx, y = ry;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      // Alluring high-curvature feline tail wave emerging behind her hips/skirt hem:
      // Sweeping UP -> deep overarching downward hook (╮)
      // Reaching top & sweeping DOWN -> lush coquettish J-hook upward curl (╰╯)
      // Bottom turnaround -> wide languid S-curve so it stays plush & curved all the way to the bottom
      const a = 0.54 - 0.30 * Math.pow(s, 1.7) -
        0.28 * Math.sin(phase) * (1 - 0.65 * s) -
        1.44 * Math.pow(s, 0.95) * Math.sin(phase - 2.18 * s) -
        0.66 * Math.pow(s, 1.85) * Math.sin(phase - 3.05 * s);
      if (i > 0) {
        x += -Math.cos(a) * ds;
        y += Math.sin(a) * ds;
      }
      // Perpendicular normal: UP = (-sin a, -cos a), DOWN = (+sin a, +cos a)
      const nx = Math.sin(a);
      const ny = Math.cos(a);
      topPts.push({ x: x - nx * halfH, y: y - ny * halfH });
      botPts.push({ x: x + nx * halfH, y: y + ny * halfH });
    }

    for (let i = 0; i < N; i++) {
      const u0 = (i / N) * tw;
      const u1 = ((i + 1) / N) * tw;
      const p0 = topPts[i], p1 = topPts[i + 1], p2 = botPts[i + 1], p3 = botPts[i];
      drawTexturedTri(ctx, imgTail, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, u0, 0, u1, 0, u1, th);
      drawTexturedTri(ctx, imgTail, p0.x, p0.y, p2.x, p2.y, p3.x, p3.y, u0, 0, u1, th, u0, th);
    }
  }

  function renderFrame(now) {
    if (disposed) return;
    if (typeof globalThis.requestAnimationFrame === 'function') {
      rafId = globalThis.requestAnimationFrame(renderFrame);
    }
    if (document.hidden || !settings?.petEnabled) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    const minFrameMs = (hovered || dragging || excitedT > 0.02) ? 14 : 30;
    if (lastFrameAt && now - lastFrameAt < minFrameMs) return;

    const dt = lastFrameAt ? Math.min(0.05, Math.max(0.004, (now - lastFrameAt) / 1000)) : 0.016;
    lastFrameAt = now;
    if (now - lastLayoutAt > 180) {
      lastLayoutAt = now;
      const r = findChatPaneRect();
      if (Math.abs(r.right - lastPaneRight) > 1) {
        lastPaneRight = r.right;
        bindPaneObserver();
        layout(false);
      } else {
        syncObscured();
      }
    }
    if (obscured) return;

    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    hoverT += ((hovered ? 1 : 0) - hoverT) * Math.min(1, dt * 11);
    excitedT = Math.max(0, excitedT - dt * 2.4);
    if (!reduced) tailPhase += dt * (2.05 + hoverT * 0.85 + excitedT * 1.8);

    const wallNow = Date.now();
    if (!reduced && wallNow >= nextWinkAt) {
      triggerWink(360);
      nextWinkAt = wallNow + 6500 + Math.random() * 4000;
    }
    const isWinking = wallNow < winkUntil;

    const d = dims();
    const dpr = Math.min(1.5, globalThis.devicePixelRatio || 1);
    const pw = Math.round(d.canvasW * dpr);
    const ph = Math.round(d.canvasH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, d.canvasW, d.canvasH);

    const bobY = reduced ? 0 : Math.sin(now * 0.0022) * 1.6 - Math.sin(excitedT * Math.PI) * 3.2;
    const peekX = -hoverT * 4.2;
    const tilt = -(hoverT * 0.036 + Math.sin(excitedT * Math.PI) * 0.025);
    const pivotX = d.seamInCanvas;
    const pivotY = d.padT + d.bodyH * 0.52;

    // 1. Draw silky animated tail behind body (rooted cleanly under rear skirt/hips, above her leg)
    const tailRootX = d.padL + d.bodyW * 0.84 + peekX * 0.45;
    const tailRootY = d.padT + d.bodyH * 0.88 + bobY * 0.55;
    drawFluffyTail(ctx, tailRootX, tailRootY, d.bodyW, tailPhase);

    // 2. Draw aligned catgirl body (open or wink) anchored at gripping paws
    const sprite = (isWinking && winkReady) ? imgWink : (openReady ? imgOpen : null);
    if (sprite) {
      ctx.save();
      ctx.translate(pivotX + peekX, pivotY + bobY);
      ctx.rotate(tilt);
      ctx.drawImage(sprite, d.padL - pivotX, d.padT - pivotY, d.bodyW, d.bodyH);
      ctx.restore();
    }
  }

  // Pointer interactions: vertical drag + click drawer toggle + hover peek + right-click menu
  function onPointerDown(e) {
    if (e.button !== 0 || e.ctrlKey) return;
    hideMenu();
    pointerDown = true;
    dragging = false;
    dragMoved = false;
    dragStartY = e.clientY;
    dragStartTop = currentTop;
    try { hit.setPointerCapture?.(e.pointerId); } catch {}
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const dy = e.clientY - dragStartY;
    if (!dragging && Math.abs(dy) > 5) {
      dragging = true;
      dragMoved = true;
      root.classList.add('dragging');
    }
    if (!dragging) return;
    const d = dims();
    const vh = globalThis.innerHeight || 800;
    const minY = 52;
    const maxY = Math.max(minY, vh - d.canvasH - 44);
    currentTop = Math.max(minY, Math.min(maxY, Math.round(dragStartTop + dy)));
    root.style.top = `${currentTop}px`;
  }
  function onPointerUp(e) {
    if (!pointerDown) return;
    pointerDown = false;
    try { hit.releasePointerCapture?.(e.pointerId); } catch {}
    if (dragging) {
      dragging = false;
      root.classList.remove('dragging');
      const d = dims();
      const vh = globalThis.innerHeight || 800;
      const minY = 52;
      const maxY = Math.max(minY + 1, vh - d.canvasH - 44);
      const petY = Math.max(10, Math.min(86, Math.round(10 + ((currentTop - minY) / (maxY - minY)) * 76)));
      dispatchPatch({ petY });
    } else if (!dragMoved) {
      setDrawerOpen(!drawerOpen);
    }
  }
  function onMouseEnter() {
    hovered = true;
  }
  function onMouseLeave() { hovered = false; }
  function onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    showMenu(e.clientX, e.clientY);
  }
  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrawerOpen(!drawerOpen); }
    else if (e.key === 'Escape') { hideMenu(); if (drawerOpen) setDrawerOpen(false); }
  }
  function isToggleHotkey(e) {
    if (!e || !e.altKey || e.shiftKey) return false;
    const isW = e.code === 'KeyW' || (typeof e.key === 'string' && e.key.toLowerCase() === 'w');
    return Boolean(isW && (e.ctrlKey || e.metaKey));
  }
  function onGlobalKeyDown(e) {
    if (disposed || !settings?.enabled) return;
    if (isToggleHotkey(e)) {
      e.preventDefault?.();
      e.stopPropagation?.();
      hideMenu();
      setDrawerOpen(!drawerOpen);
      return;
    }
    if (e.key === 'Escape' && drawerOpen) {
      hideMenu();
      setDrawerOpen(false);
    }
  }
  function onWindowMessage(e) {
    if (disposed || !drawerUrl) return;
    try { if (e.origin && e.origin !== new URL(drawerUrl).origin) return; } catch {}
    if (e.data?.type === 'agy-glass-drawer-toggle') {
      hideMenu();
      setDrawerOpen(!drawerOpen);
    } else if (e.data?.type === 'agy-glass-drawer-close' && drawerOpen) {
      hideMenu();
      setDrawerOpen(false);
    }
  }
  function onDocPointerDown(e) {
    if (!menu.hidden && !menu.contains?.(e.target)) hideMenu();
  }
  function onWindowResize() { layout(true); }

  function onPillPointerDown(e) {
    if (e.button !== 0 || e.ctrlKey) return;
    hideMenu();
    pointerDown = true;
    dragging = false;
    dragMoved = false;
    dragStartY = e.clientY;
    dragStartTop = Number.parseFloat(pill.style.top) || currentTop;
    try { pill.setPointerCapture?.(e.pointerId); } catch {}
  }
  function onPillPointerMove(e) {
    if (!pointerDown) return;
    const dy = e.clientY - dragStartY;
    if (!dragging && Math.abs(dy) > 5) {
      dragging = true;
      dragMoved = true;
      pill.classList.add('dragging');
    }
    if (!dragging) return;
    const vh = globalThis.innerHeight || 800;
    const minY = 56;
    const maxY = Math.max(minY, vh - 36 - 56);
    currentTop = Math.max(minY, Math.min(maxY, Math.round(dragStartTop + dy)));
    pill.style.top = `${currentTop}px`;
  }
  function onPillPointerUp(e) {
    if (!pointerDown) return;
    pointerDown = false;
    try { pill.releasePointerCapture?.(e.pointerId); } catch {}
    if (dragging) {
      dragging = false;
      pill.classList.remove('dragging');
      const vh = globalThis.innerHeight || 800;
      const minY = 56;
      const maxY = Math.max(minY + 1, vh - 36 - 56);
      const petY = Math.max(10, Math.min(86, Math.round(10 + ((currentTop - minY) / (maxY - minY)) * 76)));
      dispatchPatch({ petY });
    } else if (!dragMoved) {
      setDrawerOpen(!drawerOpen);
    }
  }

  hit.addEventListener('pointerdown', onPointerDown);
  hit.addEventListener('pointermove', onPointerMove);
  hit.addEventListener('pointerup', onPointerUp);
  hit.addEventListener('pointercancel', onPointerUp);
  hit.addEventListener('mouseenter', onMouseEnter);
  hit.addEventListener('mouseleave', onMouseLeave);
  hit.addEventListener('contextmenu', onContextMenu);
  hit.addEventListener('keydown', onKeyDown);
  pill.addEventListener('pointerdown', onPillPointerDown);
  pill.addEventListener('pointermove', onPillPointerMove);
  pill.addEventListener('pointerup', onPillPointerUp);
  pill.addEventListener('pointercancel', onPillPointerUp);
  pill.addEventListener('contextmenu', onContextMenu);
  pill.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onDocPointerDown);
  globalThis.addEventListener?.('keydown', onGlobalKeyDown, true);
  globalThis.addEventListener?.('message', onWindowMessage);
  globalThis.addEventListener?.('resize', onWindowResize, { passive: true });

  // Track chat pane right border live whenever Review / Files / Terminal / Split pane opens or resizes!
  let ro = null;
  let mo = null;
  let observedPane = null;
  function bindPaneObserver() {
    if (disposed || typeof ResizeObserver !== 'function') return;
    const conv = document.querySelector?.('[data-testid="conversation-view"]');
    const pane = conv?.closest?.('[data-pane-id]') || conv;
    if (pane && pane !== observedPane) {
      if (ro && observedPane) ro.unobserve(observedPane);
      if (!ro) ro = new ResizeObserver(() => layout(false));
      ro.observe(pane);
      observedPane = pane;
    }
  }
  let moTimer = 0;
  if (typeof MutationObserver === 'function' && document.body) {
    mo = new MutationObserver(() => {
      if (moTimer) return;
      moTimer = setTimeout(() => {
        moTimer = 0;
        if (!disposed) { bindPaneObserver(); layout(false); }
      }, 150);
    });
    // Only observe direct childList on body (portals/dialogs) to avoid layout thrashing on chat streaming tokens
    mo.observe(document.body, { childList: true });
  }

  function update(nextSettings) {
    settings = nextSettings;
    hit.setAttribute('aria-label', L('petAria'));
    hit.title = L('petTitle');
    pill.setAttribute('aria-label', L('pillAria'));
    pill.title = L('pillTitle');
    if (closeBtn) closeBtn.title = L('petCloseDrawer');
    if (drawerFrame) drawerFrame.title = L('petFrameTitle');
    const mode = resolveEntryMode(settings);
    const active = Boolean(settings?.enabled);
    root.hidden = !(active && mode === 'pet');
    pill.hidden = !(active && mode === 'pill');
    if (!active) {
      hideMenu();
      if (drawerOpen) setDrawerOpen(false);
    } else {
      if (mode === 'hotkey') hideMenu();
      bindPaneObserver();
      layout(false);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(rafId);
    if (moTimer) { clearTimeout(moTimer); moTimer = 0; }
    ro?.disconnect();
    mo?.disconnect();
    document.removeEventListener('pointerdown', onDocPointerDown);
    globalThis.removeEventListener?.('keydown', onGlobalKeyDown, true);
    globalThis.removeEventListener?.('message', onWindowMessage);
    globalThis.removeEventListener?.('resize', onWindowResize);
    menu.remove();
    pill.remove();
    root.remove();
    drawerHost?.remove();
  }

  bindPaneObserver();
  update(settings);
  if (typeof globalThis.requestAnimationFrame === 'function') {
    rafId = globalThis.requestAnimationFrame(renderFrame);
  }
  return { update, dispose, setDrawerOpen, isDrawerOpen: () => drawerOpen };
}
