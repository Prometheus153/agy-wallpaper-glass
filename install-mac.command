#!/bin/bash
# AGY Wallpaper Glass v1.2.0 — macOS One-Click Installer & Launcher
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR" || exit 1

is_valid_node() {
  [ -n "${1:-}" ] && [ -x "$1" ] || return 1
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' >/dev/null 2>&1
}

find_node() {
  for CAND in \
    /opt/homebrew/bin/node \
    /opt/homebrew/opt/node@22/bin/node \
    /opt/homebrew/opt/node/bin/node \
    /usr/local/bin/node \
    /usr/local/opt/node@22/bin/node \
    /usr/local/opt/node/bin/node \
    "${HOME}/.volta/bin/node" \
    "${HOME}/.local/share/mise/shims/node" \
    "${HOME}/.asdf/shims/node" \
    "${HOME}/.local/share/fnm/aliases/default/bin/node" \
    "${HOME}/Library/Application Support/fnm/aliases/default/bin/node"
  do
    if is_valid_node "$CAND"; then
      echo "$CAND"
      return 0
    fi
  done

  BEST=""
  BEST_SCORE=0
  for CAND in "$HOME/.nvm/versions/node"/v*/bin/node \
              "$HOME/.local/share/fnm/node-versions"/v*/installation/bin/node \
              "$HOME/Library/Application Support/fnm/node-versions"/v*/installation/bin/node
  do
    if is_valid_node "$CAND"; then
      SCORE=$("$CAND" -e 'const [a,b,c]=process.versions.node.split(".").map(Number); console.log(a*1000000+b*1000+c)' 2>/dev/null || echo 0)
      if [ "$SCORE" -gt "$BEST_SCORE" ]; then
        BEST_SCORE="$SCORE"
        BEST="$CAND"
      fi
    fi
  done
  if [ -n "$BEST" ]; then
    echo "$BEST"
    return 0
  fi

  PATH_NODE=$(command -v node 2>/dev/null || true)
  if is_valid_node "$PATH_NODE"; then
    echo "$PATH_NODE"
    return 0
  fi
  return 1
}

find_antigravity_app() {
  for APP in "/Applications/Antigravity.app" "$HOME/Applications/Antigravity.app"; do
    if [ -d "$APP" ]; then
      echo "$APP"
      return 0
    fi
  done
  return 1
}

create_mac_launcher_app() {
  APP_TARGET="$1"
  DEST_DIR="$HOME/Applications"
  mkdir -p "$DEST_DIR"
  LAUNCHER_APP="$DEST_DIR/Antigravity (Glass).app"
  ESCAPED_APP=$(printf '%s' "$APP_TARGET" | sed 's/\\/\\\\/g; s/"/\\"/g')
  TMP_SCPT=$(mktemp /tmp/agy-glass-launcher.XXXXXX.applescript)
  cat > "$TMP_SCPT" <<EOF
do shell script "open -a \"$ESCAPED_APP\" --args --remote-debugging-port=9222"
EOF
  rm -rf "$LAUNCHER_APP"
  if /usr/bin/osacompile -o "$LAUNCHER_APP" "$TMP_SCPT"; then
    rm -f "$TMP_SCPT"
    echo "[OK] 已生成快捷启动器 / Created launcher app:"
    echo "     $LAUNCHER_APP"
    echo "     以后直接双击它（或拖到 Dock）即可带调试端口启动 Antigravity，无需再开终端！"
  else
    rm -f "$TMP_SCPT"
    echo "[WARN] 生成 .app 启动器失败，请改用终端命令：open -a \"Antigravity\" --args --remote-debugging-port=9222"
  fi
}

