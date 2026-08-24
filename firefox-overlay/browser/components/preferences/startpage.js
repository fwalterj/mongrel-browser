/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */

"use strict";

Preferences.addAll([
  { id: "pref.mongrel.startpage.links", name: "mongrel.startpage.links", type: "string" },
  { id: "pref.mongrel.startpage.show_settings_btn", name: "mongrel.startpage.show_settings_btn", type: "bool" },
  { id: "pref.mongrel.startpage.show_history_btn",  name: "mongrel.startpage.show_history_btn",  type: "bool" },
  { id: "pref.mongrel.startpage.show_passwords_btn", name: "mongrel.startpage.show_passwords_btn", type: "bool" },
  { id: "pref.mongrel.player.download_all_enabled", name: "mongrel.player.download_all_enabled", type: "bool" },
  { id: "pref.mongrel.image_overlay.buttons_enabled", name: "mongrel.image_overlay.buttons_enabled", type: "bool" },
]);

var gStartPagePane = {
  _inited: false,

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;

    // Sync textarea <-> pref manually (textarea doesn't support preference= binding).
    let linksTextarea = document.getElementById("startPageLinks");
    let linksPref = Preferences.get("pref.mongrel.startpage.links");

    linksTextarea.value = Services.prefs.getStringPref(
      "mongrel.startpage.links",
      ""
    );
    linksTextarea.addEventListener("input", () => {
      this._validateAndSaveLinks(linksTextarea.value);
    });

    linksPref.on("change", () => {
      let value = Services.prefs.getStringPref("mongrel.startpage.links", "");
      if (linksTextarea.value !== value) {
        linksTextarea.value = value;
      }
    });
  },

  _validateAndSaveLinks(raw) {
    let pref = Preferences.get("pref.mongrel.startpage.links");
    try {
      JSON.parse(raw);
      pref.value = raw;
    } catch (_) {
      // Keep whatever is stored; user still editing
    }
  },
};
