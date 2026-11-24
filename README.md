# AGY Glass v1.0.0

为 **Antigravity Desktop** 打造的 **Wallpaper Engine 壁纸库与 iOS 液态玻璃（Liquid Glass）** 美化插件。

灵感参考 `dsh-plugin-wallpaper-engine v1.4.0`，并离线内置 MIT 开源 **WebWallGL** 渲染核心：无需运行 Steam 小红车后台、无需外网 CDN，即可把本地 **场景（Scene）**、**网页（Web）**、**视频（Video）**、**图片（Image）** 壁纸实时渲染在 Antigravity 主界面背后，同时将侧边栏、输入框、设置弹窗与菜单升级为通透的液态玻璃材质。

---

## 核心特性

- **全格式本地壁纸 + 6 套自带动态壁纸（内置离线 WebWallGL 引擎）**
  - **开箱自带 6 套原创动态壁纸**：无需 Steam 小红车也能直接体验——**极光冰原（Aurora）**、**深空星尘（Stardust）**、**樱吹雪（Sakura）**、**深海潮汐（Deep Tide）**、**暮林萤火（Fireflies）**、**雨夜霓虹（Rainy Night）**，均支持鼠标视差与实时流速/粒子密度调节。
  - **场景壁纸（Scene）**：支持 `scene.pkg` 打包与松散 `scene.json` 工程，实时 WebGL2 渲染粒子、骨骼动画、SceneScript 与鼠标视差交互；WebGL 不可用时平滑降级为静态预览帧不白屏。
  - **网页壁纸（Web）**：严格沙箱隔离渲染，内置 Wallpaper Engine 属性通信。
  - **视频 / 图片壁纸**：原文件免复制本机流式播放（支持 Range 拖动与大视频）。
  - **灵活导入**：自动发现本机 Steam 创意工坊（`431960`）与 Wallpaper Engine 目录；支持一键**导入本地场景/网页文件夹**（Windows 原生文件夹选择框或手动路径），也支持直接**导入独立 `.pkg` 场景包**（最大 256 MB）及单文件图片/视频。
- **互动猫娘桌宠与快捷液态玻璃浮窗**
  - 紧贴聊天区右边界的动态小猫娘：60fps 原画纹理网格实时物理摇尾（上摆自然大弧度下垂、到顶下摆勾出饱满上翘 J 弯，转折过渡柔顺 S 曲线）、静谧定时单次 Wink 眨眼（鼠标碰触不误触发）、轻呼吸微动与悬停探头互动。
  - **智能联动**：打开右侧审阅 / 文件 / 终端 / 分屏时，桌宠自动同步向左移动贴合聊天区右边框；支持上下拖动调整并记住高度。
  - **一点即开**：单击桌宠直接在身旁丝滑弹出独立的液态玻璃控制浮窗（再点收起）；右键呼出迷你快捷菜单（暂停壁纸 / 切换主题 / 暂时隐藏桌宠），也可在「样式」页随时开关和调节桌宠大小。
- **极简液态玻璃控制面板（实时所见即所得）**
  - 顶部常驻轻量总开关与当前壁纸状态卡（圆形封面 + 实时状态 + 暂停 / 刷新 / 清除）。
  - 精简的 **壁纸 / 样式** 两页设计：默认直接展示壁纸库点选切换；「样式」页前置 3 套鲜明氛围主题（午夜蓝 / 薄雾白 / 暖余晖）与核心玻璃/播放滑块，色彩/缩放/倍速/字体等精调项优雅收纳在折叠区中。
  - **分屏与审阅高可读性**：对话区全透展示壁纸，多栏分屏自动显示细腻的液态玻璃分隔线，审阅（Diff）、代码、终端与分屏新建页自动铺设高通透毛玻璃底衬，兼顾美感与清晰阅读。
  - 动态场景自定义属性：自动解析 `project.json` 中的 `general.properties`，直接在面板热调场景参数。
- **安全与无侵入**
  - 不修改 Antigravity 安装目录文件，不读取聊天内容，不上传任何本地资源。
  - 停用或关闭插件后界面立即自动恢复原生样式（异常退出约 15 秒租约到期自动清理）。

---

## 前置要求

