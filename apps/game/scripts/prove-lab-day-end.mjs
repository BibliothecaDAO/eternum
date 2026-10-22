/**
 * Proves the Frontier day-end lab (`/lab/day-end`) the way the owner will judge it: on the machine's GPU, each
 * direction plays from the day as it was played to the new day, as a player in the game when the day ends and as one
 * who opens it later, on a desktop and on a phone. Each run leaves a still at each beat, and `transcript.json` holds
 * every phase seen, each still and every check. It records no video: a recording opens the page a second time in its
 * own context, and two WebGPU pages at once left the map black in some stills. It starts its own dev client on `--port`, or
 * drives the one `--base-url` names, and closes its browser however the run ends.
 *
 *   pnpm --dir apps/game prove:day-end --port 4199 --out <fresh-dir>
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
const port = arg("--port", "4199");
const out = resolve(arg("--out", `.context/day-end-proof-${Date.now()}`));
const GPU_FLAGS =
  "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu";

/** Each run: the direction, when the player arrives, the screen, and the beats to still, in seconds from the day's end. */
const RUNS = [
  { direction: "night", arrival: "live", screen: "desktop", beats: [1.2, 2.4, 3.6, 8] },
  { direction: "dawn", arrival: "live", screen: "desktop", beats: [1, 2.5, 4] },
  { direction: "night", arrival: "later", screen: "desktop", beats: [0.8] },
  { direction: "dawn", arrival: "later", screen: "desktop", beats: [] },
  { direction: "night", arrival: "live", screen: "phone", beats: [1.2, 3.6] },
  { direction: "dawn", arrival: "live", screen: "phone", beats: [1, 3] },
];
const SCREENS = { desktop: [1920, 1080], phone: [390, 844] };

mkdirSync(out, { recursive: false });
const transcript = { runs: [], checks: [], adapter: null };
const save = (ok, error) =>
  writeFileSync(join(out, "transcript.json"), JSON.stringify({ ok, error, ...transcript }, null, 2) + "\n");
const check = (condition, claim) => {
  transcript.checks.push({ claim, passed: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${claim}`);
};
const phase = (browser) => browser.read("JSON.stringify(document.querySelector('[data-day-end-lab]')?.dataset.phase)");
const waitFor = (browser, expression, timeout = 30000) =>
  browser.run(["wait", "--fn", expression, "--timeout", String(timeout)]);

function open(browser, urlBase, run) {
  const [width, height] = SCREENS[run.screen];
  const query = new URLSearchParams({ direction: run.direction, arrival: run.arrival, capture: "1", panel: "0" });
  if (run.screen === "phone") query.set("phone", "1");
  const url = `${urlBase}/lab/day-end?${query}`;
  browser.run(["set", "viewport", String(width), String(height)]);
  browser.run(["open", url, "--ignore-https-errors"]);
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.ready === 'true'", 90000);
  // The land, its spires and its realm settle before the day ends.
  browser.run(["wait", "2500"]);
  return url;
}

/** Plays one run from the day as it was played to the new day; stills land on the beats and after each change. */
function play(browser, urlBase, run) {
  const name = `${run.screen}-${run.direction}-${run.arrival}`;
  const record = { name, url: open(browser, urlBase, run), stills: [], load: loadavg()[0] };
  const still = (label) => {
    const file = `${name}-${String(record.stills.length).padStart(2, "0")}-${label}.png`;
    browser.screenshot(join(out, file));
    record.stills.push({ label, phase: phase(browser), file });
  };
  still("day");
  const endedAt = Date.now();
  browser.eval("window.__dayEnd.endTheDay(); true");
  for (const second of run.beats) {
    browser.run(["wait", String(Math.max(0, Math.round(second * 1000 - (Date.now() - endedAt))))]);
    still(`${second}s`);
  }
  if (run.direction === "night") {
    waitFor(browser, "['summary'].includes(document.querySelector('[data-day-end-lab]')?.dataset.phase)");
    browser.eval("window.__dayEnd.continueDay(); true");
    browser.run(["wait", "300"]);
    still("continued");
  }
  // A still takes a moment, so the dawn may already have handed over to the new day.
  waitFor(browser, "['dawn', 'new-day'].includes(document.querySelector('[data-day-end-lab]')?.dataset.phase)");
  still("dawn");
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.phase === 'new-day'");
  browser.run(["wait", "1500"]);
  still("new-day");
  const docked = browser.read("Boolean(document.querySelector('.day-end-card[data-placement=docked]'))");
  check(
    docked === (run.direction === "dawn"),
    `${name}: the new day ${run.direction === "dawn" ? "keeps the summary docked" : "opens clear"}`,
  );
  transcript.runs.push(record);
}

/** Space skips: the night's mist to its summary, the dawn's mist to the nightfall. */
function proveSkip(browser, urlBase) {
  for (const [direction, lands] of [
    ["night", "summary"],
    ["dawn", "nightfall"],
  ]) {
    open(browser, urlBase, { direction, arrival: "live", screen: "desktop" });
    browser.eval("window.__dayEnd.endTheDay(); true");
    browser.run(["wait", "500"]);
    browser.press("Space");
    browser.run(["wait", "150"]);
    // The dawn direction's skip runs on through the black on its own, so a slow read may find it past the nightfall.
    const after = phase(browser);
    check(
      direction === "night" ? after === "summary" : ["nightfall", "black", "dawn", "new-day"].includes(after),
      `${direction}: Space skips the mist to ${lands}`,
    );
  }
}

try {
  await withDevClient({ base, port, out }, async (urlBase) => {
    const profile = mkdtempSync(join(tmpdir(), "day-end-proof-"));
    const browser = createBrowserSession(`day-end-${Date.now().toString(36)}`, { profile, headed: false });
    try {
      browser.run(["open", `${urlBase}/lab/day-end`, "--ignore-https-errors", "--args", GPU_FLAGS]);
      // The launch above can leave the first tab blank; opening the address again lands on it.
      browser.run(["open", `${urlBase}/lab/day-end`, "--ignore-https-errors"]);
      waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.ready === 'true'", 90000);
      transcript.adapter = browser.read(
        "(async()=>{const a=await navigator.gpu?.requestAdapter();return JSON.stringify(a?{vendor:a.info.vendor,architecture:a.info.architecture,isFallbackAdapter:a.info.isFallbackAdapter}:null)})()",
      );
      check(transcript.adapter && !transcript.adapter.isFallbackAdapter, "the lab renders on a hardware GPU");
      for (const run of RUNS) play(browser, urlBase, run);
      proveSkip(browser, urlBase);
      const errors = browser.run(["errors"]);
      // A refused GPU frame (a WebGPU validation error) is only a console line, yet it leaves the map black.
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
  console.log(JSON.stringify({ ok: true, out, checks: transcript.checks.length }));
} catch (error) {
  save(false, String(error));
  console.error(error);
  process.exitCode = 1;
}
