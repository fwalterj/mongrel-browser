#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_DIR/obj-atlas-alpha/dist"
BRANDING_DIR="$REPO_DIR/browser/branding/unofficial"
SOURCE_ICON="${MONGREL_ICON_SOURCE:-$BRANDING_DIR/default256.png}"
PREFERRED_CODESIGN_IDENTITY="${MONGREL_CODESIGN_IDENTITY:-}"
SIGNING_MODE="${MONGREL_SIGNING_MODE:-standard}"
TOUCHID_ENTITLEMENTS_FILE="${MONGREL_TOUCHID_ENTITLEMENTS:-}"
APPSTORE_ENTITLEMENTS_FILE="${MONGREL_APPSTORE_ENTITLEMENTS:-}"
EMBEDDED_PROVISIONPROFILE="${MONGREL_EMBEDDED_PROVISIONPROFILE:-}"
TODAY="$(date +%F)"

PATCH_TMPDIR=""
STAGE_DIR=""

cleanup_tmp() {
  [[ -n "$PATCH_TMPDIR" && -d "$PATCH_TMPDIR" ]] && rm -rf "$PATCH_TMPDIR"
  [[ -n "$STAGE_DIR" && -d "$STAGE_DIR" ]] && rm -rf "$STAGE_DIR"
}
trap cleanup_tmp EXIT

plist_has_key() {
  local file="$1"
  local key="$2"
  grep -q "<key>$key</key>" "$file"
}

resolve_codesign_identity() {
  if [[ -n "$PREFERRED_CODESIGN_IDENTITY" ]]; then
    echo "$PREFERRED_CODESIGN_IDENTITY"
  else
    echo "-"
  fi
}

next_release_label() {
  local base_label="$1"
  if [[ ! -e "$REPO_DIR/release-dogfood-$base_label" ]]; then
    echo "$base_label"
    return
  fi
  local counter=2
  while [[ -e "$REPO_DIR/release-dogfood-$base_label-$counter" ]]; do
    counter=$((counter + 1))
  done
  echo "$base_label-$counter"
}

copy_app_resolved() {
  local src="$1"
  local dst="$2"
  rm -rf "$dst"
  mkdir -p "$dst"
  # Dereference symlinks so release app is self-contained and signature stable.
  rsync -aL --delete "$src/" "$dst/"
}

patch_pref_file() {
  local file="$1"
  local label="$2"

  echo "Patching prefs: $label"
  chmod u+w "$file" || true

  sed -i '' '/pref("gfx\.webrender\.software"/d' "$file" || true
  sed -i '' '/pref("layers\.acceleration\.disabled"/d' "$file" || true

  if grep -q 'browser\.urlbar\.unifiedSearchButton\.always' "$file"; then
    sed -i '' 's/pref("browser\.urlbar\.unifiedSearchButton\.always"[^)]*)/pref("browser.urlbar.unifiedSearchButton.always", true)/' "$file"
  else
    printf '\npref("browser.urlbar.unifiedSearchButton.always", true);\n' >> "$file"
  fi

  if grep -q 'browser\.search\.selectedEngine' "$file"; then
    sed -i '' 's/pref("browser\.search\.selectedEngine"[^)]*)/pref("browser.search.selectedEngine", "DuckDuckGo")/' "$file"
  else
    printf 'pref("browser.search.selectedEngine", "DuckDuckGo");\n' >> "$file"
  fi

  if grep -q 'browser\.search\.defaultenginename\.US' "$file"; then
    sed -i '' 's/pref("browser\.search\.defaultenginename\.US"[^)]*)/pref("browser.search.defaultenginename.US", "DuckDuckGo")/' "$file"
  else
    printf 'pref("browser.search.defaultenginename.US", "DuckDuckGo");\n' >> "$file"
  fi

  if grep -q 'browser\.search\.defaultenginename"' "$file"; then
    sed -i '' 's/pref("browser\.search\.defaultenginename"[^)]*)/pref("browser.search.defaultenginename", "DuckDuckGo")/' "$file"
  else
    printf 'pref("browser.search.defaultenginename", "DuckDuckGo");\n' >> "$file"
  fi

  if grep -q 'browser\.search\.hiddenOneOffs' "$file"; then
    sed -i '' 's/pref("browser\.search\.hiddenOneOffs"[^)]*)/pref("browser.search.hiddenOneOffs", "")/' "$file"
  else
    printf 'pref("browser.search.hiddenOneOffs", "");\n' >> "$file"
  fi

  echo "  Enforced search defaults + one-offs visibility"
}

