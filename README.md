# AGY Wallpaper Glass (`agy-wallpaper-glass`) v1.2.0

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

An **iOS-style Liquid Glass & Wallpaper Engine** customization plugin for **Antigravity Desktop (Windows & macOS — Apple Silicon & Intel)** — featuring offline local Scene/Web/Video/Image wallpaper rendering, performance tuning, full English/Chinese UI, and an interactive animated catgirl desktop pet.

Inspired by `dsh-plugin-wallpaper-engine v1.4.0` and powered by the bundled MIT-licensed **WebWallGL** engine: render local **Scene**, **Web**, **Video**, and **Image** wallpapers behind Antigravity Desktop with **no Steam/Wallpaper Engine background process** and **no external CDN**, while upgrading the sidebar, composer, split panes, diff review views, and dialogs into translucent Liquid Glass surfaces.

---

## Highlights

- **Cross-Platform Ready (Windows 10/11 & macOS Apple Silicon / Intel)**
  - **macOS First-Class Support (`v1.2.0`)**: GUI-PATH-safe Sidecar launcher (`launch-mac.sh` auto-detects Homebrew `/opt/homebrew/bin/node`, `/usr/local/bin/node`, `nvm`, `fnm`, `volta`, `mise`, `asdf`), native Finder folder picker (`osascript`), `~/` path expansion, `Control+Click` pet support, one-click **`install-mac.command`**, optional standalone **`Antigravity (Glass).app`** debug launcher, and built-in **`scripts/doctor.mjs`** environment checker.
- **All Wallpaper Formats + 6 Built-in Animated Wallpapers (Offline WebWallGL Bundled)**
  - **6 Original Built-in Wallpapers Ready Out of the Box**: *Aurora*, *Stardust*, *Sakura*, *Deep Tide*, *Fireflies*, and *Rainy Night* — works even without Wallpaper Engine, with mouse parallax, live speed/density controls, and low-CPU sprite/gradient caching.
  - **Scene Wallpapers**: Supports both packed `scene.pkg` and loose `scene.json` projects via WebGL2 (particles, skeletal animation, SceneScript, mouse parallax), with automatic fallback to static preview frames if WebGL2 is unavailable.
  - **Web / Video / Image Wallpapers**: Sandboxed Web wallpapers with Wallpaper Engine property messaging, plus zero-copy local streaming with HTTP Range support for large videos.
- **Smooth Performance Controls**
  - Built-in **Performance Mode** (**Eco / Balanced / Ultra**, default *Balanced*) and **FPS Cap** (**30 / 45 / 60 FPS**, default *30 FPS*) hot-applied directly to WebWallGL (`setFps`, `setQuality`, `setRenderDpr`, `setVideoTexScale`), keeping Retina MacBooks and laptops cool and responsive.
- **Interactive Catgirl Desktop Pet & Floating Glass Drawer**
  - Clings to the right border of the chat pane with 60fps hand-painted tail mesh physics, calm periodic winks, tight click-through body hit testing, and automatic hiding beneath Settings/modal dialogs.
  - Automatically shifts left when right-side panes (Review, Files, Terminal, Split View) open; drag vertically to adjust & save height; click to toggle a sleek floating Liquid Glass drawer; right-click (or `Control+Click` on macOS) for quick actions.
- **Bilingual UI (`EN / 中文`) & 3 Distinct Glass Themes**
  - Auto-detects system language with a one-click **`EN / 中文`** toggle in the panel header.
  - Streamlined **Wallpapers / Style** tabs with 3 themes (**Midnight**, **Frost**, **Ember**), split-pane glass dividers, high-contrast frosted backing for Diff/Review/Terminal panes, and dynamic `project.json` Scene properties.
- **Non-Invasive & Safe**
  - Never modifies Antigravity binaries or app signatures, never reads chat content, and never uploads local files. Disabling restores native UI immediately (and cleans up automatically on a 15s lease if terminated unexpectedly).

---

## Requirements

