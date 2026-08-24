/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const MONGREL_VISUAL_SYSTEM = Object.freeze({
  typography: Object.freeze({
    uiFont:
      '"Avenir Next", "SF Pro Display", "Segoe UI Variable", "Helvetica Neue", sans-serif',
    monoFont:
      '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace',
  }),
  color: Object.freeze({
    /* Balenciaga-restraint defaults — see MONGREL_MOOD_COLORS below for the
     * authoritative per-mood palette. These constants are baseline overrides
     * for code paths that don't take a mood (chrome paint, fallback CSS). */
    void: "#07080f",
    voidMid: "#0d0f1c",
    surface: "#11142a",
    energy: "#5a6fff",
    energyDim: "rgba(90,111,255,0.10)",
    energyGlow: "rgba(90,111,255,0.18)",
    textPrimary: "rgba(235,238,255,0.94)",
    textSecondary: "rgba(170,180,210,0.56)",
    textDim: "rgba(120,135,180,0.32)",
    glassBase: "rgba(255,255,255,0.03)",
    glassHover: "rgba(255,255,255,0.05)",
    glassActive: "rgba(255,255,255,0.08)",
    glassBorder: "rgba(255,255,255,0.06)",
    glassBorderLit: "rgba(120,140,255,0.16)",
    glassHighlight: "rgba(255,255,255,0.12)",
    glassHighlightSoft: "rgba(255,255,255,0.06)",
    glassTint: "rgba(126,148,255,0.08)",
    glassTintHot: "rgba(126,148,255,0.14)",
    glassShadow: "rgba(4,7,20,0.42)",
    glassShadowDeep: "rgba(2,4,14,0.62)",
    frost: "rgba(180,200,255,0.08)",
    safe: "rgba(80,220,160,0.7)",
  }),
  radius: Object.freeze({
    panel: "18px",
    surface: "14px",
    control: "10px",
    pill: "999px",
  }),
  blur: Object.freeze({
    chrome: "24px",
    panel: "20px",
    control: "14px",
  }),
  shadow: Object.freeze({
    panel: "0 24px 80px rgba(0, 0, 0, 0.34)",
    control: "0 10px 30px rgba(6, 8, 24, 0.26)",
    glow: "0 0 20px rgba(90,111,255,0.24)",
  }),
  motion: Object.freeze({
    fast: "140ms ease",
    medium: "220ms ease",
  }),
});

/* Balenciaga-restraint mood palette.
 *
 * Source of truth for both the chrome (via MongrelThemeEffects) and the start
 * page (mirror in browser/components/mongrel-startpage/content/newtab.html
 * MOOD object — both files MUST be edited together when a mood changes).
 *
 * Design rules:
 *  - Each mood is monochromatic with a single muted accent (`energy`).
 *  - Surfaces are deep neutrals tinted toward the accent's hue family only.
 *  - Glow alphas stay <= 0.18 (chrome) / <= 0.18 (start page) so nothing
 *    feels neon. Accent presence is restraint, not loudness.
 *  - Onyx (`allblack`) is true black with an ice-white whisper of an accent
 *    at very low alpha. No color at all.
 */