patch_omni_ja() {
  local omni="$1"
  local label="$2"
  PATCH_TMPDIR="$(mktemp -d /tmp/mongrel-prefpatch.XXXXXX)"
  local unpack="$PATCH_TMPDIR/unpacked"
  mkdir -p "$unpack"
  unzip -qq "$omni" -d "$unpack"

  local found=""
  found="$(find "$unpack" -type f -path '*/app/profile/firefox.js' | head -n 1 || true)"
  [[ -z "$found" ]] && found="$(find "$unpack" -type f -name 'firefox.js' | head -n 1 || true)"
  if [[ -z "$found" ]]; then
    rm -rf "$PATCH_TMPDIR"
    PATCH_TMPDIR=""
    return 1
  fi

  patch_pref_file "$found" "$label (embedded firefox.js)"
  (
    cd "$unpack"
    zip -q -r -X "$PATCH_TMPDIR/repacked.omni.ja" .
  )
  cp "$PATCH_TMPDIR/repacked.omni.ja" "$omni"
  echo "  Repacked: $label"

  rm -rf "$PATCH_TMPDIR"
  PATCH_TMPDIR=""
}

patch_app_prefs() {
  local app="$1"
  local patched=0
  local loose="$app/Contents/Resources/browser/defaults/preferences/firefox.js"
  local main_omni="$app/Contents/Resources/omni.ja"
  local browser_omni="$app/Contents/Resources/browser/omni.ja"

  if [[ -f "$loose" ]]; then
    patch_pref_file "$loose" "$loose"
    patched=1
  fi
  if [[ -f "$main_omni" ]] && patch_omni_ja "$main_omni" "$main_omni"; then
    patched=1
  fi
  if [[ -f "$browser_omni" ]] && patch_omni_ja "$browser_omni" "$browser_omni"; then
    patched=1
  fi

  if [[ "$patched" -eq 0 ]]; then
    echo "ERROR: Could not find patchable firefox.js in $app" >&2
    return 1
  fi
}