1. **Node.js `>= 22.12.0`** ([nodejs.org](https://nodejs.org/) or `brew install node` on macOS) — **no `npm install` needed** to install or run the plugin.
2. **Antigravity Desktop** (desktop app, not the VS Code extension).
3. **Local DevTools Debugging Port Enabled** (loopback `127.0.0.1` only):
   - **macOS**: Quit Antigravity completely (`⌘Q`), then launch with:
     ```bash
     open -a "Antigravity" --args --remote-debugging-port=9222
     ```
     Or use option **`[3]`** inside **`install-mac.command`** to create a standalone **`~/Applications/Antigravity (Glass).app`** icon you can double-click anytime without Terminal (confirms `~/Library/Application Support/Antigravity/DevToolsActivePort` exists).
   - **Windows**: Right-click your Antigravity shortcut → **Properties** → append a space and `--remote-debugging-port=9222` to **Target** (e.g. `"...Antigravity.exe" --remote-debugging-port=9222`) → save and restart Antigravity (confirm `%APPDATA%\Antigravity\DevToolsActivePort` exists).
   - **Security note**: Keep the debugging port strictly on `127.0.0.1`; never expose it to LAN or the public internet.

---

## Quick Install (Zero `npm install`)

The repository and release ZIPs already bundle the offline MIT WebWallGL engine (`sidecars/glass/vendor/webwallgl.global.min.js`), 6 built-in animated wallpapers, and desktop pet assets with zero hardcoded user paths.

### macOS Installation (Apple Silicon & Intel)
1. Download **`agy-wallpaper-glass-v1.2.0-macos.zip`** (or the universal **`agy-wallpaper-glass-v1.2.0.zip`**) from [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) and unzip it.
2. Open Terminal in the extracted folder and run (bypasses macOS Gatekeeper quarantine prompt cleanly):
   ```bash
   bash install-mac.command
   ```
   *(Or right-click `install-mac.command` → **Open** in Finder.)*
3. Choose **`[1]`** to install (automatically records your Node 22+ path so Antigravity launched from Dock/Spotlight always starts the Sidecar cleanly), then accept the prompt to launch Antigravity with `--remote-debugging-port=9222` and create **`~/Applications/Antigravity (Glass).app`**.
4. Optional: Run **`[4]`** (`node scripts/doctor.mjs`) anytime to verify Node, plugin files, Sidecar launcher, DevTools port, and Steam discovery.

### Windows Installation
1. Download **`agy-wallpaper-glass-v1.2.0.zip`** from [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) and extract it.
2. Double-click **`install.bat`**:
   - `1`: First-time install to `~/.gemini/config/plugins/agy-wallpaper-glass`
   - `2`: Update / migrate from legacy `agy-glass` (automatically backs up the old plugin and preserves all user settings & imported wallpapers)
   - `3`: Uninstall (keeps backup & user data)
   - `4`: Launch browser live preview without touching Antigravity
   - `5`: Run self-check diagnostics (`scripts/doctor.mjs`)

### Command Line (`git clone` / Cross-Platform)
```bash
git clone https://github.com/Prometheus153/agy-wallpaper-glass.git
cd agy-wallpaper-glass

# First-time install (no npm install required)
node scripts/install.mjs

# Update or migrate from legacy agy-glass (keeps backup & user data)
node scripts/install.mjs --update

# Verify your local environment (Windows & macOS)
node scripts/doctor.mjs

# Uninstall
node scripts/install.mjs --uninstall

# Launch local browser preview
node sidecars/glass/server.mjs --preview
```

### Enable in Antigravity Desktop
1. Open Antigravity Desktop (with `--remote-debugging-port=9222`) → **Customizations → Installed → AGY Wallpaper Glass**.
2. Enable the plugin, then open the **AGY Wallpaper Glass** side pane (or click the catgirl pet on the right edge of chat).
3. Toggle the master switch ON and click any built-in or local Wallpaper Engine card to apply it live!

---

## Using Your Own Wallpaper Engine Library

- **Standard Steam Wallpaper Engine Users — Zero Setup**:
  - **Steam and Wallpaper Engine do NOT need to be running.**
  - On startup, the plugin checks Windows Steam & Wallpaper Engine registry keys, parses `steamapps/libraryfolders.vdf` and `config/libraryfolders.vdf`, scans Windows Steam drives, and checks default **macOS (`~/Library/Application Support/Steam`)** and Linux Steam paths (including external `/Volumes/...` libraries listed in VDF) to discover Workshop (`431960`) and default wallpapers.
- **Portable / Custom Locations (3 Easy Options)**:
  1. **Import Folder**: Click **Import Folder** in the *Wallpapers* tab to pick a folder via native **macOS Finder** or **Windows Folder Picker** (also supports pasting `~/...` paths on macOS).
  2. **Import File / `.pkg`**: Click **Import File / .pkg** to import any standalone `scene.pkg` (up to 256 MB) or single image/video file.
  3. **Custom Scan Roots**: Expand **Library Paths & Steam Discovery** to save up to 12 custom directories (or set `AGY_GLASS_STEAM_ROOT`).
- **No Wallpaper Engine Installed?**: Enjoy the **6 built-in animated wallpapers** or import any local MP4/WebM/PNG/JPG/WebP/GIF directly.

---

## Troubleshooting

- **Run `node scripts/doctor.mjs` first!** It checks Node version, installed plugin files, macOS GUI-PATH launcher, `DevToolsActivePort`, loopback CDP connectivity, and Steam roots in one command.
- **Status stuck on `Waiting` on macOS?**
  Make sure you completely quit Antigravity (`⌘Q`) before launching with `open -a "Antigravity" --args --remote-debugging-port=9222` (or double-click `~/Applications/Antigravity (Glass).app`). `open -a` ignores `--args` if Antigravity was already running!
- **macOS says `install-mac.command` cannot be opened from an unidentified developer?**
  Run `bash install-mac.command` in Terminal, or right-click → **Open** in Finder.
- **Dynamic wallpaper feels heavy on laptops / Retina displays?**
  Open the **Style** tab → **Performance & Smoothness** and keep **Quality** on **Balanced** or **Eco** with **30 FPS**.
- **How to restore the native UI instantly?**
  Turn off the top-right master switch, click **Restore Native UI** in the *Style* tab, or disable **AGY Wallpaper Glass** in Antigravity Customizations.

---

## Development

```bash
npm test             # Run full cross-platform automated test suite (Windows + simulated macOS)
npm run doctor       # Run local environment self-check
npm run preview      # Start live browser preview (http://127.0.0.1:47831)
npm run sync:vendor  # Refresh offline WebWallGL bundle from node_modules
npm run pack:release # Build offline v1.2.0 universal + macOS ZIPs with Unix 0755 permissions
```

## License & Credits

- Released under the [MIT License](./LICENSE).
- Bundled offline Scene engine **[WebWallGL](https://github.com/oneincase/webwallgl)** is licensed under MIT (`sidecars/glass/vendor/webwallgl.LICENSE`).
- Conceptually inspired by `dsh-plugin-wallpaper-engine`. Not affiliated with Google, Antigravity, DSH, or Wallpaper Engine.
