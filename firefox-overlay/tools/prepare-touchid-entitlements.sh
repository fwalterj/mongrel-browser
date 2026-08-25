#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf 'NOTE: prepare-touchid-entitlements.sh is a compatibility wrapper.\n' >&2
printf '      Passkey authorization must be derived from an Apple-issued provisioning profile.\n' >&2
exec "$SCRIPT_DIR/prepare-passkey-signing.sh" "$@"
