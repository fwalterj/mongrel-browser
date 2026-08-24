/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import {
  MONGREL_VISUAL_SYSTEM,
  getMongrelCssVariables,
  getMongrelCssVariablesForMood,
  getMoodColors,
} from "resource:///modules/MongrelVisualSystem.sys.mjs";

// Procedural fractal-noise SVG embedded as a CSS background-image.
// Tiles at 256×256 px, opacity 0.04 — adds micro-texture to glass
// surfaces so they read as material rather than just a blurred div.
const NOISE_URL =
  "url(\"data:image/svg+xml," +
  "%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E" +
  "%3Cfilter id='n'%3E" +
  "%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E" +
  "%3CfeColorMatrix type='saturate' values='0'/%3E" +
  "%3C/filter%3E" +
  "%3Crect width='256' height='256' filter='url(%23n)' opacity='0.04'/%3E" +
  "%3C/svg%3E\")";

const PREFS = [
  "mongrel.personalize.night_mode.enabled",
  "mongrel.personalize.night_mode.apply_to_web",
  "mongrel.personalize.night_mode.variant",
  "mongrel.nightmode.theme",
  "mongrel.nightmode.extend_to_pages",
  "mongrel.nightmode.adaptive_tinting",
  "mongrel.personalize.mood",
  "mongrel.personalize.bloom",
];

const STYLE_ID = "mongrel-theme-effects";

function isBrowserWindow(window) {
  return window?.location?.href === AppConstants.BROWSER_CHROME_URL;
}

function getSiteSeed(window) {
  try {
    const { currentURI } = window.gBrowser.selectedBrowser;
    if (!currentURI) {
      return "";
    }
    return currentURI.host || currentURI.spec || "";
  } catch {
    return "";
  }
}

function normalizeNightVariant(value) {
  const key = String(value || "follow").toLowerCase();
  switch (key) {
    case "follow":
    case "none":
    case "off":
      return "follow";
    case "abyssal":
    case "night":
      return key;
    case "standard":
    case "dark":
    case "classic-dark":
    case "classicdark":
    case "sepia":
    case "dusk":
    case "ash":
      return "night";
    case "black":
    case "deep-black":
    case "deepblack":
    case "all-black":
    case "allblack":
    case "deep-dark-blue":
    case "bluehour":
      return "abyssal";
    default:
      return "follow";
  }
}

