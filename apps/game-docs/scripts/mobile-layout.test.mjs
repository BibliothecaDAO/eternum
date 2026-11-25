import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const WIDTHS = [320, 360, 390, 414, 768];
const VIEWPORT_HEIGHT = 844;
const TOLERANCE_PX = 1;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findInCacheDirs(dirs) {
  const rels = [
    "chrome-linux64/chrome",
    "chrome-linux/chrome",
    "chrome-headless-shell-linux64/chrome-headless-shell",
    "chrome-linux/headless_shell",
  ];
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort().reverse()) {
      const entryDir = join(dir, entry);
      for (const rel of rels) {
        const bin = join(entryDir, rel);
        if (existsSync(bin)) return bin;
      }
      if (!statSync(entryDir).isDirectory()) continue;
      for (const sub of readdirSync(entryDir).sort().reverse()) {
        for (const rel of rels) {
          const bin = join(entryDir, sub, rel);
          if (existsSync(bin)) return bin;
        }
      }
    }
  }
  return null;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.AGENT_BROWSER_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/brave-browser",
    "/opt/brave.com/brave/brave",
  ].filter(Boolean);
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  const pathDirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  for (const dir of pathDirs) {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser"]) {
      const bin = join(dir, name);
      if (existsSync(bin)) return bin;
    }
  }
  const home = homedir();
  const cached = findInCacheDirs([
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, ".agent-browser", "browsers"),
    join(home, ".cache", "puppeteer", "chrome"),
    join(home, ".cache", "ms-playwright"),
    join(home, ".cache", "chrome-for-testing"),
  ]);
  if (cached) return cached;
  throw new Error(`No Chromium binary found for mobile layout check (HOME=${home})`);
}

function builtRoutes(distDir) {
  return readdirSync(distDir, { recursive: true })
    .map((file) => String(file).replace(/\\/g, "/"))
    .filter((file) => file.endsWith(".html") && !file.endsWith("404.html"))
    .map((file) => (file === "index.html" ? "/" : `/${file.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`))
    .sort();
}

function startStaticServer(distDir) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const candidates = [join(distDir, urlPath), join(distDir, urlPath, "index.html"), join(distDir, `${urlPath}.html`)];
    const file = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (!file) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function startDirectChrome(executable, profile) {
  const isHeadlessShell = executable.includes("headless-shell") || executable.includes("headless_shell");
  const child = spawn(
    executable,
    [
      ...(isHeadlessShell ? [] : ["--headless=new"]),
      "--no-sandbox",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  const exited = new Promise((done) => child.once("exit", done));
  const wsUrl = await new Promise((resolve, reject) => {
    let log = "";
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    child.once("exit", () => reject(new Error(`browser exited: ${log}`)));
  });
  return {
    wsUrl,
    stop: async () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      await exited;
    },
  };
}

async function launchBrowser() {
  const executable = findChrome();
  const profile = mkdtempSync(join(tmpdir(), "docs-mobile-layout-"));
  const runtime = await startDirectChrome(executable, profile);
  const socket = new WebSocket(runtime.wsUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++seq, { resolve, reject });
      socket.send(JSON.stringify({ id: seq, method, params, sessionId }));
    });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Page.enable");
  await page("Runtime.enable");
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await page("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "eval failed");
    return result.value;
  };
  return {
    page,
    evaluate,
    close: async () => {
      socket.close();
      await runtime.stop();
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    },
  };
}

const MEASURE_EXPRESSION = `(() => {
  const vw = window.innerWidth;
  const docScroll = document.documentElement.scrollWidth;
  const tolerance = ${TOLERANCE_PX};
  const insideScrollBox = (el) => {
    let cur = el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const cs = getComputedStyle(cur);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
        const rect = cur.getBoundingClientRect();
        if (rect.right <= vw + tolerance && rect.left >= -tolerance) return true;
      }
      cur = cur.parentElement;
    }
    return false;
  };
  const isHidden = (el) => {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const cs = getComputedStyle(cur);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return true;
      if (cur.getAttribute("aria-hidden") === "true") return true;
      cur = cur.parentElement;
    }
    return false;
  };
  const overflows = [];
  for (const el of document.querySelectorAll("body *")) {
    if (isHidden(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (insideScrollBox(el)) continue;
    if (rect.right > vw + tolerance || rect.left < -tolerance) {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "";
      overflows.push({
        selector: el.tagName.toLowerCase() + (cls ? "." + cls : ""),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }
  }
  return { vw, docScroll, overflows: overflows.slice(0, 8), overflowCount: overflows.length };
})()`;

let host;
let browser;

before(async () => {
  host = await startStaticServer(DIST);
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  host?.server.close();
});

