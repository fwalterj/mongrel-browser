/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * MongrelPlayerService
 *
 * Central service for the built-in Mongrel media player subsystem.
 * Responsibilities:
 *   - Register JSWindowActors for content-side media detection and overlay.
 *   - Maintain a per-window map of detected streams.
 *   - Provide the privileged download queue API consumed by the toolbar button.
 *   - Dispatch "mongrel-player:*" events on the chrome window for UI bindings.
 *
 * Architecture (Phase A — privileged system add-on approach):
 *   MongrelPlayerService (chrome, privileged)
 *     └─ MongrelPlayerParent (JSWindowActor, parent/privileged per browser)
 *          └─ MongrelPlayerChild (JSWindowActor, child/content per page)
 *               ├─ video element detection + mutation observer
 *               ├─ XHR/fetch interception for .m3u8 / .mpd manifests
 *               └─ overlay injection (custom controls div, shadow DOM)
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  getMoodColors: "resource:///modules/MongrelVisualSystem.sys.mjs",
});

const ACTOR_NAME = "MongrelPlayer";
const PREF_ENABLED = "mongrel.player.enabled";
const PREF_OVERLAY = "mongrel.player.overlay_enabled";
const PREF_DOWNLOAD = "mongrel.player.download_enabled";

const HLS_URL_PATTERN = /\.m3u8(\?|$)/i;
const HLS_CONTENT_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegurl"];
const DRM_INDICATORS = ["widevine", "playready", "clearkey", "fairplay"];

