# Phase 5 Benchmark: Accessibility Subsystem Removal

Date: 2026-03-22
Branch: main
Base: Firefox ESR 128, Atlas Alpha fork
Platform: macOS Apple Silicon (arm64, M2), macOS 26.2

---

## Summary

This phase disables build-time accessibility support by turning off the upstream
`ACCESSIBILITY` configure option in `mozconfig`.

This removes the main `accessible/` compile tree from the build and leaves only
the `accessible/ipc` fallback path that upstream uses when accessibility is
disabled.

Flag forced off:
- `--disable-accessibility`

---

## Configuration Change

File: mozconfig

Before:
- `ac_add_options --disable-webrtc`

After:
- `ac_add_options --disable-webrtc`
- `ac_add_options --disable-accessibility`

Notes:
- upstream configure switch lives in `toolkit/moz.configure`
- `toolkit/toolkit.mozbuild` gates `/accessible` behind `CONFIG["ACCESSIBILITY"]`
- when accessibility is off, build falls back to `/accessible/ipc` only

---

## Build Validation

| Setting | Value |
|---|---|
| Build type | Incremental (`mozconfig` change) |
| Build duration | ~33m 11s |
| Build exit code | 0 |

Build log: /tmp/mongrel-phase5-a11y-build.log

---

## Regression Tests

| Result | Count |
|---|---|
| Passed | 28 |
| Failed | 0 |
| Todo | 0 |

Status: PASS - no regressions

Test log: /tmp/mongrel-phase5-xpcshell.log

---

## Decision Log

- Change set: Phase 5 - Accessibility compile-time removal
- Components removed: main `accessible/` subtree via `--disable-accessibility`
- Motivation: reduce binary surface area, background subsystem complexity, and memory overhead in a personal build with no assistive technology requirement
- Risk: moderate - removes platform accessibility integration entirely, including support for VoiceOver and other assistive technologies
- Observed build result: successful incremental rebuild and green regression suite
- Regressions: none detected in the retained `browser/extensions/newtab` xpcshell suite
- Keep/Revert decision: KEEP for personal-use builds only
- Disk footprint: 270 MB `Nightly.app` (down from 274 MB at Phase 4, −4 MB)
- Notes:
  - this is a real usability regression for AT users and should not ship to a general audience
  - the project doc explicitly listed accessibility among candidate strip targets for the personal browser goal
  - this phase was intentionally validated after Phases 2 through 4 were already green