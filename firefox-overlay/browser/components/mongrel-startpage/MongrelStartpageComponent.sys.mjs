/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  getMongrelCssRecipes,
  getMongrelCssVariablesForMood,
} from "resource:///modules/MongrelVisualSystem.sys.mjs";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeCssVariables(variables) {
  return Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
}

class MongrelStartpage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._clockTimer = null;
    this._engines = [];
    this._selectedEngine = "";
  }

  connectedCallback() {
    this._name = this.getAttribute("profileName") || "friend";
    this._weatherLocation = this.getAttribute("weatherLocation") || "New York";

    const rawLinks = this.getAttribute("quickLinks") || "[]";
    try {
      const parsed = JSON.parse(rawLinks);
      this._links = Array.isArray(parsed) ? parsed : [];
    } catch {
      this._links = [];
    }

    if (!this._links.length) {
      this._links = [
        { title: "GitHub", url: "https://github.com" },
        { title: "MDN", url: "https://developer.mozilla.org" },
        { title: "YouTube", url: "https://youtube.com" },
      ];
    }

    this.render();
    this._startClock();
    this._wireSearch();
    this._loadSearchEngines();
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
  }

  _startClock() {
    const clock = this.shadowRoot.getElementById("clock");
    const date = this.shadowRoot.getElementById("date");
    const handHour = this.shadowRoot.getElementById("hand-hour");
    const handMinute = this.shadowRoot.getElementById("hand-minute");

    const update = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      date.textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const minutes = now.getMinutes();
      const hours = now.getHours() % 12;
      const minuteDeg = minutes * 6;
      const hourDeg = hours * 30 + minutes * 0.5;
      handMinute.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
      handHour.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
    };

    update();
    this._clockTimer = setInterval(update, 1000);
  }

  _wireSearch() {
    const input = this.shadowRoot.getElementById("search");
    const button = this.shadowRoot.getElementById("search-submit");
    const enginePicker = this.shadowRoot.getElementById("engine-picker");
    const submit = () => {
      this._submitSearch(input.value);
    };

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      submit();
    });

    button?.addEventListener("click", submit);

    enginePicker?.addEventListener("change", event => {
      this._selectedEngine = event.target.value;
    });
  }

  async _loadSearchEngines() {
    try {
      if (!Services.search.isInitialized && typeof Services.search.init == "function") {
        await Services.search.init();
      }

      const visible =
        (await Promise.resolve(Services.search.getVisibleEngines?.())) || [];
      this._engines = visible
        .filter(engine => engine?.name)
        .map(engine => ({
          name: engine.name,
          icon: engine.iconURI?.spec || "",
        }));

      const current = Services.search.defaultEngine?.name;
      this._selectedEngine =
        current && this._engines.some(engine => engine.name == current)
          ? current
          : this._engines[0]?.name || "";
    } catch {
      this._engines = [{ name: "DuckDuckGo", icon: "" }];
      this._selectedEngine = "DuckDuckGo";
    }

    const searchValue = this.shadowRoot.getElementById("search")?.value || "";
    this.render(searchValue);
    this._wireSearch();
  }

  async _submitSearch(rawQuery) {
    const query = rawQuery.trim();
    if (!query) {
      return;
    }

    try {
      if (!Services.search.isInitialized && typeof Services.search.init == "function") {
        await Services.search.init();
      }

      let engine = null;
      if (this._selectedEngine) {
        engine = await Promise.resolve(
          Services.search.getEngineByName?.(this._selectedEngine)
        );
      }

      engine ||= Services.search.defaultEngine;
      const submission = engine?.getSubmission?.(query, null, "homepage");
      const submissionUrl = submission?.uri?.spec;
      if (submissionUrl) {
        window.location.href = submissionUrl;
        return;
      }
    } catch {}

    dispatchEvent(
      new CustomEvent("ContentSearchClient", {
        detail: {
          type: "SearchHandoff",
          data: { text: query },
        },
      })
    );
  }

  _renderLinks() {
    return this._links
      .map(link => {
        const title = String(link.title || "Link");
        const href = String(link.url || "about:blank");
        return `<a class="link" href="${escapeHtml(href)}">${escapeHtml(title)}</a>`;
      })
      .join("");
  }

  _renderEngines() {
    if (!this._engines.length) {
      return "";
    }

    return this._engines
      .map(engine => {
        const selected = engine.name == this._selectedEngine ? " selected" : "";
        return `<option value="${escapeHtml(engine.name)}"${selected}>${escapeHtml(engine.name)}</option>`;
      })
      .join("");
  }

  render(searchValue = "") {
    const css = getMongrelCssRecipes();
    const mood = Services.prefs.getStringPref("mongrel.personalize.mood", "default");
    const cssVariables = serializeCssVariables(getMongrelCssVariablesForMood(mood));

    this.shadowRoot.innerHTML = `
      <style>
        :host {
${cssVariables}
          display: block;
          min-height: 100vh;
          background: linear-gradient(
            180deg,
            var(--mongrel-color-void-mid, #0d1130) 0%,
            var(--mongrel-bg-deep, #08091a) 100%
          );
        }

        ${css.atmosphere}

        .card {
          width: min(760px, 92vw);
          padding: 36px 28px;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        ${css.panel}

        .toolbar {
          margin-bottom: 22px;
        }

        ${css.toolbar}

        .toolbar-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--mongrel-frost, rgba(180,200,255,0.12));
          box-shadow: var(--mongrel-shadow-glow, 0 0 20px rgba(90,111,255,0.24));
        }

        .toolbar-sep {
          width: 1px;
          height: 18px;
          background: var(--mongrel-border, rgba(255,255,255,0.09));
          opacity: 0.9;
        }

        ${css.toolbarTitle}

        .surface {
          gap: 16px;
        }

        ${css.stage}

        .hello {
          margin: 0;
          font-size: 18px;
          color: var(--mongrel-color-text-secondary, rgba(180,190,230,0.6));
          letter-spacing: 0.02em;
        }

        .clock {
          margin-top: 4px;
          font-size: clamp(48px, 9vw, 84px);
          line-height: 1;
          font-weight: 300;
          letter-spacing: 0.04em;
        }

        .date {
          margin-top: 8px;
          color: var(--mongrel-color-text-secondary, rgba(180,190,230,0.6));
          font-size: 15px;
        }

        .analog-wrap {
          display: grid;
          place-items: center;
          margin: 16px auto 6px;
        }

        .analog {
          width: 94px;
          height: 94px;
          border-radius: 50%;
          border: 1px solid var(--mongrel-border, rgba(255,255,255,0.25));
          background: var(--mongrel-bg-hover, rgba(255,255,255,0.07));
          position: relative;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), var(--mongrel-shadow-control, 0 10px 30px rgba(6, 8, 24, 0.26));
        }

        .hand {
          position: absolute;
          left: 50%;
          bottom: 50%;
          transform-origin: bottom center;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.92;
        }

        .hand-hour {
          width: 3px;
          height: 24px;
        }

        .hand-minute {
          width: 2px;
          height: 34px;
        }

        .dot {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .search {
          margin: 4px auto 0;
          width: min(600px, 100%);
        }

        .search-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .search-engine {
          min-width: 156px;
          padding: 12px 16px;
          font-size: 14px;
          appearance: none;
          background-position: right 14px center;
          background-repeat: no-repeat;
          background-size: 12px 12px;
          cursor: pointer;
        }

        .search input {
          width: 100%;
          font-size: 17px;
          padding: 12px 18px;
        }

        ${css.pillControl}

        .search-submit {
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }

        .search-submit:hover,
        .search-engine:hover,
        .search input:hover {
          border-color: var(--mongrel-border-lit, rgba(120,140,255,0.22));
          transform: translateY(-1px);
        }

        .search input:focus {
          outline: none;
          border-color: var(--mongrel-color-energy, #5a6fff);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--mongrel-color-energy, #5a6fff) 45%, transparent), var(--mongrel-shadow-glow, 0 0 20px rgba(90,111,255,0.24));
        }

        .section-label {
          margin: 4px 0 0;
        }

        ${css.sectionLabel}

        .links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
        }

        .link {
          padding: 7px 13px;
          font-size: 13px;
        }

        ${css.pillButton}

        .link:hover {
          background: var(--mongrel-bg-hover, rgba(255,255,255,0.16));
          border-color: var(--mongrel-border-lit, rgba(120,140,255,0.22));
          transform: translateY(-1px);
          box-shadow: var(--mongrel-shadow-glow, 0 0 20px rgba(90,111,255,0.24));
        }

        .weather {
          margin-top: 2px;
          color: var(--mongrel-safe, rgba(80,220,160,0.7));
          font-size: 13px;
        }
      </style>

      <section class="mongrel-panel card">
        <div class="mongrel-toolbar toolbar" aria-hidden="true">
          <div class="toolbar-dot"></div>
          <div class="toolbar-dot"></div>
          <div class="toolbar-dot"></div>
          <div class="toolbar-sep"></div>
          <div class="mongrel-toolbar-title toolbar-title">Mongrel Utility Surface</div>
        </div>

        <div class="mongrel-stage surface">
          <p class="hello">Hello, ${escapeHtml(this._name)}</p>
          <div class="clock" id="clock">--:--</div>
          <div class="date" id="date"></div>

          <div class="analog-wrap" aria-hidden="true">
            <div class="analog">
              <div id="hand-hour" class="hand hand-hour"></div>
              <div id="hand-minute" class="hand hand-minute"></div>
              <div class="dot"></div>
            </div>
          </div>

          <div class="search">
            <div class="search-row">
              <select id="engine-picker" class="mongrel-pill-control search-engine" aria-label="Search engine">
                ${this._renderEngines()}
              </select>
              <input
                id="search"
                class="mongrel-pill-control"
                type="text"
                value="${escapeHtml(searchValue)}"
                placeholder="Search the web..."
              />
              <button id="search-submit" class="mongrel-pill-button search-submit" type="button">Search</button>
            </div>
          </div>

          <div class="mongrel-section-label section-label">Quick Links</div>
          <nav class="links">${this._renderLinks()}</nav>

          <div class="weather">${escapeHtml(this._weatherLocation)}: 72F, Partly Cloudy</div>
        </div>
      </section>
    `;
  }
}

customElements.define("mongrel-startpage", MongrelStartpage);