launch_antigravity_debug() {
  APP_PATH=$(find_antigravity_app || true)
  if [ -z "$APP_PATH" ]; then
    echo "[WARN] 未在 /Applications 或 ~/Applications 找到 Antigravity.app。"
    echo "       如果你把 Antigravity 安装在其他位置，请手动运行："
    echo "       open -a \"/path/to/Antigravity.app\" --args --remote-debugging-port=9222"
    return
  fi

  echo "检测到 / Detected: $APP_PATH"
  if pgrep -x "Antigravity" >/dev/null 2>&1; then
    echo ""
    echo "[提示 / Note] 检测到 Antigravity 正在运行。macOS 需要先退出原进程才能附加调试端口。"
    printf "是否立即平滑关闭并重新以调试端口启动？[Y/n]: "
    read -r restart_ans
    if [ -z "$restart_ans" ] || [ "$restart_ans" = "y" ] || [ "$restart_ans" = "Y" ]; then
      /usr/bin/osascript -e 'tell application "Antigravity" to quit' >/dev/null 2>&1 || true
      sleep 2
    fi
  fi

  open -a "$APP_PATH" --args --remote-debugging-port=9222
  echo "[OK] 已通过本机回环调试端口启动 Antigravity (--remote-debugging-port=9222)"
  echo ""
  printf "是否顺便在 ~/Applications 生成「Antigravity (Glass).app」免终端双击启动图标？[Y/n]: "
  read -r app_ans
  if [ -z "$app_ans" ] || [ "$app_ans" = "y" ] || [ "$app_ans" = "Y" ]; then
    create_mac_launcher_app "$APP_PATH"
  fi
}

NODE_BIN=$(find_node || true)
if [ -z "$NODE_BIN" ]; then
  echo "=============================================================="
  echo "  [Error / 错误] 未找到 Node.js >= 22.12.0"
  echo "  Node.js 22.12+ is required to run AGY Wallpaper Glass."
  echo "=============================================================="
  echo ""
  echo "  推荐安装方式 / Recommended:"
  echo "    - Homebrew:  brew install node"
  echo "    - Official:  https://nodejs.org/"
  echo ""
  printf "Press Enter to close / 按回车键退出..."
  read -r _
  exit 1
fi

NODE_VER=$("$NODE_BIN" -v)

echo "=============================================================="
echo "  AGY Wallpaper Glass v1.2.0 (macOS Installer)"
echo "  Antigravity Liquid Glass + Wallpaper Engine (EN / 中文)"
echo "  Node: $NODE_VER ($NODE_BIN)"
echo "=============================================================="
echo ""
echo "  [1] Install plugin          / 首次安装到本机 Antigravity 插件目录"
echo "  [2] Update / Migrate plugin / 更新并自动迁移旧版（保留备份与数据）"
echo "  [3] Launch Antigravity      / 开启调试端口启动 Antigravity（可生成双击启动图标）"
echo "  [4] Self-Check Doctor       / 一键环境自检（排查连接与壁纸库）"
echo "  [5] Live Browser Preview    / 启动浏览器实时预览（不修改 Antigravity）"
echo "  [6] Uninstall               / 卸载插件（保留个人数据与备份）"
echo "  [0] Exit                    / 退出"
echo ""
printf "Select [1-6] / 请输入数字并回车 [1-6]: "
read -r choice

case "${choice:-}" in
  1)
    "$NODE_BIN" scripts/install.mjs
    echo ""
    printf "安装完成！是否立即配置并启动带调试端口的 Antigravity？[Y/n]: "
    read -r launch_now
    if [ -z "$launch_now" ] || [ "$launch_now" = "y" ] || [ "$launch_now" = "Y" ]; then
      launch_antigravity_debug
    fi
    ;;
  2)
    "$NODE_BIN" scripts/install.mjs --update
    ;;
  3)
    launch_antigravity_debug
    ;;
  4)
    "$NODE_BIN" scripts/doctor.mjs
    ;;
  5)
    echo "Starting local preview at http://127.0.0.1:47831 (Ctrl+C to stop)..."
    "$NODE_BIN" sidecars/glass/server.mjs --preview
    ;;
  6)
    "$NODE_BIN" scripts/install.mjs --uninstall
    ;;
  0|"")
    exit 0
    ;;
  *)
    echo "Invalid option / 无效选项: $choice"
    ;;
esac

echo ""
printf "Press Enter to close / 按回车键退出..."
read -r _
