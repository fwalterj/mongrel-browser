#!/usr/bin/env bash

set -u

PASSKEY_ENTITLEMENT="com.apple.developer.web-browser.public-key-credential"
APP_PATH=""
SOURCE_ROOT=""
bundle_id=""
signed_app_id=""
failures=0
warnings=0

usage() {
  cat <<'EOF'
Usage: mongrel-passkey-audit.sh /path/to/Mongrel.app [--source-root /path/to/firefox]

Audits the signed app bundle gates that must be open before macOS can present
the platform passkey / Touch ID authorization sheet. This does not perform a
WebAuthn ceremony or change system authorization state.
EOF
}

ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf '[FAIL] %s\n' "$1" >&2; failures=$((failures + 1)); }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-root)
      SOURCE_ROOT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$APP_PATH" ]]; then
        printf 'Only one app bundle may be audited.\n' >&2
        exit 2
      fi
      APP_PATH="$1"
      shift
      ;;
  esac
done

if [[ -z "$APP_PATH" || ! -d "$APP_PATH/Contents" ]]; then
  usage >&2
  exit 2
fi

for tool in codesign security plutil; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Required macOS tool is unavailable: %s\n' "$tool" >&2
    exit 2
  fi
done

tmp_dir="$(mktemp -d /tmp/mongrel-passkey-audit.XXXXXX)"
trap 'rm -rf "$tmp_dir"' EXIT

info_plist="$APP_PATH/Contents/Info.plist"
entitlements_plist="$tmp_dir/effective-entitlements.plist"
profile_plist="$tmp_dir/profile.plist"

printf 'Mongrel passkey readiness audit\n'
printf 'App: %s\n\n' "$APP_PATH"

if [[ ! -f "$info_plist" ]]; then
  fail 'Contents/Info.plist is missing.'
else
  bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist" 2>/dev/null || true)"
  if [[ -n "$bundle_id" ]]; then
    ok "Bundle identifier: $bundle_id"
  else
    fail 'CFBundleIdentifier is missing.'
  fi

  info_xml="$(plutil -convert xml1 -o - "$info_plist" 2>/dev/null || true)"
  if grep -q '<string>http</string>' <<<"$info_xml" &&
     grep -q '<string>https</string>' <<<"$info_xml"; then
    ok 'Info.plist declares both HTTP and HTTPS URL schemes.'
  else
    fail 'Apple requires browser candidates to declare HTTP and HTTPS URL schemes.'
  fi
fi

signing_meta="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1 || true)"
if grep -q '^Signature=adhoc$' <<<"$signing_meta"; then
  fail 'The app is ad-hoc signed. The managed browser credential capability cannot be authorized this way.'
else
  ok 'The outer app signature is not ad hoc.'
fi

team_id="$(sed -n 's/^TeamIdentifier=//p' <<<"$signing_meta" | head -n 1)"
if [[ -z "$team_id" || "$team_id" == 'not set' ]]; then
  fail 'The signature has no TeamIdentifier.'
else
  ok "Signature TeamIdentifier: $team_id"
fi

if codesign -d --entitlements :- "$APP_PATH" >"$entitlements_plist" 2>/dev/null &&
   plutil -lint "$entitlements_plist" >/dev/null 2>&1; then
  if /usr/libexec/PlistBuddy -c "Print :$PASSKEY_ENTITLEMENT" "$entitlements_plist" 2>/dev/null | grep -qx 'true'; then
    ok "Effective signature contains $PASSKEY_ENTITLEMENT=true."
  else
    fail "Effective signature is missing $PASSKEY_ENTITLEMENT=true. Gecko will reject the macOS backend before creating ASAuthorizationController."
  fi
  signed_app_id="$(/usr/libexec/PlistBuddy -c 'Print :com.apple.application-identifier' "$entitlements_plist" 2>/dev/null || true)"
  if [[ -n "$signed_app_id" ]]; then
    ok "Effective application identifier: $signed_app_id"
  else
    fail 'Effective signature has no com.apple.application-identifier.'
  fi
else
  fail 'Could not read a valid entitlement plist from the app signature.'
fi

profile="$APP_PATH/Contents/embedded.provisionprofile"
if [[ -f "$profile" ]]; then
  if security cms -D -i "$profile" >"$profile_plist" 2>/dev/null; then
    if /usr/libexec/PlistBuddy -c "Print :Entitlements:$PASSKEY_ENTITLEMENT" "$profile_plist" 2>/dev/null | grep -qx 'true'; then
      ok 'Embedded provisioning profile authorizes the browser passkey entitlement.'
    else
      fail 'The embedded provisioning profile does not authorize the browser passkey entitlement.'
    fi

    profile_app_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$profile_plist" 2>/dev/null || true)"
    if [[ -n "$profile_app_id" ]]; then
      ok "Provisioned application identifier: $profile_app_id"
      case "$profile_app_id" in
        *".$bundle_id"|*".*")
          ok 'Provisioning profile covers the packaged bundle identifier.'
          ;;
        *)
          fail 'Provisioning profile does not cover the packaged bundle identifier.'
          ;;
      esac
    else
      fail 'The provisioning profile has no com.apple.application-identifier.'
    fi

    if [[ -n "$team_id" && -n "$bundle_id" && -n "$signed_app_id" ]]; then
      expected_app_id="$team_id.$bundle_id"
      if [[ "$signed_app_id" == "$expected_app_id" ]]; then
        ok 'Effective application identifier matches the signature team and bundle identifier.'
      else
        fail "Effective application identifier should be $expected_app_id."
      fi
    fi
  else
    fail 'The embedded provisioning profile could not be decoded.'
  fi
else
  fail 'No embedded.provisionprofile is present to prove Apple authorized the managed capability for this App ID and distribution method.'
fi

if codesign --verify --deep --strict --verbose=2 "$APP_PATH" >/dev/null 2>&1; then
  ok 'The app passes deep, strict code-signature verification.'
else
  fail 'The app fails deep, strict code-signature verification.'
fi

if [[ -z "$SOURCE_ROOT" ]]; then
  candidate_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [[ -f "$candidate_root/modules/libpref/init/StaticPrefList.yaml" ]]; then
    SOURCE_ROOT="$candidate_root"
  fi
fi

if [[ -n "$SOURCE_ROOT" && -f "$SOURCE_ROOT/modules/libpref/init/StaticPrefList.yaml" ]]; then
  pref_file="$SOURCE_ROOT/modules/libpref/init/StaticPrefList.yaml"
  if awk '
      /name: security\.webauthn\.enable_macos_passkeys/ { in_pref=1; next }
      in_pref && /value: true/ { found=1; exit }
      in_pref && /^- name:/ { exit }
      END { exit(found ? 0 : 1) }
    ' "$pref_file"; then
    ok 'security.webauthn.enable_macos_passkeys defaults to true in the supplied source tree.'
  else
    fail 'security.webauthn.enable_macos_passkeys is not enabled by default in the supplied source tree.'
  fi
else
  warn 'No Firefox source root was supplied; the compiled WebAuthn preference was not audited.'
fi

printf '\n'
if [[ "$failures" -gt 0 ]]; then
  printf 'NOT READY: %d blocking check(s), %d warning(s). No Touch ID sheet should be expected yet.\n' "$failures" "$warnings" >&2
  exit 2
fi

printf 'PACKAGING READY: all inspectable gates are open (%d warning(s)).\n' "$warnings"
printf 'Next: launch this exact app, grant macOS browser passkey access if asked, and run a real WebAuthn registration/assertion test.\n'
