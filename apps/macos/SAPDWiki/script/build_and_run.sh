#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="SAPD Wiki"
EXECUTABLE_NAME="SAPDWiki"
BUNDLE_ID="com.sapd.wiki.macos"
DISPLAY_VERSION="${SAPD_WIKI_DISPLAY_VERSION:-${SAPD_WIKI_APP_VERSION:-0.4.1}}"
BUNDLE_VERSION="${SAPD_WIKI_BUNDLE_VERSION:-$DISPLAY_VERSION}"
LICENSE_MODE="${SAPD_WIKI_LICENSE_MODE:-license}"
MIN_SYSTEM_VERSION="13.0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/../../.." && pwd)"
DIST_DIR="${SAPD_WIKI_DIST_DIR:-$APP_ROOT/dist}"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_HELPERS="$APP_CONTENTS/Helpers"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_BINARY="$APP_MACOS/$EXECUTABLE_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"
APP_ICON_SOURCE="$APP_ROOT/Resources/AppIcon.icns"
RUNTIME_WORK="$APP_ROOT/.build/runtime-work"
BACKEND_WORK="$APP_ROOT/.build/backend-work"
BACKEND_SOURCE_STAMP="$BACKEND_WORK/backend-source.sha256"
CODE_SIGN_IDENTITY="${SAPD_WIKI_CODESIGN_IDENTITY:--}"
PACKAGE_LOCK_FILE="${SAPD_WIKI_PACKAGE_LOCK_DIR:-$APP_ROOT/.build/package-dmg.lock}"
PACKAGE_LOCK_STALE_SECONDS="${SAPD_WIKI_PACKAGE_LOCK_STALE_SECONDS:-21600}"
BUILD_CHILD_PID=""

prepare_package_lock_file() {
  local modified_at
  local now
  local age
  if [[ ! -d "$PACKAGE_LOCK_FILE" ]]; then
    return 0
  fi
  if find "$PACKAGE_LOCK_FILE" -mindepth 1 -print -quit | grep -q .; then
    echo "legacy package lock directory is not empty; refusing recovery: $PACKAGE_LOCK_FILE" >&2
    exit 1
  fi
  modified_at="$(stat -f %m "$PACKAGE_LOCK_FILE" 2>/dev/null || stat -c %Y "$PACKAGE_LOCK_FILE")"
  now="$(date +%s)"
  age=$((now - modified_at))
  if (( age < PACKAGE_LOCK_STALE_SECONDS )); then
    echo "legacy package lock directory lacks sufficient stale-time evidence: $PACKAGE_LOCK_FILE" >&2
    exit 1
  fi
  rmdir "$PACKAGE_LOCK_FILE"
  echo "recovered stale legacy package lock directory: $PACKAGE_LOCK_FILE" >&2
}

terminate_process_tree() {
  local parent_pid="$1"
  local child_pid
  local child_pids
  if ! kill -STOP "$parent_pid" 2>/dev/null; then
    return 0
  fi
  child_pids="$(pgrep -P "$parent_pid" 2>/dev/null || true)"
  for child_pid in $child_pids; do
    terminate_process_tree "$child_pid"
  done
  kill -TERM "$parent_pid" 2>/dev/null || true
  kill -CONT "$parent_pid" 2>/dev/null || true
}

terminate_build() {
  local exit_code="$1"
  trap - INT TERM
  if [[ -n "$BUILD_CHILD_PID" ]] && kill -0 "$BUILD_CHILD_PID" 2>/dev/null; then
    terminate_process_tree "$BUILD_CHILD_PID"
    wait "$BUILD_CHILD_PID" 2>/dev/null || true
  fi
  exit "$exit_code"
}

run_build_command() {
  local status
  "$@" &
  BUILD_CHILD_PID=$!
  if wait "$BUILD_CHILD_PID"; then
    status=0
  else
    status=$?
  fi
  BUILD_CHILD_PID=""
  return "$status"
}

acquire_package_lock() {
  if [[ "${SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD:-0}" == "1" ]]; then
    if [[ ! -f "$PACKAGE_LOCK_FILE" ]]; then
      echo "internal package lock handoff is invalid: $PACKAGE_LOCK_FILE" >&2
      exit 1
    fi
    return 0
  fi
  prepare_package_lock_file
  mkdir -p "$(dirname "$PACKAGE_LOCK_FILE")"
  exec lockf -t 0 -k "$PACKAGE_LOCK_FILE" env \
    SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD=1 \
    "$0" "$@"
}

trap 'terminate_build 130' INT
trap 'terminate_build 143' TERM

export CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-$APP_ROOT/.build/module-cache}"
export SWIFTPM_HOME="${SWIFTPM_HOME:-$APP_ROOT/.build/swiftpm-cache}"
mkdir -p "$CLANG_MODULE_CACHE_PATH" "$SWIFTPM_HOME"

