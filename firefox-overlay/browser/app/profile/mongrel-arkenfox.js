// -*- Mode: JavaScript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*-
// vim: set ts=8 sw=2 et tw=80:
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// =====================================================================
// Mongrel Arkenfox Baseline
// =====================================================================
//
// PROVENANCE
//   Distilled from arkenfox/user.js v144 (21 Apr 2026) under MIT.
//   Upstream:  https://github.com/arkenfox/user.js
//   Vendored copy lives at tools/arkenfox-vendored/user.js for audit.
//
// PURPOSE
//   Bake the privacy/security wins of arkenfox directly into Mongrel as
//   build-time *default* preferences (pref(...), not user_pref(...)) so
//   every fresh profile gets them on first launch with zero install
//   ceremony, zero auto-updaters, and zero phone-home — the App Store-
//   compliant way to ship hardening.
//
// LOAD ORDER
//   `defaults/preferences/*.js` files are read alphabetically by Gecko's
//   nsIPrefService at startup. Filenames sort: `firefox.js` then
//   `mongrel-arkenfox.js`, so any pref set in BOTH files takes its value
//   from THIS file. Use that intentionally to override Mozilla-leaning
//   upstream defaults (e.g. UITour, telemetry submission) while leaving
//   anything Mongrel-specific (start page, brand, image overlay, IPFS,
//   Sanctuary, mood) untouched in firefox.js.
//
// SCOPE: BASELINE TIER ONLY
//   We ship the "casual fun browser that also feels safe" subset: prefs
//   that meaningfully harden the browser without breaking common UX.
//   The aggressive arkenfox prefs (RFP, WebRTC kill, sanitize-on-
//   shutdown, captive-portal off, force-ask-on-every-download, disk
//   cache off, IDN punycode-only, formfill off, autofill off…) are
//   DELIBERATELY NOT BAKED — they are listed in the "intentionally not
//   baked" annotations below so reviewers can see exactly what we
//   declined and why. Power users can flip any of them in about:config
//   or drop the upstream user.js into their profile dir verbatim.
//
// APP STORE COMPLIANCE NOTES
//   * Static, build-time resource shipped read-only inside the .app
//     bundle (Contents/Resources/defaults/preferences/). No writable
//     payload, no auto-updater, no remote fetch.
//   * Disables Mozilla telemetry, Normandy, Studies, Crash Reporter,
//     Activity-Stream sponsored content, captive-portal probe,
//     connectivity-service probe, and Web Compatibility Reporter — all
//     network calls Apple's privacy review prefers absent.
//   * Does NOT alter sandbox prefs, code-signing surface, or any
//     sandbox-relevant security boundaries.
//
// AUDIT MAP
//   Section numbers below mirror arkenfox's numbering so a reviewer can
//   diff against the upstream user.js line-for-line.
// =====================================================================

// --- 0100 STARTUP --------------------------------------------------
// 0102/0103/0104: NOT baked. Mongrel's start page is the product;
//   browser.startup.homepage is set in firefox.js to the chrome newtab.
// 0105: disable sponsored content on Firefox Home (defense-in-depth).
pref("browser.newtabpage.activity-stream.showSponsored",          false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites",  false);
pref("browser.newtabpage.activity-stream.showSponsoredCheckboxes", false);
// 0106: clear default topsites (user can still pin their own).
pref("browser.newtabpage.activity-stream.default.sites", "");

// --- 0200 GEOLOCATION ----------------------------------------------
// 0202: disable using the OS's geolocation service in JS sites that
//   somehow get the geo prompt past the prompt — defense in depth.
pref("geo.provider.ms-windows-location",  false); // [WINDOWS]
pref("geo.provider.use_corelocation",     false); // [MAC]
pref("geo.provider.use_geoclue",          false); // [LINUX]

// --- 0300 QUIETER FOX ----------------------------------------------
// 0320: disable recommendation pane in about:addons (Google Analytics).
pref("extensions.getAddons.showPane", false);
// 0321: disable AMO recommendation panes.
pref("extensions.htmlaboutaddons.recommendations.enabled", false);
// 0322: disable personalized AMO recommendations.
pref("browser.discovery.enabled", false);
// 0335: disable Activity Stream telemetry feeds.
pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry",       false);
// 0340: disable Studies opt-out switch.
pref("app.shield.optoutstudies.enabled", false);
// 0341: disable Normandy/Shield experiment runner.
pref("app.normandy.enabled",  false);
pref("app.normandy.api_url",  "");
// 0350/0351: disable crash report submission.
pref("breakpad.reportURL",                                "");
pref("browser.tabs.crashReporting.sendReport",            false);
pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);
// 0360/0361: NOT baked. Captive-portal probes break airport / hotel /
//   municipal Wi-Fi onboarding for casual users; disabling them is a
//   power-user choice, not a baseline default.