1. **Node.js `>= 22.12.0`**（可从 [nodejs.org](https://nodejs.org/) 下载，安装插件**无需执行 `npm install`**）
2. **Antigravity Desktop**（桌面客户端，非 VS Code IDE 扩展）
3. **开启 Antigravity 本机 DevTools 调试端口**（插件通过本机回环调试端口无侵入注入壁纸与玻璃样式）：
   - **Windows 设置方式**：右键桌面/开始菜单中的 Antigravity 快捷方式 → **属性** → 在「目标（Target）」末尾加一个空格和 `--remote-debugging-port=9222`（例如 `"...Antigravity.exe" --remote-debugging-port=9222`）→ 保存后重新启动 Antigravity 即可（确认 `%APPDATA%\Antigravity\DevToolsActivePort` 已生成）。
   - **安全提醒**：仅限本机回环地址（`127.0.0.1`），切勿向局域网或公网暴露调试端口。

---

## 快速安装（开箱即用，免 `npm install`）

仓库已内置离线 MIT 开源 WebWallGL 引擎（`sidecars/glass/vendor/webwallgl.global.min.js`）、6 套原创动态壁纸与猫娘桌宠素材，**无需安装任何 npm 依赖**，也不包含任何作者个人路径。

### 方式一：Windows 一键安装（推荐）
1. 在本仓库页面点击 **Code → Download ZIP**（或前往 [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) 下载 `agy-glass-v1.0.0.zip`）并解压到任意目录。
2. 双击文件夹里的 **`install.bat`**：
   - 输入 `1`：首次安装到 `~/.gemini/config/plugins/agy-glass`
   - 输入 `2`：覆盖更新（自动备份旧版并保留原有壁纸和设置）
   - 输入 `3`：卸载（保留备份与个人数据）
   - 输入 `4`：在浏览器启动本地实时预览，提前体验 UI、壁纸与桌宠（不修改真实 Antigravity）

### 方式二：命令行安装（`git clone` / 跨平台）
```bash
git clone https://github.com/Prometheus153/agy-wallpaper-glass.git
cd agy-wallpaper-glass

# 首次安装（无需 npm install）
node scripts/install.mjs

# 从旧版本更新（自动备份）
node scripts/install.mjs --update

# 卸载
node scripts/install.mjs --uninstall

# 浏览器实时预览（用于调试或体验）
node sidecars/glass/server.mjs --preview
```

### 安装后如何启用
1. 重启或打开 Antigravity Desktop，进入 **自定义（Customizations） → 已安装（Installed） → AGY Glass**。
2. 开启 **AGY Glass** 插件，点击聊天区右侧小猫娘桌宠（或侧边栏 **「AGY Glass · 壁纸库」** 视图）打开控制面板。
3. 开启顶部总开关，在默认 **「壁纸」** 页即可看到 6 套自带动态壁纸与自动扫描出的本机 Steam / Wallpaper Engine 全部壁纸，点击任意卡片即可立即应用！

---

## 读取本机 Wallpaper Engine 壁纸需要做什么？

- **标准 Steam 版 Wallpaper Engine 用户：通常零配置，全自动读取！**
  - **无需运行 Steam 或 Wallpaper Engine 后台**（小红车完全退出也能渲染场景/网页/视频/图片壁纸）。
  - 插件启动时会自动检测 Windows 注册表中的 Steam 与 Wallpaper Engine 路径、解析所有盘符的 `steamapps/libraryfolders.vdf` 与 `config/libraryfolders.vdf`、扫描常见盘符下的 `Steam` / `SteamLibrary` 目录（以及 macOS / Linux 默认 Steam 路径），自动列出你本机已订阅的创意工坊（`431960`）与内置壁纸。
- **绿色版 / 自定义路径 / 独立壁纸包用户（3 种手动导入方式）**：
  1. **导入场景 / 网页目录**：在「壁纸」页点击 **「导入场景 / 网页目录」**，选择包含 `project.json` 的单个壁纸文件夹或存放多个壁纸的总目录，立即加入库并免复制流式渲染。
  2. **直接导入 `.pkg` / 视频 / 图片**：点击 **「导入文件 / .pkg」** 选择任意 `scene.pkg`（最大 256 MB）或单个视频/图片文件，插件自动封装并实时渲染。
  3. **自定义长期扫描目录**：展开 **「扫描目录与 Steam 库配置」**，每行填入一个 Steam 根目录、Wallpaper Engine 安装目录或自定义壁纸总目录保存（也支持设置环境变量 `AGY_GLASS_STEAM_ROOT`）。
- **没有安装 Wallpaper Engine 的用户**：同样可以直接开箱使用内置的 **6 套原创动态壁纸**，或者导入自己的本地 MP4 / WebM / 图片。

---

## 常见问题排查

- **顶部状态显示「等待连接」？**
  请确认 Antigravity Desktop 已开启本机 DevTools 调试端口（生成 `%APPDATA%\Antigravity\DevToolsActivePort`），且插件是从 Antigravity 插件系统启动的。开启端口请仅限本机回环地址，不要暴露到局域网或公网。
- **某些极复杂的场景壁纸无法 WebGL 渲染？**
  WebWallGL 支持绝大多数 2D/3D 场景、粒子、木偶骨骼与 SceneScript；若个别壁纸使用特殊未支持特性或设备 WebGL2 受限，播放器会自动平滑回退显示壁纸自带的预览图，不会导致界面黑屏。
- **如何彻底恢复原生界面？**
  点击面板右上角「已开启」按钮关闭，或在「样式」页点击「恢复原界面」，或在 Antigravity 插件页停用 AGY Glass 即可瞬间还原。

---

## 开发者说明

```bash
# 运行全部自动化单元测试
npm test

# 启动浏览器本地实时预览（默认 http://127.0.0.1:47831）
npm run preview

# 从 node_modules 重新同步离线 WebWallGL 引擎文件
npm run sync:vendor

# 生成可直接分享给别人的离线发布压缩包（dist/agy-glass-v1.0.0.zip）
npm run pack:release
```

## 开源许可与致谢

- 本项目遵循 [MIT License](./LICENSE)。
- 内置离线场景渲染核心 **[WebWallGL](https://github.com/oneincase/webwallgl)** 采用 MIT 许可（完整许可文本见 `sidecars/glass/vendor/webwallgl.LICENSE`）。
- 产品交互思路致敬社区项目 `dsh-plugin-wallpaper-engine`。与 Google、Antigravity、DSH 及 Wallpaper Engine 官方无隶属关系。
