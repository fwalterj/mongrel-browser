/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  MongrelPlayerService: "resource:///modules/MongrelPlayerService.sys.mjs",
  MongrelVideoDownloader: "resource:///modules/MongrelVideoDownloader.sys.mjs",
  MongrelThemeEffects: "resource:///modules/MongrelThemeEffects.sys.mjs",
});

/**
 * MongrelPlayerParent
 *
 * Privileged (chrome-process) side of the MongrelPlayer JSWindowActor pair.
 *
 * Message protocol from child:
 *   "MongrelPlayer:StreamsDetected"  — { streams: StreamInfo[] }
 *   "MongrelPlayer:OverlayReady"     — { videoCount: number }
 *   "MongrelPlayer:DownloadRequest"  — { url, title, type, quality }
 *   "MongrelPlayer:OpenStandalone"   — { url }
 *
 * StreamInfo: { url, title, type, qualities, isLive, isDRM, confidence }
 */
export class MongrelPlayerParent extends JSWindowActorParent {
  receiveMessage(message) {
    switch (message.name) {
      case "MongrelPlayer:StreamsDetected":
        this._onStreamsDetected(message.data);
        break;
      case "MongrelPlayer:DownloadRequest":
        this._onDownloadRequest(message.data);
        break;
      case "MongrelPlayer:OpenStandalone":
        this._onOpenStandalone(message.data);
        break;
      case "MongrelPlayer:ScrollStateChanged":
        this._onScrollStateChanged(message.data);
        break;
    }
  }

  _onStreamsDetected({ streams }) {
    if (!Array.isArray(streams) || !streams.length) {
      return;
    }
    const browser = this.browsingContext?.embedderElement;
    if (!browser) {
      return;
    }
    lazy.MongrelPlayerService.registerStreams(browser, streams);
  }

  _onDownloadRequest({ url, title, type, quality }) {
    if (!url) {
      return;
    }
    lazy.MongrelPlayerService.enqueueDownload({ url, title, type, quality });

    const win = this.browsingContext?.embedderElement?.ownerGlobal;
    lazy.MongrelVideoDownloader.download({ url, title, type, quality }, win).catch(
      err => Cu.reportError(`MongrelVideoDownloader: ${err.message}`)
    );
  }

  _onScrollStateChanged({ isScrolled }) {
    const browser = this.browsingContext?.embedderElement;
    if (!browser) {
      return;
    }
    lazy.MongrelThemeEffects.setPageScrollState(browser, isScrolled);
  }

  _onOpenStandalone({ url }) {
    const win = this.browsingContext?.embedderElement?.ownerGlobal;
    if (!win) {
      return;
    }
    const standaloneURL = url
      ? `chrome://browser/content/mongrel-player/player.html#${encodeURIComponent(url)}`
      : "chrome://browser/content/mongrel-player/player.html";

    win.openTrustedLinkIn(standaloneURL, "tab");
  }
}
