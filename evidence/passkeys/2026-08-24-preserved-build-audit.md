# Preserved build passkey audit — 2026-08-24

Artifact inspected: the extracted `Mongrel-Dogfood-2026-05-08.app.zip`

This record intentionally omits local paths and signing-account details. The artifact checksum is preserved in `release/SHA256SUMS.txt`.

## Result

```text
Mongrel passkey readiness audit

[OK]   Bundle identifier: com.mongrel.browser
[OK]   Info.plist declares both HTTP and HTTPS URL schemes.
[FAIL] The app is ad-hoc signed.
[FAIL] The signature has no TeamIdentifier.
[FAIL] Effective signature is missing
       com.apple.developer.web-browser.public-key-credential=true.
[FAIL] Effective signature has no com.apple.application-identifier.
[FAIL] No embedded.provisionprofile is present.
[FAIL] The app fails deep, strict code-signature verification.
[OK]   security.webauthn.enable_macos_passkeys defaults to true in source.

NOT READY: 6 blocking checks, 0 warnings.
```

The strict signature failure identified an unsigned `Contents/moz.build` subcomponent in the preserved bundle. The revised release script now rejects source-only `moz.build` or `jar.mn` files in the staged app and requires strict signature verification before it writes release artifacts.

## Interpretation

The app met Apple's HTTP/HTTPS declaration criterion and Gecko's platform-passkey preference was enabled. However, Gecko checks the running process for the managed browser public-key credential entitlement before it creates the Authentication Services controller. The four signing/provisioning failures above therefore explain why no macOS authorization or Touch ID sheet appeared.

This audit does not claim that a future correctly packaged app will automatically pass a live WebAuthn ceremony. It narrows the next test to Apple capability approval, profile-backed signing, macOS browser-passkey authorization, and then runtime ceremony behavior.

Reproduce with:

```bash
./tools/mongrel-passkey-audit.sh "/path/to/Mongrel.app" \
  --source-root "/path/to/firefox-source"
```
