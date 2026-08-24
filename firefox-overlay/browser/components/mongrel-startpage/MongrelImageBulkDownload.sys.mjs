/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  CustomizableUI:
    "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs",
  MongrelImageOverlayParent: "resource:///actors/MongrelImageOverlayParent.sys.mjs",
});

const PREF_ENABLED = "mongrel.player.download_all_enabled";
const BUTTON_ID = "mongrel-download-all-images-button";
const MAX_IMAGES_PER_TAB = 1200;
const CONFIRM_THRESHOLD = 25;

function isBrowserWindow(window) {
  return window?.location?.href === lazy.AppConstants.BROWSER_CHROME_URL;
}

export const MongrelImageBulkDownload = {
  _initialized: false,
  _widgetRegistered: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    Services.obs.addObserver(this, "browser-delayed-startup-finished");
    Services.prefs.addObserver(PREF_ENABLED, this);

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (!isBrowserWindow(win)) {
        continue;
      }
      if (!this._widgetRegistered) {
        this._widgetRegistered = true;
        this._registerWidget();
      }
      this._syncButtonInWindow(win);
    }
  },

  observe(subject, topic, data) {
    if (topic === "browser-delayed-startup-finished" && isBrowserWindow(subject)) {
      if (!this._widgetRegistered) {
        this._widgetRegistered = true;
        this._registerWidget();
      }
      this._syncButtonInWindow(subject);
      return;
    }

    if (topic === "nsPref:changed" && data === PREF_ENABLED) {
      this._syncAllButtons();
    }
  },

  _registerWidget() {
    const self = this;
    lazy.CustomizableUI.createWidget({
      id: BUTTON_ID,
      type: "button",
      label: "Download All Images",
      tooltiptext: "Download all images from this tab",
      defaultArea: lazy.CustomizableUI.AREA_NAVBAR,
      onCommand(event) {
        self.downloadAllFromWindow(event.target.ownerGlobal);
      },
      onCreated(node) {
        node.style.listStyleImage = 'url("chrome://browser/skin/save.svg")';
        self._updateButtonNode(node);
      },
    });

    if (!lazy.CustomizableUI.getPlacementOfWidget(BUTTON_ID)) {
      lazy.CustomizableUI.addWidgetToArea(
        BUTTON_ID,
        lazy.CustomizableUI.AREA_NAVBAR
      );
    }
  },

  _syncAllButtons() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this._syncButtonInWindow(win);
    }
  },

  _syncButtonInWindow(win) {
    const node = win?.document?.getElementById(BUTTON_ID);
    if (!node) {
      return;
    }
    this._updateButtonNode(node);
  },

  _updateButtonNode(node) {
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
    node.hidden = !enabled;
    node.disabled = !enabled;
  },

  async downloadAllFromWindow(win) {
    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      return;
    }

    const browser = win?.gBrowser?.selectedBrowser;
    if (!browser) {
      return;
    }

    const sources = await lazy.MongrelImageOverlayParent.collectImageSources(
      browser,
      { max: MAX_IMAGES_PER_TAB }
    );

    if (!sources.length) {
      Services.prompt.alert(
        win,
        "Download All Images",
        "No downloadable images were found in this tab."
      );
      return;
    }

    if (
      sources.length >= CONFIRM_THRESHOLD &&
      !Services.prompt.confirm(
        win,
        "Download All Images",
        `Download ${sources.length} images to your default downloads folder?`
      )
    ) {
      return;
    }

    const saved = await lazy.MongrelImageOverlayParent.saveAllImageSources(win, sources);
    if (!saved) {
      Services.prompt.alert(
        win,
        "Download All Images",
        "No image downloads were started."
      );
    }
  },
};
