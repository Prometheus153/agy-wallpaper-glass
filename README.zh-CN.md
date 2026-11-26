# AGY Wallpaper Glass (`agy-wallpaper-glass`) v1.3.0

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

为 **Antigravity Desktop（Windows & macOS Apple Silicon / Intel 双端）** 打造的 **Wallpaper Engine 壁纸库与 iOS 液态玻璃（Liquid Glass）** 美化插件，内置中/英双语界面、动态壁纸流畅度优化与互动猫娘桌宠。

灵感参考 `dsh-plugin-wallpaper-engine v1.4.0`，并离线内置 MIT 开源 **WebWallGL** 渲染核心：无需运行 Steam 小红车后台、无需外网 CDN，即可把本地 **场景（Scene）**、**网页（Web）**、**视频（Video）**、**图片（Image）** 壁纸实时渲染在 Antigravity 主界面背后，同时将侧边栏、输入框、分屏、审阅区与设置弹窗升级为通透的液态玻璃材质。

---

## 核心特性

- **内置「Antigravity 界面汉化」一键开关 + 兼容外部汉化（`v1.3.0` 新增）**
  - 在「样式」页或右键快捷菜单即可一键开关 Antigravity 主界面汉化（覆盖顶栏、左侧导航、输入框提示、概览/审阅菜单与设置弹窗）。不改 `app.asar`、软件更新不掉汉化、Windows & macOS 通用；已含中文自动跳过不与外部汉化包打架；严禁触碰聊天正文、代码块和终端输出；关闭开关即刻无损还原英文原文。
- **32×32 壁纸动态取色 / 莫奈取色（`v1.3.0` 新增）**
  - 开启「莫奈动态取色」后，切换任意场景、内置、视频或图片壁纸都会在毫秒内完成 `32×32` 采样，按深浅主题自适应联动玻璃底染、边框高光、强调色与光标色，并在面板实时展示 3 枚色板圆点与色值。
- **`Ctrl+Alt+W`（macOS `⌘+⌥+W`）全局快捷浮窗 + 双入口形态（`v1.3.0` 新增）**
  - 在 Antigravity 任意位置按 **`Ctrl+Alt+W`**（macOS 按 **`⌘+⌥+W`**）随时呼出/收起悬浮控制面板（`Esc` 关闭），入口形态可在 **「猫娘桌宠 / 极简胶囊」** 间自由切换，并预留同级 **「创意」** 标签页。
- **Windows & macOS 双端开箱即用（`v1.2.0` 完整适配 macOS）**
  - **深度适配 Apple Silicon（M1/M2/M3/M4）与 Intel Mac**：内置免 `PATH` 依赖的 macOS Sidecar 启动器（`launch-mac.sh`，即使从访达/程序坞启动 Antigravity 也能精准定位 Homebrew `/opt/homebrew/bin/node`、官方包、`nvm`、`fnm`、`volta`、`mise`、`asdf` 中的 Node 22+）；接入原生 **访达（Finder）文件夹选择器**、支持 `~/` 路径展开与 macOS `Control+单击` 桌宠交互；附带一键安装菜单 **`install-mac.command`**、免终端快捷启动器 **`Antigravity (Glass).app`** 生成与 **`scripts/doctor.mjs`** 一键自检工具。
- **全格式本地壁纸 + 6 套自带动态壁纸（离线内置 WebWallGL 引擎）**
  - **开箱自带 6 套原创动态壁纸**：无需 Steam 小红车也能直接体验——**极光冰原（Aurora）**、**深空星尘（Stardust）**、**樱吹雪（Sakura）**、**深海潮汐（Deep Tide）**、**暮林萤火（Fireflies）**、**雨夜霓虹（Rainy Night）**，支持鼠标视差、流速/粒子密度调节。
  - **场景壁纸（Scene）**：支持 `scene.pkg` 打包与松散 `scene.json` 工程，实时 WebGL2 渲染粒子、骨骼动画、SceneScript 与鼠标视差交互；WebGL 不可用时自动平滑回退静态预览帧不白屏。
  - **网页 / 视频 / 图片壁纸**：网页壁纸严格沙箱隔离渲染；视频/图片免复制本机流式播放（支持 Range 拖动与大视频）。
- **深度流畅度与性能优化**
  - 面板「样式」页内置 **画质性能档位（省电 / 均衡 / 高画质，默认均衡）** 与 **帧率上限（30 / 45 / 60 FPS，默认 30 FPS）**，直接联动 WebWallGL 原生 `setFps` / `setQuality` / `setRenderDpr` / `setVideoTexScale` 实时热调，在 Retina 屏 MacBook 和轻薄本上同样安静顺滑。
- **完整中/英双语切换**
  - 支持自动跟随系统语言，并在面板顶部提供一键 **`EN / 中文`** 切换按钮，控制面板、桌宠右键菜单、提示语与自带壁纸名称同步切换。
