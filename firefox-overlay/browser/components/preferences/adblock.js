/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */

"use strict";

Preferences.addAll([
  {
    id: "pref.mongrel.adblock.invisible.enabled",
    name: "mongrel.adblock.invisible.enabled",
    type: "bool",
  },
  {
    id: "pref.mongrel.adblock.invisible.ad_domains",
    name: "mongrel.adblock.invisible.ad_domains",
    type: "string",
  },
]);

var gAdblockPane = {
  _inited: false,

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;

    document
      .getElementById("adblockEnabled")
      .addEventListener("command", () => this._updateControlStates());

    const textarea = document.getElementById("adblockDomains");
    const domainsPref = Preferences.get(
      "pref.mongrel.adblock.invisible.ad_domains"
    );

    textarea.value = Services.prefs.getStringPref(
      "mongrel.adblock.invisible.ad_domains",
      ""
    );
    textarea.addEventListener("input", () => {
      domainsPref.value = textarea.value;
    });
    domainsPref.on("change", () => {
      const value = Services.prefs.getStringPref(
        "mongrel.adblock.invisible.ad_domains",
        ""
      );
      if (textarea.value !== value) {
        textarea.value = value;
      }
    });

    this._updateControlStates();
  },

  _updateControlStates() {
    const enabled = Preferences.get(
      "pref.mongrel.adblock.invisible.enabled"
    ).value;
    document.getElementById("adblockDomains").disabled = !enabled;
  },
};
