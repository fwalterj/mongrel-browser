/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ENABLED_PREF = "mongrel.adblock.invisible.enabled";
const DOMAINS_PREF = "mongrel.adblock.invisible.ad_domains";
const DOMAINS_DEFAULT =
  "doubleclick.net,googleadservices.com,googlesyndication.com," +
  "amazon-adsystem.com,taboola.com,outbrain.com";

// 1×1 transparent GIF as a data URI — target for all intercepted image loads.
const TRANSPARENT_GIF_URI =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export const MongrelAdblockService = {
  _observing: false,

  init() {
    Services.obs.addObserver(this, "http-on-modify-request");
    this._observing = true;
  },

  destroy() {
    if (this._observing) {
      Services.obs.removeObserver(this, "http-on-modify-request");
      this._observing = false;
    }
  },

  /**
   * Returns true if `host` matches an entry in the ad-domain pref list,
   * including subdomain matches (e.g. "ads.doubleclick.net" → true).
   * @param {string} host
   */
  _isAdDomain(host) {
    if (!host) {
      return false;
    }
    const raw = Services.prefs.getStringPref(DOMAINS_PREF, DOMAINS_DEFAULT);
    for (const domain of raw.split(",")) {
      const d = domain.trim();
      if (d && (host === d || host.endsWith("." + d))) {
        return true;
      }
    }
    return false;
  },

  observe(subject, topic) {
    if (topic !== "http-on-modify-request") {
      return;
    }
    if (!Services.prefs.getBoolPref(ENABLED_PREF, false)) {
      return;
    }

    let channel;
    try {
      channel = subject.QueryInterface(Ci.nsIHttpChannel);
    } catch {
      return;
    }

    const { loadInfo } = channel;
    if (!loadInfo) {
      return;
    }

    const { TYPE_IMAGE, TYPE_IMAGESET } = Ci.nsIContentPolicy;
    const type = loadInfo.externalContentPolicyType;
    if (type !== TYPE_IMAGE && type !== TYPE_IMAGESET) {
      return;
    }

    let host;
    try {
      host = channel.URI.host;
    } catch {
      return;
    }

    if (!this._isAdDomain(host)) {
      return;
    }

    try {
      channel.redirectTo(Services.io.newURI(TRANSPARENT_GIF_URI));
    } catch {
      // Channel may already be advancing; nothing to do.
    }
  },
};
