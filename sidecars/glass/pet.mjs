export function createCatPet({ onPatch, getSettings, assets, drawerUrl, isPreview = false } = {}) {
  if (typeof document === 'undefined' || !document.body) return null;

  const ASPECT = 493 / 320;
  const SEAM_RATIO = 0.9413;
  const DRAWER_W = 336;
  const ENTRY_MODES = ['pet', 'pill'];
  const getLang = () => (typeof resolveLanguage === 'function' ? resolveLanguage(settings?.language) : 'zh-CN');
  const L = (key, vars) => (typeof tr === 'function' ? tr(getLang(), key, vars) : key);
  const resolveEntryMode = s => {
    if (ENTRY_MODES.includes(s?.entryMode)) return s.entryMode;
    return s?.petEnabled === false ? 'pill' : 'pet';
  };
  const isReducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  const LEAVE_SAD_MS = 620;
  const LEAVE_RETREAT_MS = 500;
  const LEAVE_TOTAL_MS = LEAVE_SAD_MS + LEAVE_RETREAT_MS;
  const PILL_LAUNCH_AT_MS = 980;
  const PILL_TOSS_MS = 580;
  const PEEK_IN_MS = 420;

  let settings = getSettings();
  let lastEntryMode = resolveEntryMode(settings);
  let leaveAnim = null;
  let pillToss = null;
  let peekInAnim = null;
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
  const imgSad = typeof Image === 'function' ? new Image() : null;
  const imgTail = typeof Image === 'function' ? new Image() : null;
  let openReady = false;
  let winkReady = false;
  let sadReady = false;
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
  if (imgSad && assets?.sad) {
    imgSad.crossOrigin = 'anonymous';
    imgSad.onload = () => { sadReady = true; };
    imgSad.src = assets.sad;
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

  function canAnimateTransitions() {
    return typeof globalThis.requestAnimationFrame === 'function' && !isReducedMotion();
  }

  function clearPillToss() {
    pillToss = null;
    pill.classList.remove('tossing');
    pill.style.transform = '';
    pill.style.opacity = '';
  }

  function cancelTransitions() {
    leaveAnim = null;
    peekInAnim = null;
    root.classList.remove('leaving');
    clearPillToss();
  }

  function updatePillToss(now) {
    if (!pillToss) return;
    if (pillToss.startedAt === null) pillToss.startedAt = now;
    const t = Math.max(0, Math.min(1, (now - pillToss.startedAt) / PILL_TOSS_MS));
    let dx = 0;
    let dy = 0;
    let rot = 0;
    let sx = 1;
    let sy = 1;
    let op = 1;
    if (t < 0.68) {
      const p = t / 0.68;
      dx = 42 * (1 - p) * (1 - p) - 10 * Math.pow(p, 1.4);
      dy = -56 * Math.sin(p * Math.PI) + 12 * (1 - p);
      rot = -320 * (1 - p) * (1 - 0.25 * p);
      const sc = 0.25 + 0.88 * Math.min(1, p * 1.35);
      sx = sc;
      sy = sc;
      op = Math.min(1, p * 4.5);
    } else {
      const q = (t - 0.68) / 0.32;
      dx = -10 * (1 - q) * Math.cos(q * Math.PI * 1.5);
      dy = -12 * Math.sin(q * Math.PI) * (1 - q * 0.4);
      rot = 14 * Math.sin(q * Math.PI * 2) * (1 - q);
      sx = 1 + 0.14 * Math.sin(q * Math.PI) * (1 - q);
      sy = 1 - 0.12 * Math.sin(q * Math.PI) * (1 - q);
      op = 1;
    }
    pill.style.opacity = op.toFixed(3);
    pill.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    if (t >= 1) clearPillToss();
  }

  function launchPillToss(now) {
    if (pillToss) return;
    pillToss = { startedAt: now };
    pill.hidden = false;
    pill.classList.add('tossing');
    layout(true);
    updatePillToss(now);
  }

  function startLeaveToPill() {
    if (leaveAnim) return;
    peekInAnim = null;
    hovered = false;
    dragging = false;
    pointerDown = false;
    lastEntryMode = 'pill';
    if (!canAnimateTransitions()) {
      cancelTransitions();
      root.hidden = true;
      pill.hidden = false;
      layout(false);
      return;
    }
    clearPillToss();
    leaveAnim = { startedAt: null, pillLaunched: false };
    root.hidden = false;
    root.classList.add('leaving');
    pill.hidden = true;
  }

  function startPeekIn() {
    cancelTransitions();
    lastEntryMode = 'pet';
    root.hidden = false;
    pill.hidden = true;
    excitedT = 1;
    triggerWink(420);
    if (canAnimateTransitions()) {
      peekInAnim = { startedAt: null };
    }
    layout(false);
  }

  function showMenu(clientX, clientY) {
    menu.replaceChildren();
    const curEntry = resolveEntryMode(settings);
    const nextEntry = curEntry === 'pet' ? 'pill' : 'pet';
    const items = [
      ...(drawerHost ? [{ label: L(drawerOpen ? 'petMenuClose' : 'petMenuOpen'), run: () => setDrawerOpen(!drawerOpen) }] : []),
      { label: L(settings?.paused ? 'petMenuResume' : 'petMenuPause'), run: () => dispatchPatch({ paused: !settings?.paused }) },
      {
        label: L(nextEntry === 'pill' ? 'petMenuToPill' : 'petMenuToPet'),
        run: () => {
          dispatchPatch({ entryMode: nextEntry, petEnabled: nextEntry === 'pet' });
          if (nextEntry === 'pill') startLeaveToPill();
          else startPeekIn();
        },
      },
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
    const mw = 188, mh = items.length * 32 + 12;
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

  function drawFluffyTail(ctx, rx, ry, bodyW, phase, sadness = 0) {
    if (!tailReady || !imgTail) return;
    const N = 26;
    const totalLen = bodyW * 1.13;
    const ds = totalLen / N;
    const tw = imgTail.naturalWidth || 256;
    const th = imgTail.naturalHeight || 128;
    const halfH = totalLen * (th / tw) * 0.43;

    const wagAmp = 1 - sadness * 0.58;
    const topPts = [];
    const botPts = [];
    let x = rx, y = ry;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const droop = sadness * (0.28 + 0.16 * s);
      // Alluring high-curvature feline tail wave emerging behind her hips/skirt hem:
      // Sweeping UP -> deep overarching downward hook (╮)
      // Reaching top & sweeping DOWN -> lush coquettish J-hook upward curl (╰╯)
      // Bottom turnaround -> wide languid S-curve so it stays plush & curved all the way to the bottom
      const a = 0.54 + droop - 0.30 * Math.pow(s, 1.7) * (1 - sadness * 0.45) -
        0.28 * wagAmp * Math.sin(phase) * (1 - 0.65 * s) -
        1.44 * wagAmp * Math.pow(s, 0.95) * Math.sin(phase - 2.18 * s) -
        0.66 * wagAmp * Math.pow(s, 1.85) * Math.sin(phase - 3.05 * s);
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
    if (document.hidden) return;
    const petVisible = Boolean(settings?.enabled) && (resolveEntryMode(settings) === 'pet' || Boolean(leaveAnim));
    if (!petVisible && !pillToss) return;

    const anyAnim = Boolean(leaveAnim || pillToss || peekInAnim);
    const minFrameMs = (hovered || dragging || excitedT > 0.02 || anyAnim) ? 12 : 30;
    if (lastFrameAt && now - lastFrameAt < minFrameMs) return;

    const dt = lastFrameAt ? Math.min(0.05, Math.max(0.004, (now - lastFrameAt) / 1000)) : 0.016;
    lastFrameAt = now;

    // Advance pill toss physics even after the catgirl has vanished behind the border
    if (pillToss) updatePillToss(now);
    if (!petVisible) return;

    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

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

    const reduced = isReducedMotion();
    hoverT += ((hovered ? 1 : 0) - hoverT) * Math.min(1, dt * 11);
    excitedT = Math.max(0, excitedT - dt * 2.4);
    const tailSpeed = leaveAnim ? 0.85 : (2.05 + hoverT * 0.85 + excitedT * 1.8);
    if (!reduced) tailPhase += dt * tailSpeed;

    const wallNow = Date.now();
    if (!reduced && !leaveAnim && wallNow >= nextWinkAt) {
      triggerWink(360);
      nextWinkAt = wallNow + 6500 + Math.random() * 4000;
    }
    const isWinking = !leaveAnim && wallNow < winkUntil;

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

    let sadness = 0;
    let forceSadSprite = false;
    let retreatX = 0;
    let extraY = 0;
    let extraTilt = 0;
    let bodyScaleX = 1;
    let bodyScaleY = 1;
    let bodySkewY = 0;
    let clipRightX = null;

    if (leaveAnim) {
      if (leaveAnim.startedAt === null) leaveAnim.startedAt = now;
      const elapsed = Math.max(0, now - leaveAnim.startedAt);
      forceSadSprite = true;
      if (!leaveAnim.pillLaunched && elapsed >= PILL_LAUNCH_AT_MS) {
        leaveAnim.pillLaunched = true;
        launchPillToss(now);
      }
      if (elapsed < LEAVE_SAD_MS) {
        // Stage 1: cute pouting/sad expression + gentle melancholic droop
        const p = elapsed / LEAVE_SAD_MS;
        const wilt = Math.min(1, p / 0.28);
        const easeWilt = 1 - Math.pow(1 - wilt, 3);
        sadness = easeWilt;
        extraY = easeWilt * 3.8 + (p > 0.28 ? Math.sin((p - 0.28) * Math.PI * 3) * 0.7 : 0);
        extraTilt = -easeWilt * 0.052;
        bodyScaleX = 1 + easeWilt * 0.018;
        bodyScaleY = 1 - easeWilt * 0.032;
      } else {
        // Stage 2: turn head toward right border & slip behind the border seam
        const u = Math.min(1, (elapsed - LEAVE_SAD_MS) / LEAVE_RETREAT_MS);
        sadness = 1;
        const pawRelease = Math.min(1, u / 0.22);
        clipRightX = d.canvasW - (d.canvasW - (d.seamInCanvas + 1)) * pawRelease;
        const turn = Math.min(1, u / 0.36);
        const turnEase = turn * turn * (3 - 2 * turn);
        bodyScaleX = 1.018 - turnEase * 0.40;
        bodyScaleY = 0.968 + turnEase * 0.04;
        bodySkewY = -turnEase * 0.085;
        extraTilt = -0.052 + turnEase * 0.22;
        extraY = 3.8 * (1 - u * 0.45);
        const slideEase = u < 0.18
          ? (u / 0.18) * 0.05
          : 0.05 + 0.95 * Math.pow((u - 0.18) / 0.82, 2.2);
        retreatX = slideEase * (d.bodyW * 1.24 + 16);
      }
      if (elapsed >= LEAVE_TOTAL_MS) {
        if (!leaveAnim.pillLaunched) {
          leaveAnim.pillLaunched = true;
          launchPillToss(now);
        }
        leaveAnim = null;
        root.classList.remove('leaving');
        root.hidden = true;
        return;
      }
    } else if (peekInAnim) {
      if (peekInAnim.startedAt === null) peekInAnim.startedAt = now;
      const u = Math.min(1, Math.max(0, (now - peekInAnim.startedAt) / PEEK_IN_MS));
      const c1 = 1.45;
      const c3 = c1 + 1;
      const back = 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
      retreatX = Math.max(-4, (1 - back) * (d.bodyW * 1.12));
      bodyScaleX = 0.72 + Math.min(1, u / 0.65) * 0.28;
      extraTilt = (1 - u) * 0.14;
      if (u < 0.78) {
        clipRightX = d.seamInCanvas + 1;
      } else {
        const pawPop = (u - 0.78) / 0.22;
        clipRightX = d.seamInCanvas + 1 + (d.canvasW - (d.seamInCanvas + 1)) * pawPop;
      }
      if (u >= 1) peekInAnim = null;
    }

    const bobY = (reduced || leaveAnim) ? 0 : Math.sin(now * 0.0022) * 1.6 - Math.sin(excitedT * Math.PI) * 3.2;
    const peekX = leaveAnim ? 0 : -hoverT * 4.2;
    const tilt = leaveAnim ? 0 : -(hoverT * 0.036 + Math.sin(excitedT * Math.PI) * 0.025);
    const pivotX = d.seamInCanvas;
    const pivotY = d.padT + d.bodyH * 0.52;

    if (clipRightX !== null) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipRightX, d.canvasH);
      ctx.clip();
    }

    // 1. Draw silky animated tail behind body (rooted cleanly under rear skirt/hips, above her leg)
    const tailRootX = d.padL + d.bodyW * 0.84 + peekX * 0.45 + retreatX * 0.92;
    const tailRootY = d.padT + d.bodyH * 0.88 + bobY * 0.55 + extraY * 0.7;
    drawFluffyTail(ctx, tailRootX, tailRootY, d.bodyW, tailPhase, sadness);

    // 2. Draw aligned catgirl body (sad / wink / open) anchored at gripping paws
    const sprite = forceSadSprite
      ? (sadReady ? imgSad : (openReady ? imgOpen : null))
      : ((isWinking && winkReady) ? imgWink : (openReady ? imgOpen : null));
    if (sprite) {
      ctx.save();
      ctx.translate(pivotX + peekX + retreatX, pivotY + bobY + extraY);
      ctx.rotate(tilt + extraTilt);
      if (bodySkewY) ctx.transform(1, bodySkewY, 0, 1, 0, 0);
      if (bodyScaleX !== 1 || bodyScaleY !== 1) ctx.scale(bodyScaleX, bodyScaleY);
      ctx.drawImage(sprite, d.padL - pivotX, d.padT - pivotY, d.bodyW, d.bodyH);
      ctx.restore();
    }

    if (clipRightX !== null) {
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
    const prevMode = lastEntryMode;
    const wasActive = Boolean(settings?.enabled);
    settings = nextSettings;
    hit.setAttribute('aria-label', L('petAria'));
    hit.title = L('petTitle');
    pill.setAttribute('aria-label', L('pillAria'));
    pill.title = L('pillTitle');
    if (closeBtn) closeBtn.title = L('petCloseDrawer');
    if (drawerFrame) drawerFrame.title = L('petFrameTitle');
    const mode = resolveEntryMode(settings);
    const active = Boolean(settings?.enabled);
    lastEntryMode = mode;
    if (!active) {
      cancelTransitions();
      root.hidden = true;
      pill.hidden = true;
      hideMenu();
      if (drawerOpen) setDrawerOpen(false);
      return;
    }
    if (mode === 'pill') {
      if (wasActive && prevMode === 'pet' && !leaveAnim && !pillToss) {
        startLeaveToPill();
      } else if (leaveAnim) {
        root.hidden = false;
        pill.hidden = !leaveAnim.pillLaunched;
      } else {
        root.hidden = true;
        pill.hidden = false;
      }
    } else {
      if (wasActive && prevMode === 'pill') {
        startPeekIn();
      } else {
        cancelTransitions();
        root.hidden = false;
        pill.hidden = true;
      }
    }
    bindPaneObserver();
    layout(false);
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