smoke_test_release() {
  local app="$1"
  local fail=0

  echo
  echo "=== Smoke test: $(basename "$app") ==="
  echo "  Checking release prefs..."

  local prefs_content=""
  local loose="$app/Contents/Resources/browser/defaults/preferences/firefox.js"
  local b_omni="$app/Contents/Resources/browser/omni.ja"

  if [[ -f "$loose" ]]; then
    prefs_content="$(cat "$loose")"
  elif [[ -f "$b_omni" ]]; then
    local stmp
    stmp="$(mktemp -d /tmp/mongrel-smoke.XXXXXX)"
    unzip -qq "$b_omni" -d "$stmp" 2>/dev/null || true
    local sf
    sf="$(find "$stmp" -type f -name 'firefox.js' | head -n 1 || true)"
    [[ -n "$sf" ]] && prefs_content="$(cat "$sf")"
    rm -rf "$stmp"
  fi

  if [[ -z "$prefs_content" ]]; then
    echo "  [WARN] Could not read prefs for verification"
  else
    if grep -qE 'browser\.search\.(selectedEngine|defaultenginename(\.US)?).*DuckDuckGo' <<< "$prefs_content"; then
      echo "  [OK]   DuckDuckGo default search prefs present"
    else
      echo "  [FAIL] DuckDuckGo default search prefs missing" >&2; fail=1
    fi
    if grep -qE 'browser\.urlbar\.unifiedSearchButton\.always.*true' <<< "$prefs_content"; then
      echo "  [OK]   unifiedSearchButton.always = true"
    else
      echo "  [FAIL] unifiedSearchButton.always not set" >&2; fail=1
    fi
    if grep -qE 'layers\.acceleration\.disabled.*true|gfx\.webrender\.software.*true' <<< "$prefs_content"; then
      echo "  [FAIL] GPU-killing pref still present" >&2; fail=1
    else
      echo "  [OK]   No GPU-killing prefs"
    fi
  fi

  echo "  Launching app (headless smoke check)..."
  local binary=""
  for b in mongrel firefox; do
    [[ -x "$app/Contents/MacOS/$b" ]] && binary="$b" && break
  done

  if [[ -z "$binary" ]]; then
    echo "  [WARN] No known binary in MacOS/ — skipping launch check"
  else
    local smoke_profile
    smoke_profile="$(mktemp -d /tmp/mongrel-smoke-profile.XXXXXX)"
    "$app/Contents/MacOS/$binary" --headless --no-remote --profile "$smoke_profile" >/dev/null 2>&1 &
    local bg_pid=$!
    local waited=0
    local found_pid=""
    while [[ $waited -lt 5 ]]; do
      sleep 1
      found_pid="$(pgrep -f "MacOS/$binary" 2>/dev/null | head -n 1 || true)"
      [[ -n "$found_pid" ]] && break
      waited=$((waited + 1))
    done

    if [[ -n "$found_pid" ]]; then
      echo "  [OK]   App launched (PID $found_pid)"
      kill "$found_pid" 2>/dev/null || true
    elif kill -0 "$bg_pid" 2>/dev/null; then
      echo "  [OK]   App process alive (PID $bg_pid)"
      kill "$bg_pid" 2>/dev/null || true
    else
      echo "  [WARN] Process exited before check — headless may have completed immediately"
    fi
    sleep 1
    rm -rf "$smoke_profile"
  fi

  echo
  if [[ "$fail" -eq 0 ]]; then
    echo "=== Smoke test PASSED ==="
  else
    echo "=== Smoke test FAILED — see failures above ===" >&2
  fi
  echo
  return "$fail"
}

generate_icns() {
  local source_png="$1"
  local output_icns="$2"
  local iconset_tmp="$(mktemp -d /tmp/mongrel-iconset.XXXXXX)"
  local normalized_png="$iconset_tmp/source.png"
  local iconset_dir="$iconset_tmp/mongrel.iconset"

  sips -s format png "$source_png" --out "$normalized_png" >/dev/null
  mkdir -p "$iconset_dir"
  sips -z 16 16 "$normalized_png" --out "$iconset_dir/icon_16x16.png" >/dev/null
  sips -z 32 32 "$normalized_png" --out "$iconset_dir/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$normalized_png" --out "$iconset_dir/icon_32x32.png" >/dev/null
  sips -z 64 64 "$normalized_png" --out "$iconset_dir/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$normalized_png" --out "$iconset_dir/icon_128x128.png" >/dev/null
  sips -z 256 256 "$normalized_png" --out "$iconset_dir/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$normalized_png" --out "$iconset_dir/icon_256x256.png" >/dev/null
  sips -z 512 512 "$normalized_png" --out "$iconset_dir/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$normalized_png" --out "$iconset_dir/icon_512x512.png" >/dev/null
  cp "$normalized_png" "$iconset_dir/icon_512x512@2x.png"

  iconutil -c icns "$iconset_dir" -o "$output_icns"
  rm -rf "$iconset_tmp"
}

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "Icon source not found: $SOURCE_ICON" >&2
  exit 1
fi

ICON_APP="$BRANDING_DIR/firefox.icns"
ICON_DMG="$BRANDING_DIR/disk.icns"
APP_SRC="$DIST_DIR/Mongrel.app"
IDENTITY="$(resolve_codesign_identity)"

RELEASE_BASE="$TODAY"
ENTITLEMENTS_FILE=""