const MONGREL_MOOD_COLORS = Object.freeze({
  default: Object.freeze({
    void: "#07080f",
    voidMid: "#0d0f1c",
    surface0: "#07080f",
    surface1: "#0d0f1c",
    surface2: "#11142a",
    surface3: "#161a36",
    energy: "#5a6fff",
    energyRgb: "90, 111, 255",
    energyDim: "rgba(90,111,255,0.10)",
    energyGlow: "rgba(90,111,255,0.18)",
    textPrimary: "rgba(235,238,255,0.94)",
    textSecondary: "rgba(170,180,210,0.56)",
    textDim: "rgba(120,135,180,0.32)",
    glassBase: "rgba(255,255,255,0.03)",
    glassHover: "rgba(255,255,255,0.05)",
    glassActive: "rgba(255,255,255,0.08)",
    glassBorder: "rgba(255,255,255,0.06)",
    glassBorderLit: "rgba(120,140,255,0.16)",
    glassBorderAccent: "rgba(120,140,255,0.20)",
    glassHighlight: "rgba(255,255,255,0.12)",
    glassHighlightSoft: "rgba(255,255,255,0.06)",
    glassTint: "rgba(126,148,255,0.06)",
    glassTintHot: "rgba(126,148,255,0.12)",
    glassShadow: "rgba(4,7,20,0.32)",
    glassShadowDeep: "rgba(2,4,14,0.46)",
    frost: "rgba(180,200,255,0.08)",
  }),
  infernal: Object.freeze({
    void: "#0a0608",
    voidMid: "#16080c",
    surface0: "#0a0608",
    surface1: "#16080c",
    surface2: "#1f0c10",
    surface3: "#2a1014",
    energy: "#c44a4a",
    energyRgb: "196, 74, 74",
    energyDim: "rgba(196,74,74,0.10)",
    energyGlow: "rgba(196,74,74,0.18)",
    textPrimary: "rgba(245,225,225,0.94)",
    textSecondary: "rgba(195,158,158,0.56)",
    textDim: "rgba(150,108,108,0.32)",
    glassBase: "rgba(255,255,255,0.025)",
    glassHover: "rgba(255,255,255,0.045)",
    glassActive: "rgba(255,255,255,0.07)",
    glassBorder: "rgba(255,255,255,0.05)",
    glassBorderLit: "rgba(196,74,74,0.18)",
    glassBorderAccent: "rgba(196,74,74,0.22)",
    glassTint: "rgba(196,74,74,0.05)",
    glassTintHot: "rgba(196,74,74,0.12)",
    frost: "rgba(220,170,170,0.06)",
  }),
  purgatory: Object.freeze({
    void: "#08050d",
    voidMid: "#110a1a",
    surface0: "#08050d",
    surface1: "#110a1a",
    surface2: "#181024",
    surface3: "#22172e",
    energy: "#8b5cf6",
    energyRgb: "139, 92, 246",
    energyDim: "rgba(139,92,246,0.10)",
    energyGlow: "rgba(139,92,246,0.16)",
    textPrimary: "rgba(232,224,250,0.94)",
    textSecondary: "rgba(180,168,212,0.56)",
    textDim: "rgba(135,120,170,0.32)",
    glassBase: "rgba(255,255,255,0.025)",
    glassHover: "rgba(255,255,255,0.045)",
    glassActive: "rgba(255,255,255,0.07)",
    glassBorder: "rgba(255,255,255,0.05)",
    glassBorderLit: "rgba(139,92,246,0.16)",
    glassBorderAccent: "rgba(139,92,246,0.20)",
    glassTint: "rgba(139,92,246,0.05)",
    glassTintHot: "rgba(139,92,246,0.12)",
    frost: "rgba(200,188,242,0.06)",
  }),
  paradise: Object.freeze({
    void: "#04090a",
    voidMid: "#071215",
    surface0: "#04090a",
    surface1: "#071215",
    surface2: "#0a1c1d",
    surface3: "#0f2624",
    energy: "#34c4ad",
    energyRgb: "52, 196, 173",
    energyDim: "rgba(52,196,173,0.10)",
    energyGlow: "rgba(52,196,173,0.16)",
    textPrimary: "rgba(220,242,236,0.94)",
    textSecondary: "rgba(160,200,190,0.56)",
    textDim: "rgba(110,158,148,0.32)",
    glassBase: "rgba(255,255,255,0.025)",
    glassHover: "rgba(255,255,255,0.045)",
    glassActive: "rgba(255,255,255,0.07)",
    glassBorder: "rgba(255,255,255,0.05)",
    glassBorderLit: "rgba(52,196,173,0.16)",
    glassBorderAccent: "rgba(52,196,173,0.20)",
    glassTint: "rgba(52,196,173,0.05)",
    glassTintHot: "rgba(52,196,173,0.12)",
    frost: "rgba(170,232,220,0.06)",
  }),
  pessimist: Object.freeze({
    void: "#08090a",
    voidMid: "#101113",
    surface0: "#08090a",
    surface1: "#101113",
    surface2: "#16181b",
    surface3: "#1c1f23",
    energy: "#b5bcc6",
    energyRgb: "181, 188, 198",
    energyDim: "rgba(181,188,198,0.06)",
    energyGlow: "rgba(181,188,198,0.10)",
    textPrimary: "rgba(220,224,232,0.92)",
    textSecondary: "rgba(160,166,176,0.56)",
    textDim: "rgba(110,116,124,0.34)",
    glassBase: "rgba(255,255,255,0.02)",
    glassHover: "rgba(255,255,255,0.04)",
    glassActive: "rgba(255,255,255,0.06)",
    glassBorder: "rgba(255,255,255,0.05)",
    glassBorderLit: "rgba(181,188,198,0.12)",
    glassBorderAccent: "rgba(181,188,198,0.16)",
    glassTint: "rgba(181,188,198,0.04)",
    glassTintHot: "rgba(181,188,198,0.08)",
    frost: "rgba(210,216,224,0.06)",
  }),
  optimist: Object.freeze({
    void: "#0a0805",
    voidMid: "#14100a",
    surface0: "#0a0805",
    surface1: "#14100a",
    surface2: "#1c1810",
    surface3: "#241f15",
    energy: "#d4a14a",
    energyRgb: "212, 161, 74",
    energyDim: "rgba(212,161,74,0.10)",
    energyGlow: "rgba(212,161,74,0.16)",
    textPrimary: "rgba(245,236,220,0.94)",
    textSecondary: "rgba(208,184,144,0.56)",
    textDim: "rgba(160,135,96,0.32)",
    glassBase: "rgba(255,255,255,0.025)",
    glassHover: "rgba(255,255,255,0.045)",
    glassActive: "rgba(255,255,255,0.07)",
    glassBorder: "rgba(255,255,255,0.05)",
    glassBorderLit: "rgba(212,161,74,0.16)",
    glassBorderAccent: "rgba(212,161,74,0.20)",
    glassTint: "rgba(212,161,74,0.05)",
    glassTintHot: "rgba(212,161,74,0.12)",
    frost: "rgba(232,206,156,0.06)",
  }),
  // Onyx — pure black, ice-white whisper of an accent. No color, no warm.
  allblack: Object.freeze({
    void: "#000000",
    voidMid: "#050505",
    surface0: "#000000",
    surface1: "#050505",
    surface2: "#0a0a0a",
    surface3: "#101010",
    energy: "#ffffff",
    energyRgb: "255, 255, 255",
    energyDim: "rgba(255,255,255,0.04)",
    energyGlow: "rgba(255,255,255,0.06)",
    textPrimary: "rgba(245,245,245,0.92)",
    textSecondary: "rgba(150,150,150,0.55)",
    textDim: "rgba(90,90,90,0.35)",
    glassBase: "rgba(255,255,255,0.02)",
    glassHover: "rgba(255,255,255,0.035)",
    glassActive: "rgba(255,255,255,0.05)",
    glassBorder: "rgba(255,255,255,0.04)",
    glassBorderLit: "rgba(255,255,255,0.08)",
    glassBorderAccent: "rgba(255,255,255,0.12)",
    glassHighlight: "rgba(255,255,255,0.08)",
    glassHighlightSoft: "rgba(255,255,255,0.04)",
    glassTint: "rgba(255,255,255,0.02)",
    glassTintHot: "rgba(255,255,255,0.05)",
    glassShadow: "rgba(0,0,0,0.42)",
    glassShadowDeep: "rgba(0,0,0,0.58)",
    frost: "rgba(255,255,255,0.04)",
  }),
});