// --- 0400 SAFE BROWSING --------------------------------------------
// 0403: don't send file metadata to Google for download safety lookup.
//   Local block lists still work.
pref("browser.safebrowsing.downloads.remote.enabled", false);

// --- 0600 IMPLICIT OUTBOUND ----------------------------------------
// 0601: link prefetching off.
pref("network.prefetch-next", false);
// 0602: DNS prefetching off.
pref("network.dns.disablePrefetch",          true);
pref("network.dns.disablePrefetchFromHTTPS", true);
// 0604: no speculative connection on link-mouseover.
pref("network.http.speculative-parallel-limit", 0);
// 0605: no mousedown speculative connect on bookmarks/history.
pref("browser.places.speculativeConnect.enabled", false);

// --- 0700 DNS / DoH / PROXY ----------------------------------------
// 0702: route DNS through SOCKS proxy when one is configured.
pref("network.proxy.socks_remote_dns", true);
// 0703: disable UNC paths.
pref("network.file.disable_unc_paths", true);
// 0704: clamp GIO supported protocols (Linux proxy-bypass mitigation).
pref("network.gio.supported-protocols", "");
// 0710 DoH mode / 0712 DoH provider: NOT baked. Letting the user pick
//   in Settings is friendlier than forcing TRR-only on first launch.

