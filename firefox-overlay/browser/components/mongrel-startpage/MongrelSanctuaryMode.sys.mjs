/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MongrelTorManager } from "resource:///modules/MongrelTorManager.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableUI:
    "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs",
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  MongrelThemeEffects: "resource:///modules/MongrelThemeEffects.sys.mjs",
});

const PREF_ENABLED = "mongrel.sanctuary.enabled";

const PROXY_PREFS = [
  "network.proxy.type",
  "network.proxy.socks",
  "network.proxy.socks_port",
  "network.proxy.socks_remote_dns",
  "network.proxy.no_proxies_on",
];

const SANCTUARY_PRIVACY_PREFS = {
  "privacy.resistFingerprinting": true,
  "privacy.trackingprotection.enabled": true,
  "privacy.trackingprotection.socialtracking.enabled": true,
  "geo.enabled": false,
  "media.peerconnection.enabled": false,
  "dom.battery.enabled": false,
  "browser.safebrowsing.downloads.remote.enabled": false,
};

const BUTTON_ID = "mongrel-sanctuary-button";
const STYLE_ID = "mongrel-sanctuary-style";
const ATTR_SANCTUARY = "data-mongrel-sanctuary";
const CONTEXT_ITEM_ID = "mongrel-context-sanctuary";
// Brave-style entry point: "File → New Sanctuary Window". The menu
// item is inserted after the upstream "New Private Window" item via
// runtime DOM patching (rather than editing browser-menubar.inc.xhtml,
// which would be fragile across upstream merges).
const FILE_MENU_ITEM_ID = "menu_newMongrelSanctuaryWindow";

// User-facing copy for the "Tor binary not found" install dialog.
// Kept in code rather than Fluent so it ships even if l10n hasn't run.
const INSTALL_DIALOG_TITLE = "Sanctuary needs Tor";
const INSTALL_DIALOG_BODY = [
  "Sanctuary mode routes your traffic through the Tor network for ",
  "anonymity. Mongrel doesn't bundle Tor — that would slow startup ",
  "for everyone — so it uses a Tor binary you've installed yourself.",
  "\n\n",
  "The fastest way: open Terminal and run:",
  "\n\n    brew install tor\n\n",
  "Or install Tor Browser from https://torproject.org/ (Mongrel ",
  "will automatically find its bundled Tor binary too).",
  "\n\n",
  "After installing, click Sanctuary again and Mongrel will pick it ",
  "up.",
].join("");
const INSTALL_DIALOG_BTN_INSTALL_GUIDE = "Open install guide";
const INSTALL_DIALOG_BTN_DISMISS = "Got it";
const TOR_INSTALL_GUIDE_URL = "https://www.torproject.org/download/";

function isBrowserWindow(window) {
  return window?.location?.href === lazy.AppConstants.BROWSER_CHROME_URL;
}

function buildButtonCss() {
  return `
    #${BUTTON_ID} {
      list-style-image: none;
      padding-block: 3px !important;
      padding-inline: 10px !important;
      border-radius: 999px !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      background: rgba(255,255,255,0.04) !important;
      color: rgba(180,200,230,0.48) !important;
      font-size: 11.5px !important;
      font-weight: 500 !important;
      letter-spacing: 0.015em !important;
      transition: background 0.2s ease, box-shadow 0.3s ease, color 0.2s ease, border-color 0.2s ease !important;
      margin-inline: 3px !important;
    }
    #${BUTTON_ID}:hover {
      background: rgba(255,255,255,0.08) !important;
      border-color: rgba(255,255,255,0.18) !important;
      color: rgba(200,220,255,0.78) !important;
    }
    #${BUTTON_ID}[mongrel-sanctuary-state="starting"],
    #${BUTTON_ID}[mongrel-sanctuary-state="bootstrapping"] {
      border-color: rgba(0,210,165,0.28) !important;
      color: rgba(0,225,178,0.68) !important;
      animation: mongrel-sanctuary-pulse 1.6s ease-in-out infinite !important;
    }
    #${BUTTON_ID}[mongrel-sanctuary-state="running"] {
      border-color: rgba(0,210,150,0.58) !important;
      background: rgba(0,180,130,0.10) !important;
      color: rgba(0,235,172,0.94) !important;
      box-shadow: 0 0 11px rgba(0,200,150,0.30), inset 0 1px 0 rgba(0,255,180,0.11) !important;
    }
    #${BUTTON_ID}[mongrel-sanctuary-state="error"] {
      border-color: rgba(255,80,80,0.32) !important;
      color: rgba(255,115,95,0.72) !important;
    }
    @keyframes mongrel-sanctuary-pulse {
      0%, 100% { box-shadow: 0 0 3px rgba(0,200,150,0.12); }
      50% { box-shadow: 0 0 14px rgba(0,200,150,0.44); }
    }
  `;
}

