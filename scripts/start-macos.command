#!/bin/sh
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
mkdir -p "$DIR/logs"
LAUNCHER_LOG="$DIR/logs/launcher.log"
{
  echo "==== SAPD Wiki launcher ===="
  date
  echo "bundle_root=$DIR"
} >> "$LAUNCHER_LOG"
if [ ! -x "$DIR/SAPD-Wiki-Backend" ]; then
  echo "SAPD-Wiki-Backend is missing or not executable."
  echo "Try: chmod +x \"$DIR/SAPD-Wiki-Backend\" \"$DIR/start-macos.command\""
  echo "Then check logs/runtime.log or run diagnostics/export-diagnostics.command."
  echo "backend missing or not executable" >> "$LAUNCHER_LOG"
  exit 1
fi
if command -v xattr >/dev/null 2>&1 && xattr -p com.apple.quarantine "$DIR/SAPD-Wiki-Backend" >/dev/null 2>&1; then
  echo "macOS quarantine detected on SAPD-Wiki-Backend."
  echo "This unsigned alpha binary may be killed by Gatekeeper with 'Killed: 9'."
  echo "Run these commands in Terminal:"
  echo "  xattr -dr com.apple.quarantine \"$DIR\""
  echo "  chmod +x \"$DIR/SAPD-Wiki-Backend\" \"$DIR/start-macos.command\""
  echo "Then run start-macos.command again."
  echo "quarantine detected on backend" >> "$LAUNCHER_LOG"
  exit 1
fi
echo "starting backend" >> "$LAUNCHER_LOG"
"$DIR/SAPD-Wiki-Backend" --bundle-root "$DIR" "$@"
