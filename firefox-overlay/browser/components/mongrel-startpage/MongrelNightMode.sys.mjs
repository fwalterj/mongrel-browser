/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Two-layer dark mode implementation.
 *
 * Layer 1: layout.css.prefers-color-scheme.content-override = 2
 *   Sites that implement @media (prefers-color-scheme: dark) activate their
 *   own native dark mode. This is the correct, zero-inversion path.
 *
 * Layer 2: AGENT_SHEET with fallback colors.
 *   Provides dark background/text defaults for sites that do not implement
 *   prefers-color-scheme. Because it is AGENT_SHEET (lowest cascade priority),
 *   any author-level color declarations override it — so sites with native dark
 *   mode use their own colors without double-inversion.
 *
 * No filter inversion is used. This avoids "shock contrast" on sites like
 * Pitchfork that apply their own dark CSS in response to Layer 1, which would
 * previously get inverted a second time by a USER_SHEET filter.
 */

const PREF_THEME           = "mongrel.nightmode.theme";
const PREF_ENGINE          = "mongrel.nightmode.engine";
const PREF_EXTEND_TO_PAGES = "mongrel.nightmode.extend_to_pages";
const PREF_MOOD            = "mongrel.personalize.mood";
const PREF_OVERRIDE        = "layout.css.prefers-color-scheme.content-override";

const OVERRIDE_AUTO = 0;
const OVERRIDE_DARK = 2;

// USER_SHEET sits above author stylesheets in the cascade (between UA and
// author), so !important declarations in it override author !important.
// This is required for the fallback to actually appear on pages that set
// explicit background-color / color values (virtually all of them).
// AGENT_SHEET (previous value) has the lowest cascade priority and is
// overridden by any author declaration, making it invisible in practice.
const SHEET_TYPE = Ci.nsIStyleSheetService.USER_SHEET;

const THEME_ALIASES = {
  follow: "follow",
  none: "follow",
  off: "follow",
  // deep-black aliases
  black: "abyssal",
  "deep-black": "abyssal",
  "deepblack": "abyssal",
  "all-black": "abyssal",
  allblack: "abyssal",
  // night-warmth aliases
  standard: "night",
  dark: "night",
  "classic-dark": "night",
  classicdark: "night",
  warm: "night",
  warmth: "night",
  sepia: "night",
};

// Two themes only.
// abyssal: True deep-black color replacement (requires OVERRIDE_DARK).
// night:   Warm sepia temperature filter only — no dark-mode signal.
const THEME_DEFS = {
  abyssal: {
    mode: "dark",
    bgPrimary: "#000000",
    bgSecondary: "#0a0a0a",
    textPrimary: "#f0f0f0",
    textSecondary: "#a0a0a5",
    accent: "#0a7aff",
    border: "#1a1a1a",
    inputBg: "#1a1a1a",
    inputText: "#f0f0f0",
    scrollbar: "rgba(180,180,200,0.18)",
  },
  night: {
    mode: "warm",
    // Pure CSS filter — no color overrides, no dark-mode signal.
    filter: "sepia(80%) brightness(95%) hue-rotate(10deg) contrast(110%)",
  },
};

function normalizedTheme(theme) {
  const candidate = String(theme || "follow").toLowerCase();
  return THEME_ALIASES[candidate] || candidate;
}

function isForcedTheme(theme) {
  return theme in THEME_DEFS;
}

function cssForTheme(theme, mood = "default") {
  const t = THEME_DEFS[theme];
  if (!t) {
    return "";
  }

  // Night warmth mode: pure sepia temperature filter — no color-scheme override.
  // Applies a warm tint to all pages without triggering dark mode.
  if (t.mode === "warm") {
    return `@-moz-document url-prefix("http://"), url-prefix("https://"), url-prefix("file://") {
html {
  filter: ${t.filter} !important;
  transition: filter 0.3s ease !important;
}
}`;
  }

  // Deep-black mode: true black color overrides wrapped in prefers-color-scheme
  // so they only activate when OVERRIDE_DARK is set (Layer 1).
  // !important is required because virtually every page sets explicit colors.
  const isAllBlackMood = String(mood || "").toLowerCase() === "allblack";
  const bodyTextMix = isAllBlackMood ? 22 : 42;
  const inlineTextMix = isAllBlackMood ? 10 : 36;
  const mutedTextMix = isAllBlackMood ? 16 : 0;
  const forceOpacity = isAllBlackMood;

  return `@media (prefers-color-scheme: dark) {
@-moz-document url-prefix("http://"), url-prefix("https://"), url-prefix("file://") {

:root {
  --mongrel-page-bg-primary: ${t.bgPrimary};
  --mongrel-page-bg-secondary: ${t.bgSecondary};
  --mongrel-page-text-primary: ${t.textPrimary};
  --mongrel-page-text-secondary: ${t.textSecondary};
  --mongrel-page-accent: ${t.accent};
  --mongrel-page-border: ${t.border};
  --mongrel-page-input-bg: ${t.inputBg};
  --mongrel-page-input-text: ${t.inputText};
  color-scheme: dark !important;
}

html, body {
  background-color: var(--mongrel-page-bg-primary) !important;
  color: var(--mongrel-page-text-primary) !important;
}

/* Lift low-contrast grayscale text toward readable luminance while keeping
   each site's relative typography hierarchy. */
:where(p, span, li, dt, dd, td, th, small, em, strong, figcaption, blockquote, label, code, pre) {
  color: color-mix(in srgb, currentColor ${bodyTextMix}%, var(--mongrel-page-text-primary)) !important;
}

/* Catch common inline gray text styles that otherwise become illegible on pure black. */
:where([style*="color: rgb" i], [style*="color:#" i], [style*="color: #" i], font[color]) {
  color: color-mix(in srgb, currentColor ${inlineTextMix}%, var(--mongrel-page-text-primary)) !important;
${isAllBlackMood ? `  -webkit-text-fill-color: color-mix(in srgb, currentColor ${inlineTextMix}%, var(--mongrel-page-text-primary)) !important;` : ""}
}

${mutedTextMix > 0 ? `/* Lift common muted class patterns in all-black mode. */
:where([class*="muted" i], [class*="secondary" i], [class*="subhead" i], [class*="dek" i], [class*="excerpt" i], [class*="byline" i]) {
  color: color-mix(in srgb, currentColor ${mutedTextMix}%, var(--mongrel-page-text-primary)) !important;
}` : ""}

${forceOpacity ? `/* Neutralize opacity-dimmed copy that disappears on pure black. */
:where(p, span, li, dt, dd, td, th, small, em, strong, figcaption, blockquote, label)[style*="opacity" i] {
  opacity: 1 !important;
}` : ""}

body {
  background-image: none !important;
}

a {
  color: var(--mongrel-page-accent) !important;
}

hr,
table,
thead,
tbody,
tfoot,
tr,
td,
th {
  border-color: var(--mongrel-page-border) !important;
}

input,
textarea,
select,
button {
  background-color: var(--mongrel-page-input-bg) !important;
  color: var(--mongrel-page-input-text) !important;
  border-color: var(--mongrel-page-border) !important;
}

* {
  scrollbar-color: ${t.scrollbar} transparent !important;
  scrollbar-width: thin !important;
}

}
}`;
}

