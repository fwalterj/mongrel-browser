/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const MongrelImageOverlayManager = {
  _registered: false,

  /**
   * Initialize image overlay on window load
   */
  init() {
    this._registerActor();
    this._observePrefs();
  },

  /**
   * Register the image overlay JSWindowActor
   */
  _registerActor() {
    if (this._registered) {
      return;
    }

    try {
      const { ChromeUtils } = globalThis;
      const { ActorManagerParent } = ChromeUtils.importESModule(
        "resource://gre/modules/ActorManagerParent.sys.mjs"
      );

      ActorManagerParent.addJSWindowActors({
        MongrelImageOverlay: {
          parent: {
            esModuleURI: "resource://gre/actors/MongrelImageOverlayParent.sys.mjs",
          },
          child: {
            esModuleURI: "resource://gre/actors/MongrelImageOverlayChild.sys.mjs",
            events: {
              DOMContentLoaded: {},
              load: {},
            },
          },
          allFrames: true,
          includeChrome: false,
        },
      });
      this._registered = true;
    } catch (e) {
      if (String(e).includes("already registered")) {
        this._registered = true;
        return;
      }
      console.error("Failed to register MongrelImageOverlay actor:", e);
    }
  },

  /**
   * Observe preference changes to update overlay state
   */
  _observePrefs() {
    try {
      const prefSvc = Services.prefs;
      const observer = {
        observe(_subj, _topic, data) {
          if (
            data === "mongrel.imageoverlay.enabled" ||
            data === "mongrel.imageoverlay.opacity"
          ) {
            // Preferences changed - actors will pick up changes on next page load
          }
        },
      };

      if (
        typeof ChromeUtils !== "undefined" &&
        typeof ChromeUtils.generateQI === "function"
      ) {
        observer.QueryInterface = ChromeUtils.generateQI(["nsIObserver"]);
      }

      prefSvc.addObserver("mongrel.imageoverlay.enabled", observer);
      prefSvc.addObserver("mongrel.imageoverlay.opacity", observer);
    } catch (e) {
      // Prefs observation optional
    }
  },
};