case "$SIGNING_MODE" in
  standard)
    ENTITLEMENTS_FILE="$SCRIPT_DIR/mongrel-dogfood.entitlements"
    if [[ "$IDENTITY" == "-" ]]; then
      echo "[WARN] Standard mode is ad-hoc signed. Touch ID/platform passkeys are unavailable in this build."
      echo "[WARN] Use MONGREL_SIGNING_MODE=touchid or MONGREL_SIGNING_MODE=appstore with a real Apple signing identity for passkey testing."
    fi
    ;;
  touchid)
    if [[ "$IDENTITY" == "-" ]]; then
      echo "ERROR: Touch ID mode requires a real Apple signing identity (MONGREL_CODESIGN_IDENTITY)." >&2
      exit 2
    fi
    if [[ -z "$TOUCHID_ENTITLEMENTS_FILE" ]]; then
      echo "ERROR: Touch ID mode requires MONGREL_TOUCHID_ENTITLEMENTS pointing to an entitlement plist." >&2
      exit 2
    fi
    ENTITLEMENTS_FILE="$TOUCHID_ENTITLEMENTS_FILE"
    if [[ ! -f "$ENTITLEMENTS_FILE" ]]; then
      echo "ERROR: Touch ID entitlement file not found: $ENTITLEMENTS_FILE" >&2
      exit 2
    fi
    if ! plist_has_key "$ENTITLEMENTS_FILE" "com.apple.developer.web-browser.public-key-credential"; then
      echo "ERROR: Touch ID entitlement file missing com.apple.developer.web-browser.public-key-credential" >&2
      exit 2
    fi
    if ! plist_has_key "$ENTITLEMENTS_FILE" "com.apple.application-identifier"; then
      echo "ERROR: Touch ID entitlement file missing com.apple.application-identifier" >&2
      exit 2
    fi
    RELEASE_BASE="$TODAY-touchid"
    ;;
  appstore)
    if [[ "$IDENTITY" == "-" ]]; then
      echo "ERROR: App Store mode requires a real signing identity (MONGREL_CODESIGN_IDENTITY)." >&2
      echo "       Expected: '3rd Party Mac Developer Application: ...'" >&2
      exit 2
    fi
    if [[ "$IDENTITY" != *"3rd Party Mac Developer Application"* ]]; then
      echo "ERROR: App Store mode requires identity containing '3rd Party Mac Developer Application'." >&2
      echo "       Got: $IDENTITY" >&2
      exit 2
    fi
    if [[ -z "$APPSTORE_ENTITLEMENTS_FILE" ]]; then
      echo "ERROR: App Store mode requires MONGREL_APPSTORE_ENTITLEMENTS pointing to an entitlement plist." >&2
      exit 2
    fi
    ENTITLEMENTS_FILE="$APPSTORE_ENTITLEMENTS_FILE"
    if [[ ! -f "$ENTITLEMENTS_FILE" ]]; then
      echo "ERROR: App Store entitlement file not found: $ENTITLEMENTS_FILE" >&2
      exit 2
    fi
    if ! plist_has_key "$ENTITLEMENTS_FILE" "com.apple.developer.web-browser.public-key-credential"; then
      echo "ERROR: App Store entitlement file missing com.apple.developer.web-browser.public-key-credential" >&2
      exit 2
    fi
    if ! plist_has_key "$ENTITLEMENTS_FILE" "com.apple.application-identifier"; then
      echo "ERROR: App Store entitlement file missing com.apple.application-identifier" >&2
      exit 2
    fi
    if [[ -z "$EMBEDDED_PROVISIONPROFILE" ]]; then
      echo "ERROR: App Store mode requires MONGREL_EMBEDDED_PROVISIONPROFILE pointing to a .provisionprofile." >&2
      exit 2
    fi
    if [[ ! -f "$EMBEDDED_PROVISIONPROFILE" ]]; then
      echo "ERROR: Provisioning profile not found: $EMBEDDED_PROVISIONPROFILE" >&2
      exit 2
    fi
    RELEASE_BASE="$TODAY-appstore"
    ;;
  *)
    echo "ERROR: Unknown MONGREL_SIGNING_MODE='$SIGNING_MODE' (expected: standard|touchid|appstore)." >&2
    exit 2
    ;;
