#!/bin/sh
# AGY Wallpaper Glass — macOS / POSIX Sidecar Launcher
# Resolves Node.js >= 22.12 even when Antigravity.app launches with a minimal GUI PATH.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

is_valid_node() {
  [ -n "${1:-}" ] && [ -x "$1" ] || return 1
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' >/dev/null 2>&1
}

node_score() {
  "$1" -e 'const [a,b,c]=process.versions.node.split(".").map(Number); console.log(a*1000000+b*1000+c)' 2>/dev/null || echo 0
}

# 1. Exact Node binary recorded during installation (most reliable)
if [ -f "$SCRIPT_DIR/.node-bin" ]; then
  RECORDED=$(head -n 1 "$SCRIPT_DIR/.node-bin" | tr -d '\r')
  if is_valid_node "$RECORDED"; then
    exec "$RECORDED" "$SCRIPT_DIR/server.mjs" "$@"
  fi
fi

# 2. Standard Homebrew (Apple Silicon & Intel), official pkg, Volta, mise, asdf, fnm
for CAND in \
  /opt/homebrew/bin/node \
  /opt/homebrew/opt/node@22/bin/node \
  /opt/homebrew/opt/node/bin/node \
  /usr/local/bin/node \
  /usr/local/opt/node@22/bin/node \
  /usr/local/opt/node/bin/node \
  "${HOME:-}/.volta/bin/node" \
  "${HOME:-}/.local/share/mise/shims/node" \
  "${HOME:-}/.asdf/shims/node" \
  "${HOME:-}/.local/share/fnm/aliases/default/bin/node" \
  "${HOME:-}/Library/Application Support/fnm/aliases/default/bin/node"
do
  if is_valid_node "$CAND"; then
    exec "$CAND" "$SCRIPT_DIR/server.mjs" "$@"
  fi
done

# 3. Scan nvm and fnm installed versions safely (supports spaces in paths, picks highest version)
BEST_NODE=""
BEST_SCORE=0
check_best() {
  CAND_PATH="${1:-}"
  if is_valid_node "$CAND_PATH"; then
    SCORE=$(node_score "$CAND_PATH")
    if [ "$SCORE" -gt "$BEST_SCORE" ]; then
      BEST_SCORE="$SCORE"
      BEST_NODE="$CAND_PATH"
    fi
  fi
}

if [ -n "${HOME:-}" ]; then
  for CAND in "$HOME/.nvm/versions/node"/v*/bin/node \
              "$HOME/.local/share/fnm/node-versions"/v*/installation/bin/node \
              "$HOME/Library/Application Support/fnm/node-versions"/v*/installation/bin/node
  do
    [ -x "$CAND" ] || continue
    check_best "$CAND"
  done
fi

if [ -n "$BEST_NODE" ]; then
  exec "$BEST_NODE" "$SCRIPT_DIR/server.mjs" "$@"
fi

# 4. Fallback to PATH
PATH_NODE=$(command -v node 2>/dev/null || true)
if is_valid_node "$PATH_NODE"; then
  exec "$PATH_NODE" "$SCRIPT_DIR/server.mjs" "$@"
fi

echo "[agy-wallpaper-glass] Node.js >= 22.12.0 was not found. Please install Node.js 22+ (https://nodejs.org/ or 'brew install node') and re-run install-mac.command." >&2
exit 127
