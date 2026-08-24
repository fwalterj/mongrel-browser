# Contributing

Mongrel is currently a research prototype and source-recovery project. Contributions that make the work easier to inspect, reproduce, test, or safely evaluate are especially valuable.

## Good first contributions

- Clarify architecture or feature-status documentation.
- Add focused tests for a Mongrel-owned module.
- Reduce coupling between a Mongrel feature and an upstream Firefox file.
- Help identify and pin the exact compatible Gecko revision.
- Review privacy, process-launching, download, and protocol-handler code.
- Improve accessibility, keyboard behavior, or reduced-motion support.

## Before opening a change

1. Keep Firefox-derived files under their existing MPL 2.0 terms and notices.
2. Do not add certificates, profiles, signing identities, private keys, browser profiles, logs, or packaged builds.
3. Label experimental behavior honestly; source presence does not prove release readiness.
4. Prefer a small Mongrel-owned module plus a narrow upstream registration change over a broad upstream-file replacement.
5. Run `./scripts/verify-repository.sh`.

## Pull request notes

Explain:

- the user-facing outcome
- the Firefox integration point affected
- the compatible Firefox revision or milestone used for testing
- the verification performed
- security or privacy consequences

Build and platform changes should include the full command and relevant environment facts, but never secrets or identity names.
