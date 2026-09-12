import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { verifyPwaBuild } from "./verify-pwa-build.mjs";
import { readClientModuleEntries } from "./client-build-files.mjs";
import { NOTIFICATION_FIXTURE_PATH, verifyLocalNotifications } from "./pwa-notification-checks.mjs";

const [previousArg, currentArg, outputArg = "output/playwright/pwa"] = process.argv.slice(2);
if (!previousArg || !currentArg)
  throw new Error("Usage: verify-pwa-lifecycle.mjs <previous-dist> <current-dist> [output-directory]");
const previous = resolve(previousArg);
const current = resolve(currentArg);
const currentFiles = new Set(await readdir(join(current, "assets")));
const output = resolve(outputArg);
await mkdir(output, { recursive: true });
const results = [];
let servedBuild = previous;
let workerOverride;
const server = createServer((request, response) => {
  void serveBuild(request, response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
// Full Chromium's headless mode supports native notifications; headless-shell rejects worker permission grants.
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({ serviceWorkers: "allow", reducedMotion: "reduce" });
// These tests exercise the built shell. They do not need a wallet, a live match, or analytics.
await context.route("https://**/*", (route) => route.abort());
const page = await context.newPage();
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});
try {
  const previousEntry = await moduleEntry(previous);
  const currentEntry = await moduleEntry(current);
  assert.notEqual(previousEntry, currentEntry, "Build with distinct VITE_PUBLIC_GAME_VERSION values");
  assert.notEqual(await readFile(join(previous, "sw.js"), "utf8"), await readFile(join(current, "sw.js"), "utf8"));
  await check("both emitted builds pass the precache and install checks", async () => {
    assert.equal((await verifyPwaBuild(previous)).ok, true);
    assert.equal((await verifyPwaBuild(current)).ok, true);
  });
  await check("first install activates without an update prompt", async () => {
    await page.goto(origin);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
    );
    assert.equal(await page.getByRole("button", { name: "Update now" }).count(), 0);
    await Promise.all([page.waitForNavigation(), page.evaluate(() => location.reload())]);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  });
  await check("offline navigation retains its game URL and recovers on retry", async () => {
    await context.setOffline(true);
    await page.goto(`${origin}/play/madara/pwa-check/map`);
    await page.getByRole("heading", { name: "Connection unavailable" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/play/madara/pwa-check/map");
    await page.screenshot({ path: join(output, "offline.png") });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(output, "offline-mobile.png") });
    await page.setViewportSize({ width: 1280, height: 720 });
    const apiFailed = await page.evaluate(() =>
      fetch("/api/pwa-check").then(
        () => false,
        () => true,
      ),
    );
    assert.equal(apiFailed, true, "API requests must not receive the offline document");
    await context.setOffline(false);
    await Promise.all([page.waitForNavigation(), page.getByRole("button", { name: "Try again" }).click()]);
    assert.equal(await page.title(), "Realms: Blitz");
    await page.goto(origin);
  });
  const otherTab = await context.newPage();
  await otherTab.goto(origin);
  await otherTab.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  // Finish initial lazy imports before retiring the previous build's modules.
  await Promise.all([page.waitForLoadState("networkidle"), otherTab.waitForLoadState("networkidle")]);
  await check("deferred update keeps both pages open; acceptance reloads only its tab", async () => {
    servedBuild = current;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.getByRole("button", { name: "Update now" }).waitFor();
    assert.equal(await entryInPage(page), previousEntry);
    assert.equal(await entryInPage(otherTab), previousEntry);
    await otherTab.getByRole("button", { name: "Later", exact: true }).click();
    assert.equal(await otherTab.getByRole("button", { name: "Update now" }).count(), 0);
    await page.screenshot({ path: join(output, "update.png") });
    await Promise.all([page.waitForNavigation(), page.getByRole("button", { name: "Update now" }).click()]);
    assert.equal(await entryInPage(page), currentEntry);
    assert.equal(await entryInPage(otherTab), previousEntry);
  });
  await check("a retired module recovers through the installed worker without a stale shell loop", async () => {
    const retired = (await readdir(join(previous, "assets"))).find(
      (file) => file.endsWith(".js") && !currentFiles.has(file),
    );
    assert.ok(retired, "Need a retired module between the two builds");
    assert.equal((await context.request.get(`${origin}/assets/${retired}`)).status(), 404);
    await Promise.all([
      otherTab.waitForNavigation(),
      otherTab.evaluate(async (url) => {
        try {
          await import(url);
        } catch {
          window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
        }
      }, `/assets/${retired}?pwa-lifecycle-retired=1`),
    ]);
    assert.equal(await entryInPage(otherTab), currentEntry);
    await Promise.all([
      otherTab.waitForNavigation(),
      otherTab.evaluate(() => window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }))),
    ]);
    const repeatedPrevented = await otherTab.evaluate(() => {
      const event = new Event("vite:preloadError", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(repeatedPrevented, false, "A second failure must reach crash UI instead of reloading again");
  });
  await check("interrupted installation preserves the active offline shell", async () => {
    workerOverride = (await readFile(join(current, "sw.js"), "utf8")).replaceAll(
      "offline.html",
      "unavailable-offline.html",
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
      const installing = registration.installing;
      if (installing)
        await new Promise((resolve) => {
          const changed = () => {
            if (installing.state === "redundant") {
              installing.removeEventListener("statechange", changed);
              resolve();
            }
          };
          installing.addEventListener("statechange", changed);
          changed();
        });
    });
    await context.setOffline(true);
    await page.goto(origin);
    await page.getByRole("heading", { name: "Connection unavailable" }).waitFor();
    const keys = await page.evaluate(async () =>
      (
        await Promise.all(
          (await caches.keys()).map(async (key) =>
            (await (await caches.open(key)).keys()).map((request) => request.url),
          ),
        )
      ).flat(),
    );
    assert.ok(keys.length > 0);
    assert.ok(
      keys.every((url) => !/\/(assets|models|textures|sound)\//.test(url)),
      "Only offline resources may enter Cache Storage",
    );
  });
  workerOverride = undefined;
  await check("local notifications deduplicate across tabs, dismissal and worker restart", () =>
    verifyLocalNotifications(browser, origin),
  );
} catch (error) {
  const registration = await page
    .evaluate(async () => {
      const registered = await navigator.serviceWorker.getRegistration();
      return {
        url: location.href,
        controller: navigator.serviceWorker.controller?.scriptURL,
        scope: registered?.scope,
        active: registered?.active?.state,
        waiting: registered?.waiting?.state,
        installing: registered?.installing?.state,
      };
    })
    .catch(() => null);
  results.push({ name: "lifecycle failure", ok: false, error: error.stack, registration, browserErrors });
  await page.screenshot({ path: join(output, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  const report = { ok: results.every((result) => result.ok), previous, current, browser: "chromium", checks: results };
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

async function check(name, run) {
  const started = performance.now();
  let timeout;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 45_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  results.push({ name, ok: true, milliseconds: Math.round(performance.now() - started) });
}

async function moduleEntry(dist) {
  return JSON.stringify(await readClientModuleEntries(dist));
}

async function entryInPage(tab) {
  return JSON.stringify(
    await tab
      .locator('script[type="module"][src]')
      .evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src"))),
  );
}

async function serveBuild(request, response) {
  const path = decodeURIComponent(new URL(request.url, origin).pathname);
  response.setHeader("Cache-Control", "no-cache");
  if (path === NOTIFICATION_FIXTURE_PATH) {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      "<!doctype html><title>Notification worker verification</title><p>Isolated notification worker fixture</p>",
    );
    return;
  }
  if (path === "/api/pwa-check") {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end('{"error":"unavailable"}');
    return;
  }
  if (path.includes("..")) {
    response.writeHead(400);
    response.end();
    return;
  }
  try {
    const file = path === "/" || !extname(path) ? "index.html" : path.slice(1);
    const content = file === "sw.js" && workerOverride ? workerOverride : await readFile(join(servedBuild, file));
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".webmanifest": "application/manifest+json",
      ".wasm": "application/wasm",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".woff2": "font/woff2",
    };
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
}
