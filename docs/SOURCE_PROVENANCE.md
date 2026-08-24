# Source provenance

This portfolio repository was assembled from the local Mongrel browser workspace on 2026-08-23.

## Inputs

The snapshot deliberately combines two sources of truth:

1. **Committed dogfood integration** from local commit `87c39f8782` (`dogfood/stabilize-2026-04-11`). This preserves the preference navigation, build flags, default preferences, new-tab reductions, branding, and Firefox registration points that were part of the working product line.
2. **Later Mongrel-owned modules** from the recovered working tree. These include newer start-page, theme-effect, player, image, Tor, Tableau, IPFS, browser-glue, context-menu, localization, branding, and packaging work that was not fully represented by the last commit.

The combination is intentional. During source recovery, some tracked integration files had been temporarily replaced by canonical Firefox snapshot copies. Copying the live directory blindly would therefore have erased working Mongrel integration from the portfolio edition.

## What this means

- The repository is a faithful portfolio/consolidation snapshot, not the output of `git archive` from one original commit.
- Every included file comes from the local project workspace; documentation and safety scripts were added for this edition.
- The overlay has not yet been proven as one internally consistent clean build against a public Firefox revision.
- The exact upstream Gecko commit is unknown; only milestone `152.0a1` is preserved.
- Binary dogfood artifacts are represented by their original hashes, not copied into Git.

## Sanitization

The export excludes or replaces:

- certificates, private keys, provisioning profiles, and identity-specific examples
- developer home-directory paths
- build objects, virtual environments, caches, logs, and profiles
- release DMGs and ZIPs
- downloaded extension binaries
- full upstream Firefox source and duplicate source snapshots
- generated localization churn that did not explain Mongrel's product work

`scripts/verify-repository.sh` checks the most important parts of this boundary in local development and CI.

## Next provenance milestone

The next clean source release should record:

- exact upstream repository and commit
- overlay/tag commit
- toolchain and macOS/Xcode versions
- hashes for external inputs
- tests executed
- artifact hashes and signing/notarization record
