/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseQuickLinks(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(link => link && typeof link === "object")
      .map(link => ({
        title: String(link.title || "Link"),
        url: String(link.url || "about:blank"),
      }));
  } catch {
    return [];
  }
}

class MongrelStartpage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._clockTimer = null;
  }

  connectedCallback() {
    this.render();
    this._startClock();
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
  }

  _startClock() {
    const tick = () => {
      const now = new Date();
      const clock = this.shadowRoot.getElementById("clock");
      const date = this.shadowRoot.getElementById("date");
      if (clock) {
        clock.textContent = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (date) {
        date.textContent = now.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
      }
    };

    tick();
    this._clockTimer = setInterval(tick, 1000);
  }

  _renderLinks(links) {
    if (!links.length) {
      return '<a class="link" href="about:preferences">Settings</a>';
    }
    return links
      .map(
        link =>
          `<a class="link" href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a>`
      )
      .join("");
  }

  render() {
    const profileName = this.getAttribute("profileName") || "friend";
    const weatherLocation =
      this.getAttribute("weatherLocation") || "New York";
    const links = parseQuickLinks(this.getAttribute("quickLinks") || "[]");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          --mg-bg: var(--mongrel-color-void, #0b1022);
          --mg-bg-mid: var(--mongrel-color-void-mid, #111831);
          --mg-panel: color-mix(in srgb, var(--mg-bg-mid) 78%, white 22%);
          --mg-border: var(--mongrel-border, rgba(255, 255, 255, 0.16));
          --mg-text: var(--mongrel-color-text, rgba(235, 238, 255, 0.95));
          --mg-text-secondary: var(--mongrel-color-text-secondary, rgba(180, 190, 230, 0.7));
          --mg-accent: var(--mongrel-color-energy, #5a6fff);
          color: var(--mg-text);
        }

        .shell {
          margin: 0 auto;
          width: min(980px, 94vw);
          border-radius: 20px;
          border: 1px solid var(--mg-border);
          background: linear-gradient(165deg, var(--mg-bg-mid), var(--mg-bg));
          box-shadow: 0 26px 90px rgba(0, 0, 0, 0.34);
          padding: 24px;
          display: grid;
          gap: 16px;
          overflow: hidden;
        }

        .title {
          margin: 0;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mg-text-secondary);
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4.5vw, 52px);
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .clock {
          margin: 0;
          font-size: clamp(32px, 7vw, 72px);
          line-height: 1;
          font-weight: 300;
          font-variant-numeric: tabular-nums;
        }

        .date {
          margin: 0;
          color: var(--mg-text-secondary);
          font-size: 14px;
        }

        form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          width: min(660px, 100%);
        }

        input {
          border-radius: 10px;
          border: 1px solid var(--mg-border);
          background: color-mix(in srgb, var(--mg-bg) 86%, white 14%);
          color: var(--mg-text);
          padding: 12px 14px;
          font-size: 15px;
        }

        button {
          border-radius: 10px;
          border: 1px solid color-mix(in srgb, var(--mg-accent) 58%, transparent);
          background: color-mix(in srgb, var(--mg-accent) 26%, transparent);
          color: var(--mg-text);
          padding: 12px 16px;
          font-size: 13px;
          cursor: pointer;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .link {
          border: 1px solid var(--mg-border);
          border-radius: 999px;
          padding: 7px 13px;
          color: var(--mg-text);
          text-decoration: none;
          background: color-mix(in srgb, var(--mg-bg) 85%, white 15%);
          font-size: 13px;
        }

        .weather {
          color: var(--mg-text-secondary);
          font-size: 13px;
          margin: 0;
        }
      </style>

      <section class="shell">
        <p class="title">Start Page</p>
        <h1>Good to see you, ${escapeHtml(profileName)}.</h1>
        <p id="clock" class="clock">--:--</p>
        <p id="date" class="date"></p>

        <form action="https://duckduckgo.com/" method="GET">
          <input type="search" name="q" placeholder="Search the web" autocomplete="off" />
          <button type="submit">Search</button>
        </form>

        <div class="links">${this._renderLinks(links)}</div>
        <p class="weather">${escapeHtml(weatherLocation)}: ambient forecast ready</p>
      </section>
    `;
  }
}

if (!customElements.get("mongrel-startpage")) {
  customElements.define("mongrel-startpage", MongrelStartpage);
}
