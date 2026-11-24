@echo off
chcp 65001 >nul
title AGY Glass v1.0.0 安装与管理工具
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 22.12 或更高版本：https://nodejs.org/
  pause
  exit /b 1
)

echo ========================================================
echo   AGY Glass v1.0.0 · Antigravity 液态玻璃壁纸库插件
echo   支持 Wallpaper Engine 场景(Scene)/网页/视频/图片壁纸
echo ========================================================
echo.
echo   [1] 首次安装到本机 Antigravity 插件目录
echo   [2] 更新已安装的 AGY Glass（保留旧版备份与个人配置）
echo   [3] 卸载 AGY Glass（保留个人壁纸数据与备份）
echo   [4] 启动浏览器实时预览（不修改 Antigravity）
echo   [0] 退出
echo.
set /p choice=请输入数字并回车 [1-4]: 

if "%choice%"=="1" (
  node scripts\install.mjs
  goto done
)
if "%choice%"=="2" (
  node scripts\install.mjs --update
  goto done
)
if "%choice%"=="3" (
  node scripts\install.mjs --uninstall
  goto done
)
if "%choice%"=="4" (
  echo 正在启动本地预览，请在浏览器打开控制台显示的地址，按 Ctrl+C 结束...
  node sidecars\glass\server.mjs --preview
  goto done
)
exit /b 0

:done
echo.
pause
