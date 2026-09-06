#!/bin/sh
# repo-audit Linux/macOS/Unix POSIX shell shim
# 找到脚本所在目录的父目录，执行 repo-audit.mjs
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../repo-audit.mjs" "$@"
