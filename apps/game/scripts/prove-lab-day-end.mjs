/**
 * Proves the Frontier day end in its lab (`/lab/day-end`) the way a player meets it: the game's rollover turns the day
 * on a lab clock over the game's Frontier day facts, and its moment, screen and card play over the lab's land, on the
 * machine's GPU. It plays the ordinary turn, both clocks turning at once, the block clock arriving after the black's
 * longest hold and a later arrival, on a desktop and on a phone (390 × 844); Space's skip, Continue, and a drag on the
 * map once the new day is up. It checks what the rollover did to the map and in which phase. Each run leaves a still at
 * each beat, and `transcript.json` holds every phase, every rollover call and every check. It starts its own dev client
 * on `--port` (scripts/lib/dev-client.mjs, as the lab's proofs do), or drives the one `--base-url` names, and closes
 * its browser however the run ends.
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
const SCREENS = { desktop: [1920, 1080], phone: [390, 844] };
/** The black's longest hold and the dawn, in the game's own timing (use-day-end-store DAY_END_TIMING), plus slack. */
const PAST_THE_HOLD_MS = (10 + 1.4 + 2) * 1000;

mkdirSync(out, { recursive: false });
const transcript = { runs: [], checks: [], adapter: null };
const save = (ok, error) =>
  writeFileSync(join(out, "transcript.json"), JSON.stringify({ ok, error, ...transcript }, null, 2) + "\n");
const check = (condition, claim) => {
  transcript.checks.push({ claim, passed: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${claim}`);
};
const status = (browser) => browser.read("JSON.stringify(window.__dayEnd.status())");
const phaseIs = (...phases) =>
  `${JSON.stringify(phases)}.includes(document.querySelector('[data-day-end-lab]')?.dataset.phase)`;
const waitFor = (browser, expression, timeout = 30000) =>
  browser.run(["wait", "--fn", expression, "--timeout", String(timeout)]);
const SUMMARY_UP = "Boolean(document.querySelector('[data-day-end] section[aria-label=\"Day 1 done\"]'))";
const MAP_CLEAR =
  "(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === c; })()";

function open(browser, urlBase, how, screen) {
  const [width, height] = SCREENS[screen];
  const url = `${urlBase}/lab/day-end?${new URLSearchParams({ case: how, capture: "1", panel: "0" })}`;
  browser.run(["set", "viewport", String(width), String(height)]);
  browser.run(["open", url, "--ignore-https-errors"]);
  waitFor(browser, "document.querySelector('[data-day-end-lab]')?.dataset.ready === 'true'", 90000);
  // The land, its spires and its realm settle, and the rollover takes its first look at the clocks.
  browser.run(["wait", "2500"]);
  return url;
}

/** What the rollover does to the map in each case, and in which phase. */
const ROLLOVER_CALLS = {
  ordinary: ["reproject@black", "navigate@black"],
  together: ["reproject@black", "navigate@black"],
  "late-block": ["reproject@day", "navigate@day"],
  // Opened after the day ended, the map is already re-projected; only the camera comes onto the realm.
  later: ["navigate@black"],
};
const ROLLOVER_SAYS = {
  ordinary: "re-projected the map and moved the camera behind the black",
  together: "re-projected the map and moved the camera behind the black",
  "late-block": "re-projected the map and moved the camera when the late block arrived",
  later: "moved the camera onto the realm behind the black",
};

/** One run: the day ends as `how` says, the summary is read and continued, and the new day comes up. */
function play(browser, urlBase, { how, screen, skip = false }) {
  const name = `${screen}-${how}`;
  const record = { name, url: open(browser, urlBase, how, screen), stills: [], load: loadavg()[0] };
  const still = (label) => {
    const file = `${name}-${String(record.stills.length).padStart(2, "0")}-${label}.png`;
    browser.screenshot(join(out, file));
    record.stills.push({ label, status: status(browser), file });
  };
  still("day");
  browser.eval(`window.__dayEnd.endTheDay(${JSON.stringify(how)}); true`);
  if (how !== "later") {
    // The rollover looks at the clocks once a second: the turn begins the moment within one look.
    waitFor(browser, phaseIs("veil"), 5000);
    browser.run(["wait", "1500"]);
    still("mist");
    check(status(browser).events.length === 0, `${name}: the land stays as it was while the mist rolls`);
    if (skip) {
      browser.press("Space");
      browser.run(["wait", "150"]);
      check(status(browser).phase === "summary", `${name}: Space skips the mist to the summary`);
      browser.press("Space");
      check(status(browser).phase === "summary", `${name}: a second Space leaves the summary up`);
    }
  }
  waitFor(browser, phaseIs("summary"), 10000);
  browser.run(["wait", "600"]);
  still("summary");
  check(browser.read(SUMMARY_UP), `${name}: the day's summary stands over the map`);
  browser.click("Continue");
  browser.run(["wait", "300"]);
  still("continued");
  if (how === "late-block") proveLateBlock(browser, name, still);
  waitFor(browser, phaseIs("dawn", "day"), PAST_THE_HOLD_MS);
  still("dawn");
  waitFor(browser, phaseIs("day"));
  browser.run(["wait", "1500"]);
  still("new-day");
  const end = status(browser);
  const kinds = end.events.map((event) => `${event.kind}@${event.phase}`);
  check(
    JSON.stringify(kinds) === JSON.stringify(ROLLOVER_CALLS[how]),
    `${name}: the rollover ${ROLLOVER_SAYS[how]} (${kinds.join(", ")})`,
  );
  check(end.onNewLand, `${name}: the new day is up on the realm's new land`);
  proveMapTakesInput(browser, name);
  transcript.runs.push(record);
}

/** Past the black's longest hold the screen comes up on the old land; the late block still brings the new land in. */
function proveLateBlock(browser, name, still) {
  waitFor(browser, phaseIs("day"), PAST_THE_HOLD_MS);
  const lifted = status(browser);
  check(lifted.events.length === 0 && !lifted.onNewLand, `${name}: the black lifted at its longest hold, no land yet`);
  still("held-past");
  browser.eval("window.__dayEnd.blockArrives(); true");
  browser.run(["wait", "1800"]);
}

/** Once the moment is over nothing covers the map, and a drag moves its camera. */
function proveMapTakesInput(browser, name) {
  check(!browser.read("Boolean(document.querySelector('[data-day-end]'))"), `${name}: nothing covers the map`);
  check(browser.read(MAP_CLEAR), `${name}: the map is what a pointer meets`);
  const before = status(browser).pose.target;
  const [cx, cy] = browser.read(
    "JSON.stringify((() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })())",
  );
  browser.run(["batch", `mouse move ${cx} ${cy}`, "mouse down left"]);
  browser.run(["mouse", "move", String(cx + 120), String(cy + 60), "--steps", "20", "--duration", "500"]);
  browser.run(["mouse", "up", "left"]);
  browser.run(["wait", "300"]);
  const after = status(browser).pose.target;
  check(
    Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.5,
    `${name}: a drag on the map pans its camera on the new day`,
  );
}

const RUNS = [
  { how: "ordinary", screen: "desktop", skip: true },
  { how: "together", screen: "desktop" },
  { how: "late-block", screen: "desktop" },
  { how: "later", screen: "desktop" },
  { how: "ordinary", screen: "phone" },
  { how: "later", screen: "phone" },
];

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
