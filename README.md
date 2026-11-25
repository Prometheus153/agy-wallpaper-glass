# AGY Wallpaper Glass (`agy-wallpaper-glass`) v1.1.0

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

An **iOS-style Liquid Glass & Wallpaper Engine** customization plugin for **Antigravity Desktop** — featuring offline local Scene/Web/Video/Image wallpaper rendering, performance tuning, full English/Chinese UI, and an interactive animated catgirl desktop pet.

Inspired by `dsh-plugin-wallpaper-engine v1.4.0` and powered by the bundled MIT-licensed **WebWallGL** engine: render local **Scene**, **Web**, **Video**, and **Image** wallpapers behind Antigravity Desktop with **no Steam/Wallpaper Engine background process** and **no external CDN**, while upgrading the sidebar, composer, split panes, diff review views, and dialogs into translucent Liquid Glass surfaces.

---

## Highlights

- **All Wallpaper Formats + 6 Built-in Animated Wallpapers (Offline WebWallGL Bundled)**
  - **6 Original Built-in Wallpapers Ready Out of the Box**: *Aurora*, *Stardust*, *Sakura*, *Deep Tide*, *Fireflies*, and *Rainy Night* — works even without Wallpaper Engine, with mouse parallax, live speed/density controls, and low-CPU sprite/gradient caching.
  - **Scene Wallpapers**: Supports both packed `scene.pkg` and loose `scene.json` projects via WebGL2 (particles, skeletal animation, SceneScript, mouse parallax), with automatic fallback to static preview frames if WebGL2 is unavailable.
  - **Web / Video / Image Wallpapers**: Sandboxed Web wallpapers with Wallpaper Engine property messaging, plus zero-copy local streaming with HTTP Range support for large videos.
- **Smooth Performance Controls (`v1.1.0`)**
  - Built-in **Performance Mode** (**Eco / Balanced / Ultra**, default *Balanced*) and **FPS Cap** (**30 / 45 / 60 FPS**, default *30 FPS*) hot-applied directly to WebWallGL (`setFps`, `setQuality`, `setRenderDpr`, `setVideoTexScale`).
  - Eliminates idle full-screen CSS filter passes and excessive `backdrop-filter` readbacks on scrolling code blocks, plus debounced DOM observers and automatic pause when hidden.
- **Interactive Catgirl Desktop Pet & Floating Glass Drawer**
  - Clings to the right border of the chat pane with 60fps hand-painted tail mesh physics, calm periodic winks, tight click-through body hit testing, and automatic hiding beneath Settings/modal dialogs.
  - Automatically shifts left when right-side panes (Review, Files, Terminal, Split View) open; drag vertically to adjust & save height; click to toggle a sleek floating Liquid Glass drawer; right-click for quick actions.
- **Bilingual UI (`EN / 中文`) & 3 Distinct Glass Themes**
  - Auto-detects system language with a one-click **`EN / 中文`** toggle in the panel header.
  - Streamlined **Wallpapers / Style** tabs with 3 themes (**Midnight**, **Frost**, **Ember**), split-pane glass dividers, high-contrast frosted backing for Diff/Review/Terminal panes, and dynamic `project.json` Scene properties.
- **Non-Invasive & Safe**
  - Never modifies Antigravity binaries, never reads chat content, and never uploads local files. Disabling restores native UI immediately (and cleans up automatically on a 15s lease if terminated unexpectedly).

---

## Requirements

