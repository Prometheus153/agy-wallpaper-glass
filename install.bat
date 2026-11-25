@echo off
chcp 65001 >nul
title AGY Wallpaper Glass v1.2.0 Installer
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [Error / 错误] Node.js 22.12+ is required: https://nodejs.org/
  pause
  exit /b 1
)

echo ==============================================================
echo   AGY Wallpaper Glass v1.2.0 (agy-wallpaper-glass)
echo   Antigravity Liquid Glass + Wallpaper Engine (EN / 中文)
echo ==============================================================
echo.
echo   [1] Install plugin / 首次安装到本机 Antigravity 插件目录
echo   [2] Update plugin  / 更新并自动迁移旧版（保留备份与个人数据）
echo   [3] Uninstall      / 卸载插件（保留个人壁纸数据与备份）
echo   [4] Live Preview   / 启动浏览器实时预览（不修改 Antigravity）
echo   [5] Doctor Check   / 一键环境自检（排查连接与壁纸库）
echo   [0] Exit           / 退出
echo.
set /p choice=Select [1-5] / 请输入数字并回车 [1-5]: 

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
  echo Starting local preview / 正在启动本地预览，按 Ctrl+C 结束...
  node sidecars\glass\server.mjs --preview
  goto done
)
if "%choice%"=="5" (
  node scripts\doctor.mjs
  goto done
)
exit /b 0

:done
echo.
pause
