/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_startpage_controls_follow_master_toggle() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["mongrel.startpage.enabled", false],
      ["mongrel.startpage.name", "friend"],
      ["mongrel.startpage.weather_location", "New York"],
      [
        "mongrel.startpage.links",
        '[{"title":"GitHub","url":"https://github.com"}]',
      ],
    ],
  });

  await openPreferencesViaOpenPreferencesAPI("paneStartpage", {
    leaveOpen: true,
  });
  let doc = gBrowser.contentDocument;

  try {
    await TestUtils.waitForCondition(
      () => doc.getElementById("startPageEnabled"),
      "wait for the Start Page pane to render"
    );

    is(
      doc.querySelector(".category[selected]")?.id,
      "category-startpage",
      "The Start Page category is selected"
    );

    let enabled = doc.getElementById("startPageEnabled");
    let nameInput = doc.getElementById("startPageName");
    let weatherInput = doc.getElementById("startPageWeatherLocation");
    let linksTextarea = doc.getElementById("startPageLinks");

    ok(!enabled.checked, "Master toggle reflects disabled pref state");
    ok(
      nameInput.disabled,
      "Name input is disabled when the master toggle is off"
    );
    ok(
      weatherInput.disabled,
      "Weather location input is disabled when the master toggle is off"
    );
    ok(
      linksTextarea.disabled,
      "Links textarea is disabled when the master toggle is off"
    );

    ok(
      linksTextarea.getAttribute("placeholder")?.length > 0,
      "Links textarea has localized placeholder text"
    );
  } finally {
    BrowserTestUtils.removeTab(gBrowser.selectedTab);
    await SpecialPowers.popPrefEnv();
  }
});
