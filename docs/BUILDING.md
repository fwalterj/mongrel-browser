# Building and reconstruction

## Read this first

This repository is a source overlay, not a vendored Gecko tree. Building requires a compatible Firefox source checkout and the full Mozilla toolchain.

The recovered working tree reports Firefox milestone `152.0a1`, but it does not contain an exact upstream revision identifier. The overlay script therefore checks the milestone, not a commit hash. That is enough to prevent obvious misuse, but not enough for a reproducible release.

## Requirements

- macOS 13 or later on Apple Silicon
- Xcode 15 or later and Command Line Tools
- Mozilla's current bootstrap prerequisites for the matching source revision
- Rust via `rustup`
- Python 3.10+ (the recovery work used Python 3.12)
- LLVM/lld compatible with the chosen Gecko snapshot
- substantial disk space for a Firefox source and object tree

Mozilla's build requirements move quickly. Consult the documentation bundled with the exact Firefox source revision rather than treating this list as authoritative forever.

## 1. Acquire a compatible Firefox tree

Use a source tree whose `config/milestone.txt` is exactly:

```text
152.0a1
```

Until an exact base revision is pinned, prefer doing this work in a disposable clone. Do not apply the overlay to a valuable or dirty Firefox checkout.

## 2. Inspect the overlay operation

From this repository:

```bash
./scripts/apply-overlay.sh /absolute/path/to/firefox-source --check
```

The check validates the target shape and milestone, then lists the files that would be replaced or added.

## 3. Apply the snapshot

```bash
./scripts/apply-overlay.sh /absolute/path/to/firefox-source --write
```

This copies `firefox-overlay/` over the target tree. Several integration points are full-file snapshots, so the operation is intentionally version-guarded.

## 4. Bootstrap and build

Follow the matching Firefox source documentation to bootstrap the host. In the recovered Mongrel environment, the canonical dogfood path was:

```bash
export MACOS_SDK_DIR="/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
./tools/mongrel-build-dogfood.sh
```

For iterative development:

```bash
./mach build
./mach build faster
./mach run
```

The historical recovery work sometimes required an explicit versioned SDK and `python3.12 mach --no-interactive build faster`. Use paths appropriate to the host rather than copying a developer-specific absolute path.

## 5. Package a development artifact

After a successful package build:

```bash
./tools/mongrel-dogfood-release.sh
```

The script can produce a ZIP, DMG, and checksum record. Its modes are deliberately narrow:

- `local` (default): build-machine dogfood; ad-hoc signing allowed
- `direct`: requires a Developer ID Application identity
- `passkey`: requires a real identity, an Apple-authorized provisioning profile, and profile-derived entitlements

Controlled releases should use Developer ID and notarization where practical; this is an off-store trust measure, not Mac App Store compliance. Signing inputs must remain environment-provided and must never be committed. See [PASSKEYS.md](PASSKEYS.md) before expecting a Touch ID prompt.

## Known build caveats

- The historic tree required source recovery and may contain assumptions not represented by this overlay alone.
- `mozconfig` is tuned for the development machine and may require linker or SDK adjustment.
- Distribution add-ons are fetched during packaging. Their source, version, and checksum should be pinned before a public release.
- The May 8 build did not include the platform passkey entitlement.
- App Store-oriented switches were removed from the active packaging script; App Store submission is no longer an architecture goal.
- A source-linked `dist/Mongrel.app` was previously found to contain broken symlinks; evaluate a self-contained packaged app.
- Old browser profiles can make startup failures look like application failures. Use a clean profile for initial validation.

## Definition of a reproducible build

Before this repository should advertise normal one-command builds, it needs:

1. an exact public Firefox revision
2. cryptographically pinned external inputs
3. a clean checkout build on a documented macOS/Xcode combination
4. recorded test results from the produced package
5. provenance for signing and release checksums

Until then, the build path is best understood as a documented reconstruction route for contributors.