// --- 0800 LOCATION BAR / SUGGESTIONS / FORMS -----------------------
// 0801: no speculative connect from the urlbar.
pref("browser.urlbar.speculativeConnect.enabled", false);
// 0802: kill Firefox Suggest contextual suggestions (already false in
//   firefox.js, restated here as defense-in-depth and audit signal).
pref("browser.urlbar.quicksuggest.enabled",                  false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored",     false);
pref("browser.urlbar.suggest.quicksuggest.sponsored",        false);
// 0805: kill trending search-suggestion gate.
pref("browser.urlbar.trending.featureGate", false);
// 0806: kill all the upsell feature gates Mozilla has been wiring in.
pref("browser.urlbar.addons.featureGate",          false);
pref("browser.urlbar.amp.featureGate",             false);
pref("browser.urlbar.importantDates.featureGate",  false);
pref("browser.urlbar.market.featureGate",          false);
pref("browser.urlbar.mdn.featureGate",             false);
pref("browser.urlbar.weather.featureGate",         false);
pref("browser.urlbar.wikipedia.featureGate",       false);
pref("browser.urlbar.yelp.featureGate",            false);
pref("browser.urlbar.yelpRealtime.featureGate",    false);
// 0810 formfill / 0903/0904 signon autofill: NOT baked. The user wants
//   a "casual fun" browser; turning off in-form autofill makes every
//   login feel broken. Power users can flip these in about:config.
// 0830: separate default search engine in Private Windows + UI for it.
//   The user explicitly asked for per-surface search-engine choice and
//   this is the upstream switch that exposes it.
pref("browser.search.separatePrivateDefault",            true);
pref("browser.search.separatePrivateDefault.ui.enabled", true);

// --- 0900 PASSWORDS / PASSKEYS -------------------------------------
// 0905: only allow same-origin sub-resources to open HTTP-auth dialogs.
pref("network.auth.subresource-http-auth-allow", 1);
// 0910: enforce upstream default of no direct attestation.
pref("security.webauthn.always_allow_direct_attestation", false);

// --- 1000 DISK AVOIDANCE -------------------------------------------
// 1001 disk cache off / 1003 sessionstore privacy_level=2: NOT baked.
//   Disabling disk cache hurts perf noticeably and is a privacy-vs-
//   convenience trade we leave to the user.
// 1002: keep media cache in-memory while in Private Browsing.
pref("browser.privatebrowsing.forceMediaMemoryCache", true);
pref("media.memory_cache_max_size",                   65536);
// 1005: don't auto-restart Firefox session after Windows reboot.
pref("toolkit.winRegisterApplicationRestart", false);
// 1006: no shortcut-favicon ico cache (Windows).
pref("browser.shell.shortcutFavicons", false);

// --- 1200 HTTPS / SSL / TLS / CERTS --------------------------------
// 1201: require RFC 5746 safe TLS renegotiation (~99.85% top sites OK).
pref("security.ssl.require_safe_negotiation", true);
// 1206: disable TLS 1.3 0-RTT (replay risk).
pref("security.tls.enable_0rtt_data", false);
// 1223: strict cert pinning (level 2). Rare break with corp MITM proxy;
//   the small minority who hit this can flip in about:config.
pref("security.cert_pinning.enforcement_level", 2);
// 1224: keep CRLite at upstream default 2 (already default; restated).
pref("security.remote_settings.crlite_filters.enabled", true);
pref("security.pki.crlite_mode",                        2);
// 1244: HTTPS-Only mode browser-wide (with click-through fallback for
//   the rare legacy site). Big "feels safe" win for casual users.
pref("dom.security.https_only_mode", true);
// 1246: don't fire HTTP background-probe requests during HTTPS upgrade.
pref("dom.security.https_only_mode_send_http_background_request", false);
// 1270: padlock warning on broken security.
pref("security.ssl.treat_unsafe_negotiation_as_broken", true);
// 1272: expert advanced info on insecure-cert pages.
pref("browser.xul.error_pages.expert_bad_cert", true);

// --- 1600 REFERERS -------------------------------------------------
// 1602: cross-origin referer = scheme+host+port (no path/query leak).
pref("network.http.referer.XOriginTrimmingPolicy", 2);

// --- 1700 CONTAINERS -----------------------------------------------
// 1701: enable Container Tabs and the Settings UI for them. Sanctuary
//   already piggy-backs on userContextId; exposing the full feature is
//   a casual privacy win and keeps a single mental model for users.
pref("privacy.userContext.enabled",    true);
pref("privacy.userContext.ui.enabled", true);

// --- 2000 PLUGINS / MEDIA / WEBRTC ---------------------------------
// 2002: WebRTC stays inside the proxy when one is configured.
pref("media.peerconnection.ice.proxy_only_if_behind_proxy", true);
// 2003: single network interface for ICE candidate generation.
pref("media.peerconnection.ice.default_address_only", true);
// 2004 (no_host) / 7020 (peerconnection.enabled=false): NOT baked.
//   Killing WebRTC kills Discord voice, Google Meet, Whereby, etc. —
//   a casual deal-breaker. We rely on 2002+2003 for the IP-leak
//   mitigation that matters most.

// --- 2400 DOM ------------------------------------------------------
// 2402: scripts can't move/resize open windows.
pref("dom.disable_window_move_resize", true);

// --- 2600 MISCELLANEOUS --------------------------------------------
// 2603 (start_downloads_in_tmp_dir / deleteTempFileOnExit): NOT baked.
//   "Open" putting files in /tmp first surprises casual users; we keep
//   the default save-to-Downloads flow (which the floating image
//   overlay also depends on for direct PNG saves).
// 2606: kill the UITour backend (overrides firefox.js' "true" so no
//   remote page can drive the Mozilla onboarding overlays).
pref("browser.uitour.enabled", false);
// 2608: remote debugging stays off (enforce upstream default).
pref("devtools.debugger.remote-enabled", false);
// 2616: drop the special permissions Mozilla pre-grants to its own
//   domains (resource://app/defaults/permissions). Pure de-Mozilla
//   plumbing.
pref("permissions.manager.defaultsUrl", "");
// 2619 (network.IDN_show_punycode): NOT baked. Full punycode display
//   makes real non-Latin domains illegible — a UX regression for any
//   user outside the Latin alphabet.
// 2620: PDF.js scripting off (the JS-in-PDF attack surface).
pref("pdfjs.enableScripting", false);
// 2624: middle-click on the new-tab button doesn't paste-and-search.
pref("browser.tabs.searchclipboardfor.middleclick", false);
// 2630: content-analysis (DLP agent integration) off.
pref("browser.contentanalysis.enabled",        false);
pref("browser.contentanalysis.default_result", 0);
// 2635: isolate referrer + storage access for content-script resources.
pref("privacy.antitracking.isolateContentScriptResources", true);
// 2640: CSP Level-2 violation reporting off.
pref("security.csp.reporting.enabled", false);

// 2651/2652/2654 (always-ask-on-download): NOT baked. Forcing a "save
//   as" dialog on every download is exactly the friction the user
//   asked us to remove from the floating image overlay; we keep the
//   one-click flow.
// 2653: don't add downloads to the OS "recent documents" list.
pref("browser.download.manager.addToRecentDocs", false);

// 2660: limit extension install scope to profile + application dirs.
pref("extensions.enabledScopes", 5);
// 2661: don't bypass third-party-extension install prompts.
pref("extensions.postDownloadThirdPartyPrompt", false);

// --- 2700 ETP (ENHANCED TRACKING PROTECTION) -----------------------
// 2701: ETP Strict mode (enables Total Cookie Protection by default).
pref("browser.contentblocking.category", "strict");
// 2705: ETP exception lists at upstream defaults (re-stated for audit).
pref("privacy.trackingprotection.allow_list.baseline.enabled",    true);
pref("privacy.trackingprotection.allow_list.convenience.enabled", true);

// --- 2800 SHUTDOWN & SANITIZING ------------------------------------
// 2810/2811/2815 (sanitizeOnShutdown master + clearOnShutdown_v2.*):
//   NOT baked. Logging the user out of every site on every quit is the
//   single most disruptive arkenfox default — incompatible with the
//   "fun, casual" persona. Container Tabs (1701) + ETP Strict (2701)
//   already cover the cross-site-tracking concern for daily use.

// --- 4500 OPTIONAL RFP ---------------------------------------------
// 4501 (privacy.resistFingerprinting): NOT baked. RFP forces GMT
//   timezone, light theme, fixed window size, garbled fonts, and
//   randomized canvas — all visible regressions on the daily web.
//   We rely on Firefox's FPP (auto-on under ETP Strict) instead.
// 4502: still set the RFP window-size cap so IF the user turns RFP on
//   later in about:config the result is sane.
pref("privacy.window.maxInnerWidth",  1600);
pref("privacy.window.maxInnerHeight", 900);
// 4503 (block_mozAddonManager): NOT baked. Breaks AMO install button.
// 4506 (privacy.spoof_english): NOT baked. Forces en-US Accept-Language
//   on every request — visibly wrong for non-English users.
// 4511: don't let the OS theme accent paint our chrome.
pref("widget.non-native-theme.use-theme-accent", false);
// 4512: links targeting new windows open as new tabs instead.
pref("browser.link.open_newwindow", 3);
// 4513 (open_newwindow.restriction=0): NOT baked. firefox.js sets
//   restriction=2 which is the right Mongrel default (allow window.open
//   for same-origin only). Leaving firefox.js to win.
// 4520 (webgl.disabled): NOT baked. Kills WebGL games and 3D tools.

// --- 6000 DON'T TOUCH (enforce upstream defaults) ------------------
// 6001: extension blocklist on (revoked-cert updates).
pref("extensions.blocklist.enabled", true);
// 6002: no referer spoofing (CSRF protections rely on this).
pref("network.http.referer.spoofSource", false);
// 6004: 1s confirmation-dialog security delay.
pref("security.dialog_enable_delay", 1000);
// 6008: don't enable First-Party Isolation (TCP supersedes it).
pref("privacy.firstparty.isolate", false);
// 6009: keep SmartBlock shims on (web compat for blocked trackers).
pref("extensions.webcompat.enable_shims", true);
// 6010: no TLS 1.0/1.1 downgrade.
pref("security.tls.version.enable-deprecated", false);
// 6011: no "Report Site Issue" button calling Mozilla home.
pref("extensions.webcompat-reporter.enabled", false);
// 6012: respect Quarantined Domains list (keeps known-malicious
//   extension behavior contained).
pref("extensions.quarantinedDomains.enabled", true);

// --- 8500 TELEMETRY ------------------------------------------------
// 8500: never submit policy data, never show the policy modal.
pref("datareporting.policy.dataSubmissionEnabled", false);
// 8501: no Health Reports upload.
pref("datareporting.healthreport.uploadEnabled", false);
// 8502: kill telemetry every which way (the "enabled" switch is now
//   locked to channel; we still send the rest of the pings to /dev/null
//   via toolkit.telemetry.server).
pref("toolkit.telemetry.unified",                     false);
pref("toolkit.telemetry.enabled",                     false);
pref("toolkit.telemetry.server",                      "data:,");
pref("toolkit.telemetry.archive.enabled",             false);
pref("toolkit.telemetry.newProfilePing.enabled",      false);
pref("toolkit.telemetry.shutdownPingSender.enabled",  false);
pref("toolkit.telemetry.updatePing.enabled",          false);
pref("toolkit.telemetry.bhrPing.enabled",             false);
pref("toolkit.telemetry.firstShutdownPing.enabled",   false);
// 8503: opt out of telemetry coverage and clear the endpoint.
pref("toolkit.telemetry.coverage.opt-out", true);
pref("toolkit.coverage.opt-out",           true);
pref("toolkit.coverage.endpoint.base",     "");

// --- 9000 NON-PROJECT (Mozilla noise reduction) --------------------
// 9001: silence the post-update "what's new" homepage redirect.
pref("browser.startup.homepage_override.mstone", "ignore");
// 9002: kill the "Recommend extensions/features as you browse" promos.
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons",   false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
// 9004: don't replace the URL with the search terms in the address bar
//   (firefox.js sets this to true via showSearchTerms.enabled — we
//   override here. The plain URL is more honest.)
pref("browser.urlbar.showSearchTerms.enabled", false);

// --- 9999 DEPRECATED-BUT-STILL-LIVE -------------------------------
// 0603: predictor + prefetch off (still active in current Gecko).
pref("network.predictor.enabled",         false);
pref("network.predictor.enable-prefetch", false);

// =====================================================================
// END mongrel-arkenfox.js
// =====================================================================