esac

RELEASE_LABEL="$(next_release_label "$RELEASE_BASE")"
RELEASE_DIR="$REPO_DIR/release-dogfood-$RELEASE_LABEL"
ZIP_NAME="Mongrel-Dogfood-$RELEASE_LABEL.app.zip"
DMG_NAME="Mongrel-Dogfood-$RELEASE_LABEL.dmg"
README_PATH="$RELEASE_DIR/README_DOGFOOD.md"
SHA_PATH="$RELEASE_DIR/SHA256SUMS.txt"

STAGE_DIR="$(mktemp -d /tmp/mongrel-release.XXXXXX)"
APP_STAGE="$STAGE_DIR/Mongrel.app"
DMG_STAGE_ROOT="$STAGE_DIR/dmg-root"

# Do not mkdir "$RELEASE_DIR" until packaging/signing succeeds; otherwise an
# interrupted mach build leaves an empty release-dogfood-* directory (confusing
# and breaks next_release_label assumptions).
mkdir -p "$DMG_STAGE_ROOT"

echo "Generating Mongrel icon assets from: $SOURCE_ICON"
generate_icns "$SOURCE_ICON" "$ICON_APP"
cp "$ICON_APP" "$ICON_DMG"

MACH_PY="${MONGREL_PYTHON:-python3}"

if [[ "${MONGREL_SKIP_BUILD:-0}" == "1" ]]; then
  echo "[INFO] MONGREL_SKIP_BUILD=1 — using existing dist app (no mach build/package)"
else
  if [[ "${MONGREL_SKIP_FETCH_ADDONS:-0}" != "1" && -x "$REPO_DIR/tools/fetch-distro-addons.sh" ]]; then
    echo "Refreshing distribution extensions (AMO)…"
    "$REPO_DIR/tools/fetch-distro-addons.sh" || echo "[WARN] fetch-distro-addons.sh failed (offline?); continuing with existing XPIs"
  fi
  echo "Building updated app and package ($MACH_PY mach …)"
  "$MACH_PY" "$REPO_DIR/mach" build faster
  "$MACH_PY" "$REPO_DIR/mach" package
fi

if [[ ! -d "$APP_SRC" ]]; then
  if [[ -d "$DIST_DIR/Nightly.app" ]]; then
    APP_SRC="$DIST_DIR/Nightly.app"
    echo "[INFO] Staging from $APP_SRC (legacy Nightly branding)"
  elif [[ -d "$DIST_DIR/Firefox.app" ]]; then
    APP_SRC="$DIST_DIR/Firefox.app"
    echo "[INFO] Staging from $APP_SRC (Firefox bundle name)"
  else
    echo "Expected app not found: $DIST_DIR/Mongrel.app (or Nightly.app / Firefox.app)" >&2
    exit 1
  fi
fi

echo "Staging self-contained app bundle"
copy_app_resolved "$APP_SRC" "$APP_STAGE"

# Strip the precompiled Assets.car so macOS uses our regenerated firefox.icns
# (the Mongrel orb) instead of the baked-in upstream Firefox/Nightly fox.
# CFBundleIconName has also been removed from Info.plist.in; this is the
# matching cleanup on the staged bundle in case Assets.car was packaged
# anyway. Safe to ignore if it isn't present.
if [[ -f "$APP_STAGE/Contents/Resources/Assets.car" ]]; then
  echo "Removing upstream Assets.car so Mongrel orb (firefox.icns) wins"
  rm -f "$APP_STAGE/Contents/Resources/Assets.car"
fi

echo "Applying dogfood prefs patch to staged app"
patch_app_prefs "$APP_STAGE"

