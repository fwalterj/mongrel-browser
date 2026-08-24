#!/bin/sh
set -eu

usage() {
  printf '%s\n' "Usage: $0 /absolute/path/to/firefox-source --check|--write"
}

if [ "$#" -ne 2 ]; then
  usage >&2
  exit 64
fi

target=$1
mode=$2

case "$mode" in
  --check|--write) ;;
  *)
    usage >&2
    exit 64
    ;;
esac

if [ ! -d "$target" ]; then
  printf 'Target is not a directory: %s\n' "$target" >&2
  exit 66
fi

case "$target" in
  /*) ;;
  *)
    printf 'Use an absolute target path.\n' >&2
    exit 64
    ;;
esac

target=$(cd "$target" && pwd -P)
script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
repo_root=$(dirname "$script_dir")
overlay="$repo_root/firefox-overlay"
milestone_file="$target/config/milestone.txt"

if [ ! -f "$milestone_file" ] || [ ! -x "$target/mach" ]; then
  printf 'Target does not look like a Firefox source root: %s\n' "$target" >&2
  exit 65
fi

milestone=$(sed -n '/^[0-9][0-9.]*[a-z0-9+]*$/p' "$milestone_file" | head -n 1)
if [ "$milestone" != "152.0a1" ]; then
  printf 'Refusing overlay: expected Firefox milestone 152.0a1, found %s.\n' "${milestone:-unknown}" >&2
  exit 65
fi

count=0
replaced=0
added=0

find "$overlay" -type f ! -name README.md | sort | while IFS= read -r source; do
  relative=${source#"$overlay"/}
  destination="$target/$relative"
  if [ -e "$destination" ]; then
    action=replace
  else
    action=add
  fi
  printf '%-7s %s\n' "$action" "$relative"

  if [ "$mode" = "--write" ]; then
    destination_dir=$(dirname "$destination")
    mkdir -p "$destination_dir"
    cp -p "$source" "$destination"
  fi
done

if [ "$mode" = "--check" ]; then
  printf '\nDry run only. Re-run with --write to copy the listed files.\n'
else
  printf '\nOverlay applied to %s\n' "$target"
  printf 'Review the target diff before bootstrapping or building.\n'
fi
