# Architecture

Mongrel is an overlay on Firefox/Gecko rather than a new browser engine. The project keeps networking, layout, JavaScript, multiprocess isolation, accessibility foundations, and web-platform support in Gecko, then changes the product layer around them.

## System shape

```text
macOS application bundle
└── Firefox/Gecko platform
    ├── browser chrome and preferences
    │   ├── Mongrel visual tokens and theme effects
    │   ├── Start Page / Personalize / Ad Blocking panes
    │   └── context-menu and toolbar integration
    ├── about:newtab component registry
    │   └── Mongrel start-page component and document
    ├── privileged Mongrel modules
    │   ├── night mode and page-aware styling
    │   ├── media/player parent-child actors
    │   ├── image and video tools
    │   ├── Tor helper orchestration
    │   ├── opt-in image ad blocking
    │   └── experimental IPFS protocol handling
    └── build and packaging layer
        ├── product defaults and feature flags
        ├── distribution add-ons
        └── macOS package/signing scripts
```

## Why an overlay repository

A full Firefox checkout is tens of gigabytes once source, dependencies, objects, and packaged builds coexist. Most of that volume is upstream code, not a legible account of Mongrel.

`firefox-overlay/` mirrors only the paths that carry Mongrel-specific work or register it. The tradeoff is explicit:

- GitHub readers can inspect the differentiated work quickly.
- The repository remains small enough to clone and review.
- A compatible upstream Firefox source tree is still required to build a browser.
- Full-file integration snapshots are revision-sensitive and should become narrower patches over time.

## Major components

### Start page

`browser/components/mongrel-startpage/` owns the largest coherent feature area.

- `MongrelStartpageRegistrant.sys.mjs` registers the custom component with Firefox's new-tab component registry.
- `MongrelStartpageComponent.sys.mjs` defines the privileged web component and exchanges state with browser services.
- `content/newtab.html` is the rendered surface.
- `content/mongrelStartpage.mjs` contains page behavior.
- `MongrelStartpageOverride.sys.mjs` and `AboutNewTabRedirector.sys.mjs` participate in routing.
- `MongrelVisualSystem.sys.mjs` centralizes palettes and CSS variables.

The start page reads browser preferences for identity, links, weather location, visibility, and visual mood. Search integration is intended to use Firefox's real search service rather than a second hard-coded engine list.

### Visual system and night mode

`MongrelVisualSystem.sys.mjs` is the token layer. `MongrelThemeEffects.sys.mjs` and `MongrelNightMode.sys.mjs` apply those choices to chrome or content. The separate preference CSS keeps the product language consistent inside `about:preferences`.

The architecture separates stable semantic choices—mood, palette, bloom, site adaptation—from individual CSS effects. That makes it possible to reduce expensive compositing without discarding the visual identity.

### Player and page tools

The player uses privileged parent/child modules because page inspection and browser-owned UI live on different sides of Firefox's process boundary:

- `MongrelPlayerChild.sys.mjs` observes or acts in content processes.
- `MongrelPlayerParent.sys.mjs` receives actor messages.
- `MongrelPlayerService.sys.mjs` coordinates browser-level state.

Image overlay, image bulk download, video download, and contextual actions follow a similar principle: keep browser privilege in modules rather than placing it in the start-page document.

### Privacy and network-adjacent features

- `MongrelAdblockService.sys.mjs` is an opt-in, narrow image-request redirector. It is not presented as a replacement for a mature content blocker.
- `MongrelTorManager.sys.mjs` coordinates an external Tor helper and therefore needs strict lifecycle and failure handling.
- `MongrelIPFSProtocolHandler.sys.mjs` is experimental URI plumbing and should receive security review before broad use.
- `mongrel-arkenfox.js` collects hardened preference choices derived from the project's vendored Arkenfox work.

### Firefox registration points

The most important upstream-facing files are:

| Path | Role |
| --- | --- |
| `browser/components/moz.build` | Adds Mongrel component directories to the build graph |
| `browser/components/BrowserComponents.manifest` | Registers privileged modules and actors |
| `browser/components/BrowserGlue.sys.mjs` | Initializes product-level services |
| `browser/components/preferences/preferences.xhtml` | Exposes Mongrel settings categories |
| `browser/app/profile/firefox.js` | Defines defaults and feature switches |
| `browser/themes/shared/jar.inc.mn` | Packages preference styling |
| `browser/app/distribution/distribution.ini` | Sets distribution identity and defaults |
| `browser/moz.configure` and `mozconfig` | Select build-time product scope |

## Build and release boundary

The overlay contains build and release scripts because packaging behavior is part of the product work. It excludes their outputs. A GitHub release should carry the DMG and application ZIP as release assets, with checksums committed in `release/`.

Signing is deliberately environment-driven. No certificate names, team identifiers, provisioning profiles, or private keys belong in this repository.

### Direct-distribution boundary

Mongrel is no longer architected around Mac App Store compliance. The release target is a controlled off-store channel shared with known testers and collaborators. This removes store-specific product constraints, but it does not remove platform trust requirements: Developer ID signing, notarization, hardened release provenance, and verifiable update metadata remain desirable.

Legacy App Store-oriented branches in the packaging script are preserved as project history, not as the current product objective. See `docs/DISTRIBUTION.md`.

## Architectural debt

The most important improvements are:

1. Pin the exact Firefox revision and publish a deterministic base acquisition step.
2. Convert full upstream-file snapshots into narrowly reviewable patches or generated integration steps.
3. Add automated browser-level tests for start page, preferences, actor registration, and packaging.
4. Threat-model helpers, downloads, request redirection, and custom URI handling.
5. Separate demonstrated product paths from speculative modules at build time.
