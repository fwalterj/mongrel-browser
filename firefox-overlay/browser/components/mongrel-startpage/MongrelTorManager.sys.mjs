/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
});

const SOCKS_PORT = 9150;
const CONTROL_PORT = 9151;

const TOR_BINARY_CANDIDATES = [
  "/opt/homebrew/bin/tor",
  "/usr/local/bin/tor",
  "/usr/bin/tor",
  "/usr/sbin/tor",
  "/Applications/Tor Browser.app/Contents/MacOS/Tor/tor",
  "/Applications/Tor Browser Alpha.app/Contents/MacOS/Tor/tor",
];

const BOOTSTRAP_RE = /Bootstrapped (\d+)%/i;

export const MongrelTorManager = {
  _proc: null,
  _state: "stopped",
  _bootstrapProgress: 0,
  _torBinary: null,

  onStateChange: null,
  onProgress: null,

  async findBinary() {
    if (this._torBinary) {
      return this._torBinary;
    }
    for (const candidate of TOR_BINARY_CANDIDATES) {
      try {
        const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        f.initWithPath(candidate);
        if (f.exists() && f.isExecutable()) {
          this._torBinary = candidate;
          return candidate;
        }
      } catch {}
    }
    return null;
  },

  async _setupProfile() {
    const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);

    const sanctuaryDir = profileDir.clone();
    sanctuaryDir.append("mongrel-sanctuary");
    if (!sanctuaryDir.exists()) {
      sanctuaryDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
    }

    const dataDir = sanctuaryDir.clone();
    dataDir.append("tor-data");
    if (!dataDir.exists()) {
      dataDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
    }

    const torrcFile = sanctuaryDir.clone();
    torrcFile.append("torrc");

    const torrcContent = [
      `SocksPort ${SOCKS_PORT}`,
      `ControlPort ${CONTROL_PORT}`,
      `DataDirectory ${dataDir.path}`,
      "Log notice stdout",
    ].join("\n") + "\n";

    const outStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    outStream.init(torrcFile, 0x02 | 0x08 | 0x20, 0o600, 0);
    const converter = Cc["@mozilla.org/intl/converter-output-stream;1"]
      .createInstance(Ci.nsIConverterOutputStream);
    converter.init(outStream, "UTF-8");
    converter.writeString(torrcContent);
    converter.close();

    return torrcFile.path;
  },

  async start() {
    if (this._proc) {
      return;
    }

    const binary = await this.findBinary();
    if (!binary) {
      this._setState("error");
      throw new Error(
        "Tor binary not found. Install with: brew install tor"
      );
    }

    const torrcPath = await this._setupProfile();

    this._setState("starting");
    this._bootstrapProgress = 0;

    try {
      this._proc = await lazy.Subprocess.call({
        command: binary,
        arguments: ["-f", torrcPath],
        environmentAppend: true,
        stderr: "stdout",
      });
    } catch (e) {
      this._setState("error");
      throw e;
    }

    this._setState("bootstrapping");
    this._readLoop();
  },

  async _readLoop() {
    let buffer = "";
    try {
      while (true) {
        const chunk = await this._proc.stdout.readString();
        if (!chunk) {
          break;
        }
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) {
            this._parseLine(line);
          }
        }
      }
    } catch (e) {
      if (this._state !== "stopped") {
        console.error("MongrelTorManager: stdout read error:", e);
        this._setState("error");
      }
    }
    if (this._state !== "stopped" && this._state !== "error") {
      this._setState("stopped");
    }
  },

  _parseLine(line) {
    const m = BOOTSTRAP_RE.exec(line);
    if (!m) {
      return;
    }
    const progress = parseInt(m[1], 10);
    this._bootstrapProgress = progress;
    this.onProgress?.(progress);
    if (progress >= 100) {
      this._setState("running");
    }
  },

  _setState(state) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.onStateChange?.(state);
  },

  async stop() {
    if (!this._proc) {
      this._setState("stopped");
      return;
    }
    const proc = this._proc;
    this._proc = null;
    this._setState("stopped");
    this._bootstrapProgress = 0;
    try {
      proc.kill();
    } catch {}
  },

  /*
   * Sends one or more commands to the Tor control port.
   * Returns the full response string, resolves when the connection closes.
   */
  async sendControl(commands) {
    return new Promise((resolve, reject) => {
      let done = false;

      const finish = (ok, val) => {
        if (done) {
          return;
        }
        done = true;
        timeoutTimer.cancel();
        if (ok) {
          resolve(val);
        } else {
          reject(val instanceof Error ? val : new Error(String(val)));
        }
      };

      const timeoutTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      timeoutTimer.initWithCallback(
        () => finish(false, new Error("Tor control port timeout")),
        5000,
        Ci.nsITimer.TYPE_ONE_SHOT
      );

      let transport, outStream, inStream, scriptable;

      try {
        const sts = Cc["@mozilla.org/network/socket-transport-service;1"]
          .getService(Ci.nsISocketTransportService);
        transport = sts.createTransport([], "127.0.0.1", CONTROL_PORT, null, null);

        outStream = transport.openOutputStream(0, 0, 0);
        inStream = transport.openInputStream(0, 0, 0);

        scriptable = Cc["@mozilla.org/scriptableinputstream;1"]
          .createInstance(Ci.nsIScriptableInputStream);
        scriptable.init(inStream);

        const cmd = commands.join("\r\n") + "\r\n";
        outStream.write(cmd, cmd.length);
        outStream.flush();
      } catch (e) {
        finish(false, e);
        return;
      }

      const asyncIn = inStream.QueryInterface(Ci.nsIAsyncInputStream);
      let response = "";

      const readNext = () => {
        asyncIn.asyncWait(
          {
            onInputStreamReady() {
              try {
                const avail = scriptable.available();
                if (avail > 0) {
                  response += scriptable.read(avail);
                }
                if (response.includes("closing connection") || response.startsWith("5")) {
                  finish(true, response);
                } else if (avail === 0) {
                  finish(true, response);
                } else {
                  readNext();
                }
              } catch {
                finish(true, response);
              }
            },
          },
          0,
          0,
          Services.tm.mainThreadEventTarget
        );
      };

      readNext();
    });
  },

  async newIdentity() {
    await this.sendControl(['AUTHENTICATE ""', "SIGNAL NEWNYM", "QUIT"]);
  },

  get socksPort() {
    return SOCKS_PORT;
  },

  get state() {
    return this._state;
  },

  get bootstrapProgress() {
    return this._bootstrapProgress;
  },
};
