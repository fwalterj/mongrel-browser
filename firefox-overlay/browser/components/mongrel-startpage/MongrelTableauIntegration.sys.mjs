/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
});

export const MongrelTableauIntegration = {
  /**
   * Initialize tableau integration with browser commands
   */
  init() {
    // Command wiring is handled by browser-main.js and browser-sets.inc.
  },

  /**
   * Add the current page (from active tab) to the Tableau
   */
  addCurrentPageToTableau() {
    try {
      const window = lazy.BrowserWindowTracker.getTopWindow();
      if (!window?.gBrowser) return;

      const browser = window.gBrowser.selectedBrowser;
      const url = browser.currentURI?.spec;
      const title = browser.contentTitle || url;

      if (url) {
        this.saveToTableauPref(url, title);
      }
    } catch (e) {
      console.error("Error adding page to tableau:", e);
    }
  },

  /**
   * Save a page to the Tableau pref storage
   * @param {string} url - The page URL
   * @param {string} title - The page title
   */
  saveToTableauPref(url, title) {
    const TABLEAU_PREF = "mongrel.startpage.tableau";
    try {
      const prefs = Services.prefs;
      const current = prefs.getStringPref(TABLEAU_PREF, "[]");

      let items = [];
      try {
        items = JSON.parse(current);
        if (!Array.isArray(items)) items = [];
      } catch {
        items = [];
      }

      // Check for duplicates
      if (items.some(item => item.url === url)) {
        return; // Already in tableau
      }

      // Add new item
      items.push({
        url,
        title: title || url,
      });

      // Save back to prefs
      prefs.setStringPref(TABLEAU_PREF, JSON.stringify(items));
    } catch (e) {
      console.error("Error saving to tableau pref:", e);
    }
  },
};