echo "Signing app with identity: $IDENTITY"
if [[ "$SIGNING_MODE" == "appstore" ]]; then
  echo "Embedding provisioning profile: $EMBEDDED_PROVISIONPROFILE"
  cp "$EMBEDDED_PROVISIONPROFILE" "$APP_STAGE/Contents/embedded.provisionprofile"
  codesign --force --deep --options runtime --timestamp --sign "$IDENTITY" --entitlements "$ENTITLEMENTS_FILE" "$APP_STAGE"
elif [[ "$IDENTITY" == "-" ]]; then
  codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_FILE" "$APP_STAGE"
else
  codesign --force --deep --options runtime --timestamp=none --sign "$IDENTITY" --entitlements "$ENTITLEMENTS_FILE" "$APP_STAGE"
fi
codesign -dv --verbose=2 "$APP_STAGE" >/dev/null 2>&1 || true

if [[ "$SIGNING_MODE" == "touchid" || "$SIGNING_MODE" == "appstore" ]]; then
  SIGN_META="$(codesign -dv --verbose=4 "$APP_STAGE" 2>&1 || true)"
  SIGN_TEAM="$(echo "$SIGN_META" | sed -n 's/^TeamIdentifier=//p' | head -n 1)"

  if echo "$SIGN_META" | grep -q 'Signature=adhoc'; then
    echo "ERROR: $SIGNING_MODE mode produced ad-hoc signature; platform passkeys will not work." >&2
    exit 2
  fi
  if echo "$SIGN_META" | grep -q 'TeamIdentifier=not set'; then
    echo "ERROR: $SIGNING_MODE mode produced signature without TeamIdentifier; platform passkeys will not work." >&2
    exit 2
  fi

  EFFECTIVE_ENT="$(mktemp /tmp/mongrel-entitlements-effective.XXXXXX)"
  codesign -d --entitlements :- "$APP_STAGE" >"$EFFECTIVE_ENT" 2>&1 || true
  if ! plist_has_key "$EFFECTIVE_ENT" "com.apple.developer.web-browser.public-key-credential"; then
    rm -f "$EFFECTIVE_ENT"
    echo "ERROR: Signed app is missing com.apple.developer.web-browser.public-key-credential entitlement." >&2
    exit 2
  fi
  APP_IDENTIFIER="$(perl -0777 -ne 'if (/<key>com.apple.application-identifier<\/key>\s*<string>([^<]+)<\/string>/s) { print $1; }' "$EFFECTIVE_ENT")"
  if [[ -n "$SIGN_TEAM" && -n "$APP_IDENTIFIER" && "$APP_IDENTIFIER" != "$SIGN_TEAM".* ]]; then
    rm -f "$EFFECTIVE_ENT"
    echo "ERROR: Entitlement application-identifier ($APP_IDENTIFIER) does not match signed TeamIdentifier ($SIGN_TEAM)." >&2
    exit 2
  fi
  rm -f "$EFFECTIVE_ENT"

  if [[ "$SIGNING_MODE" == "appstore" ]]; then
    if [[ ! -f "$APP_STAGE/Contents/embedded.provisionprofile" ]]; then
      echo "ERROR: embedded.provisionprofile missing from signed bundle; codesign may have stripped it." >&2
      exit 2
    fi
    echo "[OK]   embedded.provisionprofile present in signed bundle"
  fi
fi

mkdir -p "$RELEASE_DIR"

ditto "$APP_STAGE" "$DMG_STAGE_ROOT/Mongrel.app"

echo "Creating ZIP artifact"
ditto -c -k --sequesterRsrc --keepParent "$APP_STAGE" "$RELEASE_DIR/$ZIP_NAME"

echo "Creating DMG artifact"
hdiutil create -volname "Mongrel Dogfood" -srcfolder "$DMG_STAGE_ROOT" -ov -format UDZO "$RELEASE_DIR/$DMG_NAME" >/dev/null

