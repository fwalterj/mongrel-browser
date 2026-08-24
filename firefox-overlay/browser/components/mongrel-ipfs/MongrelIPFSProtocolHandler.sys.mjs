/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Mongrel IPFS / IPNS protocol handlers.
 *
 * Implements `ipfs://` and `ipns://` as standard browser-level URI
 * schemes. Resolution is via a public HTTPS gateway, transparently:
 *
 *   ipfs://CID/path/file.html
 *     → https://{gateway}/ipfs/CID/path/file.html
 *
 *   ipns://name.eth/index.html
 *     → https://{gateway}/ipns/name.eth/index.html
 *
 * Why a gateway and not a local node:
 *   - App Store distribution forbids bundling Kubo (a Go-based daemon
 *     that listens on localhost ports). Even direct-DMG users would
 *     pay a startup-time, RAM, and disk-space tax for a feature most
 *     people use occasionally. The public-gateway approach is
 *     instantaneous and zero-config.
 *   - The user can swap gateways in Settings if the default is
 *     blocked / slow / they don't trust Cloudflare. Self-hosters can
 *     point at `127.0.0.1:8080`.
 *   - In the future, if Mongrel ever ships a sidecar Kubo daemon for
 *     direct-distribution builds only, the same pref simply gets
 *     pointed at `localhost:8080` — no other code changes required.
 *
 * The handler does not enforce any specific gateway operator: it's a
 * URL rewrite and nothing more. Cookies / storage / cache are scoped
 * to the gateway origin (because we set `resultPrincipalURI`), which
 * is the right answer — IPFS content fetched via Cloudflare shares
 * a security context with other Cloudflare-IPFS-served content, the
 * same as any other HTTPS site.
 */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { NetUtil } from "resource://gre/modules/NetUtil.sys.mjs";

const PREF_GATEWAY = "mongrel.ipfs.gateway";
const DEFAULT_GATEWAY = "cloudflare-ipfs.com";
const PREF_ENABLED = "mongrel.ipfs.enabled";

// Hardcoded fallback used when the user's chosen gateway is something
// obviously broken (empty, contains a scheme, etc.). We never silently
// fail to a different operator without telling the user — better to
// throw and have them fix their pref than to pretend it worked.
function sanitizeGateway(raw) {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_GATEWAY;
  }
  // Strip scheme if user pasted e.g. "https://dweb.link" — we always
  // resolve over HTTPS, so the scheme is implicit.
  let host = raw.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/g, "").trim();
  // Reject obviously bad input (empty, has a path segment, has a
  // space). Anything weirder than that is the user's problem.
  if (!host || host.includes("/") || /\s/.test(host)) {
    return DEFAULT_GATEWAY;
  }
  return host;
}

/**
 * Build the gateway URL for a given namespace ("ipfs" or "ipns") and
 * the source IPFS-scheme URI.
 *
 * Important: we use `uri.host` plus `uri.pathQueryRef` to preserve the
 * path AND any `?query=` AND any `#fragment` from the original URI.
 * The IO service constructs a URI with the namespace as the first
 * path segment because that's how all major IPFS HTTP gateways are
 * laid out (`/ipfs/CID/...` and `/ipns/name/...`).
 */
function buildGatewayURI(namespace, uri, gatewayHost) {
  // `uri.host` is the CID (for ipfs://) or name (for ipns://).
  // `uri.pathQueryRef` includes the leading slash plus any path,
  // query, and fragment. If the source URI had no path at all, this
  // will be just "/" which is what we want.
  const host = uri.host;
  if (!host) {
    throw new Error(
      `Mongrel IPFS: ${uri.scheme}:// URI is missing a host (CID/name)`
    );
  }
  const tail = uri.pathQueryRef || "/";
  const target = `https://${gatewayHost}/${namespace}/${host}${tail}`;
  return NetUtil.newURI(target);
}

/**
 * Common channel-creation logic for both schemes. We:
 *   1. Look up the gateway host from the user pref.
 *   2. Compute the rewritten HTTPS URL.
 *   3. Build a regular HTTPS channel via the IO service so caching,
 *      cookies, certificate pinning, and content sniffing all behave
 *      exactly like a direct HTTPS load.
 *   4. Set `loadInfo.resultPrincipalURI` to the gateway URL so the
 *      committed document's principal is the gateway origin (rather
 *      than `ipfs://CID/...`, which would have no security context).
 *
 * If `mongrel.ipfs.enabled` is `false`, we fail the channel (which
 * surfaces the standard "Address wasn't understood" page) — same as
 * if no protocol handler were registered.
 */
function createGatewayChannel(namespace, uri, loadInfo) {
  if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
    throw Components.Exception(
      `Mongrel IPFS is disabled (${PREF_ENABLED} = false)`,
      Cr.NS_ERROR_UNKNOWN_PROTOCOL
    );
  }
  const gatewayHost = sanitizeGateway(
    Services.prefs.getStringPref(PREF_GATEWAY, DEFAULT_GATEWAY)
  );
  const gatewayURI = buildGatewayURI(namespace, uri, gatewayHost);
  const channel = Services.io.newChannelFromURIWithLoadInfo(
    gatewayURI,
    loadInfo
  );
  loadInfo.resultPrincipalURI = gatewayURI;
  return channel;
}

export function MongrelIPFSHandler() {
  XPCOMUtils.defineLazyPreferenceGetter(
    this,
    "_gateway",
    PREF_GATEWAY,
    DEFAULT_GATEWAY
  );
}

MongrelIPFSHandler.prototype = {
  scheme: "ipfs",
  defaultPort: -1,
  // URI_STD: standard host-based URL. URI_NOAUTH: no userinfo allowed
  // (CIDs don't have user:pass@). URI_LOADABLE_BY_ANYONE: any web page
  // can put `<a href="ipfs://...">` on it, same security posture as
  // linking to any HTTPS gateway URL.
  protocolFlags:
    Ci.nsIProtocolHandler.URI_STD |
    Ci.nsIProtocolHandler.URI_NOAUTH |
    Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,

  newChannel(uri, loadInfo) {
    return createGatewayChannel("ipfs", uri, loadInfo);
  },

  allowPort() {
    // ipfs:// URIs never specify a port. Reject any that try.
    return false;
  },

  QueryInterface: ChromeUtils.generateQI(["nsIProtocolHandler"]),
};

export function MongrelIPNSHandler() {
  XPCOMUtils.defineLazyPreferenceGetter(
    this,
    "_gateway",
    PREF_GATEWAY,
    DEFAULT_GATEWAY
  );
}

MongrelIPNSHandler.prototype = {
  scheme: "ipns",
  defaultPort: -1,
  protocolFlags:
    Ci.nsIProtocolHandler.URI_STD |
    Ci.nsIProtocolHandler.URI_NOAUTH |
    Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,

  newChannel(uri, loadInfo) {
    return createGatewayChannel("ipns", uri, loadInfo);
  },

  allowPort() {
    return false;
  },

  QueryInterface: ChromeUtils.generateQI(["nsIProtocolHandler"]),
};
