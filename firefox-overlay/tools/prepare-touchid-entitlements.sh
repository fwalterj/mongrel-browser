#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_OUTPUT="$SCRIPT_DIR/mongrel-touchid.entitlements.local.plist"

IDENTITY="${MONGREL_CODESIGN_IDENTITY:-}"
TEAM_ID="${MONGREL_TEAM_ID:-}"
BUNDLE_ID="${MONGREL_BUNDLE_ID:-}"
OUTPUT_PATH="${MONGREL_TOUCHID_ENTITLEMENTS:-$DEFAULT_OUTPUT}"

usage() {
  echo "Usage: $0 [--identity \"Apple Development: Name (TEAMID)\"] [--team-id TEAMID] [--bundle-id BUNDLE_ID] [--output /abs/path/file.plist]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --identity)
      IDENTITY="${2:-}"
      shift 2
      ;;
    --team-id)
      TEAM_ID="${2:-}"
      shift 2
      ;;
    --bundle-id)
      BUNDLE_ID="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

if [[ -z "$IDENTITY" ]]; then
  echo "ERROR: Missing signing identity. Provide --identity or set MONGREL_CODESIGN_IDENTITY." >&2
  exit 2
fi

if [[ -z "$TEAM_ID" ]]; then
  if [[ "$IDENTITY" =~ \(([A-Z0-9]{10})\)$ ]]; then
    TEAM_ID="${BASH_REMATCH[1]}"
  fi
fi

if [[ -z "$TEAM_ID" ]]; then
  echo "ERROR: Could not infer Team ID from identity. Provide --team-id explicitly." >&2
  exit 2
fi

if [[ -z "$BUNDLE_ID" ]]; then
  APP_INFO="/Applications/Mongrel.app/Contents/Info.plist"
  if [[ -f "$APP_INFO" ]]; then
    BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_INFO" 2>/dev/null || true)"
  fi
fi

if [[ -z "$BUNDLE_ID" ]]; then
  BUNDLE_ID="com.mongrel.browser"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

cat > "$OUTPUT_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.device.camera</key>
  <true/>
  <key>com.apple.security.smartcard</key>
  <true/>
  <key>com.apple.application-identifier</key>
  <string>${TEAM_ID}.${BUNDLE_ID}</string>
  <key>com.apple.developer.web-browser.public-key-credential</key>
  <true/>
</dict>
</plist>
EOF

echo "Wrote Touch ID entitlement plist: $OUTPUT_PATH"
echo "Team ID: $TEAM_ID"
echo "Bundle ID: $BUNDLE_ID"
echo "Application Identifier: ${TEAM_ID}.${BUNDLE_ID}"
