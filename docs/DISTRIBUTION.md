# Controlled direct distribution

## Decision

Mongrel is not targeting the Mac App Store. It is a controlled, off-store macOS application distributed to known testers, collaborators, and eventually invited users.

The working phrase is **underground distribution**: independent, deliberate, and outside a mass-market storefront. It does not mean unsigned mystery binaries, disabled operating-system protections, hidden behavior, or an attempt to evade platform security.

## Why this model fits Mongrel

- Firefox/Gecko already has a complex desktop runtime and helper-process model.
- Experimental browser capabilities should reach small tester rings before broad release.
- The project benefits from choosing its own cadence, feature gates, and compatibility window.
- Source can remain comprehensive and public while access to binary channels stays controlled.
- Store-specific review and sandbox constraints no longer define product architecture.

## Trust model

A credible off-store release still needs a stronger chain of trust than the archived dogfood package.

1. **Pinned source** — every binary maps to a tagged overlay and exact Gecko revision.
2. **Verified inputs** — extensions and external tools are version- and checksum-pinned.
3. **Developer ID signing** — release builds use a project-controlled identity kept outside Git.
4. **Notarization** — artifacts are notarized and stapled where the build permits it.
5. **Published checksums** — SHA-256 values ship beside every immutable asset.
6. **Controlled access** — binary links are limited to the intended tester ring.
7. **Signed updates** — any future updater verifies signed metadata and supports rollback.
8. **Clear revocation** — compromised or unstable builds can be withdrawn from the channel.

Platform passkeys are a separate capability gate, not a fourth release channel. Direct distribution removes the App Store pipeline, but Apple still treats the browser public-key credential entitlement as managed. A passkey-enabled build must use an Apple-authorized profile whose eligible distribution method matches the signing path. See [PASSKEYS.md](PASSKEYS.md).

## Release rings

| Ring | Audience | Signing | Expectations |
| --- | --- | --- | --- |
| Local | developers on the build machine | ad hoc acceptable | debugging only; clean profile preferred |
| Kennel | named internal testers | Developer ID target | known issues, rapid iteration, explicit feedback |
| Underground | invited external testers | Developer ID + notarization target | immutable artifact, checksums, release notes, rollback path |
| Public source | anyone | not applicable | portfolio, review, and reconstruction; no binary trust implied |

The names are product language, not security boundaries by themselves. Access controls, signatures, and provenance enforce the real boundaries.

## Update policy

Automatic updating is not yet established. Until update metadata is signed and rollback-tested:

- distribute immutable versioned DMGs/ZIPs
- require checksum verification
- publish a concise known-issues record
- keep earlier known-good artifacts available to authorized testers
- never replace an asset in place under the same version

GitHub Releases can serve as an initial source and provenance surface, but a private or restricted release link alone is not a complete update security design.

## App Store work that is historical

The recovered project included entitlement preparation and an App Store-flavored packaging branch. That exploration remains part of the project history, but the active script no longer carries an App Store mode. Local development, controlled Developer ID distribution, and profile-backed passkey testing now have distinct contracts.

## Suite rule

Across the Mongrel suite, direct distribution should be a shared architecture rule:

- one identity and vocabulary for release rings
- per-app manifests and checksums
- a common signing/notarization policy
- no credentials or signing identities in source repositories
- consistent rollback and revocation behavior
- capability requests justified by product need, not storefront compliance

The browser is the current reference implementation because it has the largest security surface and the most immediate distribution relevance.
