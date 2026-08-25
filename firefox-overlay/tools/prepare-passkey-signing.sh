#!/usr/bin/env bash

set -euo pipefail

PASSKEY_ENTITLEMENT="com.apple.developer.web-browser.public-key-credential"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_PATH="${MONGREL_PROVISIONING_PROFILE:-}"
BUNDLE_ID="${MONGREL_BUNDLE_ID:-com.mongrel.browser}"
OUTPUT_PATH="${MONGREL_PASSKEY_ENTITLEMENTS:-$SCRIPT_DIR/mongrel-passkey.entitlements.local.plist}"

usage() {
  cat <<'EOF'
Usage: prepare-passkey-signing.sh --profile /path/to/profile.provisionprofile [options]

Options:
  --bundle-id ID       Expected bundle identifier (default: com.mongrel.browser)
  --output PATH        Generated signing entitlements plist
  -h, --help           Show this help

The profile must already contain Apple's managed macOS browser passkey
capability. This script validates that grant; it cannot create or bypass it.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE_PATH="${2:-}"
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
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$PROFILE_PATH" || ! -f "$PROFILE_PATH" ]]; then
  printf 'ERROR: --profile must point to an Apple provisioning profile.\n' >&2
  exit 2
fi

profile_plist="$(mktemp /tmp/mongrel-passkey-profile.XXXXXX)"
trap 'rm -f "$profile_plist"' EXIT

if ! security cms -D -i "$PROFILE_PATH" >"$profile_plist" 2>/dev/null; then
  printf 'ERROR: Could not decode provisioning profile: %s\n' "$PROFILE_PATH" >&2
  exit 2
fi

if ! /usr/libexec/PlistBuddy -c "Print :Entitlements:$PASSKEY_ENTITLEMENT" "$profile_plist" 2>/dev/null | grep -qx 'true'; then
  printf 'ERROR: The profile does not authorize %s.\n' "$PASSKEY_ENTITLEMENT" >&2
  printf '       Request/enable the managed capability for this App ID, then regenerate the profile.\n' >&2
  exit 2
fi

profile_application_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$profile_plist" 2>/dev/null || true)"
team_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.developer.team-identifier' "$profile_plist" 2>/dev/null || true)"

if [[ -z "$profile_application_id" ]]; then
  printf 'ERROR: The profile has no com.apple.application-identifier.\n' >&2
  exit 2
fi

case "$profile_application_id" in
  *".$BUNDLE_ID")
    application_id="$profile_application_id"
    ;;
  *".*")
    application_id="${profile_application_id%.*}.$BUNDLE_ID"
    ;;
  *)
    printf 'ERROR: Profile application identifier %s does not cover bundle ID %s.\n' "$profile_application_id" "$BUNDLE_ID" >&2
    exit 2
    ;;
esac

mkdir -p "$(dirname "$OUTPUT_PATH")"

{
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.application-identifier</key>
  <string>${application_id}</string>
EOF
  if [[ -n "$team_id" ]]; then
    cat <<EOF
  <key>com.apple.developer.team-identifier</key>
  <string>${team_id}</string>
EOF
  fi
  cat <<EOF
  <key>${PASSKEY_ENTITLEMENT}</key>
  <true/>
</dict>
</plist>
EOF
} >"$OUTPUT_PATH"

plutil -lint "$OUTPUT_PATH" >/dev/null
printf 'Wrote profile-backed passkey entitlements: %s\n' "$OUTPUT_PATH"
printf 'Profile allows application identifier: %s\n' "$profile_application_id"
printf 'Signed application identifier: %s\n' "$application_id"
printf 'Bundle identifier: %s\n' "$BUNDLE_ID"