if [[ "$(uname -m)" == "arm64" ]]; then
  PLATFORM="mac-arm64"
else
  PLATFORM="mac-x64"
fi
runtime_bundle_name_version() {
  case "$DISPLAY_VERSION" in
    v*|V*) printf '%s\n' "$DISPLAY_VERSION" ;;
    *) printf 'v%s\n' "$DISPLAY_VERSION" ;;
  esac
}

FRONTEND_DIST="${SAPD_WIKI_FRONTEND_DIST:-$REPO_ROOT/frontend/capability-browser}"
BASE_DB="${SAPD_WIKI_BASE_DB:-$REPO_ROOT/data/database/sapd_wiki.sqlite3}"
CONTENT_ASSET_DB="${SAPD_WIKI_CONTENT_ASSET_DB:-$REPO_ROOT/data/database/sapd_content_assets.sqlite3}"
MATURITY_REPORT_SEED="${SAPD_WIKI_MATURITY_REPORT_SEED:-$REPO_ROOT/data/user/maturity-reports}"
MATURITY_REPORT_SEED_ARTIFACT="${SAPD_WIKI_MATURITY_REPORT_SEED_ARTIFACT:-demo-project-002=maturity-report-216c744b314ff70e8cfd-20260718-102008Z-9af11352}"
DEFAULT_PYINSTALLER_PYTHON="$APP_ROOT/.build/pyinstaller-venv/bin/python"
if [[ -z "${PYTHON_BIN:-}" && -x "$DEFAULT_PYINSTALLER_PYTHON" ]]; then
  PYTHON_BIN="$DEFAULT_PYINSTALLER_PYTHON"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

backend_source_hash() {
  "$PYTHON_BIN" - "$REPO_ROOT" <<'PY'
import hashlib
import sys
from pathlib import Path

root = Path(sys.argv[1])
paths = [
    root / "scripts" / "run_local_server.py",
    root / "scripts" / "check_bundle_runtime.py",
    root / "scripts" / "create_user_db.py",
    root / "scripts" / "export_diagnostics.py",
    root / "scripts" / "package_backend_pyinstaller.py",
]
paths.extend(sorted((root / "src" / "sapd_wiki").rglob("*.py")))
paths.extend(sorted((root / "docs" / "01-architecture" / "contracts" / "mcp").rglob("*.json")))
digest = hashlib.sha256()
for path in paths:
    if not path.exists():
        continue
    digest.update(str(path.relative_to(root)).encode("utf-8"))
    digest.update(b"\0")
    digest.update(path.read_bytes())
    digest.update(b"\0")
print(digest.hexdigest())
PY
}

local_backend_binary() {
  printf '%s\n' "$BACKEND_WORK/backend/$PLATFORM/SAPD-Wiki-Backend"
}

ensure_local_backend_binary() {
  local backend_binary
  backend_binary="$(local_backend_binary)"
  local current_hash
  current_hash="$(backend_source_hash)"
  local recorded_hash=""
  if [[ -f "$BACKEND_SOURCE_STAMP" ]]; then
    recorded_hash="$(cat "$BACKEND_SOURCE_STAMP")"
  fi

  if [[ -x "$backend_binary" && "${SAPD_WIKI_REBUILD_BACKEND:-auto}" != "1" && "$recorded_hash" == "$current_hash" ]]; then
    printf '%s\n' "$backend_binary"
    return 0
  fi

  echo "building_backend_from_current_source=1" >&2
  "$PYTHON_BIN" "$REPO_ROOT/scripts/package_backend_pyinstaller.py" \
    --output-dir "$BACKEND_WORK" \
    --platform "$PLATFORM" \
    --require-native >&2
  mkdir -p "$(dirname "$BACKEND_SOURCE_STAMP")"
  printf '%s\n' "$current_hash" >"$BACKEND_SOURCE_STAMP"

  if [[ ! -x "$backend_binary" ]]; then
    echo "current-source backend was not produced: $backend_binary" >&2
    return 1
  fi
  printf '%s\n' "$backend_binary"
}

