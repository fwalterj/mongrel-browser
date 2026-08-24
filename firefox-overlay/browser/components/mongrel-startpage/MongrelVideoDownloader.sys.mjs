/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * MongrelVideoDownloader
 *
 * Handles the actual download work for both HLS streams and direct video URLs.
 * Works independently of the page overlay — triggered by the overlay download
 * button, the tab-player UI, or any future toolbar/context-menu integration.
 *
 * HLS pipeline (derived from hls-downloader architecture):
 *   1. Fetch master playlist → pick highest-bandwidth variant.
 *   2. Fetch variant playlist → collect ordered segment URIs.
 *   3. Fetch all segments as ArrayBuffer, concatenate into MPEG-TS.
 *   4. Write to ~/Downloads/<title>.ts via IOUtils.
 *
 * Direct video pipeline:
 *   Passes the URL through Firefox's Downloads API for a normal managed download.
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
});

const HLS_URL_RE = /\.m3u8(\?.*)?$/i;
const HLS_CONTENT_TYPES = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
];
const DIRECT_EXTS_RE = /\.(mp4|webm|mov|mkv|m4v|ts|avi|flv)(\?.*)?$/i;

export const MongrelVideoDownloader = {
  /**
   * @param {object} item  { url, title, type, quality }
   * @param {Window} win   Chrome window (for progress notifications).
   * @returns {Promise<void>}
   */
  async download(item, win) {
    const { url, title, type } = item;
    if (!url) {
      throw new Error("MongrelVideoDownloader: no URL provided");
    }

    const safeName = _sanitize(title || _titleFromURL(url));

    if (type === "hls" || HLS_URL_RE.test(url)) {
      return this._downloadHLS(url, safeName, win);
    }
    return this._downloadDirect(url, safeName, win);
  },

  // ── Direct video (mp4, webm, …) ────────────────────────────────────────────

  async _downloadDirect(url, name, win) {
    const ext = _guessExt(url);
    const dir = await lazy.Downloads.getSystemDownloadsDirectory();
    const target = PathUtils.join(dir, name + ext);
    const uniqueTarget = _uniquePath(target);

    const dl = await lazy.Downloads.createDownload({
      source: { url },
      target: { path: uniqueTarget },
    });
    await dl.start();
    const list = await lazy.Downloads.getList(lazy.Downloads.ALL);
    list.add(dl);
  },

  // ── HLS ────────────────────────────────────────────────────────────────────

  async _downloadHLS(masterUrl, name, win) {
    const masterText = await _fetchText(masterUrl);
    if (!masterText) {
      throw new Error("MongrelVideoDownloader: could not fetch playlist");
    }

    let segmentPlaylistUrl = masterUrl;
    let segmentPlaylistText = masterText;

    if (_isMasterPlaylist(masterText)) {
      const variantUrl = _bestVariantURL(masterText, masterUrl);
      if (variantUrl) {
        segmentPlaylistUrl = variantUrl;
        segmentPlaylistText = await _fetchText(variantUrl);
        if (!segmentPlaylistText) {
          throw new Error("MongrelVideoDownloader: could not fetch variant playlist");
        }
      }
    }

    const segments = _parseSegmentURLs(segmentPlaylistText, segmentPlaylistUrl);
    if (!segments.length) {
      throw new Error("MongrelVideoDownloader: no segments found in playlist");
    }

    _notifyProgress(win, { phase: "downloading", total: segments.length, done: 0 });

    const buffers = [];
    let done = 0;
    for (const segURL of segments) {
      try {
        const buf = await _fetchArrayBuffer(segURL);
        buffers.push(buf);
      } catch {
        // Skip unreadable segments rather than aborting the whole download.
      }
      done++;
      if (done % 5 === 0 || done === segments.length) {
        _notifyProgress(win, { phase: "downloading", total: segments.length, done });
      }
    }

    if (!buffers.length) {
      throw new Error("MongrelVideoDownloader: all segments failed");
    }

    _notifyProgress(win, { phase: "muxing", total: buffers.length, done: buffers.length });

    const merged = _concatBuffers(buffers);
    const dir = await lazy.Downloads.getSystemDownloadsDirectory();
    const target = PathUtils.join(dir, name + ".ts");
    const uniqueTarget = _uniquePath(target);

    await IOUtils.write(uniqueTarget, merged);

    _notifyProgress(win, { phase: "done", path: uniqueTarget });
    Services.obs.notifyObservers(
      null,
      "mongrel-player:download-complete",
      uniqueTarget
    );
  },
};