function colorFromSeed(seed) {
  const raw = String(seed || "");
  if (!raw) {
    return "90, 111, 255";
  }

  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hue = Math.abs(hash) % 360;
  const sat = 62;
  const light = 58;

  const c = (1 - Math.abs(2 * (light / 100) - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light / 100 - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return `${r}, ${g}, ${b}`;
}

function buildChromeCss() {
  return `
    :root[data-mongrel-personalized="true"] {
      color-scheme: dark;
      --mongrel-chrome-veil:
        linear-gradient(180deg,
          rgba(255,255,255,0.10) 0%,
          rgba(255,255,255,0.03) 18%,
          rgba(255,255,255,0.00) 36%);
      --mongrel-chrome-rib:
        linear-gradient(90deg,
          rgba(255,255,255,0.00) 0%,
          var(--mongrel-glass-highlight-soft, rgba(255,255,255,0.09)) 12%,
          rgba(255,255,255,0.00) 26%,
          rgba(255,255,255,0.00) 74%,
          color-mix(in srgb, var(--mongrel-glass-tint, rgba(126,148,255,0.12)) 82%, rgba(255,255,255,0.04)) 88%,
          rgba(255,255,255,0.00) 100%);
    }

    /* ── Window shell ───────────────────────────────────────── */
    /* Note: In browser.xhtml, <html id="main-window"> IS the root element,
       so we target :root directly — a descendant selector for #main-window
       would never match since an element cannot be its own descendant. */
    :root[data-mongrel-personalized="true"] {
      background:
        radial-gradient(ellipse 60% 40% at 12% -6%, var(--mongrel-color-energy-glow, rgba(90,111,255,0.35)), transparent),
        radial-gradient(ellipse 42% 32% at 90% 2%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 22%, transparent), transparent),
        radial-gradient(ellipse 50% 60% at 88% 92%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 10%, transparent), transparent),
        linear-gradient(178deg, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24)) 0%, var(--mongrel-surface-0, var(--mongrel-color-void, #08091a)) 100%) !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    /* ── Toolbox container ──────────────────────────────────── */
    :root[data-mongrel-personalized="true"] #navigator-toolbox {
      position: relative !important;
      background:
        var(--mongrel-chrome-veil),
        radial-gradient(ellipse 120% 100% at 50% -24%, color-mix(in srgb, var(--mongrel-glass-tint-hot, rgba(126,148,255,0.22)) 70%, transparent), transparent 58%),
        linear-gradient(180deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.01) 22%,
          rgba(255,255,255,0.00) 48%),
        linear-gradient(180deg,
          color-mix(in srgb, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24)) 82%, var(--mongrel-color-energy, #5a6fff)) 0%,
          transparent 100%) !important;
      backdrop-filter: blur(var(--mongrel-v-blur-chrome, var(--mongrel-blur-chrome, 24px))) saturate(1.7) brightness(1.02) !important;
      -webkit-backdrop-filter: blur(var(--mongrel-v-blur-chrome, var(--mongrel-blur-chrome, 24px))) saturate(1.7) brightness(1.02) !important;
      border-bottom: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.06),
        0 24px 48px var(--mongrel-glass-shadow, rgba(4,7,20,0.42)),
        0 42px 80px var(--mongrel-glass-shadow-deep, rgba(2,4,14,0.62)),
        inset 0 1px 0 var(--mongrel-glass-highlight-soft, rgba(255,255,255,0.09)),
        inset 0 -1px 0 rgba(255,255,255,0.03) !important;
    }

    :root[data-mongrel-personalized="true"] #navigator-toolbox::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        var(--mongrel-chrome-rib),
        radial-gradient(circle at 18% 0%, var(--mongrel-glass-highlight, rgba(255,255,255,0.18)), transparent 28%),
        radial-gradient(circle at 80% 0%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 18%, rgba(255,255,255,0.12)), transparent 34%);
      mix-blend-mode: screen;
      opacity: 0.78;
    }

    :root[data-mongrel-personalized="true"][data-mongrel-adaptive-tint="true"] #navigator-toolbox::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 55% 85% at 12% 10%, rgba(var(--mongrel-site-adapt-rgb, 90, 111, 255), 0.20), transparent 72%),
        linear-gradient(110deg, rgba(var(--mongrel-site-adapt-rgb, 90, 111, 255), 0.12) 0%, transparent 62%);
      mix-blend-mode: screen;
      opacity: 0.85;
      border-radius: inherit;
    }

    :root[data-mongrel-personalized="true"] #TabsToolbar,
    :root[data-mongrel-personalized="true"] #nav-bar,
    :root[data-mongrel-personalized="true"] #PersonalToolbar,
    :root[data-mongrel-personalized="true"] #tabbrowser-tabbox,
    :root[data-mongrel-personalized="true"] #sidebar-box,
    :root[data-mongrel-personalized="true"] findbar {
      background: transparent !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    /* ── TabsToolbar strip ──────────────────────────────────── */
    :root[data-mongrel-personalized="true"] #TabsToolbar {
      padding-block: 6px 2px !important;
    }

    /* ── Tabs (formless) ─────────────────────────────────────────
     * Inactive tabs: completely chrome-less. No border, no fill, no
     * hover bevel — just label text on the toolbar.
     * Hover: a whisper of a tint, still no visible border.
     * Active: a soft accent halo (drop-shadow) and a barely-there
     * surface lift. No outline, no border. The tab is recognised by
     * its glow, not by its perimeter.
     */
    :root[data-mongrel-personalized="true"] .tabbrowser-tab .tab-background {
      background: transparent !important;
      border: 0 !important;
      outline: none !important;
      box-shadow: none !important;
      border-radius: 10px !important;
      transition:
        background 180ms ease,
        box-shadow 220ms ease,
        filter 220ms ease !important;
    }

    :root[data-mongrel-personalized="true"] .tabbrowser-tab:hover .tab-background:not([selected]) {
      background:
        linear-gradient(180deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.00) 100%) !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    :root[data-mongrel-personalized="true"] .tab-background[selected] {
      background:
        radial-gradient(ellipse 130% 100% at 50% 110%,
          color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 14%, transparent) 0%,
          transparent 70%),
        linear-gradient(180deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.00) 100%) !important;
      border: 0 !important;
      outline: none !important;
      /* The selected-state identity: a soft accent halo, no perimeter. */
      box-shadow:
        0 0 0 1px transparent,
        0 0 18px var(--mongrel-color-energy-glow, rgba(90,111,255,0.18)),
        0 0 42px var(--mongrel-color-energy-glow, rgba(90,111,255,0.18)) !important;
      transform: none !important;
    }

    :root[data-mongrel-personalized="true"] .tab-label,
    :root[data-mongrel-personalized="true"] .tab-text {
      color: var(--mongrel-text-1, var(--mongrel-color-text-secondary, rgba(180,190,230,0.72))) !important;
    }

    :root[data-mongrel-personalized="true"] .tab-background[selected] ~ .tab-stack > .tab-content .tab-label {
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.95))) !important;
      font-weight: 450 !important;
    }

    /* ── URL bar ────────────────────────────────────────────── */
    :root[data-mongrel-personalized="true"] #urlbar-background {
      background:
        ${NOISE_URL} left top / 256px 256px,
        linear-gradient(180deg,
          rgba(255,255,255,0.12) 0%,
          rgba(255,255,255,0.03) 28%,
          rgba(255,255,255,0.00) 100%),
        radial-gradient(ellipse 140% 90% at 50% -32%, color-mix(in srgb, var(--mongrel-glass-tint, rgba(126,148,255,0.12)) 92%, rgba(255,255,255,0.06)), transparent 58%),
        color-mix(in srgb, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24)) 74%, transparent) !important;
      border: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.10))) !important;
      box-shadow:
        inset 0 1px 0 var(--mongrel-glass-highlight-soft, rgba(255,255,255,0.09)),
        inset 0 -8px 18px rgba(255,255,255,0.02),
        0 12px 28px rgba(0,0,0,0.24),
        0 0 0 1px rgba(255,255,255,0.02) !important;
      border-radius: 13px !important;
      backdrop-filter: blur(var(--mongrel-v-blur-control, var(--mongrel-blur-control, 14px))) saturate(1.55) brightness(1.02) !important;
      -webkit-backdrop-filter: blur(var(--mongrel-v-blur-control, var(--mongrel-blur-control, 14px))) saturate(1.55) brightness(1.02) !important;
    }

    :root[data-mongrel-personalized="true"] #urlbar[focused] #urlbar-background {
      background:
        ${NOISE_URL} left top / 256px 256px,
        linear-gradient(180deg,
          rgba(255,255,255,0.16) 0%,
          rgba(255,255,255,0.04) 26%,
          rgba(255,255,255,0.00) 100%),
        radial-gradient(ellipse 132% 90% at 50% -30%, color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 36%, rgba(255,255,255,0.10)), transparent 58%),
        color-mix(in srgb, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24)) 86%, var(--mongrel-color-energy, #5a6fff)) !important;
      border-color: var(--mongrel-color-energy, #5a6fff) !important;
      box-shadow:
        0 0 0 2.5px var(--mongrel-color-energy-glow, rgba(90,111,255,0.28)),
        inset 0 1px 0 var(--mongrel-glass-highlight, rgba(255,255,255,0.18)),
        inset 0 -10px 22px rgba(255,255,255,0.03),
        0 16px 32px rgba(0,0,0,0.28),
        0 0 34px var(--mongrel-color-energy-glow, rgba(90,111,255,0.18)) !important;
    }

    :root[data-mongrel-personalized="true"] #urlbar > .urlbar-input-container {
      background:
        linear-gradient(180deg,
          rgba(255,255,255,0.05) 0%,
          rgba(255,255,255,0.00) 100%),
        color-mix(in srgb, var(--mongrel-surface-2, var(--mongrel-surface-1, #202330)) 84%, transparent) !important;
      border-radius: 11px !important;
      border: 0.5px solid color-mix(in srgb, var(--mongrel-border-accent, var(--mongrel-border-lit, rgba(120,140,255,0.22))) 88%, rgba(255,255,255,0.10)) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.07),
        inset 0 -1px 0 rgba(255,255,255,0.02) !important;
    }

    :root[data-mongrel-personalized="true"] #urlbar-input,
    :root[data-mongrel-personalized="true"] #urlbar .urlbar-input {
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    /* ── Nav-bar glass floor ────────────────────────────────── */
    :root[data-mongrel-personalized="true"] #nav-bar {
      padding-block: 8px 9px !important;
    }

    /* ── Toolbar buttons ────────────────────────────────────── */
    :root[data-mongrel-personalized="true"] toolbarbutton,
    :root[data-mongrel-personalized="true"] .toolbarbutton-1 {
      color: var(--mongrel-text-1, var(--mongrel-color-text-secondary, rgba(180,190,230,0.7))) !important;
      border-radius: 7px !important;
      transition: background 120ms ease, box-shadow 120ms ease !important;
    }

    :root[data-mongrel-personalized="true"] .toolbarbutton-1:hover,
    :root[data-mongrel-personalized="true"] toolbarbutton:hover {
      background:
        linear-gradient(180deg,
          rgba(255,255,255,0.08) 0%,
          rgba(255,255,255,0.02) 100%),
        var(--mongrel-hover-0, rgba(255,255,255,0.09)) !important;
      border-radius: 8px !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 6px 14px rgba(0,0,0,0.16) !important;
    }

    :root[data-mongrel-personalized="true"] .toolbarbutton-1[open],
    :root[data-mongrel-personalized="true"] .toolbarbutton-1:active {
      background: var(--mongrel-active-0, var(--mongrel-color-energy-dim, rgba(90,111,255,0.18))) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.06),
        0 0 12px var(--mongrel-color-energy-glow, rgba(90,111,255,0.22)) !important;
    }

    :root[data-mongrel-personalized="true"] #PanelUI-menu-button {
      border-radius: 10px !important;
      background:
        linear-gradient(180deg,
          rgba(255,255,255,0.10) 0%,
          rgba(255,255,255,0.02) 100%),
        color-mix(in srgb, var(--mongrel-surface-2, #202330) 78%, transparent) !important;
      border: 0.5px solid var(--mongrel-border-accent, var(--mongrel-border-lit, rgba(120,140,255,0.22))) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 8px 18px rgba(0,0,0,0.18) !important;
    }

    :root[data-mongrel-personalized="true"] #PanelUI-menu-button:hover {
      background: color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 22%, var(--mongrel-surface-2, #202330)) !important;
    }

    :root[data-mongrel-personalized="true"] #PanelUI-menu-button[open] {
      background: color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 30%, var(--mongrel-surface-2, #202330)) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.10),
        0 0 16px var(--mongrel-color-energy-glow, rgba(90,111,255,0.25)) !important;
    }

    /* ── Sidebar ────────────────────────────────────────────── */
    :root[data-mongrel-personalized="true"] #sidebar-box {
      background: color-mix(in srgb, var(--mongrel-surface-0, var(--mongrel-color-void, #08091a)) 92%, var(--mongrel-color-energy, #5a6fff)) !important;
      border-inline-end: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
    }

    /* ── Findbar ────────────────────────────────────────────── */
    :root[data-mongrel-personalized="true"] findbar {
      background: color-mix(in srgb, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24)) 96%, transparent) !important;
      border-top: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
    }

    /* ── Context menus / popups ─────────────────────────────── */
    :root[data-mongrel-personalized="true"] menupopup,
    :root[data-mongrel-personalized="true"] panel {
      --panel-background: color-mix(in srgb, var(--mongrel-surface-3, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24))) 92%, var(--mongrel-color-energy, #5a6fff)) !important;
      --panel-border-color: var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.11))) !important;
      --panel-shadow: 0 16px 48px rgba(0,0,0,0.48), 0 0 0 0.5px var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
      background:
        ${NOISE_URL} left top / 256px 256px,
        color-mix(in srgb, var(--mongrel-surface-3, var(--mongrel-surface-1, var(--mongrel-color-void-mid, #0d0f24))) 92%, var(--mongrel-color-energy, #5a6fff)) !important;
    }

    /* ── Application menu (hamburger / PanelUI) ─────────────── */
    :root[data-mongrel-personalized="true"] #appMenu-popup,
    :root[data-mongrel-personalized="true"] #appMenu-popup > .panel-arrowcontainer > .panel-arrowcontent,
    :root[data-mongrel-personalized="true"] #appMenu-popup .panel-subviews {
      background:
        ${NOISE_URL} left top / 256px 256px,
        color-mix(in srgb, var(--mongrel-color-void-mid, #0d0f24) 92%, var(--mongrel-color-energy, #5a6fff)) !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-mainView,
    :root[data-mongrel-personalized="true"] #appMenu-popup panelview {
      background: transparent !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup .subviewbutton,
    :root[data-mongrel-personalized="true"] #appMenu-popup .subviewbutton-iconic,
    :root[data-mongrel-personalized="true"] #appMenu-popup toolbarbutton {
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
      border-radius: 6px !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup .subviewbutton:hover,
    :root[data-mongrel-personalized="true"] #appMenu-popup .subviewbutton-iconic:hover,
    :root[data-mongrel-personalized="true"] #appMenu-popup toolbarbutton:hover {
      background: var(--mongrel-hover-0, rgba(255,255,255,0.08)) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06) !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup .panel-header {
      background: color-mix(in srgb, var(--mongrel-color-void-mid, #0d0f24) 80%, var(--mongrel-color-energy, #5a6fff)) !important;
      border-bottom: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.92))) !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup menuseparator,
    :root[data-mongrel-personalized="true"] #appMenu-popup toolbarseparator {
      border-color: var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup .panel-footer {
      background: color-mix(in srgb, var(--mongrel-color-void, #08091a) 88%, var(--mongrel-color-energy, #5a6fff)) !important;
      border-top: 0.5px solid var(--mongrel-border-0, var(--mongrel-border, rgba(255,255,255,0.09))) !important;
    }

    /* ── Selection / highlight ──────────────────────────────── */
    :root[data-mongrel-personalized="true"] ::selection {
      background: var(--mongrel-color-energy-dim, rgba(90,111,255,0.28)) !important;
      color: var(--mongrel-text-0, var(--mongrel-color-text, rgba(220,225,255,0.95))) !important;
    }

    :root[data-mongrel-personalized="true"][data-mongrel-mood="allblack"] ::selection {
      background: rgba(190, 223, 255, 0.52) !important;
      color: #041525 !important;
    }

    /* ── Scrollbars ─────────────────────────────────────────── */
    :root[data-mongrel-personalized="true"] * {
      scrollbar-color: color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 22%, rgba(255,255,255,0.14)) transparent !important;
      scrollbar-width: thin !important;
    }

    /* ── Load progress bar on URL bar ───────────────────────── */
    :root[data-mongrel-personalized="true"][data-mongrel-urlbar-loading="true"] #urlbar-background::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      width: calc(var(--mongrel-urlbar-load-progress, 0) * 100%);
      height: 1.5px;
      background: linear-gradient(
        90deg,
        var(--mongrel-color-energy, #5a6fff),
        color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 60%, white)
      );
      border-radius: 0 0 9px 9px;
      box-shadow: 0 0 8px var(--mongrel-color-energy-glow, rgba(90,111,255,0.5));
      transition: width 160ms ease, opacity 200ms;
      pointer-events: none;
    }

    /* ── Bloom glow — scales with --mongrel-bloom-ratio ─────── */
    /* At ratio 0 (default) all values compute to 0 — no glow. */

    :root[data-mongrel-personalized="true"] .tab-background[selected] {
      filter:
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 10px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.25)))
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 24px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.12)));
    }

    :root[data-mongrel-personalized="true"] .tab-background[selected] ~ .tab-stack > .tab-content .tab-label {
      text-shadow:
        0 0 calc(var(--mongrel-bloom-ratio, 0) * 6px) var(--mongrel-color-energy, rgba(90,111,255,0.9)),
        0 0 calc(var(--mongrel-bloom-ratio, 0) * 16px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.5));
    }

    :root[data-mongrel-personalized="true"] #urlbar[focused] #urlbar-background {
      filter:
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 8px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.28)))
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 20px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.12)));
    }

    :root[data-mongrel-personalized="true"] #urlbar[focused] #urlbar-input {
      text-shadow:
        0 0 calc(var(--mongrel-bloom-ratio, 0) * 5px) var(--mongrel-color-energy, rgba(90,111,255,0.8)),
        0 0 calc(var(--mongrel-bloom-ratio, 0) * 14px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.4));
    }

    :root[data-mongrel-personalized="true"] .toolbarbutton-1[open],
    :root[data-mongrel-personalized="true"] .toolbarbutton-1:active {
      filter:
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 7px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.3)))
        drop-shadow(0 0 calc(var(--mongrel-bloom-ratio, 0) * 18px) var(--mongrel-color-energy-glow, rgba(90,111,255,0.12)));
    }

    /* Mood-accent border overrides removed: tabs are formless. The mood is
     * conveyed entirely through the soft halo (--mongrel-color-energy-glow),
     * which is already mood-derived in MongrelVisualSystem. */

    /* ── Variant-specific chrome tinting ───────────────────── */
    :root[data-mongrel-variant="abyssal"] {
      --mongrel-color-void: #000000 !important;
      --mongrel-color-void-mid: #050506 !important;
      --mongrel-surface-0: #000000 !important;
      --mongrel-surface-1: #08080a !important;
      --mongrel-surface-2: #101014 !important;
      --mongrel-color-energy: #6f7680 !important;
      --mongrel-color-energy-rgb: 111, 118, 128 !important;
      --mongrel-color-energy-dim: rgba(111,118,128,0.16) !important;
      --mongrel-color-energy-glow: rgba(111,118,128,0.22) !important;
    }

    :root[data-mongrel-variant="bluehour"] {
      --mongrel-color-void: #050914 !important;
      --mongrel-color-void-mid: #0a1328 !important;
      --mongrel-surface-0: #050914 !important;
      --mongrel-surface-1: #0d1934 !important;
      --mongrel-surface-2: #162447 !important;
      --mongrel-color-energy: #4d79ff !important;
      --mongrel-color-energy-rgb: 77, 121, 255 !important;
      --mongrel-color-energy-dim: rgba(77,121,255,0.18) !important;
      --mongrel-color-energy-glow: rgba(77,121,255,0.30) !important;
    }

    :root[data-mongrel-variant="dusk"] {
      --mongrel-color-void: #1d1712 !important;
      --mongrel-color-void-mid: #2a221b !important;
      --mongrel-surface-0: #1d1712 !important;
      --mongrel-surface-1: #32281f !important;
      --mongrel-surface-2: #433426 !important;
      --mongrel-color-energy: #d4a76a !important;
      --mongrel-color-energy-rgb: 212, 167, 106 !important;
      --mongrel-color-energy-dim: rgba(212,167,106,0.18) !important;
      --mongrel-color-energy-glow: rgba(212,167,106,0.26) !important;
    }

    :root[data-mongrel-variant="ash"] {
      --mongrel-color-void: #121214 !important;
      --mongrel-color-void-mid: #1a1b1f !important;
      --mongrel-surface-0: #121214 !important;
      --mongrel-surface-1: #1d1e23 !important;
      --mongrel-surface-2: #262831 !important;
      --mongrel-color-energy: #aeb6c1 !important;
      --mongrel-color-energy-rgb: 174, 182, 193 !important;
      --mongrel-color-energy-dim: rgba(174,182,193,0.16) !important;
      --mongrel-color-energy-glow: rgba(174,182,193,0.22) !important;
    }

    :root[data-mongrel-mood="allblack"] {
      --mongrel-color-void: #000000 !important;
      --mongrel-color-void-mid: #000000 !important;
      --mongrel-surface-0: #000000 !important;
      --mongrel-surface-1: #000000 !important;
      --mongrel-surface-2: #000000 !important;
      --mongrel-color-energy: #000000 !important;
      --mongrel-color-energy-rgb: 0, 0, 0 !important;
      --mongrel-color-energy-dim: rgba(0,0,0,0) !important;
      --mongrel-color-energy-glow: rgba(0,0,0,0) !important;
      --mongrel-border-lit: rgba(64,64,64,0.20) !important;
    }

    /* ── App Menu contrast by mood ─────────────────────────── */
    :root[data-mongrel-personalized="true"] #PanelUI-menu-button {
      color: var(--mongrel-color-energy, #5a6fff) !important;
    }

    :root[data-mongrel-personalized="true"] #PanelUI-menu-button > .toolbarbutton-badge-stack {
      border: 0.5px solid color-mix(in srgb, currentColor 45%, transparent) !important;
      border-radius: 8px !important;
      background: color-mix(in srgb, currentColor 12%, transparent) !important;
    }

    :root[data-mongrel-mood="pessimist"] #PanelUI-menu-button {
      color: #e5e9ef !important;
    }

    :root[data-mongrel-mood="infernal"] #PanelUI-menu-button {
      color: #ff785f !important;
    }

    :root[data-mongrel-mood="paradise"] #PanelUI-menu-button {
      color: #8ef4e5 !important;
    }

    :root[data-mongrel-mood="allblack"] #PanelUI-menu-button {
      color: #c8c8c8 !important;
    }

    /* ── Sanctuary button ───────────────────────────────────── */
    #mongrel-sanctuary-button {
      font-size: 11px !important;
      padding-inline: 8px !important;
      border-radius: 4px !important;
      min-width: 0 !important;
    }
    #mongrel-sanctuary-button[mongrel-sanctuary-state="bootstrapping"],
    #mongrel-sanctuary-button[mongrel-sanctuary-state="starting"] {
      opacity: 0.7 !important;
    }
    #mongrel-sanctuary-button[mongrel-sanctuary-state="running"] {
      color: #5fff8a !important;
      border: 1px solid rgba(95, 255, 138, 0.35) !important;
    }
    #mongrel-sanctuary-button[mongrel-sanctuary-state="error"] {
      color: #ff6060 !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       PREMIUM PASS — glass material, press physics, light grammar
       ═══════════════════════════════════════════════════════════════ */

    /* ── Chromatic aberration: gives the chrome a genuine glass
       quality via an imperceptible hue shift. Composited on GPU. ───── */
    :root[data-mongrel-personalized="true"] #navigator-toolbox {
      filter: hue-rotate(0.5deg) brightness(1.005) !important;
    }

    /* ── Radial light refraction — light entering the glass from
       top-left and top-right corners simultaneously. ─────────────────── */
    :root[data-mongrel-personalized="true"] #navigator-toolbox::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        radial-gradient(ellipse 35% 55% at 4% 0%,
          color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 14%, rgba(255,255,255,0.06)),
          transparent 68%),
        radial-gradient(ellipse 28% 42% at 98% 0%,
          rgba(255,255,255,0.035),
          transparent 60%);
    }

    /* ── Press micro-physics: scale + opacity make buttons feel
       solid rather than just colour-shifting. ───────────────────────── */
    :root[data-mongrel-personalized="true"] toolbarbutton,
    :root[data-mongrel-personalized="true"] .toolbarbutton-1 {
      will-change: transform, opacity !important;
      transition:
        background  120ms ease,
        box-shadow  120ms ease,
        transform   100ms cubic-bezier(0.34, 1.56, 0.64, 1),
        opacity     100ms ease !important;
    }

    :root[data-mongrel-personalized="true"] .toolbarbutton-1:active,
    :root[data-mongrel-personalized="true"] toolbarbutton:active {
      transform: scale(0.96) !important;
      opacity: 0.88 !important;
    }

    /* ── Tab typography: semi-bold selected tab, regular inactive. ─── */
    :root[data-mongrel-personalized="true"] .tab-background[selected] ~ .tab-stack > .tab-content .tab-label {
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
    }

    :root[data-mongrel-personalized="true"] .tabbrowser-tab:not([selected]) .tab-label {
      font-weight: 400 !important;
    }

    /* ── Tab press: sinks toward bottom edge on click. ──────────────── */
    :root[data-mongrel-personalized="true"] .tabbrowser-tab:active .tab-background {
      transform: scaleY(0.97) !important;
      transform-origin: bottom !important;
    }

    /* ── URL bar: luminosity shift on focus, not just ring. ─────────── */
    :root[data-mongrel-personalized="true"] #urlbar-background {
      transition:
        border-color    160ms ease,
        box-shadow      160ms ease,
        filter          160ms ease,
        backdrop-filter 280ms ease !important;
    }

    /* ── Scroll-driven depth: blur thickens when the page has scrolled,
       making the chrome feel physically elevated above the content. ──── */
    :root[data-mongrel-personalized="true"][data-mongrel-page-scrolled="true"] #urlbar-background {
      backdrop-filter: blur(20px) saturate(1.6) !important;
      -webkit-backdrop-filter: blur(20px) saturate(1.6) !important;
    }

    :root[data-mongrel-personalized="true"] #urlbar[focused] #urlbar-background {
      filter: brightness(1.06) !important;
    }

    :root[data-mongrel-personalized="true"] #urlbar-input {
      font-weight: 450 !important;
      letter-spacing: -0.005em !important;
    }

    /* ── Context menu: deep elevation shadow, no hard frame. ───────── */
    :root[data-mongrel-personalized="true"] menupopup {
      box-shadow:
        0 24px 64px rgba(0,0,0,0.60),
        0 8px 24px rgba(0,0,0,0.32),
        inset 0 1px 0 rgba(255,255,255,0.09),
        0 0 0 0.5px var(--mongrel-border-0, rgba(255,255,255,0.09)) !important;
    }

    /* ── Menu item press physics. ───────────────────────────────────── */
    :root[data-mongrel-personalized="true"] menuitem:active,
    :root[data-mongrel-personalized="true"] menu:active {
      transform: scale(0.99) !important;
      opacity: 0.92 !important;
    }

    /* ── App-menu header: semi-bold category labels. ────────────────── */
    :root[data-mongrel-personalized="true"] #appMenu-popup .panel-header > label,
    :root[data-mongrel-personalized="true"] #appMenu-popup .panel-header > h1 {
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
    }

    :root[data-mongrel-personalized="true"] #appMenu-popup .subviewbutton:active {
      transform: scale(0.98) !important;
      opacity: 0.90 !important;
    }

    /* ── Edge catch: 1px luminous inset at the top of floating
       panels — the glass catching overhead light. ───────────────────── */
    :root[data-mongrel-personalized="true"] #appMenu-popup > .panel-arrowcontainer > .panel-arrowcontent {
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.12),
        0 32px 80px rgba(0,0,0,0.60),
        0 0 0 0.5px var(--mongrel-border-0, rgba(255,255,255,0.09)) !important;
    }
  `;
}

export const MongrelThemeEffects = {
  _initialized: false,
  _windowState: new WeakMap(),

  _isSelectedTopLevelProgress(window, webProgress) {
    try {
      if (!webProgress?.isTopLevel) {
        return false;
      }

      const selected = window.gBrowser?.selectedBrowser?.browsingContext;
      const current = webProgress.browsingContext;
      return !!selected && !!current && selected.id === current.id;
    } catch {
      return false;
    }
  },

  _setUrlbarProgress(window, progress, loading) {
    if (!isBrowserWindow(window)) {
      return;
    }

    const root = window.document?.documentElement;
    if (!root) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, progress));
    root.style.setProperty("--mongrel-urlbar-load-progress", String(clamped));
    if (loading) {
      root.setAttribute("data-mongrel-urlbar-loading", "true");
    } else {
      root.removeAttribute("data-mongrel-urlbar-loading");
    }
  },

  _syncProgressFromSelectedTab(window) {
    const tab = window.gBrowser?.selectedTab;
    const busy = !!tab?.hasAttribute("busy");
    this._setUrlbarProgress(window, busy ? 0.12 : 0, busy);
  },

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    for (const pref of PREFS) {
      Services.prefs.addObserver(pref, this);
    }
    Services.obs.addObserver(this, "browser-delayed-startup-finished");

    for (const window of Services.wm.getEnumerator("navigator:browser")) {
      this._attachToWindow(window);
      this._applyToWindow(window);
    }
  },

  destroy() {
    if (!this._initialized) {
      return;
    }

    this._initialized = false;
    for (const pref of PREFS) {
      Services.prefs.removeObserver(pref, this);
    }
    Services.obs.removeObserver(this, "browser-delayed-startup-finished");

    for (const window of Services.wm.getEnumerator("navigator:browser")) {
      this._detachFromWindow(window);
    }
  },

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished") {
      const window = subject;
      if (isBrowserWindow(window)) {
        this._attachToWindow(window);
        this._applyToWindow(window);
      }
      return;
    }

    this._refreshAllWindows();
  },

  _refreshAllWindows() {
    for (const window of Services.wm.getEnumerator("navigator:browser")) {
      this._applyToWindow(window);
    }
  },

  _attachToWindow(window) {
    if (!isBrowserWindow(window) || this._windowState.has(window)) {
      return;
    }

    const progressListener = {
      QueryInterface: ChromeUtils.generateQI([
        Ci.nsIWebProgressListener,
        Ci.nsISupportsWeakReference,
      ]),

      onLocationChange: webProgress => {
        if (MongrelThemeEffects._isSelectedTopLevelProgress(window, webProgress)) {
          MongrelThemeEffects._setUrlbarProgress(window, 0.12, true);
          // New page starts at the top — clear scroll-driven blur.
          window.document?.documentElement?.removeAttribute("data-mongrel-page-scrolled");
        }
        MongrelThemeEffects._applyToWindow(window);
      },

      onStateChange(webProgress, request, stateFlags) {
        if (!MongrelThemeEffects._isSelectedTopLevelProgress(window, webProgress)) {
          return;
        }

        const stateStart = Ci.nsIWebProgressListener.STATE_START;
        const stateStop = Ci.nsIWebProgressListener.STATE_STOP;

        if (stateFlags & stateStart) {
          MongrelThemeEffects._setUrlbarProgress(window, 0.08, true);
          return;
        }

        if (stateFlags & stateStop) {
          const state = MongrelThemeEffects._windowState.get(window);
          if (state?.progressResetTimer) {
            window.clearTimeout(state.progressResetTimer);
          }

          MongrelThemeEffects._setUrlbarProgress(window, 1, true);
          const timer = window.setTimeout(() => {
            MongrelThemeEffects._setUrlbarProgress(window, 0, false);
            const latestState = MongrelThemeEffects._windowState.get(window);
            if (latestState) {
              latestState.progressResetTimer = null;
            }
          }, 140);

          if (state) {
            state.progressResetTimer = timer;
          }
        }
      },

      onProgressChange(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
        if (!MongrelThemeEffects._isSelectedTopLevelProgress(window, webProgress)) {
          return;
        }

        if (maxTotalProgress > 0) {
          const ratio = curTotalProgress / maxTotalProgress;
          MongrelThemeEffects._setUrlbarProgress(window, ratio, true);
        }
      },
      onStatusChange() {},
      onSecurityChange() {},
      onContentBlockingEvent() {},
    };

    const onTabSelect = () => {
      this._applyToWindow(window);
      this._syncProgressFromSelectedTab(window);
    };

    const onUnload = () => {
      this._detachFromWindow(window);
    };

    window.gBrowser.addTabsProgressListener(progressListener);
    window.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    window.addEventListener("unload", onUnload, { once: true });

    this._windowState.set(window, {
      progressListener,
      onTabSelect,
      onUnload,
      progressResetTimer: null,
      lastAppliedMood: null,
      lastAppliedBloom: -1,
      lastAppliedVariant: null,
    });
    this._syncProgressFromSelectedTab(window);
  },

  _detachFromWindow(window) {
    const state = this._windowState.get(window);
    if (!state || !window.gBrowser) {
      this._windowState.delete(window);
      return;
    }

    try {
      window.gBrowser.removeTabsProgressListener(state.progressListener);
    } catch {}
    try {
      window.gBrowser.tabContainer.removeEventListener("TabSelect", state.onTabSelect);
    } catch {}
    if (state.progressResetTimer) {
      window.clearTimeout(state.progressResetTimer);
    }
    this._setUrlbarProgress(window, 0, false);
    this._windowState.delete(window);
  },

  _applyToWindow(window) {
    if (!isBrowserWindow(window)) {
      return;
    }

    const root = window.document.documentElement;
    if (!root) {
      return;
    }

    const mood = Services.prefs.getStringPref("mongrel.personalize.mood", "default");
    const bloom = Services.prefs.getIntPref("mongrel.personalize.bloom", 5);
    const variant = normalizeNightVariant(
      Services.prefs.getStringPref(
        "mongrel.nightmode.theme",
        Services.prefs.getStringPref("mongrel.personalize.night_mode.variant", "follow")
      )
    );
    const adaptiveTinting = Services.prefs.getBoolPref(
      "mongrel.nightmode.adaptive_tinting",
      false
    );
    const state = this._windowState.get(window);

    // Skip the expensive CSS-variable loop and style-content assignment when
    // mood and bloom haven't changed. The common case on every tab switch and
    // navigation is that neither has changed since the last full application.
    if (
      !state ||
      state.lastAppliedMood !== mood ||
      state.lastAppliedBloom !== bloom ||
      state.lastAppliedVariant !== variant
    ) {
      const cssVars = getMongrelCssVariablesForMood(mood);
      const bloomRatio = Math.max(0, Math.min(10, bloom)) / 10;

      for (const [prop, value] of Object.entries(cssVars)) {
        root.style.setProperty(prop, value);
      }
      root.style.setProperty("--mongrel-bloom-ratio", String(bloomRatio));

      root.setAttribute("data-mongrel-personalized", "true");
      root.setAttribute("data-mongrel-mood", mood);

      if (variant === "follow") {
        root.removeAttribute("data-mongrel-variant");
      } else {
        root.setAttribute("data-mongrel-variant", variant);
      }

      const style = this._ensureStyle(root.ownerDocument);
      style.textContent = buildChromeCss();

      if (state) {
        state.lastAppliedMood = mood;
        state.lastAppliedBloom = bloom;
        state.lastAppliedVariant = variant;
      }
    }

    if (adaptiveTinting && mood !== "allblack") {
      root.setAttribute("data-mongrel-adaptive-tint", "true");
      root.style.setProperty("--mongrel-site-adapt-rgb", colorFromSeed(getSiteSeed(window)));
    } else {
      root.removeAttribute("data-mongrel-adaptive-tint");
      root.style.removeProperty("--mongrel-site-adapt-rgb");
    }

    // Sanctuary tint is checked unconditionally — it changes independently
    // of mood/bloom and costs only a single attribute read.
    if (root.getAttribute("data-mongrel-sanctuary") === "active") {
      root.style.setProperty("--mongrel-accent-sanctuary", "#00c89a");
    } else {
      root.style.removeProperty("--mongrel-accent-sanctuary");
    }
  },

  setPageScrollState(browser, isScrolled) {
    const win = browser?.ownerGlobal;
    if (!isBrowserWindow(win)) {
      return;
    }
    const root = win.document?.documentElement;
    if (!root) {
      return;
    }
    if (isScrolled) {
      root.setAttribute("data-mongrel-page-scrolled", "true");
    } else {
      root.removeAttribute("data-mongrel-page-scrolled");
    }
  },

  _ensureStyle(document) {
    let style = document.getElementById(STYLE_ID);
    if (style) {
      return style;
    }

    style = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
    return style;
  },

  _removeStyle(document) {
    document.getElementById(STYLE_ID)?.remove();
  },
};
