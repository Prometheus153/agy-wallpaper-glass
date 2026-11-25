(() => {
  const root = document.documentElement;
  const mediaKey = root.dataset.mediaKey || '';
  const kind = root.dataset.kind || 'scene';
  const previewFile = root.dataset.preview || '';
  const stage = document.getElementById('stage');
  const fallback = document.getElementById('fallback');

  let initial = {};
  try { if (root.dataset.init) initial = JSON.parse(root.dataset.init); } catch { /* ignore */ }

  const state = {
    fit: typeof initial.fit === 'string' ? initial.fit : 'cover',
    paused: Boolean(initial.paused),
    pauseWhenHidden: initial.pauseWhenHidden !== false,
    volume: Number.isFinite(initial.volume) ? initial.volume : 0,
    playbackRate: Number.isFinite(initial.playbackRate) ? initial.playbackRate : 1,
    posX: Number.isFinite(initial.posX) ? initial.posX : 50,
    posY: Number.isFinite(initial.posY) ? initial.posY : 50,
    zoom: Number.isFinite(initial.zoom) ? initial.zoom : 100,
    flipX: Boolean(initial.flipX),
    pointerParallax: initial.pointerParallax !== false,
    performanceMode: ['eco', 'balanced', 'ultra'].includes(initial.performanceMode) ? initial.performanceMode : 'balanced',
    fpsLimit: [30, 45, 60].includes(initial.fpsLimit) ? initial.fpsLimit : 30,
    properties: initial.properties && typeof initial.properties === 'object' ? initial.properties : {},
  };

  let instance = null;
  let mounting = false;
  let destroyed = false;
  let hostHidden = false;
  let appliedRenderDpr = 0;
  let lastPropsJson = '';
  let lastPerfMode = '';
  let lastFps = 0;
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };

  function perfProfile(mode) {
    const devDpr = Math.max(1, window.devicePixelRatio || 1);
    if (mode === 'eco') {
      return {
        renderDpr: 1,
        videoTexScale: 0.75,
        quality: { antiAliasing: 'off', particles: 'low', postProcessing: 'low' },
      };
    }
    if (mode === 'ultra') {
      return {
        renderDpr: Math.min(2, devDpr),
        videoTexScale: 1,
        quality: { antiAliasing: 'off', particles: 'high', postProcessing: 'high' },
      };
    }
    return {
      renderDpr: Math.min(1.25, devDpr),
      videoTexScale: 0,
      quality: { antiAliasing: 'off', particles: 'medium', postProcessing: 'medium' },
    };
  }

  function notify(status, detail = '') {
    try { window.parent?.postMessage({ type: 'agy-glass-player-status', mediaKey, kind, status, detail }, '*'); } catch {}
  }

  function mapFit(fit) {
    if (fit === 'contain' || fit === 'center') return 'contain';
    if (fit === 'stretch') return 'stretch';
    return 'cover';
  }

  function applyTransform() {
    const tx = (50 - state.posX) * 0.6;
    const ty = (50 - state.posY) * 0.6;
    const scale = Math.max(0.5, Math.min(2.5, (state.zoom || 100) / 100));
    const sx = state.flipX ? -scale : scale;
    const transform = `translate(${tx}%, ${ty}%) scale(${sx}, ${scale})`;
    stage.style.transform = transform;
    fallback.style.transform = transform;
    fallback.style.objectFit = state.fit === 'contain' ? 'contain' : state.fit === 'stretch' ? 'fill' : state.fit === 'center' ? 'none' : 'cover';
    fallback.style.objectPosition = `${state.posX}% ${state.posY}%`;
  }

  function syncPauseState() {
    if (!instance) return;
    const shouldPause = Boolean(state.paused || reducedMotion.matches || (state.pauseWhenHidden && (document.hidden || hostHidden)));
    try {
      if (shouldPause) { if (!instance.paused) instance.pause(); }
      else { if (instance.paused) instance.resume(); }
    } catch {}
  }

  function applyRuntimeControls() {
    applyTransform();
    if (!instance) return;
    try { instance.setFit(mapFit(state.fit)); } catch {}
    try { instance.setVolume(Math.max(0, Math.min(1, (state.volume || 0) / 100))); } catch {}
    try { if (instance.editor?.setTimeScale) instance.editor.setTimeScale(state.playbackRate || 1); } catch {}
    if (state.fpsLimit !== lastFps) {
      lastFps = state.fpsLimit;
      try { if (typeof instance.setFps === 'function') instance.setFps(state.fpsLimit); } catch {}
    }
    if (state.performanceMode !== lastPerfMode) {
      lastPerfMode = state.performanceMode;
      const prof = perfProfile(state.performanceMode);
      try { if (typeof instance.setQuality === 'function') instance.setQuality(prof.quality); } catch {}
      try { if (typeof instance.setVideoTexScale === 'function') instance.setVideoTexScale(prof.videoTexScale); } catch {}
      if (Math.abs(prof.renderDpr - appliedRenderDpr) > 0.01) {
        appliedRenderDpr = prof.renderDpr;
        try { if (typeof instance.setRenderDpr === 'function') instance.setRenderDpr(prof.renderDpr); } catch {}
      }
    }
    const propsJson = state.properties && Object.keys(state.properties).length ? JSON.stringify(state.properties) : '';
    if (propsJson && propsJson !== lastPropsJson) {
      lastPropsJson = propsJson;
      try { instance.setProperties(state.properties); } catch {}
    }
    syncPauseState();
  }

  function showFallback(reason) {
    if (previewFile) {
      const encoded = previewFile.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
      fallback.src = `/scene/${encodeURIComponent(mediaKey)}/${encoded}`;
      fallback.classList.add('visible');
    }
    notify('fallback', String(reason || '渲染降级'));
  }

  function teardown() {
    if (instance) {
      try { instance.destroy({ releasePkgCache: true }); } catch {}
      instance = null;
    }
    stage.replaceChildren();
  }

  async function mountWallpaper() {
    if (destroyed || mounting || !mediaKey) return;
    mounting = true;
    teardown();
    fallback.classList.remove('visible');
    applyTransform();
    const api = window.WebWallGL;
    if (!api || typeof api.mount !== 'function' || typeof api.httpSource !== 'function') {
      mounting = false;
      showFallback('WebWallGL 引擎未加载');
      return;
    }
    notify('loading');
    try {
      const baseUrl = `${location.origin}/scene/${encodeURIComponent(mediaKey)}`;
      const source = api.httpSource(baseUrl);
      const shouldPause = Boolean(state.paused || reducedMotion.matches || (state.pauseWhenHidden && (document.hidden || hostHidden)));
      const prof = perfProfile(state.performanceMode);
      appliedRenderDpr = prof.renderDpr;
      lastPerfMode = state.performanceMode;
      lastFps = state.fpsLimit;
      lastPropsJson = state.properties && Object.keys(state.properties).length ? JSON.stringify(state.properties) : '';
      const mounted = await api.mount(stage, {
        source,
        fit: mapFit(state.fit),
        fps: state.fpsLimit,
        renderDpr: prof.renderDpr,
        videoTexScale: prof.videoTexScale,
        quality: prof.quality,
        volume: Math.max(0, Math.min(1, (state.volume || 0) / 100)),
        autoplay: !shouldPause,
        properties: state.properties || {},
        scripts: true,
        webSandbox: 'strict',
        localAssets: 'off',
        autoQuality: state.performanceMode !== 'ultra',
        mountTimeoutMs: 45000,
        onReady(info) { notify('ready', info ? `${info.width}x${info.height}` : ''); },
        onError(err) { showFallback(err?.message || '壁纸渲染失败'); },
      });
      if (destroyed) {
        try { mounted.destroy({ releasePkgCache: true }); } catch {}
        return;
      }
      instance = mounted;
      applyRuntimeControls();
      notify('ready');
    } catch (error) {
      showFallback(error?.message || '壁纸加载失败');
    } finally {
      mounting = false;
    }
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'agy-glass-player-update' && data.payload && typeof data.payload === 'object') {
      const p = data.payload;
      if (typeof p.fit === 'string') state.fit = p.fit;
      if (typeof p.paused === 'boolean') state.paused = p.paused;
      if (typeof p.pauseWhenHidden === 'boolean') state.pauseWhenHidden = p.pauseWhenHidden;
      if (typeof p.volume === 'number') state.volume = p.volume;
      if (typeof p.playbackRate === 'number') state.playbackRate = p.playbackRate;
      if (typeof p.posX === 'number') state.posX = p.posX;
      if (typeof p.posY === 'number') state.posY = p.posY;
      if (typeof p.zoom === 'number') state.zoom = p.zoom;
      if (typeof p.flipX === 'boolean') state.flipX = p.flipX;
      if (typeof p.pointerParallax === 'boolean') state.pointerParallax = p.pointerParallax;
      if (['eco', 'balanced', 'ultra'].includes(p.performanceMode)) state.performanceMode = p.performanceMode;
      if ([30, 45, 60].includes(p.fpsLimit)) state.fpsLimit = p.fpsLimit;
      if (typeof p.hidden === 'boolean') hostHidden = p.hidden;
      if (p.properties && typeof p.properties === 'object') state.properties = p.properties;
      applyRuntimeControls();
    } else if (data.type === 'agy-glass-player-pointer') {
      if (instance && state.pointerParallax && !state.paused) {
        try { instance.pushPointer(Number(data.u) || 0.5, Number(data.v) || 0.5, Number(data.buttons) || 0, Number(data.mods) || 0); } catch {}
      }
    } else if (data.type === 'agy-glass-player-pointer-leave') {
      if (instance) { try { instance.pointerLeave(); } catch {} }
    } else if (data.type === 'agy-glass-player-reload') {
      void mountWallpaper();
    }
  });

  document.addEventListener('visibilitychange', syncPauseState);
  reducedMotion.addEventListener?.('change', syncPauseState);
  window.addEventListener('pagehide', () => { destroyed = true; teardown(); });
  window.addEventListener('beforeunload', () => { destroyed = true; teardown(); });

  void mountWallpaper();
})();
