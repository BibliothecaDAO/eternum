/**
 * Stills of the biome study (`/lab/biome-study`): every approach on the World biomes field, at every shot on a
 * desktop and at play zoom and the closest zoom on a phone, each with its army and realm. Starts the dev client on
 * `--port` (scripts/lib/dev-client.mjs) or drives the one `--base-url` names, renders on the machine's GPU, and closes
 * everything it started. Fails on a software adapter or any page or console error.
 *
 *   pnpm --dir apps/game prove:biome-study --port 4245 --out <fresh-dir>
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const base = arg("--base-url", null);
const port = arg("--port", "4245");
const out = resolve(arg("--out", `.context/biome-study-${Date.now()}`));
const only = arg("--approaches", null)?.split(",");
const GPU_FLAGS =
  "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu";
const APPROACHES = ["today", "relief", "painted", "terraced", "recommended"];
const SCREENS = {
  desktop: {
    size: [1440, 900],
    shots: ["overview", "play", "army", "realm", "coast", "tropics", "desert", "highlands", "cold", "scorched"],
  },
  phone: { size: [390, 844], shots: ["play", "army", "realm"] },
};
const READY = "document.documentElement.dataset.biomeStudy === 'ready'";

mkdirSync(out, { recursive: false });
const transcript = { adapter: null, stills: [], checks: [] };
const save = (ok, error) =>
  writeFileSync(join(out, "transcript.json"), JSON.stringify({ ok, error, ...transcript }, null, 2) + "\n");
const check = (condition, claim) => {
  transcript.checks.push({ claim, passed: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${claim}`);
};

/** One approach on one screen: the land drawn once, then the camera on each shot. */
function shoot(browser, urlBase, approach, screen) {
  const { size, shots } = SCREENS[screen];
  browser.run(["set", "viewport", String(size[0]), String(size[1])]);
  const url = `${urlBase}/lab/biome-study?${new URLSearchParams({ approach, shot: shots[0], capture: "1" })}`;
  browser.run(["open", url, "--ignore-https-errors"]);
  browser.run(["wait", "--fn", READY, "--timeout", "120000"]);
  // The first frames compile the land's and models' pipelines; a still taken then is the boot splash.
  browser.run(["wait", "4000"]);
  for (const shot of shots) {
    browser.eval(`window.__biomeStudy.look(${JSON.stringify(shot)}); true`);
    browser.run(["wait", "1500"]);
    const file = `${approach}-${screen}-${shot}.png`;
    browser.screenshot(join(out, file));
    transcript.stills.push({ approach, screen, shot, file, load: loadavg()[0] });
  }
  transcript.lands ??= {};
  transcript.lands[approach] = browser.read("JSON.stringify(window.__biomeStudy.land)");
}

try {
  await withDevClient({ base, port, out }, async (urlBase) => {
    const profile = mkdtempSync(join(tmpdir(), "biome-study-"));
    const browser = createBrowserSession(`biome-study-${Date.now().toString(36)}`, { profile, headed: false });
    try {
      browser.run(["open", `${urlBase}/lab/biome-study?capture=1`, "--ignore-https-errors", "--args", GPU_FLAGS]);
      browser.run(["open", `${urlBase}/lab/biome-study?capture=1`, "--ignore-https-errors"]);
      browser.run(["wait", "--fn", READY, "--timeout", "120000"]);
      transcript.adapter = browser.read(
        "(async()=>{const a=await navigator.gpu?.requestAdapter();return JSON.stringify(a?{vendor:a.info.vendor,architecture:a.info.architecture,isFallbackAdapter:a.info.isFallbackAdapter}:null)})()",
      );
      check(transcript.adapter && !transcript.adapter.isFallbackAdapter, "the study renders on a hardware GPU");
      for (const approach of only ?? APPROACHES) {
        for (const screen of Object.keys(SCREENS)) shoot(browser, urlBase, approach, screen);
      }
      const errors = browser.run(["errors"]);
      const consoleErrors = browser
        .run(["console"])
        .split("\n")
        .filter((line) => line.startsWith("[error]"));
      transcript.errors = { errors, console: consoleErrors };
      check(!errors.trim(), "the page logged no errors");
      check(consoleErrors.length === 0, "the console logged no errors (no refused GPU frame)");
    } finally {
      browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
  save(true);
  console.log(JSON.stringify({ ok: true, out, stills: transcript.stills.length }));
} catch (error) {
  save(false, String(error));
  console.error(error);
  process.exitCode = 1;
}
