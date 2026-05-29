#!/bin/sh
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if [ ! -x "$DIR/SAPD-Wiki-Backend" ]; then
  echo "SAPD-Wiki-Backend is missing or not executable."
  echo "Try: chmod +x \"$DIR/SAPD-Wiki-Backend\" \"$DIR/start-macos.command\""
  echo "Then check logs/runtime.log or run diagnostics/export-diagnostics.command."
  exit 1
fi
"$DIR/SAPD-Wiki-Backend" --bundle-root "$DIR" "$@"