export function getMoodColors(mood = "default") {
  return MONGREL_MOOD_COLORS[mood] || MONGREL_MOOD_COLORS.default;
}

export function getMongrelCssVariables(overrides = {}) {
  return {
    "--mongrel-font-ui": MONGREL_VISUAL_SYSTEM.typography.uiFont,
    "--mongrel-font-mono": MONGREL_VISUAL_SYSTEM.typography.monoFont,
    "--mongrel-color-void": MONGREL_VISUAL_SYSTEM.color.void,
    "--mongrel-color-void-mid": MONGREL_VISUAL_SYSTEM.color.voidMid,
    "--mongrel-color-surface": MONGREL_VISUAL_SYSTEM.color.surface,
    "--mongrel-color-energy": MONGREL_VISUAL_SYSTEM.color.energy,
    "--mongrel-color-energy-dim": MONGREL_VISUAL_SYSTEM.color.energyDim,
    "--mongrel-color-energy-glow": MONGREL_VISUAL_SYSTEM.color.energyGlow,
    "--mongrel-color-text": MONGREL_VISUAL_SYSTEM.color.textPrimary,
    "--mongrel-color-text-secondary": MONGREL_VISUAL_SYSTEM.color.textSecondary,
    "--mongrel-color-text-dim": MONGREL_VISUAL_SYSTEM.color.textDim,
    "--mongrel-bg": MONGREL_VISUAL_SYSTEM.color.glassBase,
    "--mongrel-bg-hover": MONGREL_VISUAL_SYSTEM.color.glassHover,
    "--mongrel-bg-active": MONGREL_VISUAL_SYSTEM.color.glassActive,
    "--mongrel-bg-deep": MONGREL_VISUAL_SYSTEM.color.void,
    "--mongrel-border": MONGREL_VISUAL_SYSTEM.color.glassBorder,
    "--mongrel-border-lit": MONGREL_VISUAL_SYSTEM.color.glassBorderLit,
    "--mongrel-glass-highlight": MONGREL_VISUAL_SYSTEM.color.glassHighlight,
    "--mongrel-glass-highlight-soft": MONGREL_VISUAL_SYSTEM.color.glassHighlightSoft,
    "--mongrel-glass-tint": MONGREL_VISUAL_SYSTEM.color.glassTint,
    "--mongrel-glass-tint-hot": MONGREL_VISUAL_SYSTEM.color.glassTintHot,
    "--mongrel-glass-shadow": MONGREL_VISUAL_SYSTEM.color.glassShadow,
    "--mongrel-glass-shadow-deep": MONGREL_VISUAL_SYSTEM.color.glassShadowDeep,
    "--mongrel-frost": MONGREL_VISUAL_SYSTEM.color.frost,
    "--mongrel-hot-spot": MONGREL_VISUAL_SYSTEM.color.energyGlow,
    "--mongrel-safe": MONGREL_VISUAL_SYSTEM.color.safe,
    "--mongrel-radius-panel": MONGREL_VISUAL_SYSTEM.radius.panel,
    "--mongrel-radius-surface": MONGREL_VISUAL_SYSTEM.radius.surface,
    "--mongrel-radius-control": MONGREL_VISUAL_SYSTEM.radius.control,
    "--mongrel-radius-pill": MONGREL_VISUAL_SYSTEM.radius.pill,
    "--mongrel-blur-chrome": MONGREL_VISUAL_SYSTEM.blur.chrome,
    "--mongrel-blur-panel": MONGREL_VISUAL_SYSTEM.blur.panel,
    "--mongrel-blur-control": MONGREL_VISUAL_SYSTEM.blur.control,
    "--mongrel-shadow-panel": MONGREL_VISUAL_SYSTEM.shadow.panel,
    "--mongrel-shadow-control": MONGREL_VISUAL_SYSTEM.shadow.control,
    "--mongrel-shadow-glow": MONGREL_VISUAL_SYSTEM.shadow.glow,
    "--mongrel-motion-fast": MONGREL_VISUAL_SYSTEM.motion.fast,
    "--mongrel-motion-medium": MONGREL_VISUAL_SYSTEM.motion.medium,
    ...overrides,
  };
}

