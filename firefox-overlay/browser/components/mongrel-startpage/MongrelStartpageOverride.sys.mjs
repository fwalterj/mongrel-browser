/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
});

const NEWTAB_URL = "chrome://browser/content/newtab.html";

// Bump this whenever the migration logic below changes. Each profile
// records the highest version it has run; we re-run any later migrations
// without redoing the earlier ones. Treat this like CustomizableUI.kVersion.
const MIGRATION_VERSION = 1;
const MIGRATION_PREF = "mongrel.startpage.migration.version";

// Values that mean "Firefox stock home/newtab" — i.e. anything we want to
// quietly migrate away from when we encounter it as a *user-set* value.
// We never touch a user-set value that isn't on this list (so a user who
// deliberately points their homepage at example.com keeps their choice).
const STALE_HOMEPAGE_VALUES = new Set([
  "",
  "about:home",
  "about:newtab",
  "about:blank",
  // Also catch the multi-tab pipe-separated form Firefox uses when you set
  // multiple home tabs in Settings (e.g. "about:home|https://example.com").
  // We only migrate if EVERY entry is stock; mixed lists keep the user's
  // intent intact.
]);

function _isAllStock(homepageValue) {
  if (typeof homepageValue !== "string") {
    return false;
  }
  if (STALE_HOMEPAGE_VALUES.has(homepageValue)) {
    return true;
  }
  // Pipe-separated multi-tab homepage: stock only if EVERY entry is stock.
  if (homepageValue.includes("|")) {
    const parts = homepageValue.split("|").map(s => s.trim());
    return parts.length > 0 && parts.every(p => STALE_HOMEPAGE_VALUES.has(p));
  }
  return false;
}

export const MongrelStartpageOverride = {
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    // Cmd-T / new tab keystroke uses AboutNewTab.newTabURL, which is
    // independent of the about:newtab redirector (the override path
    // bypasses redirection entirely). This guarantees opening a new tab
    // always lands on Mongrel even if the redirector ever falls back.
    lazy.AboutNewTab.newTabURL = NEWTAB_URL;

    try {
      this._runMigrations();
    } catch (e) {
      console.error("MongrelStartpageOverride migration failed:", e);
    }
  },

  /**
   * One-shot, idempotent profile migrations. Runs at most once per
   * MIGRATION_VERSION bump per profile. Each step is wrapped in its own
   * try/catch so a single failure doesn't block the rest.
   *
   * v1 — Stale homepage cleanup. Profiles created against earlier Mongrel
   *      builds (and Firefox profiles imported wholesale) often carry a
   *      *user-set* `browser.startup.homepage` value of "about:home" or
   *      similar, which overrides the chrome-page default we ship in
   *      `firefox.js`. The result is: boot lands on Activity Stream
   *      ("the generic Firefox page") even though our default points at
   *      `chrome://browser/content/newtab.html`. We clear the user value
   *      only if it matches a known stock-Firefox pattern, leaving any
   *      deliberate user homepage choice untouched.
   */
  _runMigrations() {
    const prefs = Services.prefs;
    const lastRun = prefs.getIntPref(MIGRATION_PREF, 0);
    if (lastRun >= MIGRATION_VERSION) {
      return;
    }

    if (lastRun < 1) {
      this._migrateV1StaleHomepage(prefs);
    }

    prefs.setIntPref(MIGRATION_PREF, MIGRATION_VERSION);
  },

  _migrateV1StaleHomepage(prefs) {
    const HOMEPAGE = "browser.startup.homepage";
    if (!prefs.prefHasUserValue(HOMEPAGE)) {
      return;
    }

    let userValue;
    try {
      userValue = prefs.getStringPref(HOMEPAGE);
    } catch {
      // Pref exists with a non-string type — leave it for the user to
      // sort out rather than guessing.
      return;
    }

    // Fast path: already pointing at the Mongrel chrome page (e.g. they
    // ran Settings → Restore Defaults). Clear the redundant user value so
    // future default bumps take effect.
    if (userValue === NEWTAB_URL) {
      prefs.clearUserPref(HOMEPAGE);
      return;
    }

    if (_isAllStock(userValue)) {
      prefs.clearUserPref(HOMEPAGE);
    }
  },

  destroy() {
    if (!this._initialized) {
      return;
    }
    try {
      if (lazy.AboutNewTab.newTabURL === NEWTAB_URL) {
        lazy.AboutNewTab.resetNewTabURL();
      }
    } catch {}
    this._initialized = false;
  },
};