export const MongrelPlayerService = {
  _initialized: false,

  _downloadQueue: [],

  _streamsByWindow: new WeakMap(),

  /** bcId (number) → StreamInfo[] — populated by the HTTP-level observer. */
  _streamsByBCId: new Map(),

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      return;
    }

    this._registerActors();
    Services.obs.addObserver(this, "http-on-examine-response");
    Services.obs.addObserver(this, "http-on-examine-cached-response");

    for (const pref of [PREF_ENABLED, PREF_OVERLAY, PREF_DOWNLOAD]) {
      Services.prefs.addObserver(pref, this);
    }
  },

  destroy() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;

    this._unregisterActors();

    try {
      Services.obs.removeObserver(this, "http-on-examine-response");
      Services.obs.removeObserver(this, "http-on-examine-cached-response");
    } catch {}

    for (const pref of [PREF_ENABLED, PREF_OVERLAY, PREF_DOWNLOAD]) {
      Services.prefs.removeObserver(pref, this);
    }
  },

  observe(subject, topic, data) {
    if (
      topic === "http-on-examine-response" ||
      topic === "http-on-examine-cached-response"
    ) {
      this._observeNetworkResponse(subject);
      return;
    }
    if (topic === "nsPref:changed") {
      if (data === PREF_ENABLED) {
        if (Services.prefs.getBoolPref(PREF_ENABLED, true)) {
          this._registerActors();
        } else {
          this._unregisterActors();
        }
      }
    }
  },

  _observeNetworkResponse(subject) {
    if (!Services.prefs.getBoolPref(PREF_DOWNLOAD, true)) {
      return;
    }
    try {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      const url = channel.URI.spec;

      let isHLS = HLS_URL_PATTERN.test(url);
      if (!isHLS) {
        try {
          const ct = channel.getResponseHeader("Content-Type").toLowerCase();
          isHLS = HLS_CONTENT_TYPES.some(mime => ct.includes(mime));
        } catch {}
      }

      if (!isHLS) {
        return;
      }

      // Only treat top-level variant playlists (avoid individual segment requests
      // which are .ts, not .m3u8, but also avoid sub-playlists without bandwidth info).
      // We allow all .m3u8 here; the downloader will handle master vs variant.
      const bc = channel.loadInfo?.browsingContext?.top;
      if (!bc) {
        return;
      }

      const bcId = bc.id;
      const existing = this._streamsByBCId.get(bcId) || [];
      if (existing.some(s => s.url === url)) {
        return;
      }

      const isDRM = DRM_INDICATORS.some(k => url.toLowerCase().includes(k));
      const stream = {
        url,
        title: "",
        type: "hls",
        qualities: [],
        isLive: false,
        isDRM,
        confidence: 85,
        source: "http-observer",
        detectedAt: Date.now(),
      };

      this._streamsByBCId.set(bcId, [...existing, stream]);

      // Also try to register against the browser element if we can resolve it.
      try {
        const browser = bc.embedderElement;
        if (browser) {
          const merged = this._mergeStreams(
            this._streamsByWindow.get(browser) || [],
            stream
          );
          this.registerStreams(browser, merged);
        }
      } catch {}
    } catch {}
  },

  _mergeStreams(existing, incoming) {
    if (existing.some(s => s.url === incoming.url)) {
      return existing;
    }
    return [...existing, incoming];
  },

  _registerActors() {
    try {
      ChromeUtils.registerWindowActor(ACTOR_NAME, {
        parent: {
          esModuleURI:
            "resource:///modules/MongrelPlayerParent.sys.mjs",
        },
        child: {
          esModuleURI:
            "resource:///modules/MongrelPlayerChild.sys.mjs",
          events: {
            DOMContentLoaded: { mozSystemGroup: true },
          },
        },
        allFrames: false,
        matches: ["https://*/*", "http://*/*"],
        messageManagerGroups: ["browsers"],
      });
    } catch (e) {
      // Actor already registered on re-init; ignore.
    }
  },

  _unregisterActors() {
    try {
      ChromeUtils.unregisterWindowActor(ACTOR_NAME);
    } catch (e) {}
  },

  // ── Download queue API ──────────────────────────────────────────────────────

  getDownloadQueue() {
    return [...this._downloadQueue];
  },

  enqueueDownload(item) {
    this._downloadQueue.push({
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: item.url,
      title: item.title || "Untitled stream",
      type: item.type || "hls",
      quality: item.quality || "best",
      state: "queued",
      progress: 0,
      addedAt: Date.now(),
    });
    Services.obs.notifyObservers(null, "mongrel-player:queue-changed");
  },

  removeDownload(id) {
    const idx = this._downloadQueue.findIndex(d => d.id === id);
    if (idx !== -1) {
      this._downloadQueue.splice(idx, 1);
      Services.obs.notifyObservers(null, "mongrel-player:queue-changed");
    }
  },

  // ── Per-window stream registry ──────────────────────────────────────────────

  registerStreams(browser, streams) {
    const win = browser?.ownerGlobal;
    if (!win) {
      return;
    }
    this._streamsByWindow.set(browser, streams);
    win.dispatchEvent(
      new win.CustomEvent("mongrel-player:streams-updated", {
        bubbles: false,
        detail: { browser, streams },
      })
    );
  },

  getStreams(browser) {
    const fromActor = this._streamsByWindow.get(browser) || [];
    const bcId = browser?.browsingContext?.top?.id;
    const fromObserver = bcId ? (this._streamsByBCId.get(bcId) || []) : [];

    // Merge, deduplicating by URL.
    const seen = new Set(fromActor.map(s => s.url));
    const merged = [...fromActor];
    for (const s of fromObserver) {
      if (!seen.has(s.url)) {
        merged.push(s);
      }
    }
    return merged;
  },

  clearStreams(browser) {
    this._streamsByWindow.delete(browser);
    const bcId = browser?.browsingContext?.top?.id;
    if (bcId) {
      this._streamsByBCId.delete(bcId);
    }
  },

  activateOverlay(browser) {
    if (!Services.prefs.getBoolPref(PREF_OVERLAY, true)) {
      return;
    }
    try {
      const actor =
        browser?.browsingContext?.currentWindowGlobal?.getActor(ACTOR_NAME);
      actor?.sendAsyncMessage("MongrelPlayer:InjectOverlay", {});
    } catch {}
  },
};
