# Project status

Snapshot date: 2026-08-23
Latest preserved dogfood package record: 2026-05-08
Gecko milestone in the working source: `152.0a1`

## What is real today

- A Mongrel-branded Firefox/Gecko application has been built and packaged on macOS.
- The custom browser chrome and preference navigation are visible in development captures.
- Mongrel-owned start-page, visual-system, player, image, privacy, and protocol modules exist as inspectable source.
- The overlay contains the Firefox registration, defaults, localization, and packaging paths that connect those modules.
- A May 8 dogfood DMG and application ZIP were produced, and their SHA-256 hashes are preserved.

## What remains unresolved

- The live development checkout had been assembled from incomplete and recovered Firefox source snapshots.
- A clean build from a freshly fetched, exact public upstream revision has not been demonstrated.
- The exact Mozilla revision beneath the `152.0a1` milestone was not preserved in repository metadata.
- Some later source work was newer than the last packaged dogfood artifact.
- The custom start page had rendering/flicker problems in some development builds.
- Extended daily-use stability, formal security review, Developer ID signing, and notarization were incomplete.
- Earlier Apple/App Store preparation is now historical. The active architecture targets controlled direct distribution outside the store.

## Status matrix

| Area | State | Confidence |
| --- | --- | --- |
| Product concept and identity | Demonstrated | High |
| Mongrel-owned source preservation | Included here | High |
| Browser preference integration | Demonstrated/in source | High |
| Start-page registration | In source | High |
| Start-page runtime polish | In progress | Medium |
| Search-source alignment | Implemented during development | Medium |
| Apple Silicon development build | Demonstrated | Medium |
| May 8 standalone package | Demonstrated, archival | High |
| Fresh-clone reproducibility | Blocked by missing exact base revision | Low |
| Controlled off-store release model | Adopted in architecture | Medium |
| Developer ID signing and notarization | Not demonstrated | Low |
| Touch ID/passkey release capability | Experimental | Low |
| Security hardening of helper features | Not complete | Low |
| Weeklong default-browser evaluation | Goal, not completed evidence | Low |

## Highest-priority next work

1. Identify the exact compatible Firefox revision or rebase the overlay onto a newly pinned ESR/nightly base.
2. Produce a clean build from that base in a fresh checkout.
3. Reduce full-file upstream replacements to reviewable patches.
4. Test the start page, preferences, actor boundaries, context menu, and packaging in automation.
5. Threat-model and harden every module that launches a process, downloads a resource, redirects a channel, or handles a custom URI.
6. Restore or retain accessibility and other user-critical platform services before any public daily-driver positioning.
7. Establish a controlled direct-release channel with signed artifacts, notarization where practical, checksums, and rollback metadata.

## Portfolio interpretation

This repository is strongest as evidence of ambitious product engineering across a mature browser stack: visual design translated into Gecko components, privileged browser integration, macOS packaging, and iterative dogfood work. It should not be read as a claim that an independently shippable browser is complete.