test("every built docs page fits inside 320, 360, 390, 414 and 768 viewports without sideways scroll or clipped elements", async () => {
  const routes = builtRoutes(DIST);
  assert.ok(routes.length >= 20, `expected all docs pages, found ${routes.length}`);
  const failures = [];
  for (const route of routes) {
    await browser.page("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: 390,
      screenHeight: VIEWPORT_HEIGHT,
    });
    await browser.page("Page.navigate", { url: `${host.baseUrl}${route}` });
    await sleep(350);
    for (const width of WIDTHS) {
      await browser.page("Emulation.setDeviceMetricsOverride", {
        width,
        height: VIEWPORT_HEIGHT,
        deviceScaleFactor: 1,
        mobile: width < 768,
        screenWidth: width,
        screenHeight: VIEWPORT_HEIGHT,
      });
      await sleep(80);
      const report = await browser.evaluate(MEASURE_EXPRESSION);
      if (report.docScroll > width + TOLERANCE_PX || report.overflowCount > 0) {
        const items = report.overflows.map((item) => `${item.selector}[${item.left}..${item.right}]`).join(", ");
        failures.push(`${route} @${width}: docScroll=${report.docScroll}, clipped=${report.overflowCount} (${items})`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("overflow detector catches a clipped child inside an overflow-x:hidden container even when scrollWidth equals viewport", async () => {
  await browser.page("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: VIEWPORT_HEIGHT,
  });
  const html =
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><footer style="overflow-x:hidden;width:100%"><div style="display:flex"><a style="flex:0 0 240px;height:48px">Left</a><a style="flex:0 0 240px;height:48px">Right</a></div></footer></body>';
  await browser.page("Page.navigate", { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
  await sleep(100);
  const report = await browser.evaluate(MEASURE_EXPRESSION);
  assert.equal(report.vw, 390);
  assert.equal(report.docScroll, 390);
  assert.ok(report.overflowCount > 0, "expected clipped child inside overflow-x:hidden footer to be flagged");
  assert.ok(report.overflows.some((item) => item.right > 390));
});

test("phone navigation triggers and footer pager meet the 44px tap target minimum", async () => {
  await browser.page("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: VIEWPORT_HEIGHT,
  });
  await browser.page("Page.navigate", { url: `${host.baseUrl}/frontier` });
  await sleep(350);
  const targets = await browser.evaluate(`(() => {
    const selectors = [
      ".vocs_MobileTopNav_menuTrigger",
      ".vocs_MobileTopNav_outlineTrigger",
      ".vocs_MobileSearch_searchButton",
      ".vocs_Footer_navigationItem",
    ];
    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((el) => {
        const rect = el.getBoundingClientRect();
        return { selector, height: Math.round(rect.height), width: Math.round(rect.width) };
      }),
    );
  })()`);
  assert.ok(targets.length >= 4, `expected mobile nav and pager targets, found ${targets.length}`);
  const undersized = targets.filter((item) => item.height < 44);
  assert.deepEqual(undersized, []);
});

test("rendered body prose holds readable size, leading, gutters, and measure on phone and desktop", async () => {
  await browser.page("Page.navigate", { url: `${host.baseUrl}/frontier` });
  await sleep(350);
  const readMetrics = `(() => {
    const p = document.querySelector(".vocs_Content p");
    const cs = getComputedStyle(p);
    const rect = p.getBoundingClientRect();
    return {
      vw: window.innerWidth,
      fontSize: parseFloat(cs.fontSize),
      lineHeight: parseFloat(cs.lineHeight),
      left: rect.left,
      rightGap: window.innerWidth - rect.right,
      width: rect.width,
    };
  })()`;

  await browser.page("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: VIEWPORT_HEIGHT,
  });
  await sleep(100);
  const phone = await browser.evaluate(readMetrics);
  assert.ok(phone.fontSize >= 15 && phone.fontSize <= 17, `phone body size ${phone.fontSize}`);
  assert.ok(phone.lineHeight / phone.fontSize >= 1.5, `phone line height ratio ${phone.lineHeight / phone.fontSize}`);
  assert.ok(phone.left >= 16 && phone.rightGap >= 16, `phone side gutters left=${phone.left} right=${phone.rightGap}`);

  await browser.page("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 900,
  });
  await sleep(100);
  const desktop = await browser.evaluate(readMetrics);
  assert.ok(desktop.fontSize >= 16 && desktop.fontSize <= 18, `desktop body size ${desktop.fontSize}`);
  assert.ok(
    desktop.lineHeight / desktop.fontSize >= 1.5,
    `desktop line height ratio ${desktop.lineHeight / desktop.fontSize}`,
  );
  assert.ok(desktop.width <= 720, `desktop prose width ${desktop.width} exceeds comfortable measure`);
});
