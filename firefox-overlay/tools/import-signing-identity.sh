#!/usr/bin/env bash
# Import the Mongrel signing identity (cert + private key) into the login
# keychain on this Mac so codesign can use it for `MONGREL_SIGNING_MODE=touchid`
# or `MONGREL_SIGNING_MODE=appstore` dogfood builds.
#
# Run once per machine. Run again only when:
#   - the cert has been re-issued by Apple, or
#   - the keychain has been cleared.
#
# Usage:
#   ./tools/import-signing-identity.sh                 # uses repo-root Certificates.p12
#   ./tools/import-signing-identity.sh /path/to/x.p12  # uses an explicit .p12 path
#
# You will be prompted for the .p12 export password by the macOS `security`
# tool. (The password is NOT logged or saved by this script.)
#
# Optional env vars:
#   MONGREL_P12_PATH   Path to the .p12. Defaults to <repo-root>/Certificates.p12
#   MONGREL_KEYCHAIN   Target keychain. Defaults to the login keychain.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
P12_PATH="${1:-${MONGREL_P12_PATH:-$REPO_ROOT/Certificates.p12}}"
KEYCHAIN="${MONGREL_KEYCHAIN:-}"

if [[ ! -f "$P12_PATH" ]]; then
  echo "ERROR: .p12 not found at: $P12_PATH" >&2
  echo "       Place Certificates.p12 at the repo root, or pass an explicit path." >&2
  exit 2
fi

if [[ -z "$KEYCHAIN" ]]; then
  KEYCHAIN="$(security default-keychain | tr -d '\n "')"
fi

echo "==> Importing identity"
echo "    from: $P12_PATH"
echo "    into: $KEYCHAIN"
echo

# -A allows codesign and other Apple tools to use the key without per-call
# Keychain prompts. The first interactive codesign run may still trigger
# a one-time "Always Allow" dialog; click it once and subsequent signs are
# silent.
#
# `security import` will prompt interactively for the .p12 password if -P
# is not provided. We intentionally do NOT accept the password as an arg;
# pass it interactively when prompted.
security import "$P12_PATH" -k "$KEYCHAIN" -t cert -f pkcs12 \
  -T /usr/bin/codesign \
  -T /usr/bin/productsign \
  -T /usr/bin/security \
  -A

echo
echo "==> Identities now visible to codesign:"
security find-identity -v -p codesigning "$KEYCHAIN"
echo

echo "Done. Suggested next step:"
echo
cat <<'EOF'
  # Generate a Touch ID entitlement plist scoped to the imported identity:
  ./tools/prepare-touchid-entitlements.sh \
      --identity "Apple Development: Your Name (TEAMID)"

  # Then a signed dogfood release:
  MONGREL_SIGNING_MODE=touchid \
  MONGREL_CODESIGN_IDENTITY="Apple Development: Your Name (TEAMID)" \
  MONGREL_TOUCHID_ENTITLEMENTS="$(pwd)/tools/mongrel-touchid.entitlements.local.plist" \
  ./tools/mongrel-dogfood-release.sh
EOF