find_external_backend_binary() {
  if [[ -n "${SAPD_WIKI_MAC_BACKEND:-}" && -f "${SAPD_WIKI_MAC_BACKEND:-}" ]]; then
    printf '%s\n' "$SAPD_WIKI_MAC_BACKEND"
    return 0
  fi

  local candidates=(
    "$REPO_ROOT/dist/macos/backend/$PLATFORM/SAPD-Wiki-Backend"
    "$REPO_ROOT/dist/zip-alpha/backend/$PLATFORM/SAPD-Wiki-Backend"
    "$REPO_ROOT/dist/zip-alpha/dist/$PLATFORM/SAPD-Wiki-Backend"
    "/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/package-work/backend/$PLATFORM/SAPD-Wiki-Backend"
    "/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/package-work/dist/$PLATFORM/SAPD-Wiki-Backend"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

BACKEND_BINARY=""

resolve_backend_binary() {
  if [[ -n "$BACKEND_BINARY" ]]; then
    return 0
  fi
  BACKEND_BINARY="$(ensure_local_backend_binary || true)"
  if [[ -z "$BACKEND_BINARY" && "${SAPD_WIKI_ALLOW_EXTERNAL_BACKEND:-0}" == "1" ]]; then
    BACKEND_BINARY="$(find_external_backend_binary || true)"
  fi
  if [[ -z "$BACKEND_BINARY" ]]; then
    cat >&2 <<ERROR
Cannot build SAPD-Wiki-Backend for $PLATFORM from current source.

Install PyInstaller for this Python, then retry:
  $PYTHON_BIN -m pip install pyinstaller

For emergency diagnostics only, you may explicitly allow an external backend:
  SAPD_WIKI_ALLOW_EXTERNAL_BACKEND=1 SAPD_WIKI_MAC_BACKEND=/path/to/SAPD-Wiki-Backend $0 build
ERROR
    exit 1
  fi
}

if [[ ! -d "$FRONTEND_DIST" ]]; then
  echo "frontend dist does not exist: $FRONTEND_DIST" >&2
  exit 1
fi

if [[ ! -f "$BASE_DB" ]]; then
  echo "base database does not exist: $BASE_DB" >&2
  exit 1
fi

if [[ ! -f "$CONTENT_ASSET_DB" ]]; then
  echo "required content asset database does not exist: $CONTENT_ASSET_DB" >&2
  exit 1
fi

if [[ ! -f "$APP_ICON_SOURCE" ]]; then
  echo "app icon does not exist: $APP_ICON_SOURCE" >&2
  exit 1
fi

kill_existing_app() {
  local runtime_backend="$HOME/Library/Application Support/SAPD Wiki/Runtime/SAPD-Wiki-Backend"
  pkill -x "$EXECUTABLE_NAME" >/dev/null 2>&1 || true
  sleep 0.6
  pkill -f "$runtime_backend" >/dev/null 2>&1 || true
  sleep 0.4
  pkill -9 -f "$runtime_backend" >/dev/null 2>&1 || true
}

build_runtime() {
  resolve_backend_binary
  rm -rf "$RUNTIME_WORK"
  mkdir -p "$RUNTIME_WORK"
  local bundle_args=(
    --output-dir "$RUNTIME_WORK" \
    --platform "$PLATFORM" \
    --bundle-version "$DISPLAY_VERSION" \
    --app-version "$DISPLAY_VERSION" \
    --frontend-dist "$FRONTEND_DIST" \
    --backend-binary "$BACKEND_BINARY" \
    --base-db "$BASE_DB" \
    --content-asset-db "$CONTENT_ASSET_DB"
  )
  if [[ -d "$MATURITY_REPORT_SEED" ]]; then
    bundle_args+=(
      --maturity-report-seed "$MATURITY_REPORT_SEED"
      --maturity-report-seed-artifact "$MATURITY_REPORT_SEED_ARTIFACT"
    )
  fi
  "$PYTHON_BIN" "$REPO_ROOT/scripts/build_zip_bundle.py" "${bundle_args[@]}"
}

write_runtime_fingerprint() {
  local runtime_bundle="$1"
  "$PYTHON_BIN" - "$runtime_bundle" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
include_roots = [
    root / "SAPD-Wiki-Backend",
    root / "_internal",
    root / "start-macos.command",
    root / "stop-macos.command",
    root / "app" / "frontend-dist",
    root / "config",
    root / "data" / "base",
    root / "diagnostics",
]
paths = []
for item in include_roots:
    if item.is_file():
        paths.append(item)
    elif item.is_dir():
        paths.extend(path for path in item.rglob("*") if path.is_file())
digest = hashlib.sha256()
for path in sorted(paths):
    rel = path.relative_to(root).as_posix()
    digest.update(rel.encode("utf-8"))
    digest.update(b"\0")
    if rel == "data/base/base-manifest.json":
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest.pop("build_time", None)
        digest.update(json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    elif rel == "config/app-config.json":
        config = json.loads(path.read_text(encoding="utf-8"))
        for key in ("app_data_root", "download_dir", "import_dir", "runtime_root", "user_database_path", "license"):
            config.pop(key, None)
        digest.update(json.dumps(config, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    else:
        digest.update(path.read_bytes())
    digest.update(b"\0")
(root / ".sapd-runtime-fingerprint").write_text(digest.hexdigest() + "\n", encoding="utf-8")
print(f"runtime_fingerprint={digest.hexdigest()}")
PY
}

write_info_plist() {
  cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$EXECUTABLE_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon.icns</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$BUNDLE_VERSION</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>SAPDWikiDisplayVersion</key>
  <string>$DISPLAY_VERSION</string>
  <key>SAPDWikiLicenseMode</key>
  <string>$LICENSE_MODE</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
</dict>
</plist>
PLIST
}

codesign_args() {
  printf '%s\0' --force --sign "$CODE_SIGN_IDENTITY"
  if [[ "$CODE_SIGN_IDENTITY" != "-" ]]; then
    printf '%s\0' --options runtime --timestamp
  fi
}

sign_path() {
  local target="$1"
  local -a args=()
  while IFS= read -r -d '' item; do
    args+=("$item")
  done < <(codesign_args)
  codesign "${args[@]}" "$target"
}

sign_macho_tree() {
  local root="$1"
  if ! command -v codesign >/dev/null 2>&1 || ! command -v file >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r -d '' candidate; do
    if file "$candidate" | grep -q "Mach-O"; then
      sign_path "$candidate" >/dev/null 2>&1
    fi
  done < <(find "$root" -type f \( -perm -111 -o -name "*.dylib" -o -name "*.so" \) -print0)
}

stage_app_bundle() {
  acquire_package_lock
  swift build --package-path "$APP_ROOT"
  local build_bin_dir
  build_bin_dir="$(swift build --package-path "$APP_ROOT" --show-bin-path)"
  local build_binary="$build_bin_dir/$EXECUTABLE_NAME"
  local keychain_repair_binary="$build_bin_dir/SAPDWikiKeychainRepair"
  if [[ ! -x "$build_binary" ]]; then
    echo "SwiftPM did not produce executable: $build_binary" >&2
    exit 1
  fi
  if [[ ! -x "$keychain_repair_binary" ]]; then
    echo "SwiftPM did not produce Keychain repair helper: $keychain_repair_binary" >&2
    exit 1
  fi

  build_runtime
  local runtime_bundle="$RUNTIME_WORK/SAPD-Wiki-$(runtime_bundle_name_version)-$PLATFORM"
  if [[ ! -d "$runtime_bundle" ]]; then
    echo "runtime bundle missing: $runtime_bundle" >&2
    exit 1
  fi
  write_runtime_fingerprint "$runtime_bundle"

  rm -rf "$APP_BUNDLE"
  mkdir -p "$APP_MACOS" "$APP_HELPERS" "$APP_RESOURCES"
  cp "$build_binary" "$APP_BINARY"
  cp "$keychain_repair_binary" "$APP_HELPERS/SAPDWikiKeychainRepair"
  cp "$APP_ICON_SOURCE" "$APP_RESOURCES/AppIcon.icns"
  chmod +x "$APP_BINARY"
  chmod +x "$APP_HELPERS/SAPDWikiKeychainRepair"
  write_info_plist
  cp -R "$runtime_bundle" "$APP_RESOURCES/Runtime"
  if command -v xattr >/dev/null 2>&1; then
    xattr -cr "$APP_BUNDLE" >/dev/null 2>&1 || true
  fi
  if command -v codesign >/dev/null 2>&1; then
    sign_path "$APP_HELPERS/SAPDWikiKeychainRepair" >/dev/null 2>&1 || {
      echo "warning: Keychain repair helper codesign failed; continuing with unsigned local helper" >&2
    }
    sign_macho_tree "$APP_RESOURCES/Runtime" || {
      echo "warning: nested runtime codesign failed; continuing with existing signatures" >&2
    }
    sign_path "$APP_BUNDLE" >/dev/null 2>&1 || {
      echo "warning: app codesign failed; continuing with unsigned local bundle" >&2
    }
  fi

  echo "app_bundle=$APP_BUNDLE"
  echo "backend_binary=$BACKEND_BINARY"
  echo "base_db=$BASE_DB"
  echo "content_asset_db=$CONTENT_ASSET_DB"
}

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run|--run)
    kill_existing_app
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    open_app
    ;;
  --build-only|build)
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    ;;
  --debug|debug)
    kill_existing_app
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    run_build_command lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    kill_existing_app
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    open_app
    run_build_command /usr/bin/log stream --info --style compact --predicate "process == \"$EXECUTABLE_NAME\""
    ;;
  --telemetry|telemetry)
    kill_existing_app
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    open_app
    run_build_command /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    kill_existing_app
    run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage
    open_app
    sleep 3
    pgrep -x "$EXECUTABLE_NAME" >/dev/null
    echo "verify=pass"
    ;;
  --stop|stop)
    kill_existing_app
    echo "stop=ok"
    ;;
  --package|package|--dmg|dmg)
    run_build_command "$SCRIPT_DIR/package_dmg.sh"
    ;;
  --internal-stage)
    stage_app_bundle
    ;;
  *)
    echo "usage: $0 [run|build|--debug|--logs|--telemetry|--verify|--package]" >&2
    exit 2
    ;;
esac
