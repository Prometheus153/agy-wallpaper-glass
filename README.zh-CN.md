# AGY Wallpaper Glass (`agy-wallpaper-glass`) v1.1.0

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

为 **Antigravity Desktop** 打造的 **Wallpaper Engine 壁纸库与 iOS 液态玻璃（Liquid Glass）** 美化插件，内置中/英双语界面、动态壁纸流畅度优化与互动猫娘桌宠。

灵感参考 `dsh-plugin-wallpaper-engine v1.4.0`，并离线内置 MIT 开源 **WebWallGL** 渲染核心：无需运行 Steam 小红车后台、无需外网 CDN，即可把本地 **场景（Scene）**、**网页（Web）**、**视频（Video）**、**图片（Image）** 壁纸实时渲染在 Antigravity 主界面背后，同时将侧边栏、输入框、分屏、审阅区与设置弹窗升级为通透的液态玻璃材质。

---

## 核心特性

- **全格式本地壁纸 + 6 套自带动态壁纸（离线内置 WebWallGL 引擎）**
  - **开箱自带 6 套原创动态壁纸**：无需 Steam 小红车也能直接体验——**极光冰原（Aurora）**、**深空星尘（Stardust）**、**樱吹雪（Sakura）**、**深海潮汐（Deep Tide）**、**暮林萤火（Fireflies）**、**雨夜霓虹（Rainy Night）**，支持鼠标视差、流速/粒子密度调节，并经过离屏贴图缓存与低功耗帧率优化。
  - **场景壁纸（Scene）**：支持 `scene.pkg` 打包与松散 `scene.json` 工程，实时 WebGL2 渲染粒子、骨骼动画、SceneScript 与鼠标视差交互；WebGL 不可用时自动平滑回退静态预览帧不白屏。
  - **网页 / 视频 / 图片壁纸**：网页壁纸严格沙箱隔离渲染；视频/图片免复制本机流式播放（支持 Range 拖动与大视频）。
- **深度流畅度与性能优化（`v1.1.0` 新增）**
  - 面板「样式」页内置 **画质性能档位（省电 / 均衡 / 高画质，默认均衡）** 与 **帧率上限（30 / 45 / 60 FPS，默认 30 FPS）**，直接联动 WebWallGL 原生 `setFps` / `setQuality` / `setRenderDpr` / `setVideoTexScale` 实时热调，高分屏下显著降低 GPU 占用。
  - 默认参数自动跳过全屏 CSS 离屏滤镜，移除对话区高频滚动代码块的重复毛玻璃回读，并优化桌宠监听防抖与后台自动休眠，边流式对话边播动态壁纸依旧顺滑。
- **完整中/英双语切换**
  - 支持自动跟随系统语言，并在面板顶部提供一键 **`EN / 中文`** 切换按钮，控制面板、桌宠右键菜单、提示语与自带壁纸名称同步切换。
- **互动猫娘桌宠与快捷液态玻璃浮窗**
  - 紧贴聊天区右边界的动态小猫娘：原画纹理网格实时物理摇尾、静谧定时单次 Wink（碰触不误触发）、贴身精准热区（尾巴周围透明区完全点击穿透不挡复制键），打开设置等弹窗时自动隐身避让。
  - 打开右侧审阅 / 文件 / 终端 / 分屏时自动同步左移；上下拖动记住高度；单击弹出液态玻璃浮窗控制面板，右键打开迷你快捷菜单。
- **极简 2 页设计与 3 套鲜明主题**
  - 精简的 **壁纸 / 样式** 两页布局，前置 **午夜蓝 / 薄雾白 / 暖余晖** 三套主题；分屏自动加细腻玻璃分隔线，审阅（Diff）、代码、终端区自动铺设高可读性毛玻璃底衬，并支持自动解析 `project.json` 场景自定义属性。
- **安全无侵入**
  - 不改动 Antigravity 安装目录文件，不读取聊天内容，不上传任何本地资源；关闭或停用插件后立即恢复原生界面（异常退出约 15 秒租约到期自动清理）。

---

## 前置要求