export function getMongrelCssVariablesForMood(mood = "default", overrides = {}) {
  const colors = getMoodColors(mood);
  return getMongrelCssVariables({
    "--mongrel-color-void": colors.void || MONGREL_VISUAL_SYSTEM.color.void,
    "--mongrel-color-void-mid":
      colors.voidMid || MONGREL_VISUAL_SYSTEM.color.voidMid,
    "--mongrel-color-surface":
      colors.surface1 || colors.surface0 || MONGREL_VISUAL_SYSTEM.color.surface,
    "--mongrel-color-energy": colors.energy || MONGREL_VISUAL_SYSTEM.color.energy,
    "--mongrel-color-energy-rgb":
      colors.energyRgb || "90, 111, 255",
    "--mongrel-color-energy-dim":
      colors.energyDim || MONGREL_VISUAL_SYSTEM.color.energyDim,
    "--mongrel-color-energy-glow":
      colors.energyGlow || MONGREL_VISUAL_SYSTEM.color.energyGlow,
    "--mongrel-color-text":
      colors.textPrimary || MONGREL_VISUAL_SYSTEM.color.textPrimary,
    "--mongrel-color-text-secondary":
      colors.textSecondary || MONGREL_VISUAL_SYSTEM.color.textSecondary,
    "--mongrel-color-text-dim":
      colors.textDim || MONGREL_VISUAL_SYSTEM.color.textDim,
    "--mongrel-bg": colors.glassBase || MONGREL_VISUAL_SYSTEM.color.glassBase,
    "--mongrel-bg-hover":
      colors.glassHover || MONGREL_VISUAL_SYSTEM.color.glassHover,
    "--mongrel-bg-active":
      colors.glassActive || MONGREL_VISUAL_SYSTEM.color.glassActive,
    "--mongrel-bg-deep":
      colors.surface0 || colors.void || MONGREL_VISUAL_SYSTEM.color.void,
    "--mongrel-border":
      colors.glassBorder || MONGREL_VISUAL_SYSTEM.color.glassBorder,
    "--mongrel-border-lit":
      colors.glassBorderLit || MONGREL_VISUAL_SYSTEM.color.glassBorderLit,
    "--mongrel-border-accent":
      colors.glassBorderAccent ||
      colors.glassBorderLit ||
      MONGREL_VISUAL_SYSTEM.color.glassBorderLit,
    "--mongrel-glass-highlight":
      colors.glassHighlight || MONGREL_VISUAL_SYSTEM.color.glassHighlight,
    "--mongrel-glass-highlight-soft":
      colors.glassHighlightSoft ||
      MONGREL_VISUAL_SYSTEM.color.glassHighlightSoft,
    "--mongrel-glass-tint":
      colors.glassTint || MONGREL_VISUAL_SYSTEM.color.glassTint,
    "--mongrel-glass-tint-hot":
      colors.glassTintHot || colors.glassTint || MONGREL_VISUAL_SYSTEM.color.glassTint,
    "--mongrel-frost": colors.frost || MONGREL_VISUAL_SYSTEM.color.frost,
    "--mongrel-hot-spot":
      colors.energyGlow || MONGREL_VISUAL_SYSTEM.color.energyGlow,
    "--mongrel-surface-0":
      colors.surface0 || colors.void || MONGREL_VISUAL_SYSTEM.color.void,
    "--mongrel-surface-1":
      colors.surface1 || colors.voidMid || MONGREL_VISUAL_SYSTEM.color.voidMid,
    "--mongrel-surface-2":
      colors.surface2 || colors.surface1 || MONGREL_VISUAL_SYSTEM.color.surface,
    "--mongrel-surface-3":
      colors.surface3 || colors.surface2 || colors.surface1 || MONGREL_VISUAL_SYSTEM.color.surface,
    "--mongrel-text-0":
      colors.textPrimary || MONGREL_VISUAL_SYSTEM.color.textPrimary,
    "--mongrel-text-1":
      colors.textSecondary || MONGREL_VISUAL_SYSTEM.color.textSecondary,
    "--mongrel-glass-shadow":
      colors.glassShadow || "rgba(4,7,20,0.32)",
    "--mongrel-glass-shadow-deep":
      colors.glassShadowDeep || "rgba(2,4,14,0.46)",
    ...overrides,
  });
}