export const MongrelSanctuaryMode = {
  _initialized: false,
  _widgetRegistered: false,
  _active: false,
  _savedProxyPrefs: null,
  _savedPrivacyPrefs: null,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    MongrelTorManager.onStateChange = state => this._onTorStateChange(state);
    MongrelTorManager.onProgress = progress => this._onBootstrapProgress(progress);

    Services.obs.addObserver(this, "browser-delayed-startup-finished");

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (isBrowserWindow(win)) {
        this._applyToWindow(win);
      }
    }

    if (Services.prefs.getBoolPref(PREF_ENABLED, false)) {
      this.enable().catch(e =>
        console.error("MongrelSanctuaryMode: auto-enable failed:", e)
      );
    }
  },

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished" && isBrowserWindow(subject)) {
      if (!this._widgetRegistered) {
        this._widgetRegistered = true;
        this._registerWidget();
      }
      this._applyToWindow(subject);
    }
  },

  _applyToWindow(window) {
    this._ensureStyle(window.document);
    this._updateWindowAttr(window);
    this._setupContextMenu(window);
    this._setupFileMenu(window);
  },

  _ensureStyle(document) {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    style.textContent = buildButtonCss();
    return style;
  },

  _updateWindowAttr(window) {
    const root = window?.document?.documentElement;
    if (!root) {
      return;
    }
    if (this._active) {
      root.setAttribute(ATTR_SANCTUARY, "active");
    } else {
      root.removeAttribute(ATTR_SANCTUARY);
    }
    lazy.MongrelThemeEffects._applyToWindow(window);
  },

  _setupContextMenu(window) {
    const menu = window.document.getElementById("contentAreaContextMenu");
    if (!menu || window.document.getElementById(CONTEXT_ITEM_ID)) {
      return;
    }

    const item = window.document.createXULElement("menuitem");
    item.id = CONTEXT_ITEM_ID;
    item.setAttribute("label", "Open Link in Sanctuary");

    item.addEventListener("command", () => {
      const href = window.gContextMenu?.linkURL;
      if (!href) {
        return;
      }
      this._enableThen(window, () => window.openTrustedLinkIn(href, "tab"));
    });

    menu.addEventListener("popupshowing", () => {
      const onLink = !!window.gContextMenu?.onLink;
      item.hidden = !onLink;
      if (onLink) {
        item.setAttribute(
          "label",
          this._active ? "Open Link in Sanctuary" : "Start Sanctuary & Open Link"
        );
      }
    });

    menu.appendChild(item);
  },

  /**
   * Insert "File → New Sanctuary Window" after upstream's "New Private
   * Window". Patched at runtime so we don't have to maintain a diff
   * against browser-menubar.inc.xhtml across upstream merges.
   *
   * The Brave parity goal is: a single menu click that opens a private
   * window with Tor active. Under the hood we still flip the global
   * sanctuary toggle (which routes ALL windows through Tor while it's
   * on) — per-window proxy via container ID is a future enhancement,
   * called out in MongrelTorManager comments.
   */
  _setupFileMenu(window) {
    const doc = window.document;
    if (doc.getElementById(FILE_MENU_ITEM_ID)) {
      return;
    }
    const newPrivateItem = doc.getElementById("menu_newPrivateWindow");
    if (!newPrivateItem) {
      // No File menu in this window (e.g. about:* dialog hosting). Skip.
      return;
    }

    const item = doc.createXULElement("menuitem");
    item.id = FILE_MENU_ITEM_ID;
    item.setAttribute("label", "New Sanctuary Window");
    item.setAttribute(
      "tooltiptext",
      "New private window routed through Tor"
    );

    item.addEventListener("command", () => {
      this.openSanctuaryWindow(window);
    });

    // Insert immediately after `menu_newPrivateWindow` so the two
    // "fresh window" entries are visually adjacent.
    newPrivateItem.parentNode.insertBefore(item, newPrivateItem.nextSibling);
  },

  /**
   * Brave-equivalent "open Tor private window" entry point. Ensures
   * Tor is running first (showing the install dialog if the binary
   * isn't found), then opens a new private browsing window. The window
   * picks up the global SOCKS5 + privacy posture set by `enable()`.
   */
  openSanctuaryWindow(parentWindow) {
    this._enableThen(parentWindow, () => {
      // Use OpenBrowserWindow if available (browser.js global), else
      // fall back to direct openDialog. private:true ensures the
      // window has Private Browsing semantics regardless of whether
      // permanent PB is on globally.
      try {
        if (typeof parentWindow.OpenBrowserWindow === "function") {
          parentWindow.OpenBrowserWindow({ private: true });
        } else {
          parentWindow.openDialog(
            lazy.AppConstants.BROWSER_CHROME_URL,
            "_blank",
            "chrome,all,dialog=no,private",
            "about:privatebrowsing"
          );
        }
      } catch (e) {
        console.error("MongrelSanctuaryMode: openSanctuaryWindow failed:", e);
      }
    });
  },

  /**
   * Shared "ensure Tor is running, then run callback" flow used by
   * the toolbar toggle, context menu, and File menu. If the Tor
   * binary isn't installed we show the install dialog instead and
   * skip the callback entirely (no half-on state).
   */
  async _enableThen(window, callback) {
    if (this._active) {
      callback?.();
      return;
    }
    const binary = await MongrelTorManager.findBinary();
    if (!binary) {
      this._showInstallDialog(window);
      return;
    }
    try {
      await this.enable();
      callback?.();
    } catch (e) {
      console.error("MongrelSanctuaryMode: enable failed:", e);
      // If Tor failed to bootstrap (network down, blocked, etc.),
      // surface the install dialog as a fallback — it's a reasonable
      // "something's wrong, here's where to get help" UX.
      this._showInstallDialog(window);
    }
  },

  /**
   * Show a confirm-style dialog explaining how to install Tor. The
   * "primary" button opens the Tor Project download page (which has
   * platform-specific instructions for everyone, not just Mac).
   */
  _showInstallDialog(window) {
    if (
      !Services.prefs.getBoolPref(
        "mongrel.sanctuary.show_install_dialog",
        true
      )
    ) {
      return;
    }
    try {
      const flags =
        Services.prompt.BUTTON_POS_0 *
          Services.prompt.BUTTON_TITLE_IS_STRING +
        Services.prompt.BUTTON_POS_1 *
          Services.prompt.BUTTON_TITLE_IS_STRING +
        Services.prompt.BUTTON_POS_0_DEFAULT;

      const button = Services.prompt.confirmEx(
        window,
        INSTALL_DIALOG_TITLE,
        INSTALL_DIALOG_BODY,
        flags,
        INSTALL_DIALOG_BTN_INSTALL_GUIDE,
        INSTALL_DIALOG_BTN_DISMISS,
        null,
        null,
        { value: false }
      );
      if (button === 0) {
        // Open the install guide in a regular (non-private) tab in the
        // user's existing default profile so they can read it without
        // losing their current session.
        try {
          window.openTrustedLinkIn(TOR_INSTALL_GUIDE_URL, "tab");
        } catch {}
      }
    } catch (e) {
      console.error("MongrelSanctuaryMode: install dialog failed:", e);
    }
  },

  _registerWidget() {
    const self = this;
    lazy.CustomizableUI.createWidget({
      id: BUTTON_ID,
      type: "button",
      label: "Sanctuary",
      tooltiptext: "Tor Private Mode — click to activate",
      defaultArea: lazy.CustomizableUI.AREA_NAVBAR,
      onCommand(event) {
        // Route the toolbar button through the same install-aware
        // flow as the menu items so a click with no Tor installed
        // surfaces the dialog instead of silently failing.
        const win = event?.target?.ownerGlobal || Services.wm.getMostRecentWindow("navigator:browser");
        self._toggleFromUI(win);
      },
      onCreated(node) {
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

  _updateButtonNode(node) {
    if (!node) {
      return;
    }
    const state = MongrelTorManager.state;
    const progress = MongrelTorManager.bootstrapProgress;

    node.setAttribute("mongrel-sanctuary-state", state);

    let label, tooltip;
    switch (state) {
      case "stopped":
        label = "Sanctuary";
        tooltip = "Tor Private Mode — click to activate";
        break;
      case "starting":
        label = "Sanctuary…";
        tooltip = "Starting Tor…";
        break;
      case "bootstrapping":
        label = `Sanctuary ${progress}%`;
        tooltip = `Connecting to Tor network… ${progress}%`;
        break;
      case "running":
        label = "Sanctuary ●";
        tooltip = "Tor Private Mode active — click to deactivate";
        break;
      case "error":
        label = "Sanctuary ✗";
        tooltip = "Tor unavailable — install with: brew install tor";
        break;
    }

    node.label = label;
    node.tooltipText = tooltip;
  },

  _updateAllButtons() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      const doc = win.document;
      const node = doc.getElementById(BUTTON_ID);
      if (node) {
        this._updateButtonNode(node);
      }
      this._updateWindowAttr(win);
    }
  },

  _onTorStateChange(state) {
    this._updateAllButtons();

    if (state === "error" && this._active) {
      this._restoreAllPrefs();
      this._active = false;
      Services.prefs.setBoolPref(PREF_ENABLED, false);
      console.error(
        "MongrelSanctuaryMode: Tor exited unexpectedly — sanctuary deactivated"
      );
    }
  },

  _onBootstrapProgress() {
    this._updateAllButtons();
  },

  async enable() {
    if (this._active) {
      return;
    }

    this._saveCurrentPrefs();
    this._applyProxyPrefs();
    this._applyPrivacyPrefs();

    try {
      await MongrelTorManager.start();
    } catch (e) {
      this._restoreAllPrefs();
      throw e;
    }

    this._active = true;
    Services.prefs.setBoolPref(PREF_ENABLED, true);
    this._updateAllButtons();
  },

  async disable() {
    if (!this._active) {
      return;
    }

    await MongrelTorManager.stop();
    this._restoreAllPrefs();
    this._active = false;
    Services.prefs.setBoolPref(PREF_ENABLED, false);
    this._updateAllButtons();
  },

  async toggle() {
    const torState = MongrelTorManager.state;
    if (
      this._active ||
      torState === "starting" ||
      torState === "bootstrapping" ||
      torState === "running"
    ) {
      await this.disable();
    } else {
      await this.enable();
    }
  },

  /**
   * UI-attached toggle that surfaces the install dialog when Tor is
   * missing. Used by the toolbar button. Programmatic callers should
   * use `toggle()` directly.
   */
  async _toggleFromUI(window) {
    if (this._active) {
      await this.disable();
      return;
    }
    this._enableThen(window, null);
  },

  async newIdentity() {
    if (!this._active) {
      return;
    }
    await MongrelTorManager.newIdentity();
  },

  _saveCurrentPrefs() {
    this._savedProxyPrefs = this._snapshotPrefs(PROXY_PREFS);
    this._savedPrivacyPrefs = this._snapshotPrefs(Object.keys(SANCTUARY_PRIVACY_PREFS));
  },

  _snapshotPrefs(keys) {
    const snapshot = {};
    for (const key of keys) {
      try {
        const type = Services.prefs.getPrefType(key);
        if (type === Ci.nsIPrefBranch.PREF_INT) {
          snapshot[key] = { type: "int", value: Services.prefs.getIntPref(key) };
        } else if (type === Ci.nsIPrefBranch.PREF_STRING) {
          snapshot[key] = {
            type: "string",
            value: Services.prefs.getStringPref(key),
          };
        } else if (type === Ci.nsIPrefBranch.PREF_BOOL) {
          snapshot[key] = { type: "bool", value: Services.prefs.getBoolPref(key) };
        }
      } catch {}
    }
    return snapshot;
  },

  _applyProxyPrefs() {
    Services.prefs.setIntPref("network.proxy.type", 1);
    Services.prefs.setStringPref("network.proxy.socks", "127.0.0.1");
    Services.prefs.setIntPref("network.proxy.socks_port", MongrelTorManager.socksPort);
    Services.prefs.setBoolPref("network.proxy.socks_remote_dns", true);
    Services.prefs.setStringPref("network.proxy.no_proxies_on", "");
  },

  _applyPrivacyPrefs() {
    for (const [key, value] of Object.entries(SANCTUARY_PRIVACY_PREFS)) {
      if (typeof value === "boolean") {
        Services.prefs.setBoolPref(key, value);
      } else if (typeof value === "string") {
        Services.prefs.setStringPref(key, value);
      } else {
        Services.prefs.setIntPref(key, value);
      }
    }
  },

  _restoreAllPrefs() {
    this._restorePrefs(this._savedProxyPrefs);
    this._restorePrefs(this._savedPrivacyPrefs);
    this._savedProxyPrefs = null;
    this._savedPrivacyPrefs = null;
  },

  _restorePrefs(snapshot) {
    if (!snapshot) {
      return;
    }
    for (const [key, entry] of Object.entries(snapshot)) {
      try {
        if (entry.type === "int") {
          Services.prefs.setIntPref(key, entry.value);
        } else if (entry.type === "string") {
          Services.prefs.setStringPref(key, entry.value);
        } else if (entry.type === "bool") {
          Services.prefs.setBoolPref(key, entry.value);
        }
      } catch {}
    }
  },

  get isActive() {
    return this._active;
  },

  destroy() {
    if (!this._initialized) {
      return;
    }
    if (this._active) {
      this.disable().catch(() => {});
    }
    Services.obs.removeObserver(this, "browser-delayed-startup-finished");
    this._initialized = false;
  },
};
