# Release record and publishing

## Latest preserved artifact

The latest preserved package record is dated 2026-05-08:

- `Mongrel-Dogfood-2026-05-08.dmg`
- `Mongrel-Dogfood-2026-05-08.app.zip`

The binary files are intentionally excluded from Git. If published, attach them to a GitHub Release and keep `release/SHA256SUMS.txt` in the tagged source tree.

## Verification

After downloading both assets:

```bash
shasum -a 256 -c release/SHA256SUMS.txt
```

Expected SHA-256 values:

```text
281c7dc03abe364197e89d1a264d3bdf949a14b3cf1ecf4312d4668828cc5907  Mongrel-Dogfood-2026-05-08.dmg
b3c1c027d47f48db6031f309b7089540c09bb843bdc59274ffcecae1e2067ab1  Mongrel-Dogfood-2026-05-08.app.zip
```

## Important qualifications

The May 8 package was a development artifact:

- signing mode: standard/ad-hoc
- production notarization: not established
- platform passkey entitlement: not included
- intended audience: development dogfood/evaluation
- clean public-base reproducibility: not established
- distribution posture: controlled direct release; not a Mac App Store candidate

Those qualifications should appear in the GitHub Release notes. Do not present the build as a hardened general-availability browser.

## Future controlled-release checklist

- [ ] Build from a fresh checkout of an exact pinned Gecko revision.
- [ ] Verify all downloaded inputs by version and checksum.
- [ ] Run focused browser and packaging tests with a clean profile.
- [ ] Inspect the app bundle for broken or external symlinks.
- [ ] Confirm the displayed version, bundle identifier, and branding.
- [ ] Perform security review of experimental features included in the build.
- [ ] Sign with an appropriate non-personal release identity.
- [ ] Notarize and staple the macOS artifact where applicable.
- [ ] Publish only to the intended tester ring and document promotion criteria.
- [ ] Sign update metadata and retain a rollback path before enabling automatic updates.
- [ ] Produce SHA-256 checksums from the final immutable files.
- [ ] Tag the exact source snapshot used to build them.
- [ ] Publish limitations and known issues beside the download.

The full off-store trust model is in [DISTRIBUTION.md](DISTRIBUTION.md).

## Repository publication checklist

- [ ] Run `./scripts/verify-repository.sh`.
- [ ] Review `git status` and the full staged diff.
- [ ] Confirm that no credentials, local paths, profiles, logs, or user data are present.
- [ ] Confirm that no artifact exceeds the GitHub file-size policy.
- [ ] Use GitHub Releases, not Git history, for DMG/ZIP assets.