function buildCssRule(selector, body) {
  return `${selector} {
${body}
}`;
}

export function getMongrelCssRecipes(selectors = {}) {
  const {
    atmosphere = ":host",
    panel = ".mongrel-panel",
    toolbar = ".mongrel-toolbar",
    toolbarTitle = ".mongrel-toolbar-title",
    stage = ".mongrel-stage",
    pillControl = ".mongrel-pill-control",
    pillButton = ".mongrel-pill-button",
    sectionLabel = ".mongrel-section-label",
  } = selectors;

  return {
    atmosphere: `${buildCssRule(
      atmosphere,
      `  position: relative;
  width: 100%;
  min-height: 100vh;
  z-index: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  background-color: var(--mongrel-bg-deep, #08091a);
  background:
    linear-gradient(180deg, var(--mongrel-color-void-mid, #0d1130) 0%, var(--mongrel-bg-deep, #08091a) 100%);
  color: var(--mongrel-color-text, #eef7ff);
  font-family: var(--mongrel-font-ui, "Avenir Next", "SF Pro Display", sans-serif);`
    )}

${buildCssRule(
      `${atmosphere}::before`,
      `  content: "";
  position: fixed;
  inset: -12vh -12vw;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% -4%, var(--mongrel-hot-spot, rgba(90,111,255,0.35)), transparent 40%),
    radial-gradient(circle at 84% 0%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 28%, transparent), transparent 35%),
    radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 14%, transparent), transparent 28%);
  transform: translateZ(0);`
    )}`,
    panel: buildCssRule(
      panel,
      `  border-radius: var(--mongrel-radius-panel, 18px);
  border: 1px solid var(--mongrel-border, rgba(255,255,255,0.22));
  background:
    linear-gradient(180deg, var(--mongrel-glass-highlight-soft, rgba(255,255,255,0.08)) 0%, rgba(255,255,255,0) 24%),
    radial-gradient(circle at 14% 0%, var(--mongrel-glass-highlight, rgba(255,255,255,0.18)), transparent 28%),
    radial-gradient(circle at 82% 0%, var(--mongrel-glass-tint, rgba(126,148,255,0.10)), transparent 34%),
    linear-gradient(165deg, var(--mongrel-frost, rgba(180,200,255,0.12)) 0%, transparent 55%),
    var(--mongrel-bg, rgba(20, 30, 38, 0.62));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    var(--mongrel-shadow-panel, 0 24px 80px rgba(0, 0, 0, 0.34));`
    ),
    toolbar: buildCssRule(
      toolbar,
      `  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid var(--mongrel-border, rgba(255,255,255,0.09));
  border-radius: var(--mongrel-radius-control, 10px);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.01) 100%),
    var(--mongrel-bg, rgba(255,255,255,0.04));
  backdrop-filter: blur(var(--mongrel-blur-control, 12px)) saturate(1.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 14px rgba(0,0,0,0.14);`
    ),
    toolbarTitle: buildCssRule(
      toolbarTitle,
      `  flex: 1;
  text-align: left;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--mongrel-color-text-dim, rgba(140,155,210,0.35));`
    ),
    stage: buildCssRule(
      stage,
      `  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--mongrel-border, rgba(255,255,255,0.09)) 82%, transparent);
  border-radius: var(--mongrel-radius-surface, 14px);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 24%),
    color-mix(in srgb, var(--mongrel-color-surface, #111428) 68%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(255,255,255,0.02);`
    ),
    pillControl: buildCssRule(
      pillControl,
      `  border: 1px solid var(--mongrel-border, rgba(255,255,255,0.22));
  border-radius: var(--mongrel-radius-pill, 999px);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%),
    color-mix(in srgb, var(--mongrel-color-surface, #111428) 82%, transparent);
  color: inherit;
  backdrop-filter: blur(var(--mongrel-blur-control, 12px));
  box-sizing: border-box;
  transition:
    border-color var(--mongrel-motion-fast, 140ms ease),
    box-shadow var(--mongrel-motion-fast, 140ms ease),
    background var(--mongrel-motion-fast, 140ms ease),
    transform var(--mongrel-motion-fast, 140ms ease);`
    ),
    pillButton: buildCssRule(
      pillButton,
      `  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--mongrel-radius-pill, 999px);
  border: 1px solid var(--mongrel-border, rgba(255,255,255,0.18));
  background: var(--mongrel-bg, rgba(255,255,255,0.08));
  color: inherit;
  text-decoration: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
  transition:
    background var(--mongrel-motion-fast, 140ms ease),
    border-color var(--mongrel-motion-fast, 140ms ease),
    transform var(--mongrel-motion-fast, 140ms ease),
    box-shadow var(--mongrel-motion-fast, 140ms ease);`
    ),
    sectionLabel: buildCssRule(
      sectionLabel,
      `  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mongrel-color-text-dim, rgba(140,155,210,0.35));`
    ),
  };
}
