/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * MongrelPlayerChild
 *
 * Content-process (child) side of the MongrelPlayer JSWindowActor pair.
 *
 * This actor runs inside every page that matches the actor registration filter.
 * Its jobs:
 *   1. Detect media sources (video elements, XHR/fetch for .m3u8/.mpd).
 *   2. Score confidence for each candidate source.
 *   3. Report detected streams to MongrelPlayerParent.
 *   4. On demand: inject the in-page overlay (Vinegar-mode).
 *
 * Design rules:
 *   - Never destructively remove the site's original player.
 *   - Keep a fallback path to return to site-native player per session.
 *   - Treat all page metadata as untrusted — validate before use.
 *   - Never bypass DRM; surface clear messaging if DRM is detected.
 */

const HLS_PATTERN = /\.m3u8(\?|$)/i;
const DASH_PATTERN = /\.mpd(\?|$)/i;
const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|mov|mkv|m4v|ts|avi|flv)(\?|$)/i;
const WIDEVINE_MIME = "application/x-mpegurl";
const DRM_INDICATORS = [
  "widevine",
  "playready",
  "clearkey",
  "fairplay",
  "drm",
];

export class MongrelPlayerChild extends JSWindowActorChild {
  #detectedStreams = new Map();
  #quickButtonVideos = new WeakSet();
  #overlayInjected = false;
  #originalXHROpen = null;
  #originalFetch = null;
  #mutationObserver = null;
  #scrollHandler = null;

  handleEvent(event) {
    if (event.type === "DOMContentLoaded") {
      this._scanAndMonitor();
    }
  }

  receiveMessage(message) {
    switch (message.name) {
      case "MongrelPlayer:InjectOverlay":
        this._injectOverlay(message.data);
        break;
      case "MongrelPlayer:RemoveOverlay":
        this._removeOverlay();
        break;
    }
  }

  didDestroy() {
    this._teardown();
  }

  // ── Detection pipeline ──────────────────────────────────────────────────────

  _scanAndMonitor() {
    const doc = this.document;
    if (!doc || doc.readyState === "uninitialized") {
      return;
    }

    // Keep TikTok/X playback as close to vanilla as possible.
    if (this._isSensitiveSocialVideoSite()) {
      return;
    }

    this._scanVideoElements(doc);
    this._injectQuickDownloadButtons(doc);
    if (!this._shouldSkipNetworkInterception()) {
      this._interceptNetworkRequests();
    }
    this._observeMutations(doc);
    this._listenToScroll();
  }

  _shouldSkipNetworkInterception() {
    return this._isSensitiveSocialVideoSite();
  }

  _isSensitiveSocialVideoSite() {
    const host = this.document?.location?.hostname?.toLowerCase() || "";
    return (
      host.endsWith("tiktok.com") ||
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com")
    );
  }

  _scanVideoElements(doc) {
    for (const video of doc.querySelectorAll("video")) {
      this._processVideoElement(video);
    }
  }

  _processVideoElement(video) {
    const src = video.currentSrc || video.src || "";
    const sources = Array.from(video.querySelectorAll("source")).map(
      s => s.src
    );
    const allUrls = [src, ...sources].filter(Boolean);

    for (const url of allUrls) {
      this._candidateURL(url, "video-src");
    }
  }

  _interceptNetworkRequests() {
    const win = this.contentWindow;
    if (!win) {
      return;
    }

    const self = this;
    const origOpen = win.XMLHttpRequest.prototype.open;
    this.#originalXHROpen = origOpen;

    win.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      try {
        self._candidateURL(String(url), "xhr");
      } catch {}
      return origOpen.call(this, method, url, ...rest);
    };

    const origFetch = win.fetch;
    this.#originalFetch = origFetch;

