/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Screenshots of every view, in both colour schemes, full page.
//
//   bun screenshot.ts [--out <dir>] [--chrome <path>]
//   mise run screenshots
//
// Starts the dev server, launches headless Chrome with a remote-debugging
// port, and drives it over the DevTools protocol: for each route and each
// scheme it emulates prefers-color-scheme (the page's pre-paint script picks
// the theme from it when nothing is stored) and reduced motion, loads the page
// at 1440 wide, waits for fonts and a quiet moment, grows the viewport to the
// page height and saves a JPEG, by default to screenshots/.
//
// Adapted from patchy's status-page script. Chrome is found from --chrome,
// $CHROME_PATH, the macOS app bundle, or google-chrome / chromium / chrome on
// PATH. It cannot run inside the Claude Code sandbox, so run this from a
// normal shell.

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    out: { type: "string", default: resolve(import.meta.dir, "screenshots") },
    chrome: { type: "string" },
  },
});

const WIDTH = 1440;
const HEIGHT = 900;
const ROUTES = [
  { name: "home", hash: "#/" },
  { name: "intent-question", hash: "#/intent/0139/conversation" },
  { name: "intent-technical", hash: "#/intent/0138/technical" },
  { name: "intent-business", hash: "#/intent/0135/business" },
  { name: "intent-operate", hash: "#/intent/0128/operate" },
  { name: "intent-plan", hash: "#/intent/0143/plan" },
  { name: "flow", hash: "#/flow" },
  { name: "backlog", hash: "#/backlog" },
  { name: "insights", hash: "#/insights" },
  { name: "new-intent", hash: "#/new" },
  { name: "agents-process", hash: "#/agents/process" },
  { name: "knowledge-repos", hash: "#/knowledge/repositories" },
  { name: "setup", hash: "#/setup" },
  { name: "welcome", hash: "#/welcome" },
];
const SCHEMES = [
  { scheme: "dark", suffix: "" },
  { scheme: "light", suffix: "-light" },
];

function findChrome(): string {
  const candidates = [
    values.chrome,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    Bun.which("google-chrome"),
    Bun.which("chromium"),
    Bun.which("chrome"),
  ];
  for (const c of candidates) {
    if (c && Bun.file(c).size > 0) return c;
  }
  throw new Error("no Chrome found: pass --chrome <path> or set CHROME_PATH");
}

function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("could not find a free port");
  return port;
}

async function waitFor<T>(what: string, probe: () => Promise<T | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const v = await probe();
      if (v !== undefined) return v;
    } catch {
      // not up yet
    }
    await Bun.sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// A minimal DevTools-protocol client: numbered requests, and one-shot waits
// for named events.
class CDP {
  private ws: WebSocket;
  private next = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private waiters = new Map<string, Array<() => void>>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p?.reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else p?.resolve(msg.result);
      } else if (msg.method) {
        const ws = this.waiters.get(msg.method) ?? [];
        this.waiters.delete(msg.method);
        for (const w of ws) w();
      }
    });
  }

  static open(url: string): Promise<CDP> {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => res(new CDP(ws)));
      ws.addEventListener("error", () => rej(new Error(`cannot connect to ${url}`)));
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method: string, timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeoutMs);
      const list = this.waiters.get(method) ?? [];
      list.push(() => {
        clearTimeout(timer);
        resolve();
      });
      this.waiters.set(method, list);
    });
  }

  close() {
    this.ws.close();
  }
}

const webPort = freePort();
const debugPort = freePort();
const profile = mkdtempSync(join(tmpdir(), "ktiro-shots-"));
mkdirSync(values.out!, { recursive: true });

const dev = Bun.spawn(["bun", "dev.ts", "--port", String(webPort)], {
  cwd: import.meta.dir,
  stdout: "ignore",
  stderr: "inherit",
});
const chrome = Bun.spawn(
  [
    findChrome(),
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "about:blank",
  ],
  { stdout: "ignore", stderr: "ignore" },
);

const viewport = (height: number) => ({ width: WIDTH, height, deviceScaleFactor: 1, mobile: false });

let cdp: CDP | undefined;
try {
  const base = `http://127.0.0.1:${webPort}/`;
  await waitFor("the dev server", async () => ((await fetch(base)).ok ? true : undefined));
  const targets = await waitFor("Chrome", async () => {
    const list = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as Array<{
      type: string;
      webSocketDebuggerUrl: string;
    }>;
    return list.find((t) => t.type === "page");
  });
  cdp = await CDP.open(targets.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport(HEIGHT));

  for (const { scheme, suffix } of SCHEMES) {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: scheme },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    for (const route of ROUTES) {
      // Through about:blank, so a hash-only change still reloads the page
      // (resetting the in-memory demo) and the pre-paint script re-reads the
      // scheme.
      await cdp.send("Page.navigate", { url: "about:blank" });
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: base + route.hash });
      await loaded;
      await cdp.send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true });
      await Bun.sleep(1200);
      const height = (
        await cdp.send("Runtime.evaluate", {
          expression: "Math.min(4000, document.documentElement.scrollHeight)",
          returnByValue: true,
        })
      ).result.value as number;
      await cdp.send("Emulation.setDeviceMetricsOverride", viewport(height));
      await Bun.sleep(150);
      const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
      const file = join(values.out!, `${route.name}${suffix}.jpg`);
      await Bun.write(file, Buffer.from(shot.data as string, "base64"));
      console.log(`wrote ${file}`);
      await cdp.send("Emulation.setDeviceMetricsOverride", viewport(HEIGHT));
    }
  }
} finally {
  cdp?.close();
  chrome.kill();
  dev.kill();
  await Promise.allSettled([chrome.exited, dev.exited]);
  rmSync(profile, { recursive: true, force: true });
}
