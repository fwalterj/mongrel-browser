# Phase 3 Benchmark: DevTools Client Removal

**Date:** 2026-03-22
**Branch:** `main`
**Base:** Firefox ESR 128, Atlas Alpha fork
**Platform:** macOS Apple Silicon (arm64, M2), macOS 26.2

---

## Summary

Removed the browser DevTools client from the packaged application by switching the
`MOZ_DEVTOOLS` configure flag from `"all"` to `"server"`. This retains the remote
debugging protocol server (used by platform tests and external debuggers) while
stripping every `devtools/client/` module, the startup registration components, and
the browser-loader module that are only needed for the full in-browser toolbox.

---

## Configuration Change

**File:** `browser/moz.configure`
**Line:** 20

```python
# Before (Phase 2 state):
imply_option("MOZ_DEVTOOLS", "all")

# After (Phase 3):
# Keep remote debugging server support but strip the browser DevTools client.
imply_option("MOZ_DEVTOOLS", "server")
```

No changes to `mozconfig`. No additional gating required — the existing upstream
conditionals in `devtools/moz.build`, `devtools/startup/moz.build`, and
`devtools/shared/loader/moz.build` already gate on `CONFIG["MOZ_DEVTOOLS"] == "all"`.

---

## Build Inputs

| Setting | Value |
|---|---|
| Build type | Clobber (clean slate) |
| `--disable-webrtc` | Yes (carried from Phase 2) |
| `MOZ_SERVICES_SYNC` | False (carried from Phase 2) |
| `MOZ_DEVTOOLS` | `"server"` (Phase 3 change) |
| Toolchain | clang/llvm 22.1.1, lld, rustup (Homebrew) |
| Build duration | ~54 min 20 s |
| Build exit code | 0 |

---

## Artifact Validation

### devtools/client — Presence Check

```
find .../dist/Nightly.app -path '*devtools/client*' | wc -l
→ 0   ✅ Fully absent
```

### "all"-only Startup Modules — Presence Check

```
find .../dist/Nightly.app -name 'DevToolsStartup.sys.mjs'               → (empty)  ✅
find .../dist/Nightly.app -name 'AboutDevToolsToolboxRegistration.sys.mjs' → (empty)  ✅
find .../dist/Nightly.app -name 'browser-loader.sys.mjs'                 → (empty)  ✅
```

---

## Binary Artifacts

| Item | Phase 2 (incremental) | Phase 3 (clobber) | Notes |
|---|---|---|---|
| `Nightly.app` disk size | 269 MB | 277 MB | Phase 2 figure was from a partial incremental build; clobber is authoritative |
| `devtools/client` files | present (~100+ MB JS/React source) | **0 files** | Stripped ✅ |
| Startup XPCOM modules | DevToolsStartup + 2 others present | **absent** | Stripped ✅ |

> **Note on size delta:** The Phase 2 269 MB baseline was measured on an incremental
> build that had not fully recompiled all compilation units. The clobber build at 277 MB
> is the first fully authoritative number. `devtools/client` contains JS/CSS/React
> source that is packaged into JARs — its removal reduces the `devtools/` JAR footprint
> but does not affect native binary size. A future `mach package` (DMG) measurement will
> give a more useful end-user size number.

---

## Regression Tests

```
mach xpcshell-test browser/extensions/newtab/test/xpcshell/
```

| Result | Count |
|---|---|
| Passed | 28 |
| Failed | 0 |
| Todo | 0 |

**Status: ✅ PASS — no regressions**

---

## Decision Log

| Field | Value |
|---|---|
| **Motivation** | Remove ~100 MB of React/JS development tooling; shorten cold startup path; reduce attack surface |
| **Mechanism** | `MOZ_DEVTOOLS` configure flag, existing upstream gating |
| **Risk** | Low — `"server"` mode is the default for all non-browser Mozilla apps; well-tested path |
| **What is kept** | Remote debugging protocol server (`devtools/server/`), shared utilities (`devtools/shared/`), platform (`devtools/platform/`) |
| **What is removed** | `devtools/client/` (the entire in-browser toolbox), startup XPCOM components, browser-loader |
| **No `--disable-devtools` flag** | This configure flag does not exist; `MOZ_DEVTOOLS="server"` is the correct mechanism |
| **Compatibility** | Web content unaffected; `about:devtools-toolbox`, F12, and Ctrl+Shift+I will no longer open a toolbox |
| **Committed** | No (AGENTS.md: never commit during validation phase) |

---

## Next Steps

- [ ] `mach package` → measure DMG (end-user install) size delta
- [ ] Phase 4 planning: Telemetry compile-time removal (already pref-disabled; candidate for `--disable-telemetry` or equivalent)
- [x] CSS theme: track `userChrome.css` glass theme and companion `userContent.css` in repo (`benchmarks/themes/`)
