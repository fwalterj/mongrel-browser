# Feature map

This map describes what is present in the snapshot. “Implemented in source” means code and integration are visible here; it does not imply production validation.

| Feature | Primary source | Snapshot state | Notes |
| --- | --- | --- | --- |
| Mongrel start page | `mongrel-startpage/` | Implemented in source; runtime stabilization in progress | Custom `about:newtab` component, document, quick links, search handoff, and preference-backed options |
| Visual mood system | `MongrelVisualSystem.sys.mjs` | Demonstrated | Semantic palettes and CSS variables for chrome and start page |
| Page-aware chrome | `MongrelThemeEffects.sys.mjs` | Experimental | Adapts effects to the current page; compositing cost was still being tuned |
| Night mode | `MongrelNightMode.sys.mjs` | Implemented in source | Browser and optional website modes with named palettes |
| Preference panes | `browser/components/preferences/` | Demonstrated | Dedicated Start Page, Personalize, and Ad Blocking surfaces |
| Image overlay | `MongrelImageOverlayManager.sys.mjs` | Experimental | Browser-side image interaction tooling |
| Bulk image download | `MongrelImageBulkDownload.sys.mjs` | Experimental | Needs adversarial URL, filename, and permission testing |
| Video downloader | `MongrelVideoDownloader.sys.mjs` | Experimental | High-attention security and compatibility surface |
| Media player | `MongrelPlayer*.sys.mjs` | Implemented in source | Parent/child actor and service architecture |
| Sanctuary mode | `MongrelSanctuaryMode.sys.mjs` | Experimental | Focus/privacy-oriented browsing mode |
| Tor helper | `MongrelTorManager.sys.mjs` | Experimental | External process orchestration; not a claim of Tor Browser equivalence |
| Tableau integration | `MongrelTableauIntegration.sys.mjs` | Experimental | Contextual integration prototype |
| Invisible image blocker | `mongrel-adblock/` | Opt-in prototype | Small domain-list image redirector; mature extensions remain available |
| IPFS protocol | `mongrel-ipfs/` | Experimental | Custom protocol handler requiring security review |
| Reduced product surface | `browser/moz.configure`, `mozconfig`, new-tab modules | Recorded in source/evidence | Work includes Sync, WebRTC, Pocket/Discovery Stream, telemetry, accessibility, and DevTools experiments; not every removal is recommended for a general release |
| Distribution add-ons | `tools/fetch-distro-addons.sh` | Packaging path implemented | Downloads are release-time inputs and should be pinned/verified |
| Dogfood packaging | `tools/mongrel-dogfood-release.sh` | Demonstrated | Produced app ZIP and DMG with checksums |
| Touch ID/passkey packaging | signing scripts and entitlements | Experimental | Absent from the standard May 8 dogfood build; future work targets direct distribution |
| Controlled release channel | release scripts and checksums | Architecture adopted | Restricted/off-store delivery; signed update metadata is not implemented yet |

## A note on removal experiments

The benchmark notes record attempts to reduce Firefox subsystems. They are included as engineering evidence, not as blanket product recommendations. Accessibility in particular should not be removed from a public browser; future work should treat those experiments as measurements from an earlier optimization phase and restore user-critical platform capability.

## Source tour

For the quickest review:

1. Read `MongrelStartpageRegistrant.sys.mjs` to see how Mongrel enters Firefox's component system.
2. Read `MongrelVisualSystem.sys.mjs` to see the product's design model.
3. Open `content/newtab.html` and `content/mongrelStartpage.mjs` for the user-facing surface.
4. Read `preferences.xhtml` and the three Mongrel preference panels to see product integration.
5. Read `BrowserComponents.manifest` and `browser/components/moz.build` for actor and build registration.
6. Review `MongrelTorManager.sys.mjs`, `MongrelVideoDownloader.sys.mjs`, and the IPFS handler with a security mindset.