function getSSS() {
  return Cc["@mozilla.org/content/style-sheet-service;1"]
           .getService(Ci.nsIStyleSheetService);
}

export const MongrelNightMode = {
  _initialized: false,
  _sheetURI: null,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._migrateLegacyPrefs();

    Services.prefs.addObserver(PREF_THEME, this);
    Services.prefs.addObserver(PREF_ENGINE, this);
    Services.prefs.addObserver(PREF_EXTEND_TO_PAGES, this);
    Services.prefs.addObserver(PREF_MOOD, this);

    this.applyCurrentTheme();
  },

  observe(subject, topic, data) {
    if (topic !== "nsPref:changed") {
      return;
    }
    if (data === PREF_THEME || data === PREF_ENGINE || data === PREF_EXTEND_TO_PAGES || data === PREF_MOOD) {
      this.applyCurrentTheme();
    }
  },

  _migrateLegacyPrefs() {
    if (Services.prefs.prefHasUserValue(PREF_THEME)) {
      return;
    }

    const legacyApply = Services.prefs.getBoolPref(
      "mongrel.personalize.night_mode.apply_to_web",
      false
    );
    if (!legacyApply) {
      return;
    }

    const legacyVariant = normalizedTheme(
      Services.prefs.getStringPref(
        "mongrel.personalize.night_mode.variant",
        "night"
      )
    );

    Services.prefs.setStringPref(
      PREF_THEME,
      isForcedTheme(legacyVariant) ? legacyVariant : "night"
    );
  },

  applyCurrentTheme() {
    const sss = getSSS();

    if (this._sheetURI) {
      try {
        if (sss.sheetRegistered(this._sheetURI, SHEET_TYPE)) {
          sss.unregisterSheet(this._sheetURI, SHEET_TYPE);
        }
      } catch {}
      this._sheetURI = null;
    }

    const theme = normalizedTheme(
      Services.prefs.getStringPref(PREF_THEME, "follow")
    );
    const extendToPages = Services.prefs.getBoolPref(PREF_EXTEND_TO_PAGES, false);
    const forced = isForcedTheme(theme);

    const isWarm = forced && theme === "night";
    const isDark = forced && theme !== "night";

    // Only set OVERRIDE_DARK for the deep-black mode.
    // Night warmth mode uses a CSS filter only — no dark-mode signal.
    Services.prefs.setIntPref(
      PREF_OVERRIDE,
      (isDark && extendToPages) ? OVERRIDE_DARK : OVERRIDE_AUTO
    );

    Services.prefs.setBoolPref("mongrel.darkmode.enabled", isDark && extendToPages);
    Services.prefs.setStringPref("mongrel.darkmode.theme", forced ? theme : "follow");

    if (forced) {
      Services.prefs.setStringPref("mongrel.personalize.night_mode.variant", theme);
    }

    // Night warmth mode applies regardless of extendToPages (it's just a filter).
    // Deep-black mode requires extendToPages to be set.
    if (isWarm) {
      // fall through to register the warmth filter sheet
    } else if (!extendToPages || !isDark) {
      return;
    }

    const mood = Services.prefs.getStringPref(PREF_MOOD, "default");
    const css = cssForTheme(theme, mood);
    if (!css) {
      return;
    }

    try {
      const uri = Services.io.newURI(
        "data:text/css;charset=UTF-8," + encodeURIComponent(css)
      );
      sss.loadAndRegisterSheet(uri, SHEET_TYPE);
      this._sheetURI = uri;
    } catch (e) {
      console.error("MongrelNightMode: stylesheet registration failed:", e);
    }
  },

  destroy() {
    if (!this._initialized) {
      return;
    }

    if (this._sheetURI) {
      try {
        const sss = getSSS();
        if (sss.sheetRegistered(this._sheetURI, SHEET_TYPE)) {
          sss.unregisterSheet(this._sheetURI, SHEET_TYPE);
        }
      } catch {}
      this._sheetURI = null;
    }

    Services.prefs.removeObserver(PREF_THEME, this);
    Services.prefs.removeObserver(PREF_ENGINE, this);
    Services.prefs.removeObserver(PREF_EXTEND_TO_PAGES, this);
    this._initialized = false;
  },
};