// ── Playlist parsing helpers ────────────────────────────────────────────────

function _isMasterPlaylist(text) {
  return text.includes("#EXT-X-STREAM-INF:");
}

/**
 * Picks the variant URI with the highest BANDWIDTH from a master playlist.
 * Falls back to the first listed variant if none carry BANDWIDTH attributes.
 */
function _bestVariantURL(masterText, baseURL) {
  const lines = masterText.split(/\r?\n/);
  let bestBW = -1;
  let bestURI = null;
  let firstURI = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) {
      continue;
    }
    const uriLine = lines[i + 1]?.trim();
    if (!uriLine || uriLine.startsWith("#")) {
      continue;
    }

    if (!firstURI) {
      firstURI = _resolveURL(uriLine, baseURL);
    }

    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
    const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    if (bw > bestBW) {
      bestBW = bw;
      bestURI = _resolveURL(uriLine, baseURL);
    }
  }

  return bestURI || firstURI;
}

/**
 * Extracts all non-comment, non-tag lines as segment URIs from a level playlist.
 */
function _parseSegmentURLs(playlistText, baseURL) {
  const segments = [];
  for (const raw of playlistText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const abs = _resolveURL(line, baseURL);
    if (abs) {
      segments.push(abs);
    }
  }
  return segments;
}

function _resolveURL(uri, base) {
  if (!uri) {
    return null;
  }
  if (/^https?:\/\//i.test(uri)) {
    return uri;
  }
  try {
    return new URL(uri, base).href;
  } catch {
    return null;
  }
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function _fetchText(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return null;
    }
    return resp.text();
  } catch {
    return null;
  }
}

async function _fetchArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.arrayBuffer();
}

// ── Buffer utilities ────────────────────────────────────────────────────────

function _concatBuffers(buffers) {
  const total = buffers.reduce((n, b) => n + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    out.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return out;
}

// ── Filename utilities ──────────────────────────────────────────────────────

function _sanitize(s) {
  return (s || "video")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/_{2,}/g, "_")
    .trim()
    .slice(0, 80) || "video";
}

function _titleFromURL(url) {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop() || "video";
    return last.replace(/\.[^.]+$/, "");
  } catch {
    return "video";
  }
}

function _guessExt(url) {
  const m = url.match(DIRECT_EXTS_RE);
  return m ? `.${m[1].toLowerCase()}` : ".mp4";
}

// ── Path utilities ──────────────────────────────────────────────────────────

/**
 * Returns a path that does not yet exist on disk by appending ` (N)` before
 * the extension when needed.  Synchronous check via IOUtils.existsSync is not
 * available in all contexts; we use a timestamp suffix as a safe fallback.
 */
function _uniquePath(base) {
  const dot = base.lastIndexOf(".");
  const stem = dot >= 0 ? base.slice(0, dot) : base;
  const ext = dot >= 0 ? base.slice(dot) : "";
  const ts = Date.now();
  const candidate = `${stem}_${ts}${ext}`;
  return candidate;
}

// ── Progress notifications ──────────────────────────────────────────────────

function _notifyProgress(win, detail) {
  if (!win) {
    return;
  }
  try {
    win.dispatchEvent(
      new win.CustomEvent("mongrel-player:download-progress", {
        bubbles: false,
        detail,
      })
    );
  } catch {}
}