1. **Node.js `>= 22.12.0`**（可从 [nodejs.org](https://nodejs.org/) 下载，安装插件**无需执行 `npm install`**）
2. **Antigravity Desktop**（桌面客户端，非 VS Code IDE 扩展）
3. **开启 Antigravity 本机 DevTools 调试端口**（插件通过本机回环调试端口无侵入注入壁纸与玻璃样式）：
   - **Windows 设置方式**：右键 Antigravity 快捷方式 → **属性** → 在「目标（Target）」末尾加空格和 `--remote-debugging-port=9222`（例如 `"...Antigravity.exe" --remote-debugging-port=9222`）→ 保存后重启 Antigravity（确认 `%APPDATA%\Antigravity\DevToolsActivePort` 已生成）。
   - **安全提醒**：仅限本机回环地址（`127.0.0.1`），切勿向局域网或公网暴露调试端口。

---

## 快速安装（开箱即用，免 `npm install`）

仓库与发布包已完整内置离线 MIT 开源 WebWallGL 引擎（`sidecars/glass/vendor/webwallgl.global.min.js`）、6 套原创动态壁纸与猫娘桌宠素材，不含任何作者个人路径。

### 方式一：Windows 一键安装（推荐）
1. 前往 [Releases](https://github.com/Prometheus153/agy-wallpaper-glass/releases) 下载 `agy-wallpaper-glass-v1.1.0.zip`（或点击本页 **Code → Download ZIP**）并解压。
2. 双击文件夹里的 **`install.bat`**：
   - 输入 `1`：首次安装到 `~/.gemini/config/plugins/agy-wallpaper-glass`
   - 输入 `2`：覆盖更新 / 从旧版 `agy-glass` 无损迁移（自动备份旧插件并完整保留原有设置与已导入壁纸）
   - 输入 `3`：卸载（保留备份与个人数据）
   - 输入 `4`：在浏览器启动本地实时预览（不修改真实 Antigravity）

### 方式二：命令行安装（`git clone` / 跨平台）
```bash
git clone https://github.com/Prometheus153/agy-wallpaper-glass.git
cd agy-wallpaper-glass

# 首次安装（无需 npm install）
node scripts/install.mjs

# 更新或从旧版 agy-glass 平滑迁移（自动备份并保留数据）
node scripts/install.mjs --update

# 卸载
node scripts/install.mjs --uninstall

# 浏览器实时预览
node sidecars/glass/server.mjs --preview
```

### 安装后如何启用
1. 打开或重启 Antigravity Desktop，进入 **自定义（Customizations） → 已安装（Installed） → AGY Wallpaper Glass**。
2. 开启 **AGY Wallpaper Glass** 插件，打开侧边栏视图（或点击聊天区右侧小猫娘桌宠）呼出控制面板。
3. 打开右上角总开关，在默认 **「壁纸」** 页即可看到 6 套自带动态壁纸与自动扫描出的本机 Steam / Wallpaper Engine 全部壁纸，点击任意卡片立即生效！

---

## 读取本机 Wallpaper Engine 壁纸需要做什么？

- **标准 Steam 版 Wallpaper Engine 用户：通常零配置，全自动读取！**
  - **无需运行 Steam 或 Wallpaper Engine 后台**（小红车完全退出也能渲染）。
  - 插件启动时自动检测 Windows 注册表中的 Steam 与 Wallpaper Engine 路径、解析所有盘符的 `steamapps/libraryfolders.vdf` 与 `config/libraryfolders.vdf`、扫描 `C:\`～`Z:\` 下的 `Steam` / `SteamLibrary` 目录（以及 macOS / Linux 默认 Steam 路径），自动发现你本机已订阅的创意工坊（`431960`）与内置壁纸。
- **绿色版 / 自定义路径 / 独立壁纸包用户（3 种手动方式）**：
  1. **导入场景 / 目录**：点击「导入场景 / 目录」选择包含 `project.json` 的单个目录或壁纸总目录，免复制流式渲染。
  2. **导入文件 / `.pkg`**：点击「导入文件 / .pkg」选择独立 `scene.pkg`（最大 256 MB）或单个视频/图片。
  3. **自定义扫描目录**：展开「扫描目录与 Steam 库」填入最多 12 个本机目录（或设置环境变量 `AGY_GLASS_STEAM_ROOT`）。
- **没有安装 Wallpaper Engine 的用户**：开箱即可使用内置 **6 套原创动态壁纸**，或直接导入本地 MP4 / WebM / 图片。

---

## 常见问题排查

- **顶部状态一直显示「等待连接」？**
  请确认 Antigravity Desktop 启动参数已带 `--remote-debugging-port=9222`（生成 `%APPDATA%\Antigravity\DevToolsActivePort`），且插件是从 Antigravity 插件系统启动的。
- **动态壁纸在轻薄本或高分屏上占用偏高？**
  切到 **「样式」** 页的 **「流畅度与性能」** 卡片，选择 **「均衡」或「省电」** 搭配 **「30 FPS」** 即可大幅降低 GPU 负载。
- **如何彻底恢复原生界面？**
  关闭面板右上角总开关、在「样式」页点击「恢复原界面」，或在 Antigravity 插件页停用 **AGY Wallpaper Glass** 即可瞬间还原。

---

## 开发者命令

```bash
npm test            # 运行全部自动化单元测试
npm run preview     # 启动浏览器本地实时预览（默认 http://127.0.0.1:47831）
npm run sync:vendor # 从 node_modules 重新同步离线 WebWallGL 引擎
npm run pack:release # 生成离线发布包（dist/agy-wallpaper-glass-v1.1.0.zip）
```

## 开源许可与致谢

- 本项目遵循 [MIT License](./LICENSE)。
- 离线内置场景渲染核心 **[WebWallGL](https://github.com/oneincase/webwallgl)** 采用 MIT 许可（完整许可文本见 `sidecars/glass/vendor/webwallgl.LICENSE`）。
- 产品交互思路致敬社区项目 `dsh-plugin-wallpaper-engine`。与 Google、Antigravity、DSH 及 Wallpaper Engine 官方无隶属关系。
