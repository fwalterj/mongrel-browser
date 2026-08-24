#!/usr/bin/env bash
# tools/fetch-distro-addons.sh
#
# Download Mongrel preinstalled addon XPIs from addons.mozilla.org and
# stage them for both the build output and distribution packaging.
#
# Usage (from repo root):
#   ./tools/fetch-distro-addons.sh
#
# The XPIs are written to TWO locations:
#   1. browser/app/distribution/extensions/  — picked up by the packager
#      via the @RESPATH@/distribution/* glob in package-manifest.in
#   2. obj-atlas-alpha/dist/bin/distribution/extensions/  — picked up at
#      runtime when running `./mach run` (dev builds)
#
# XPIProvider reads {binary}/distribution/extensions/*.xpi on first launch
# (pref extensions.installDistroAddons defaults to true) and installs them
# into the user profile automatically.
#
# Opt-out: comment out any curl block below, then re-run and rebuild.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_EXT_DIR="$REPO_ROOT/browser/app/distribution/extensions"

# Detect build output directory from mozconfig (default: obj-atlas-alpha)
OBJDIR_NAME="obj-atlas-alpha"
if [[ -f "$REPO_ROOT/mozconfig" ]]; then
    _parsed=$(grep 'MOZ_OBJDIR' "$REPO_ROOT/mozconfig" | grep -oE '@TOPSRCDIR@/[^ ]+' | head -1 || true)
    if [[ -n "$_parsed" ]]; then
        OBJDIR_NAME="${_parsed##*/}"
    fi
fi
BUILD_EXT_DIR="$REPO_ROOT/$OBJDIR_NAME/dist/bin/distribution/extensions"

mkdir -p "$SRC_EXT_DIR" "$BUILD_EXT_DIR"

_fetch() {
    local name="$1" slug="$2" addon_id="$3"
    local xpi_name="$addon_id.xpi"
    echo "→ Fetching $name..."
    curl --location --fail --silent --show-error \
      "https://addons.mozilla.org/firefox/downloads/latest/$slug/latest.xpi" \
      -o "$SRC_EXT_DIR/$xpi_name"
    cp "$SRC_EXT_DIR/$xpi_name" "$BUILD_EXT_DIR/$xpi_name"
    echo "  Staged: distribution/extensions/$xpi_name"
}

# ── uBlock Origin ────────────────────────────────────────────────────────────
_fetch "uBlock Origin" "ublock-origin" "uBlock0@raymondhill.net"

# ── DownThemAll ───────────────────────────────────────────────────────────────
_fetch "DownThemAll" "downthemall" "{DDC359D1-844A-42a7-9AA1-88A850A938A8}"

echo ""
echo "Done. XPIs staged in:"
echo "  src : $SRC_EXT_DIR"
echo "  run : $BUILD_EXT_DIR"
echo ""
echo "Next: run './mach run' — both addons will install on first launch."
echo "For packaging: run './mach build' after this script."
