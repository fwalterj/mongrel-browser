/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  AboutNewTabComponentRegistry,
  BaseAboutNewTabComponentRegistrant,
} from "moz-src:///browser/components/newtab/AboutNewTabComponents.sys.mjs";
import { getMongrelCssVariablesForMood } from "resource:///modules/MongrelVisualSystem.sys.mjs";

export class MongrelStartpageRegistrant extends BaseAboutNewTabComponentRegistrant {
  getComponents() {
    if (!Services.prefs.getBoolPref("mongrel.startpage.enabled", true)) {
      return [];
    }

    return [
      {
        // We intentionally claim SEARCH so we can replace the default handoff UI.
        type: AboutNewTabComponentRegistry.TYPES.SEARCH,
        l10nURLs: [],
        componentURL: "resource:///modules/MongrelStartpageComponent.sys.mjs",
        tagName: "mongrel-startpage",
        cssVariables: getMongrelCssVariablesForMood(
          Services.prefs.getStringPref("mongrel.personalize.mood", "default")
        ),
        attributes: {
          profileName: Services.prefs.getStringPref(
            "mongrel.startpage.name",
            "friend"
          ),
          weatherLocation: Services.prefs.getStringPref(
            "mongrel.startpage.weather_location",
            "New York"
          ),
          quickLinks: Services.prefs.getStringPref(
            "mongrel.startpage.links",
            "[]"
          ),
        },
      },
    ];
  }
}
