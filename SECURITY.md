# Security policy

Mongrel is not currently presented as a production-hardened browser. It inherits a large and fast-moving Firefox/Gecko security surface while adding code that can launch helpers, redirect image requests, handle custom protocols, and coordinate downloads.

Please do not open public issues for suspected vulnerabilities. Contact the repository maintainer privately and include the affected path, reproduction conditions, impact, and whether the behavior also exists upstream.

Do not use the archived dogfood build for sensitive browsing. It was an ad-hoc-signed development artifact, did not include the platform passkey entitlement, and predates completion of clean-build and extended stability validation.

The browser passkey entitlement is a managed Apple capability. Do not attempt to bypass its approval or provisioning requirements, and do not describe a locally edited entitlement plist as passkey support. See [docs/PASSKEYS.md](docs/PASSKEYS.md) for the audited gate sequence.

Mongrel's off-store posture is not permission to weaken macOS safeguards. Controlled releases should remain signed, notarized where practical, checksum-verifiable, and distributed through an explicit tester channel. Users should never be instructed to disable Gatekeeper globally.

## High-attention areas

- `MongrelTorManager.sys.mjs` and any external-process lifecycle
- `MongrelVideoDownloader.sys.mjs` and download validation
- `MongrelIPFSProtocolHandler.sys.mjs` and URI handling
- `MongrelAdblockService.sys.mjs` and request redirection
- parent/child actor boundaries used by the player and page tools
- signing, entitlements, and packaged extension acquisition

Secrets, signing material, browser profiles, logs, and real user data must never be committed.