if [[ "$SIGNING_MODE" == "touchid" ]]; then
  SIGNING_README_EXTRA="- This build was signed in **touchid** mode with identity \`$IDENTITY\` and includes \`com.apple.developer.web-browser.public-key-credential\` (required for macOS platform passkeys / Touch ID).
- You still need a provisioning profile that allows that entitlement if macOS refuses to launch the app (AMFI)."
elif [[ "$SIGNING_MODE" == "appstore" ]]; then
  SIGNING_README_EXTRA="- This build was signed in **appstore** mode with identity \`$IDENTITY\` using a secure timestamp (\`codesign --timestamp\`).
- \`embedded.provisionprofile\` is embedded in the bundle (required for Mac App Store–style AMFI validation).
- Includes \`com.apple.developer.web-browser.public-key-credential\` for macOS platform passkeys / Touch ID.
- App Sandbox and App Store Connect submission are separate steps not covered by this script; see \`tools/APPLE_DISTRIBUTION.md\`."
else
  SIGNING_README_EXTRA='- **Standard** mode does not include the platform passkey entitlement; Touch ID for WebAuthn will not run. Use `MONGREL_SIGNING_MODE=touchid` plus `tools/prepare-touchid-entitlements.sh` for passkey testing, or `MONGREL_SIGNING_MODE=appstore` for Mac App Store–style signing.
- Default codesign identity `-` is ad-hoc; use `MONGREL_CODESIGN_IDENTITY` for a real Apple Development certificate when you need stable Gatekeeper behavior.'
fi

cat > "$README_PATH" <<EORD
# Mongrel Dogfood Build ($RELEASE_LABEL)

This folder contains the recommended build for multi-day dogfooding.

## Artifacts

- $DMG_NAME
- $ZIP_NAME
- SHA256SUMS.txt

## Verify

Run:

  cd release-dogfood-$RELEASE_LABEL
  shasum -a 256 -c SHA256SUMS.txt

Expected result: both artifacts report OK.

## Install

1. Open $DMG_NAME.
2. Drag Mongrel.app into Applications.
3. First launch: right-click app, then select Open.

## Signing

- Mode: $SIGNING_MODE
- Identity used: $IDENTITY
$SIGNING_README_EXTRA
- Touch ID release command:
  MONGREL_SIGNING_MODE=touchid MONGREL_CODESIGN_IDENTITY="Your Apple Development Cert" MONGREL_TOUCHID_ENTITLEMENTS="/path/to/entitlements.plist" ./tools/mongrel-dogfood-release.sh
- App Store–style release command:
  MONGREL_SIGNING_MODE=appstore MONGREL_CODESIGN_IDENTITY="3rd Party Mac Developer Application: ..." MONGREL_EMBEDDED_PROVISIONPROFILE="/path/to/profile.provisionprofile" MONGREL_APPSTORE_ENTITLEMENTS="/path/to/appstore.entitlements.plist" ./tools/mongrel-dogfood-release.sh
- Generate entitlements (touchid):  \`./tools/prepare-touchid-entitlements.sh --identity "..."\`
- Generate entitlements (appstore): \`./tools/prepare-appstore-entitlements.sh --identity "3rd Party Mac Developer Application: ..."\`
- If you use a real local signing certificate and its Keychain ACL is configured correctly, macOS trust should be more stable across rebuilds.
- macOS keychain access still cannot be silently pre-approved by the app.

## Icon Source

- Source PNG: ${SOURCE_ICON#$REPO_DIR/}
- Generated app icon: browser/branding/unofficial/firefox.icns
- Generated disk icon: browser/branding/unofficial/disk.icns
EORD

(cd "$RELEASE_DIR" && shasum -a 256 "$DMG_NAME" "$ZIP_NAME" > "$SHA_PATH")

smoke_test_release "$APP_STAGE" || echo "[WARN] Smoke test reported failures — release artifacts still saved."

echo
echo "Dogfood release created: $RELEASE_DIR"
echo "DMG: $RELEASE_DIR/$DMG_NAME"
echo "ZIP: $RELEASE_DIR/$ZIP_NAME"
