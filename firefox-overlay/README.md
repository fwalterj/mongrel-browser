# Firefox overlay

This directory mirrors Mongrel-specific source and integration paths from a Firefox `152.0a1` development tree.

It includes:

- Mongrel-owned components and content
- Firefox files that register or initialize those components
- product defaults, branding, localization, and preference integration
- macOS dogfood build and packaging scripts

It excludes:

- the upstream Gecko source tree
- build objects and caches
- packaged extensions and other downloaded inputs
- application bundles, ZIPs, and DMGs
- signing certificates, private keys, and provisioning profiles

Use `../scripts/apply-overlay.sh` from the repository root. Full upstream-file snapshots are included for fidelity to the recovered working state; they are revision-sensitive and should eventually be replaced by narrow patches against an exact pinned base.
