#!/bin/sh
set -eu

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
repo_root=$(dirname "$script_dir")
cd "$repo_root"

failed=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failed=1
}

printf 'Checking prohibited artifact and credential types...\n'
forbidden=$(find . -type f \( \
  -name '*.cer' -o -name '*.p12' -o -name '*.p8' -o \
  -name '*.provisionprofile' -o -name '*.mobileprovision' -o \
  -name '*.dmg' -o -name '*.zip' -o -name '*.key' -o -name '*.pem' \
\) -print)
if [ -n "$forbidden" ]; then
  printf '%s\n' "$forbidden" >&2
  fail 'prohibited artifacts are present'
fi

printf 'Checking repository file sizes...\n'
oversized=$(find . -type f -size +25M -print)
if [ -n "$oversized" ]; then
  printf '%s\n' "$oversized" >&2
  fail 'files over 25 MiB are present; publish binaries as release assets'
fi

printf 'Checking for obvious secret material...\n'
if LC_ALL=C grep -RIlE \
  --exclude-dir=.git \
  --exclude='verify-repository.sh' \
  '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})' . >/tmp/mongrel-secret-hits.txt; then
  sed -n '1,40p' /tmp/mongrel-secret-hits.txt >&2
  fail 'possible secret material detected'
fi

printf 'Checking for developer-specific absolute home paths...\n'
if LC_ALL=C grep -RIlE \
  --exclude-dir=.git \
  --exclude='verify-repository.sh' \
  '/(Users|home)/[A-Za-z0-9._-]+/' . >/tmp/mongrel-path-hits.txt; then
  sed -n '1,40p' /tmp/mongrel-path-hits.txt >&2
  fail 'developer-specific absolute paths detected'
fi

printf 'Checking for known private development identifiers...\n'
if LC_ALL=C grep -RIlEi \
  --exclude-dir=.git \
  --exclude='verify-repository.sh' \
  '(frederick james|8JMMK9U459|XFMK3QMQLT)' . >/tmp/mongrel-identity-hits.txt; then
  sed -n '1,40p' /tmp/mongrel-identity-hits.txt >&2
  fail 'private development identifiers detected'
fi

printf 'Checking shell syntax...\n'
find scripts firefox-overlay/tools -type f -name '*.sh' -print | while IFS= read -r script; do
  if sed -n '1p' "$script" | grep -q 'bash'; then
    bash -n "$script" || exit 1
  else
    sh -n "$script" || exit 1
  fi
done || fail 'shell syntax check failed'

printf 'Checking MPL headers on Mongrel JavaScript modules...\n'
find firefox-overlay/browser/components -type f \( -name '*.js' -o -name '*.mjs' \) -print | while IFS= read -r source; do
  if ! sed -n '1,8p' "$source" | grep -Eq 'This Source Code Form|dedicated to the Public Domain'; then
    printf '%s\n' "$source" >&2
    exit 1
  fi
done || fail 'a Mongrel component module is missing an MPL header'

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'Checking Git whitespace...\n'
  git diff --check || fail 'Git whitespace errors found'
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

printf 'Repository checks passed.\n'
