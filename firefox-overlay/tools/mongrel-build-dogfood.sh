#!/usr/bin/env bash
# Full optimized build + macOS package for default-browser / dogfood use.
# Produces: obj-atlas-alpha/dist/Mongrel.app (and DMG from mach package).
#
# When the script exits, macOS can show an alert (see MONGREL_BUILD_ALERT below).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# MONGREL_BUILD_ALERT: how to notify when this script finishes (macOS only).
#   dialog       — blocking Alert dialog (default; hardest to miss)
#   notification — banner in Notification Center (non-blocking)
#   0            — off
MONGREL_BUILD_ALERT="${MONGREL_BUILD_ALERT:-dialog}"

mongrel_build_finished_alert() {
  local exit_code=$?
  [[ "$(uname -s)" != "Darwin" ]] && return 0
  [[ "$MONGREL_BUILD_ALERT" == "0" ]] && return 0

  if [[ "${MONGREL_BUILD_ALERT_SOUND:-0}" == "1" ]] && [[ -f /System/Library/Sounds/Glass.aiff ]]; then
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &
  fi

  if [[ $exit_code -eq 0 ]]; then
    case "$MONGREL_BUILD_ALERT" in
      notification)
        osascript -e 'display notification "Build and package finished." with title "Mongrel" subtitle "Mongrel.app is in obj-atlas-alpha/dist/"' 2>/dev/null || true
        ;;
      *)
        osascript -e 'display alert "Mongrel build finished" message "mach build and package completed successfully. Mongrel.app is under obj-atlas-alpha/dist/ (see terminal for full path)." as informational buttons {"OK"} default button "OK"' 2>/dev/null || true
        ;;
    esac
  else
    case "$MONGREL_BUILD_ALERT" in
      notification)
        osascript -e "display notification \"mach failed (exit $exit_code).\" with title \"Mongrel\" subtitle \"Check terminal output\"" 2>/dev/null || true
        ;;
      *)
        osascript -e "display alert \"Mongrel build failed\" message \"Exit code $exit_code. Check the terminal log.\" as critical buttons {\"OK\"} default button \"OK\"" 2>/dev/null || true
        ;;
    esac
  fi
}
trap mongrel_build_finished_alert EXIT

PY="${MONGREL_PYTHON:-python3.12}"
if ! command -v "$PY" &>/dev/null; then
  PY="python3"
fi

if [[ -z "${MACOS_SDK_DIR:-}" ]]; then
  # Pick latest Xcode macOS SDK if unset (matches typical local Xcode installs).
  newest="$(ls -d /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX*.sdk 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$newest" ]]; then
    export MACOS_SDK_DIR="$newest"
  fi
fi
if [[ -z "${MACOS_SDK_DIR:-}" || ! -d "$MACOS_SDK_DIR" ]]; then
  echo "Set MACOS_SDK_DIR to your MacOSX.sdk path (Xcode → Platforms → MacOSX.platform/Developer/SDKs)." >&2
  exit 1
fi

echo "Using MACOS_SDK_DIR=$MACOS_SDK_DIR"
echo "Using python: $PY"

if [[ "${MONGREL_SKIP_FETCH_ADDONS:-0}" != "1" && -x "$REPO_ROOT/tools/fetch-distro-addons.sh" ]]; then
  echo "Refreshing distribution extensions (AMO)…"
  "$REPO_ROOT/tools/fetch-distro-addons.sh" || echo "[WARN] fetch-distro-addons.sh failed (offline?); continuing with existing XPIs"
fi

"$PY" "$REPO_ROOT/mach" --no-interactive build "$@"
"$PY" "$REPO_ROOT/mach" --no-interactive package

echo ""
echo "Built app (install or open from here):"
echo "  $REPO_ROOT/obj-atlas-alpha/dist/Mongrel.app"
ls -la "$REPO_ROOT/obj-atlas-alpha/dist/"*.dmg 2>/dev/null || true
