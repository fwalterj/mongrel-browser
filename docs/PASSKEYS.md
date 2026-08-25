# macOS passkeys and Touch ID

## Finding

The missing Touch ID sheet was not primarily a presentation-window bug. The preserved May 8, 2026 app could not enter the macOS platform passkey path at all.

The archived app was inspected as packaged:

| Gate | May 8 artifact | Consequence |
| --- | --- | --- |
| Signature | Ad hoc | No Apple development team identity |
| Team identifier | Not set | No team-scoped managed capability |
| Embedded provisioning profile | Absent | No proof that Apple authorized the capability for this App ID and distribution method |
| Effective entitlements | JIT and disabled library validation only | Browser passkey entitlement absent |
| Strict deep signature verification | Failed | The bundle contained an unsigned `Contents/moz.build` subcomponent |
| HTTP/HTTPS URL schemes | Present | This Apple browser criterion was already satisfied |

Gecko's macOS WebAuthn factory checks two things before constructing its `ASAuthorizationController`:

1. `security.webauthn.enable_macos_passkeys` must be true. It defaults to true in the recovered `152.0a1` source.
2. The running process must have `com.apple.developer.web-browser.public-key-credential=true` in its effective signature.

If the entitlement is absent, the factory returns `nullptr`. No authorization controller exists, no presentation anchor is requested, and no macOS sheet can appear. That exactly matches the observed behavior.

## What the direct-distribution rule changes

Moving outside the Mac App Store simplifies Mongrel materially:

- no App Store submission pipeline
- no store-specific certificate branch
- no App Sandbox requirement imposed merely for store eligibility
- no need to shape the Gecko helper-process model around store review
- one controlled release flow for known testers

It does **not** make the browser passkey capability self-service. Apple documents `com.apple.developer.web-browser.public-key-credential` as a managed capability. An organization Account Holder must request it, Apple must approve it, the capability must be enabled for the explicit App ID, and a new eligible provisioning profile must contain it.

Apple also notes that a managed capability can be limited to a subset of distribution methods. The developer account is therefore the source of truth for whether the approved browser capability is available to the intended Developer ID/direct-distribution profile. The release tooling deliberately refuses to guess.

## Simplified release contract

Mongrel now has three packaging states:

| Mode | Purpose | Passkeys |
| --- | --- | --- |
| `local` | Build-machine debugging; ad hoc allowed | Unavailable by design |
| `direct` | Developer ID controlled release | Unavailable unless a separately approved passkey path is used |
| `passkey` | A real signing identity plus an Apple-authorized profile | Packaging gates audited; runtime ceremony still must be tested |

The historical `standard` and `touchid` mode names remain accepted as compatibility aliases for `local` and `passkey`. The App Store packaging branch has been removed from the active release path.

## Required Apple-side work

1. Use an organization Apple Developer account whose Account Holder can request managed capabilities.
2. Register the explicit Mongrel App ID used by the package, currently `com.mongrel.browser`.
3. Request **macOS Browsers Passkeys** for that App ID.
4. After approval, enable the capability and inspect which distribution options Apple assigned.
5. Generate a fresh profile for the intended signing certificate and distribution option.
6. Verify that the decoded profile contains:

   ```text
   com.apple.developer.web-browser.public-key-credential = true
   ```

7. Keep the profile, certificate, and keys outside Git.

Writing the entitlement into a local plist without steps 1–5 is not sufficient.

## Build and verify

Generate the signing plist from the authorized profile:

```bash
./tools/prepare-passkey-signing.sh \
  --profile /secure/path/Mongrel.provisionprofile \
  --bundle-id com.mongrel.browser
```

Package with the same profile and a compatible real signing identity:

```bash
MONGREL_SIGNING_MODE=passkey \
MONGREL_CODESIGN_IDENTITY="Apple signing identity" \
MONGREL_PROVISIONING_PROFILE="/secure/path/Mongrel.provisionprofile" \
MONGREL_PASSKEY_ENTITLEMENTS="$(pwd)/tools/mongrel-passkey.entitlements.local.plist" \
./tools/mongrel-dogfood-release.sh
```

Audit any resulting app independently:

```bash
./tools/mongrel-passkey-audit.sh "/path/to/Mongrel.app" --source-root "$(pwd)"
```

The release script also runs this audit in `passkey` mode and fails before publishing artifacts if a packaging gate is closed.

## Runtime validation

A packaging-ready result is necessary, not sufficient. Test the exact packaged app, not an unsigned build-tree symlink.

1. Launch with a clean profile.
2. Visit a reputable WebAuthn test relying party over HTTPS.
3. Start a platform-authenticator registration with user verification required.
4. If macOS asks whether Mongrel may use passkeys, grant access. This authorization is managed by `ASAuthorizationWebBrowserPublicKeyCredentialManager`.
5. Confirm the system authentication sheet appears and complete Touch ID or the system fallback.
6. Repeat with an assertion/sign-in ceremony.
7. Record macOS version, hardware, app hash, bundle ID, signature Team ID, test RP, and result.

Mongrel should not create its own imitation Touch ID dialog. Authentication Services owns that system UX; Touch ID is one possible user-verification mechanism chosen by macOS.

## If the sheet still does not appear

Run the audit first. If it passes, collect Gecko logging for `macoswebauthnservice` and distinguish these later-stage failures:

- macOS browser passkey authorization is denied rather than not determined
- the site did not request a platform authenticator or required user verification
- no suitable presentation window could be resolved for the browsing context
- the device is not configured for passkeys
- Authentication Services returned an authorization error

Only after the packaging gates pass does presentation-anchor debugging become relevant.

## Primary references

- [Apple: browser public-key credential entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.web-browser.public-key-credential)
- [Apple: passkey use in web browsers](https://developer.apple.com/documentation/authenticationservices/passkey-use-in-web-browsers)
- [Apple: authenticating people by using passkeys in browser apps](https://developer.apple.com/documentation/authenticationservices/authenticating-people-by-using-passkeys-in-browser-apps)
- [Apple: provisioning with managed capabilities](https://developer.apple.com/help/account/reference/provisioning-with-managed-capabilities/)
- [Apple: capability requests](https://developer.apple.com/help/account/capabilities/capability-requests)