1. **Node.js `>= 22.12.0`** ([nodejs.org](https://nodejs.org/)) — **no `npm install` needed** to install or run the plugin.
2. **Antigravity Desktop** (desktop app, not the VS Code extension).
3. **Local DevTools Debugging Port Enabled** (loopback `127.0.0.1` only):
   - **Windows**: Right-click your Antigravity shortcut → **Properties** → append a space and `--remote-debugging-port=9222` to **Target** (e.g. `"...Antigravity.exe" --remote-debugging-port=9222`) → save and restart Antigravity (confirm `%APPDATA%\Antigravity\DevToolsActivePort` exists).
   - **Security note**: Keep the debugging port strictly on `127.0.0.1`; never expose it to LAN or the public internet.

---

## Quick Install (Zero `npm install`)

The repository and release ZIP already bundle the offline MIT WebWallGL engine (`sidecars/glass/vendor/webwallgl.global.min.js`), 6 built-in animated wallpapers, and desktop pet assets with zero hardcoded user paths.

### Option 1: Windows One-Click Installer (Recommended)
1. Download `agy-wallpaper-glass-v1.1.0.zip` from [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) (or click **Code → Download ZIP**) and extract it.
2. Double-click **`install.bat`**:
   - `1`: First-time install to `~/.gemini/config/plugins/agy-wallpaper-glass`
   - `2`: Update / migrate from legacy `agy-glass` (automatically backs up the old plugin and preserves all user settings & imported wallpapers)
   - `3`: Uninstall (keeps backup & user data)
   - `4`: Launch browser live preview without touching Antigravity

### Option 2: Command Line (`git clone` / Cross-Platform)
```bash
git clone https://github.com/Prometheus153/agy-wallpaper-glass.git
cd agy-wallpaper-glass

# First-time install (no npm install required)
node scripts/install.mjs

# Update or migrate from legacy agy-glass (keeps backup & user data)
node scripts/install.mjs --update

# Uninstall
node scripts/install.mjs --uninstall

# Launch local browser preview
node sidecars/glass/server.mjs --preview
```

### Enable in Antigravity Desktop
1. Open Antigravity Desktop → **Customizations → Installed → AGY Wallpaper Glass**.
2. Enable the plugin, then open the **AGY Wallpaper Glass** side pane (or click the catgirl pet on the right edge of chat).
3. Toggle the master switch ON and click any built-in or local Wallpaper Engine card to apply it live!

---

## Using Your Own Wallpaper Engine Library

- **Standard Steam Wallpaper Engine Users — Zero Setup**:
  - **Steam and Wallpaper Engine do NOT need to be running.**
  - On startup, the plugin automatically checks Windows Steam & Wallpaper Engine registry keys, parses both `steamapps/libraryfolders.vdf` and `config/libraryfolders.vdf`, scans common `Steam` / `SteamLibrary` drives (`C:\`–`Z:\`), and checks default macOS/Linux Steam paths to discover your Workshop (`431960`) and default wallpapers.
- **Portable / Custom Locations (3 Easy Options)**:
  1. **Import Folder**: Click **Import Folder** in the *Wallpapers* tab to add a single `project.json` folder or a parent directory of wallpapers (zero-copy streaming).
  2. **Import File / `.pkg`**: Click **Import File / .pkg** to import any standalone `scene.pkg` (up to 256 MB) or single image/video file.
  3. **Custom Scan Roots**: Expand **Library Paths & Steam Discovery** to save up to 12 custom directories (or set `AGY_GLASS_STEAM_ROOT`).
- **No Wallpaper Engine Installed?**: Enjoy the **6 built-in animated wallpapers** or import any local MP4/WebM/PNG/JPG/WebP/GIF directly.

---

## Troubleshooting

- **Status stuck on `Waiting`?**
  Verify Antigravity Desktop was launched with `--remote-debugging-port=9222` (creating `%APPDATA%\Antigravity\DevToolsActivePort`) and the plugin was started from Antigravity's plugin manager.
- **Dynamic wallpaper feels heavy on laptops / HiDPI displays?**
  Open the **Style** tab → **Performance & Smoothness** and keep **Quality** on **Balanced** or **Eco** with **30 FPS**.
- **How to restore the native UI instantly?**
  Turn off the top-right master switch, click **Restore Native UI** in the *Style* tab, or disable **AGY Wallpaper Glass** in Antigravity Customizations.

---

## Development

```bash
npm test            # Run full automated test suite
npm run preview     # Start live browser preview (http://127.0.0.1:47831)
npm run sync:vendor # Refresh offline WebWallGL bundle from node_modules
npm run pack:release # Build offline dist/agy-wallpaper-glass-v1.1.0.zip
```

## License & Credits

- Released under the [MIT License](./LICENSE).
- Bundled offline Scene engine **[WebWallGL](https://github.com/oneincase/webwallgl)** is licensed under MIT (`sidecars/glass/vendor/webwallgl.LICENSE`).
- Conceptually inspired by `dsh-plugin-wallpaper-engine`. Not affiliated with Google, Antigravity, DSH, or Wallpaper Engine.
