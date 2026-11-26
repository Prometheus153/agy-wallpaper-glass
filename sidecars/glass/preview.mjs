import { installGlass } from './runtime.mjs';

window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'agy-glass-preview') return;
  const payload = event.data.payload;
  installGlass({
    ...payload,
    zhDictUrl: './assets/zh-dict.json',
    mediaThumbUrl: payload.media?.thumbUrl || null,
    petAssets: { open: './assets/pet-open.webp', wink: './assets/pet-wink.webp', tail: './assets/pet-tail.webp' },
    settings: { ...payload.settings, enabled: true },
    owner: 'agy-glass-preview',
    leaseMs: 15000,
  });
});

setInterval(() => globalThis.__agyGlass?.heartbeat(), 3000);
parent.postMessage({ type: 'agy-glass-preview-ready' }, location.origin);
document.getElementById('show-settings').addEventListener('click', () => document.getElementById('settings-dialog').showModal());
document.getElementById('close-settings').addEventListener('click', () => document.getElementById('settings-dialog').close());
document.getElementById('toggle-mock-review').addEventListener('click', () => {
  const pane = document.getElementById('mock-review-pane');
  pane.hidden = !pane.hidden;
});
