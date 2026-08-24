/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */

"use strict";

const DARKMODE_CSS_BEGIN = "/* MONGREL_DARKMODE_MANAGED_BEGIN */";
const DARKMODE_CSS_END = "/* MONGREL_DARKMODE_MANAGED_END */";

Preferences.addAll([
  { id: "pref.mongrel.darkmode.enabled", name: "mongrel.darkmode.enabled", type: "bool" },
  {
    id: "pref.mongrel.darkmode.follow_system",
    name: "mongrel.darkmode.follow_system",
    type: "bool",
  },
  {
    id: "pref.mongrel.darkmode.force_fallback",
    name: "mongrel.darkmode.force_fallback",
    type: "bool",
  },
  { id: "pref.mongrel.darkmode.theme", name: "mongrel.darkmode.theme", type: "string" },
  {
    id: "pref.layout.css.prefers-color-scheme.content-override",
    name: "layout.css.prefers-color-scheme.content-override",
    type: "int",
  },
]);

var gDarkModePane = {
  _inited: false,

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;

    document.getElementById("darkModeEnabled").addEventListener("command", () => {
      this.apply();
    });
    document
      .getElementById("darkModeFollowSystem")
      .addEventListener("command", () => {
        this.apply();
      });
    document
      .getElementById("darkModeForceFallback")
      .addEventListener("command", () => {
        this.apply();
      });
    document.getElementById("darkModeTheme").addEventListener("command", () => {
      this.apply();
    });

    Services.obs.addObserver(this, "look-and-feel-changed");
    window.addEventListener(
      "unload",
      () => {
        Services.obs.removeObserver(this, "look-and-feel-changed");
      },
      { once: true }
    );

    this.apply();
  },

  observe(_subject, topic) {
    if (topic == "look-and-feel-changed") {
      this.apply();
    }
  },

  apply() {
    let enabled = Preferences.get("mongrel.darkmode.enabled", true);
    let followSystem = Preferences.get("mongrel.darkmode.follow_system", true);
    let forceFallback = Preferences.get("mongrel.darkmode.force_fallback", false);
    let theme = Preferences.get("mongrel.darkmode.theme", "dark");

    let followEl = document.getElementById("darkModeFollowSystem");
    let fallbackEl = document.getElementById("darkModeForceFallback");
    let themeEl = document.getElementById("darkModeTheme");
    followEl.disabled = !enabled;
    fallbackEl.disabled = !enabled;
    themeEl.disabled = !enabled || !forceFallback;

    if (!enabled) {
      Services.prefs.setIntPref("layout.css.prefers-color-scheme.content-override", 2);
      this._writeManagedUserContentCSS("").catch(console.error);
      return;
    }

    Services.prefs.setIntPref(
      "layout.css.prefers-color-scheme.content-override",
      followSystem ? 2 : 0
    );

    let shouldApplyFallback =
      forceFallback && (!followSystem || Services.appinfo.contentThemeDerivedColorSchemeIsDark);
    let css = shouldApplyFallback ? this._generateFallbackCSS(theme) : "";
    this._writeManagedUserContentCSS(css).catch(console.error);
  },

  _generateFallbackCSS(theme) {
    switch (theme) {
      case "black":
        return `html {
  filter: invert(1) hue-rotate(180deg) !important;
}
img, video, picture, svg, canvas, iframe {
  filter: invert(1) hue-rotate(180deg) !important;
}`;
      case "gray":
        return `html {
  filter: grayscale(1) brightness(0.78) !important;
}
img, video, picture, svg, canvas, iframe {
  filter: grayscale(0) brightness(1) !important;
}`;
      case "sepia":
        return `html {
  filter: sepia(0.78) brightness(0.82) contrast(1.08) !important;
}
img, video, picture, svg, canvas, iframe {
  filter: sepia(0) brightness(1) !important;
}`;
      case "dark":
      default:
        return `html {
  background-color: #16181d !important;
  color: #e6e8ef !important;
}
img, video, picture, svg, canvas, iframe {
  opacity: 0.94 !important;
}`;
    }
  },

  async _writeManagedUserContentCSS(managedCss) {
    let profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
    let chromePath = PathUtils.join(profileDir.path, "chrome");
    await IOUtils.makeDirectory(chromePath, { ignoreExisting: true });

    let filePath = PathUtils.join(chromePath, "userContent.css");
    let existing = "";
    if (await IOUtils.exists(filePath)) {
      existing = await IOUtils.readUTF8(filePath);
    }

    let beginIndex = existing.indexOf(DARKMODE_CSS_BEGIN);
    let endIndex = existing.indexOf(DARKMODE_CSS_END);
    if (beginIndex != -1 && endIndex != -1 && endIndex > beginIndex) {
      let endOffset = endIndex + DARKMODE_CSS_END.length;
      existing = existing.slice(0, beginIndex).trimEnd() + "\n" + existing.slice(endOffset).trimStart();
    }

    let block = "";
    if (managedCss) {
      block = `${DARKMODE_CSS_BEGIN}\n${managedCss}\n${DARKMODE_CSS_END}\n`;
    }

    let output = existing.trim();
    if (block) {
      output = output ? `${output}\n\n${block}` : block;
    } else if (output) {
      output = `${output}\n`;
    }

    if (output) {
      await IOUtils.writeUTF8(filePath, output);
    } else if (await IOUtils.exists(filePath)) {
      await IOUtils.remove(filePath);
    }
  },
};