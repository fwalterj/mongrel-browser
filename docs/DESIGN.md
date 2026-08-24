# Design direction

## Energy encased in glass

Mongrel's visual premise is a dark, layered material with restrained color energy inside it. The goal is not “more glow.” It is a sense of depth, atmosphere, and responsiveness that still lets the page remain primary.

The system is built around:

- translucent structural surfaces
- cool blue/cyan accents with limited bloom
- fine specular borders rather than thick outlines
- dark fields with readable contrast
- semantic moods that can change color without changing layout
- reduced-motion and reduced-cost paths as first-class requirements

## Product surfaces

### Chrome

The tab strip, address bar, and navigation controls use shared depth and accent rules. The work moved away from flat stock chrome, then back from early effects that felt too plastic or composition-heavy.

### Preferences

Mongrel preferences make the differentiating controls visible:

- Personalize: night palette, mood, bloom, and page blending
- Start Page: identity and utility controls
- Ad Blocking: explicit opt-in behavior

This matters to the concept: an unusual browser should not require hidden preferences to explain itself.

### Start page

The start page is intended as a utility surface rather than a promotional feed. Search is central. Quick links and browser actions are close, while weather and ambient information are optional. The visual concept capture in `assets/screenshots/start-page-concept.png` is a direction reference, not a current-build screenshot.

## Implementation

`MongrelVisualSystem.sys.mjs` maps moods to CSS variables. Those variables are consumed by the new-tab component and browser-side theme effects. `mongrel-preferences.css` brings the same language into settings.

This tokenized approach allows effects to be tuned centrally. In a browser, that is more than design-system neatness: blur, filters, shadows, and animated compositing can materially affect battery life and responsiveness.

## Quality bar

A mature version should satisfy all of the following:

- text and controls meet contrast expectations in every mood
- keyboard focus is unmistakable
- reduced-motion mode removes nonessential movement
- effects degrade gracefully when transparency is reduced
- no page content can spoof privileged browser controls
- visual adaptation never leaks sensitive page data
- chrome remains responsive on Apple Silicon under ordinary tab load

The current snapshot demonstrates the direction but does not claim that full bar has been met.
