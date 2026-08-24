# Phase 4 Benchmark: Telemetry, Healthreport, and Normandy Removal

Date: 2026-03-22
Branch: main
Base: Firefox ESR 128, Atlas Alpha fork
Platform: macOS Apple Silicon (arm64, M2), macOS 26.2

---

## Summary

This phase disables build-time data collection and remote experimentation features by forcing
telemetry-related configure options off in browser configuration.

Flags forced off:
- MOZ_TELEMETRY_REPORTING
- MOZ_SERVICES_HEALTHREPORT
- MOZ_NORMANDY

Crash reporting was already disabled in mozconfig (`--disable-crashreporter`) before this phase.

---

## Configuration Change

File: browser/moz.configure

Before:
- imply_option("MOZ_SERVICES_HEALTHREPORT", True)
- imply_option("MOZ_NORMANDY", True)

After:
- imply_option("MOZ_SERVICES_HEALTHREPORT", False)
- imply_option("MOZ_TELEMETRY_REPORTING", False)
- imply_option("MOZ_NORMANDY", False)

---

## Build Validation

| Setting | Value |
|---|---|
| Build type | Incremental (moz.configure change) |
| Build duration | ~42m 11s |
| Build exit code | 0 |

Build log: /tmp/mongrel-phase4-telemetry-build.log

---

## Artifact Checks

| Check | Result |
|---|---|
| `MOZ_TELEMETRY_REPORTING` in config.status | absent (0 lines) |
| `MOZ_DATA_REPORTING` in config.status | absent (0 lines) |
| `MOZ_SERVICES_HEALTHREPORT` in config.status | absent (0 lines) |
| `MOZ_NORMANDY` in config.status | absent (0 lines) |
| `Nightly.app` disk size | **274 MB** |

Size delta vs Phase 3 clean build (277 MB): **-3 MB**. This is expected — telemetry is
predominantly JavaScript/XUL with some C++ instrumentation; the dominant cost was in
JAR/omni.ja packed JS rather than native code.

---

## Regression Tests

| Result | Count |
|---|---|
| Passed | 28 |
| Failed | 0 |
| Todo | 0 |

**Status: PASS — no regressions**

Test log: /tmp/mongrel-phase4-xpcshell.log

---

## Decision Log

- **Change set:** Phase 4 — Telemetry / Healthreport / Normandy compile-time removal
- **Components removed:** MOZ_TELEMETRY_REPORTING, MOZ_SERVICES_HEALTHREPORT, MOZ_NORMANDY, MOZ_DATA_REPORTING (cascades automatically when all three parents are disabled)
- **Motivation:** remove all Mozilla data-collection and remote-recipe code paths; reduce binary footprint; eliminate background network activity
- **Risk:** low-to-moderate — all three flags are project_flag-style toggles with well-established server-offline paths; tested in ESR builds
- **Observed size delta:** -3 MB disk (274 MB from 277 MB)
- **Regressions:** none — 28/28 xpcshell pass
- **Keep/Revert decision:** KEEP
- **Notes:**
  - MOZ_CRASHREPORTER was already disabled in Phase 1 (mozconfig `--disable-crashreporter`)
  - MOZ_DATA_REPORTING sets to false automatically when all upstream inputs are disabled; no explicit override needed
  - Normandy (remote experiment recipes) and health report are independent subsystems that happen to share the same configure gating path
  - No browser UI guard work was needed — telemetry pref UI is gated by build defines natively
