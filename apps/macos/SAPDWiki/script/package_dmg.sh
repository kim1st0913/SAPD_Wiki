#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
APP_NAME="SAPD Wiki"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
STAGING_DIR="$DIST_DIR/dmg-staging"
DMG_PATH="$DIST_DIR/SAPD-Wiki-mac-$(uname -m).dmg"

"$SCRIPT_DIR/build_and_run.sh" build

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$APP_BUNDLE" "$STAGING_DIR/"
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$STAGING_DIR/$APP_NAME.app" >/dev/null 2>&1 || true
fi

cat >"$STAGING_DIR/README-FIRST.txt" <<README
SAPD Wiki macOS App alpha

1. Drag "SAPD Wiki.app" to Applications, or run it directly from this DMG for internal testing.
2. The app starts a local SAPD Wiki backend and opens the UI inside an embedded WebView.
3. Runtime data is copied to ~/Library/Application Support/SAPD Wiki/Runtime.
4. User data is stored under ~/Library/Application Support/SAPD Wiki/Runtime/data/user and is not overwritten by the app bundle.
5. This alpha DMG is ad-hoc signed only. It is not notarized. The first launch may still require Privacy & Security -> Open Anyway.
README

rm -f "$DMG_PATH"
hdiutil create \
  -volname "SAPD Wiki" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH" >/dev/null

echo "dmg=$DMG_PATH"
