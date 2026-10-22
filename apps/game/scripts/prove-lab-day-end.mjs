/**
 * Proves the Frontier day end (`/lab/day-end`) the way a player meets it, through the game's own moment, screen and
 * card: on the machine's GPU, from the day as it was played to the new day, as a player in the game when the day ends
 * and as one who opens it later, on a desktop and on a phone (390 × 844). Each run leaves a still at each beat, and
 * `transcript.json` holds every phase seen, each still and every check. It records no video: a recording opens the page
 * a second time in its own context. It starts its own dev client on `--port`, or drives the one `--base-url` names, and
 * closes its browser however the run ends.
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

/** Each run: when the player arrives, the screen, and the beats to still, in seconds from the day's end. */
const RUNS = [
  { arrival: "live", screen: "desktop", beats: [1.2, 2.4, 3.6, 8] },
  { arrival: "later", screen: "desktop", beats: [0.8] },
  { arrival: "live", screen: "phone", beats: [1.2, 3.6] },
  { arrival: "later", screen: "phone", beats: [0.8] },
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
const read = (browser, expression) => browser.read(`JSON.stringify(${expression})`);
const phase = (browser) => read(browser, "document.querySelector('[data-day-end-lab]')?.dataset.phase");
const waitFor = (browser, expression, timeout = 30000) =>
  browser.run(["wait", "--fn", expression, "--timeout", String(timeout)]);
const summaryOnScreen = "Boolean(document.querySelector('[data-day-end] section[aria-label=\"Day 1 done\"]'))";

function open(browser, urlBase, run) {
  const [width, height] = SCREENS[run.screen];
  const url = `${urlBase}/lab/day-end?${new URLSearchParams({ arrival: run.arrival, capture: "1", panel: "0" })}`;
  browser.run(["set", "viewport", String(width), String(height)]);
  browser.run(["open", url, "--ignore-https-errors"]);
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.ready === 'true'", 90000);
  // The land, its spires and its realm settle before the day ends.
  browser.run(["wait", "2500"]);
  return url;
}

/** Plays one run from the day as it was played to the new day; stills land on the beats and after each change. */
function play(browser, urlBase, run) {
  const name = `${run.screen}-${run.arrival}`;
  const record = { name, url: open(browser, urlBase, run), stills: [], load: loadavg()[0] };
  const still = (label) => {
    const file = `${name}-${String(record.stills.length).padStart(2, "0")}-${label}.png`;
    browser.screenshot(join(out, file));
    record.stills.push({ label, phase: phase(browser), file });
  };
  still("day");
  const endedAt = Date.now();
  browser.eval(`window.__dayEnd.endTheDay(${JSON.stringify(run.arrival)}); true`);
  for (const second of run.beats) {
    browser.run(["wait", String(Math.max(0, Math.round(second * 1000 - (Date.now() - endedAt))))]);
    still(`${second}s`);
  }
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.phase === 'summary'");
  check(read(browser, summaryOnScreen), `${name}: the day's summary stands over the map`);
  browser.click("Continue");
  browser.run(["wait", "300"]);
  still("continued");
  // A still takes a moment, so the dawn may already have handed over to the new day.
  waitFor(browser, "['dawn', 'day'].includes(document.querySelector('[data-day-end-lab]')?.dataset.phase)");
  still("dawn");
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.phase === 'day'");
  browser.run(["wait", "800"]);
  still("new-day");
  check(
    !read(browser, "Boolean(document.querySelector('[data-day-end]'))"),
    `${name}: the new day opens clear, the map taking orders again`,
  );
  transcript.runs.push(record);
}

/** Space skips the rolling mist to the summary, never past it. */
function proveSkip(browser, urlBase) {
  open(browser, urlBase, { arrival: "live", screen: "desktop" });
  browser.eval("window.__dayEnd.endTheDay('live'); true");
  browser.run(["wait", "500"]);
  browser.press("Space");
  browser.run(["wait", "150"]);
  check(phase(browser) === "summary", "Space skips the mist to the summary");
  browser.press("Space");
  check(phase(browser) === "summary", "a second Space leaves the summary up");
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