- **互动猫娘桌宠与快捷液态玻璃浮窗**
  - 紧贴聊天区右边界的动态小猫娘：原画纹理网格实时物理摇尾、静谧定时单次 Wink、贴身精准热区（尾巴周围透明区完全点击穿透不挡复制键），打开设置等弹窗时自动隐身避让。
  - 打开右侧审阅 / 文件 / 终端 / 分屏时自动同步左移；上下拖动记住高度；单击弹出液态玻璃浮窗控制面板，右键（macOS 亦支持 `Control+单击`）打开迷你快捷菜单。
- **安全无侵入**
  - 不改动 Antigravity 安装包文件或 macOS 应用签名，不读取聊天内容，不上传任何本地资源；关闭或停用插件后立即恢复原生界面（异常退出约 15 秒租约到期自动清理）。

---

## 前置要求

1. **Node.js `>= 22.12.0`**（可从 [nodejs.org](https://nodejs.org/) 下载，macOS 亦可用 `brew install node`；安装插件**无需执行 `npm install`**）
2. **Antigravity Desktop**（桌面客户端，非 VS Code IDE 扩展）
3. **开启 Antigravity 本机 DevTools 调试端口**（插件通过本机回环调试端口无侵入注入壁纸与玻璃样式）：
   - **macOS 设置方式**：先按 **`⌘Q`** 完全退出 Antigravity，再在终端运行：
     ```bash
     open -a "Antigravity" --args --remote-debugging-port=9222
     ```
     更省心的做法：直接运行 **`install-mac.command`** 选 **`[3]`**，一键在 `~/Applications` 生成 **`Antigravity (Glass).app`** 快捷启动图标（可拖到程序坞 Dock），以后双击即可自动带调试端口启动，无需再开终端（确认 `~/Library/Application Support/Antigravity/DevToolsActivePort` 已生成）。
   - **Windows 设置方式**：右键 Antigravity 快捷方式 → **属性** → 在「目标（Target）」末尾加空格和 `--remote-debugging-port=9222`（例如 `"...Antigravity.exe" --remote-debugging-port=9222`）→ 保存后重启 Antigravity（确认 `%APPDATA%\Antigravity\DevToolsActivePort` 已生成）。
   - **安全提醒**：仅限本机回环地址（`127.0.0.1`），切勿向局域网或公网暴露调试端口。

---

## 快速安装（开箱即用，免 `npm install`）

仓库与发布包已完整内置离线 MIT 开源 WebWallGL 引擎（`sidecars/glass/vendor/webwallgl.global.min.js`）、6 套原创动态壁纸与猫娘桌宠素材，不含任何作者个人路径。

### 方式一：macOS 一键安装（推荐）
1. 前往 [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) 下载 **`agy-wallpaper-glass-v1.3.0-macos.zip`**（或双端通用包 `agy-wallpaper-glass-v1.3.0.zip`）并解压。
2. 打开「终端（Terminal）」进入解压后的文件夹，运行以下一行命令（可绕过 macOS Gatekeeper 未知开发者弹窗）：
   ```bash
   bash install-mac.command
   ```
   *（或在访达中右键 `install-mac.command` → **打开**。）*
3. 按菜单提示输入 **`1`** 完成安装（自动写入当前 Node 22+ 路径并配置免 `PATH` 启动器），安装结束后按回车即可直接以调试端口启动 Antigravity 并生成 **`~/Applications/Antigravity (Glass).app`** 启动图标。
4. 随时可输入 **`4`**（或运行 `node scripts/doctor.mjs`）一键检查安装、Node、调试端口和壁纸库状态。

### 方式二：Windows 一键安装（推荐）
1. 前往 [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) 下载 **`agy-wallpaper-glass-v1.3.0.zip`** 并解压。
2. 双击文件夹里的 **`install.bat`**：
   - 输入 `1`：首次安装到 `~/.gemini/config/plugins/agy-wallpaper-glass`
   - 输入 `2`：覆盖更新 / 从旧版 `agy-glass` 无损迁移（自动备份旧插件并完整保留原有设置与已导入壁纸）
   - 输入 `3`：卸载（保留备份与个人数据）
   - 输入 `4`：在浏览器启动本地实时预览（不修改真实 Antigravity）
   - 输入 `5`：一键环境自检（`scripts/doctor.mjs`）

### 方式三：命令行安装（`git clone` / 跨平台）
```bash
git clone https://github.com/Prometheus153/agy-wallpaper-glass.git
cd agy-wallpaper-glass

# 首次安装（无需 npm install）
node scripts/install.mjs

# 更新或从旧版 agy-glass 平滑迁移（自动备份并保留数据）
node scripts/install.mjs --update

# 一键环境自检（排查端口、Node 与插件安装）
node scripts/doctor.mjs

# 卸载
node scripts/install.mjs --uninstall

# 浏览器实时预览
node sidecars/glass/server.mjs --preview
```

### 安装后如何启用
1. 确保 Antigravity Desktop 已带 `--remote-debugging-port=9222` 启动，进入 **自定义（Customizations） → 已安装（Installed） → AGY Wallpaper Glass**。
2. 开启 **AGY Wallpaper Glass** 插件，打开侧边栏视图（或点击聊天区右侧小猫娘桌宠）呼出控制面板。
3. 打开右上角总开关，在默认 **「壁纸」** 页即可看到 6 套自带动态壁纸与自动扫描出的本机壁纸，点击任意卡片立即生效！

---

## 读取本机 Wallpaper Engine 壁纸需要做什么？

- **标准 Steam 版 Wallpaper Engine 用户：通常零配置，全自动读取！**
  - **无需运行 Steam 或 Wallpaper Engine 后台**（小红车完全退出也能渲染）。
  - 插件启动时自动检测 Windows Steam 注册表与各盘符库、解析 `steamapps/libraryfolders.vdf` 与 `config/libraryfolders.vdf`，并自动扫描 **macOS 默认 Steam 目录（`~/Library/Application Support/Steam` 及 VDF 中登记的外接硬盘 `/Volumes/...` 库）** 与 Linux Steam 目录。
- **macOS 用户没有 Steam 版小红车 / 使用本地资源（3 种方式）**：
  1. **导入场景 / 目录**：点击「导入场景 / 目录」直接唤起原生 **macOS 访达 / Windows 文件夹选择器**，选择包含 `project.json` 的场景/网页目录或壁纸总目录（macOS 手动输入也支持 `~/...` 路径）。
  2. **导入文件 / `.pkg`**：点击「导入文件 / `.pkg`」选择独立 `scene.pkg`（最大 256 MB）或本地 MP4 / WebM / 图片。
  3. **自定义扫描目录**：展开「扫描目录与 Steam 库」填入最多 12 个本机目录（或设置环境变量 `AGY_GLASS_STEAM_ROOT`）。
- **开箱体验**：即便没有小红车，也自带 **6 套原创动态壁纸** 与全套液态玻璃与桌宠功能。

---

## 常见问题排查

- **遇到任何问题，先运行一键自检**：在插件目录运行 `node scripts/doctor.mjs`（或在安装器里选自检项），会自动检查 Node 版本、安装完整性、macOS Sidecar 启动器、`DevToolsActivePort` 文件与回环端口状态并给出精确修复命令。
- **macOS 顶部状态一直显示「等待连接」？**
  请务必先按 **`⌘Q`** 完全退出已打开的 Antigravity，再用 `open -a "Antigravity" --args --remote-debugging-port=9222`（或双击 `~/Applications/Antigravity (Glass).app`）重新启动；如果 Antigravity 已在运行，macOS 的 `open -a` 会忽略新的 `--args` 参数。
- **macOS 双击 `install-mac.command` 提示“无法验证开发者”？**
  打开终端进入解压目录执行 `bash install-mac.command`（零弹窗），或在访达里右键点击该文件选择 **「打开」** 即可。
- **动态壁纸在 Retina 屏 MacBook 或轻薄本上占用偏高？**
  切到 **「样式」** 页的 **「流畅度与性能」** 卡片，选择 **「均衡」或「省电」** 搭配 **「30 FPS」** 即可大幅降低 GPU 负载。
- **如何彻底恢复原生界面？**
  关闭面板右上角总开关、在「样式」页点击「恢复原界面」，或在 Antigravity 插件页停用 **AGY Wallpaper Glass** 即可瞬间还原。

---

## 开发者命令

```bash
npm test             # 运行全部跨平台单元测试（含 macOS 模拟测试套件）
npm run doctor       # 运行环境自检
npm run preview      # 启动浏览器本地实时预览（默认 http://127.0.0.1:47831）
npm run sync:vendor  # 从 node_modules 重新同步离线 WebWallGL 引擎
npm run pack:release # 生成双端通用包 + macOS 专版离线包（自动写入 Unix 0755 权限）
```

## 开源许可与致谢

- 本项目遵循 [MIT License](./LICENSE)。
- 离线内置场景渲染核心 **[WebWallGL](https://github.com/oneincase/webwallgl)** 采用 MIT 许可（完整许可文本见 `sidecars/glass/vendor/webwallgl.LICENSE`）。
- 离线内置 Antigravity 界面汉化词典复用自 MIT 开源项目 **[antigravity-zh-plugin](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin)**（完整许可文本见 `sidecars/glass/vendor/antigravity-zh-plugin.LICENSE`）。
- 产品交互思路致敬社区项目 `dsh-plugin-wallpaper-engine`。与 Google、Antigravity、DSH 及 Wallpaper Engine 官方无隶属关系。