    win.fetch = function (input, ...rest) {
      try {
        const url = typeof input === "string" ? input : input?.url || "";
        self._candidateURL(url, "fetch");
      } catch {}
      return origFetch.call(this, input, ...rest);
    };
  }

  _observeMutations(doc) {
    this.#mutationObserver = new doc.defaultView.MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          if (node.tagName === "VIDEO") {
            this._processVideoElement(node);
            this._ensureQuickDownloadButton(node);
          }
          for (const video of node.querySelectorAll?.("video") ?? []) {
            this._processVideoElement(video);
            this._ensureQuickDownloadButton(video);
          }
        }
      }
    });

    this.#mutationObserver.observe(doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  _listenToScroll() {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    let prevScrolled = false;
    this.#scrollHandler = () => {
      const isScrolled = win.scrollY > 0;
      if (isScrolled === prevScrolled) {
        return;
      }
      prevScrolled = isScrolled;
      this.sendAsyncMessage("MongrelPlayer:ScrollStateChanged", { isScrolled });
    };
    win.addEventListener("scroll", this.#scrollHandler, { passive: true });
  }

  _candidateURL(url, source) {
    if (!url || url.length > 4096) {
      return;
    }

    let type = null;
    if (HLS_PATTERN.test(url)) {
      type = "hls";
    } else if (DASH_PATTERN.test(url)) {
      type = "dash";
    } else if (DIRECT_VIDEO_PATTERN.test(url)) {
      type = "direct";
    } else if (url.includes("manifest") || url.includes("playlist")) {
      type = "hls";
    }

    if (!type) {
      return;
    }

    if (this.#detectedStreams.has(url)) {
      return;
    }

    const isDRM = DRM_INDICATORS.some(indicator =>
      url.toLowerCase().includes(indicator)
    );

    const stream = {
      url,
      title: this._resolveTitle(),
      type,
      qualities: [],
      isLive: false,
      isDRM,
      confidence: this._scoreConfidence(url, source, type),
      source,
      detectedAt: Date.now(),
    };

    this.#detectedStreams.set(url, stream);
    this._reportStreams();
  }

  _scoreConfidence(url, source, type) {
    let score = 0;
    if (type === "hls") {
      score += 60;
    }
    if (type === "dash") {
      score += 55;
    }
    if (type === "direct") {
      score += 35;
    }
    if (source === "xhr" || source === "fetch") {
      score += 20;
    }
    if (source === "video-src") {
      score += 15;
    }
    if (url.includes("master")) {
      score += 10;
    }
    if (url.includes("playlist")) {
      score += 5;
    }
    return Math.min(100, score);
  }

  _resolveTitle() {
    try {
      return this.document?.title || this.document?.location?.hostname || "";
    } catch {
      return "";
    }
  }

  _reportStreams() {
    const streams = [...this.#detectedStreams.values()];
    this.sendAsyncMessage("MongrelPlayer:StreamsDetected", { streams });
  }

  _injectQuickDownloadButtons(doc) {
    if (!this._isQuickDownloadSite()) {
      return;
    }
    this._ensureQuickDownloadButtonStyle(doc);
    for (const video of doc.querySelectorAll("video")) {
      this._ensureQuickDownloadButton(video);
    }
  }

  _isQuickDownloadSite() {
    // Inject quick-download buttons on all sites. Sensitive social sites (TikTok, X)
    // are already excluded via the early return in _scanAndMonitor(), so they will
    // never reach this code path regardless.
    return true;
  }

  _ensureQuickDownloadButtonStyle(doc) {
    if (doc.getElementById("mongrel-quick-video-download-css")) {
      return;
    }
    const style = doc.createElement("style");
    style.id = "mongrel-quick-video-download-css";
    style.textContent = `
      .mongrel-quick-video-download {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2147483641;
        border: none;
        border-radius: 999px;
        padding: 8px 12px;
        font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: #eaf2ff;
        background:
          linear-gradient(180deg, rgba(30,42,95,0.88) 0%, rgba(18,26,66,0.88) 100%),
          rgba(9, 14, 42, 0.72);
        box-shadow:
          inset 0 0 0 1px rgba(159, 193, 255, 0.45),
          0 10px 26px rgba(0, 0, 0, 0.40),
          0 0 14px rgba(122, 170, 255, 0.26);
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        transform: translateY(-3px);
        transition: opacity 120ms ease, transform 120ms ease;
      }

      video:hover + .mongrel-quick-video-download,
      .mongrel-quick-video-download:hover,
      .mongrel-quick-video-download:focus-visible {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    doc.documentElement.appendChild(style);
  }

  _ensureQuickDownloadButton(video) {
    if (!video || this.#quickButtonVideos.has(video) || !this._isQuickDownloadSite()) {
      return;
    }

    const doc = video.ownerDocument;
    if (!doc || !video.parentElement) {
      return;
    }

    const parent = video.parentElement;
    const win = doc.defaultView;
    if (win && win.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const button = doc.createElement("button");
    button.className = "mongrel-quick-video-download";
    button.type = "button";
    button.textContent = "download video";
    button.title = "Download video";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const item = this._buildDownloadItem(video);
      if (!item) {
        doc.defaultView?.alert("mongrel player: No downloadable stream found yet.");
        return;
      }
      if (item.isDRM) {
        doc.defaultView?.alert(
          "mongrel player: This stream is DRM-protected and cannot be saved."
        );
        return;
      }

      this.sendAsyncMessage("MongrelPlayer:DownloadRequest", {
        url: item.url,
        title: item.title,
        type: item.type,
        quality: "best",
      });
    });

    parent.appendChild(button);
    this.#quickButtonVideos.add(video);
  }

  _buildDownloadItem(video) {
    const streams = [...this.#detectedStreams.values()].sort(
      (a, b) => b.confidence - a.confidence
    );
    const bestNonDRM = streams.find(stream => !stream.isDRM);
    if (bestNonDRM) {
      return bestNonDRM;
    }

    const bestDRM = streams[0];
    if (bestDRM?.isDRM) {
      return bestDRM;
    }

    const fallback = this._normalizeDownloadURL(video.currentSrc || video.src || "");
    if (fallback) {
      return {
        url: fallback,
        title: this._resolveTitle(),
        type: HLS_PATTERN.test(fallback) ? "hls" : "direct",
        quality: "best",
        isDRM: false,
      };
    }

    const sourceFallback = Array.from(video.querySelectorAll("source"))
      .map(node => this._normalizeDownloadURL(node.src || ""))
      .find(Boolean);
    if (!sourceFallback) {
      return null;
    }

    return {
      url: sourceFallback,
      title: this._resolveTitle(),
      type: HLS_PATTERN.test(sourceFallback) ? "hls" : "direct",
      quality: "best",
      isDRM: false,
    };
  }

  _normalizeDownloadURL(url) {
    if (!url || /^(blob:|data:|mediasource:)/i.test(url)) {
      return "";
    }
    return /^https?:\/\//i.test(url) ? url : "";
  }

  // ── Overlay injection (Vinegar-mode) ────────────────────────────────────────

  _injectOverlay({ videoSelector } = {}) {
    if (this.#overlayInjected) {
      return;
    }

    const doc = this.document;
    const video = videoSelector
      ? doc.querySelector(videoSelector)
      : doc.querySelector("video");

    if (!video) {
      return;
    }

    const overlay = doc.createElement("div");
    overlay.id = "mongrel-player-overlay";
    overlay.setAttribute("data-mongrel-overlay", "true");
    overlay.innerHTML = this._overlayTemplate(video);

    const style = doc.createElement("style");
    style.id = "mongrel-player-overlay-css";
    style.textContent = this._overlayCSS();

    const container = video.parentElement || doc.body;
    container.style.position = "relative";
    container.appendChild(style);
    container.appendChild(overlay);

    video.style.setProperty("pointer-events", "none", "important");

    this._bindOverlayEvents(overlay, video);
    this.#overlayInjected = true;
    this.sendAsyncMessage("MongrelPlayer:OverlayReady", { videoCount: doc.querySelectorAll("video").length });
  }

  _removeOverlay() {
    const doc = this.document;
    doc.getElementById("mongrel-player-overlay")?.remove();
    doc.getElementById("mongrel-player-overlay-css")?.remove();

    for (const video of doc.querySelectorAll("video")) {
      video.style.removeProperty("pointer-events");
    }

    this.#overlayInjected = false;
  }

  _overlayTemplate(video) {
    const hasSrc = !!(video.currentSrc || video.src);
    return `
      <div class="mpo-shell">
        <div class="mpo-top-bar">
          <span class="mpo-brand">mongrel player</span>
          <button class="mpo-btn mpo-eject" title="Return to site player">&#x2715; site player</button>
        </div>
        <div class="mpo-center-controls">
          <button class="mpo-btn mpo-icon-btn mpo-skip-back" title="Skip back 10s">&#x21BA;</button>
          <button class="mpo-btn mpo-icon-btn mpo-play-pause" title="Play / Pause">&#x25B6;</button>
          <button class="mpo-btn mpo-icon-btn mpo-skip-fwd" title="Skip forward 10s">&#x21BB;</button>
        </div>
        <div class="mpo-bottom-bar">
          <div class="mpo-progress-track">
            <div class="mpo-progress-fill" style="width:0%"></div>
          </div>
          <div class="mpo-row">
            <span class="mpo-time">0:00 / 0:00</span>
            <div class="mpo-right-controls">
              <button class="mpo-btn mpo-pip" title="Picture in Picture">&#x2750;</button>
              <button class="mpo-btn mpo-fullscreen" title="Fullscreen">&#x26F6;</button>
              ${hasSrc ? '<button class="mpo-btn mpo-download" title="Download stream">&#x2913; save</button>' : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindOverlayEvents(overlay, video) {
    const fill = overlay.querySelector(".mpo-progress-fill");
    const timeEl = overlay.querySelector(".mpo-time");

    const fmt = s => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    video.addEventListener("timeupdate", () => {
      if (!video.duration) {
        return;
      }
      const pct = (video.currentTime / video.duration) * 100;
      if (fill) {
        fill.style.width = `${pct}%`;
      }
      if (timeEl) {
        timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
      }
    });

    video.addEventListener("play", () => {
      const btn = overlay.querySelector(".mpo-play-pause");
      if (btn) {
        btn.textContent = "⏸";
      }
    });
    video.addEventListener("pause", () => {
      const btn = overlay.querySelector(".mpo-play-pause");
      if (btn) {
        btn.textContent = "▶";
      }
    });

    overlay.querySelector(".mpo-play-pause")?.addEventListener("click", () => {
      video.paused ? video.play() : video.pause();
    });

    overlay.querySelector(".mpo-skip-back")?.addEventListener("click", () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });

    overlay.querySelector(".mpo-skip-fwd")?.addEventListener("click", () => {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    });

    overlay.querySelector(".mpo-pip")?.addEventListener("click", async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch {}
    });

    overlay.querySelector(".mpo-fullscreen")?.addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        (video.parentElement || video).requestFullscreen?.();
      }
    });

    overlay.querySelector(".mpo-eject")?.addEventListener("click", () => {
      this._removeOverlay();
    });

    overlay.querySelector(".mpo-download")?.addEventListener("click", () => {
      const item = this._buildDownloadItem(video);
      if (item) {
        if (item.isDRM) {
          this.document.defaultView.alert(
            "mongrel player: This stream is DRM-protected and cannot be saved."
          );
          return;
        }
        this.sendAsyncMessage("MongrelPlayer:DownloadRequest", {
          url: item.url,
          title: item.title,
          type: item.type,
          quality: "best",
        });
      }
    });

    overlay.querySelector(".mpo-progress-track")?.addEventListener("click", e => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (video.duration) {
        video.currentTime = pct * video.duration;
      }
    });
  }

  _overlayCSS() {
    return `
      /* ── Root overlay shell ──────────────────────────────────────── */
      #mongrel-player-overlay {
        position: absolute;
        inset: 0;
        z-index: 2147483640;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
        font-size: 13px;
      }

      /* ── Glass shell — fades in on hover ─────────────────────────── */
      #mongrel-player-overlay .mpo-shell {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 12px;
        pointer-events: none;
        opacity: 0;
        /* Chromatic aberration — a near-invisible hue shift that reads
           as glass rather than a flat overlay. */
        filter: hue-rotate(0.5deg);
        transition: opacity 180ms ease;
        /* Directional scrim: heavy at bottom where controls live,
           feathered to nothing in the middle — never obscures content. */
        background:
          linear-gradient(
            to bottom,
            rgba(5,6,20,0.72) 0%,
            transparent 22%,
            transparent 58%,
            rgba(5,6,20,0.80) 84%,
            rgba(5,6,20,0.90) 100%
          ),
          radial-gradient(ellipse 60% 30% at 50% 100%,
            rgba(90,111,255,0.08), transparent 70%);
      }

      #mongrel-player-overlay:hover .mpo-shell,
      #mongrel-player-overlay:focus-within .mpo-shell {
        opacity: 1;
        pointer-events: all;
      }

      /* ── Layout containers ───────────────────────────────────────── */
      .mpo-top-bar,
      .mpo-bottom-bar,
      .mpo-center-controls {
        display: flex;
        align-items: center;
      }

      .mpo-top-bar { justify-content: space-between; }

      .mpo-center-controls {
        justify-content: center;
        gap: 16px;
      }

      .mpo-bottom-bar {
        flex-direction: column;
        gap: 7px;
      }

      .mpo-row {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      /* ── Brand mark ──────────────────────────────────────────────── */
      .mpo-brand {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.10em;
        text-transform: lowercase;
        color: rgba(90,111,255,0.85);
        text-shadow:
          0 0 10px rgba(90,111,255,0.55),
          0 0 24px rgba(90,111,255,0.20);
      }

      /* ── Glass buttons — the core pressable unit ─────────────────── */
      .mpo-btn {
        /* Luminous glass fill: interior edge-catch at top simulates
           light entering from above, then drops to near-transparent. */
        background:
          linear-gradient(180deg,
            rgba(255,255,255,0.14) 0%,
            rgba(255,255,255,0.04) 60%,
            rgba(255,255,255,0.02) 100%),
          rgba(255,255,255,0.06);
        /* Shadow border — no hard line, just depth. */
        border: none;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.22),
          inset 0 0 0 0.5px rgba(90,111,255,0.22),
          0 2px 8px rgba(0,0,0,0.30),
          0 1px 2px rgba(0,0,0,0.18);
        color: rgba(235,238,255,0.95);
        border-radius: 999px;
        padding: 6px 13px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        line-height: 1;
        will-change: transform, opacity;
        transition:
          background 120ms ease,
          box-shadow 120ms ease,
          transform  100ms cubic-bezier(0.34, 1.56, 0.64, 1),
          opacity    100ms ease;
      }

      .mpo-btn:hover {
        background:
          linear-gradient(180deg,
            rgba(255,255,255,0.20) 0%,
            rgba(90,111,255,0.18) 100%),
          rgba(90,111,255,0.12);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.28),
          inset 0 0 0 0.5px rgba(90,111,255,0.38),
          0 0 18px rgba(90,111,255,0.32),
          0 4px 14px rgba(0,0,0,0.32);
      }

      /* Press: scale sinks toward the viewer, opacity dims — conveys
         physical mass without any skeuomorphic shadow nonsense. */
      .mpo-btn:active {
        transform: scale(0.95);
        opacity: 0.86;
        background:
          linear-gradient(180deg,
            rgba(90,111,255,0.30) 0%,
            rgba(90,111,255,0.16) 100%),
          rgba(90,111,255,0.14);
      }

      /* ── Icon button variant (circular) ─────────────────────────── */
      .mpo-icon-btn {
        width: 40px;
        height: 40px;
        padding: 0;
        font-size: 17px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* ── Play/pause — primary action, larger corona ──────────────── */
      .mpo-play-pause {
        width: 52px;
        height: 52px;
        font-size: 22px;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.26),
          inset 0 0 0 0.5px rgba(90,111,255,0.38),
          0 0 24px rgba(90,111,255,0.28),
          0 0 48px rgba(90,111,255,0.10),
          0 4px 16px rgba(0,0,0,0.36);
      }

      /* ── Time display ────────────────────────────────────────────── */
      .mpo-time {
        font-size: 11px;
        font-weight: 500;
        color: rgba(180,190,230,0.68);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.01em;
      }

      /* ── Secondary controls row ──────────────────────────────────── */
      .mpo-right-controls {
        display: flex;
        gap: 5px;
      }

      /* ── Progress track ──────────────────────────────────────────── */
      .mpo-progress-track {
        width: 100%;
        height: 2px;
        background: rgba(255,255,255,0.12);
        border-radius: 999px;
        cursor: pointer;
        position: relative;
        transition: height 140ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .mpo-progress-track:hover { height: 4px; }

      .mpo-progress-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          rgba(90,111,255,0.95),
          color-mix(in srgb, rgba(90,111,255,1) 70%, white)
        );
        border-radius: 999px;
        box-shadow:
          0 0 8px rgba(90,111,255,0.60),
          0 0 2px rgba(90,111,255,0.90);
        transition: width 100ms linear;
        pointer-events: none;
      }

      /* ── Download button: accent tint ────────────────────────────── */
      .mpo-download {
        background:
          linear-gradient(180deg,
            rgba(90,111,255,0.22) 0%,
            rgba(90,111,255,0.12) 100%),
          rgba(90,111,255,0.08);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          inset 0 0 0 0.5px rgba(90,111,255,0.38),
          0 0 12px rgba(90,111,255,0.20),
          0 2px 6px rgba(0,0,0,0.24);
      }

      /* ── Eject button: ghost treatment ───────────────────────────── */
      .mpo-eject {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.04em;
        background:
          linear-gradient(180deg,
            rgba(255,255,255,0.08) 0%,
            rgba(255,255,255,0.02) 100%),
          transparent;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.12),
          inset 0 0 0 0.5px rgba(255,255,255,0.12),
          0 1px 3px rgba(0,0,0,0.18);
        opacity: 0.65;
        transition:
          opacity    160ms ease,
          transform  100ms cubic-bezier(0.34, 1.56, 0.64, 1),
          background 120ms ease;
      }
      .mpo-eject:hover { opacity: 1; }
      .mpo-eject:active { transform: scale(0.95); opacity: 0.85; }
    `;
  }

  // ── Teardown ────────────────────────────────────────────────────────────────

  _teardown() {
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;

    try {
      const win = this.contentWindow;
      if (this.#originalXHROpen && win?.XMLHttpRequest?.prototype) {
        win.XMLHttpRequest.prototype.open = this.#originalXHROpen;
      }
      if (this.#originalFetch && win) {
        win.fetch = this.#originalFetch;
      }
      if (this.#scrollHandler && win) {
        win.removeEventListener("scroll", this.#scrollHandler);
        this.#scrollHandler = null;
      }
    } catch {}

    const doc = this.document;
    if (doc) {
      for (const button of doc.querySelectorAll(".mongrel-quick-video-download")) {
        button.remove();
      }
      doc.getElementById("mongrel-quick-video-download-css")?.remove();
    }

    this.#detectedStreams.clear();
  }
}
