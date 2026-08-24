# Project history

This history condenses the development repository's commit narrative and later recovery notes into a readable sequence. Dates are approximate where the local commits did not carry a public release record.

## Product reduction and measurement

The early work explored how much Firefox product surface could be removed while keeping Gecko as the browser engine. Sync and WebRTC were disabled at build time, then guarded in browser UI. Pocket and Discovery Stream paths were reduced, followed by experiments around telemetry, DevTools, and accessibility.

The raw notes are preserved under `evidence/benchmarks/`. They document engineering exploration, not a final recommendation. In particular, a public browser should preserve accessibility unless there is a fully capable alternative.

## Visual identity

Mongrel then moved beyond a stripped Firefox configuration:

- a glass-oriented userChrome/userContent prototype
- a native new-tab component
- a formalized visual token system
- app icon and branding integration
- dedicated preference surfaces
- progressively calmer chrome and lower-cost effects

The design language converged on “energy encased in glass.”

## Product features

The source grew into a group of browser-owned utilities:

- opt-in image ad blocking
- night and mood controls
- image overlay and bulk download tools
- browser-level media player actors/services
- video download exploration
- sanctuary/focus mode
- Tor helper orchestration
- IPFS protocol handling
- start-page search and utility work

These features have different maturity levels; the map in `docs/FEATURES.md` keeps that distinction visible.

## Build and dogfood work

The project added an Apple Silicon-oriented `mozconfig`, dogfood build automation, self-contained packaging, DMG/ZIP generation, entitlements tooling, and release checksums. A hardening branch recorded smoke-test and packaging improvements.

A May 8, 2026 package is the latest preserved release record in this snapshot.

Early distribution work explored App Store constraints. The architecture has since shifted to a controlled, independent macOS channel: source can be public and legible while binary access, update rings, and tester enrollment remain deliberate. App Store compliance is no longer a product requirement.

## Source-tree recovery

Later work uncovered a structural problem: the live checkout was incomplete and had been relying on a nearby source snapshot plus partially historical build products. Recovery proceeded by repeatedly running `mach build faster`, restoring the next missing subtree, and rerunning.

That work restored broad areas including build tooling, Python support, testing, third-party code, media, storage, security, toolkit, networking, parsing, and graphics. It moved failures deeper into normal source/build territory, but did not reach a clean, publicly reproducible checkout.

## Why this repository exists

The original workspace was useful for development but poor for communication: tens of gigabytes, full source mirrors, build objects, archived packages, signing files, and several generations of notes lived together.

This snapshot separates the product story from that environment. It preserves the differentiated code, evidence, and release record in a repository that can be reviewed without downloading an entire browser engine.

## Selected development milestones

The local Git history recorded these milestones:

- compile-time removal and UI guarding for Sync/WebRTC
- dark-mode and product-surface reduction phases
- glass theme prototype
- Pocket/Discovery Stream reduction
- native glass start page and preference registration
- formal visual system and branding assets
- Apple Silicon/LTO build tuning
- invisible image ad-blocking service and preference pane
- consolidated visual system and restyled preferences
- dogfood overlay defaults and packaging hardening
- Apple distribution and WebAuthn documentation work

The current priority is no longer feature count. It is pinning the base, restoring clean buildability, narrowing integration patches, and validating the result.
