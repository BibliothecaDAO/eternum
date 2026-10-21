/**
 * Proves the film studio (`/lab/studio`) the way it is used: opens it on the machine's GPU, moves the camera with the
 * keys and the mouse, plays a camera path twice and checks it lands the same, then rolls the named takes in a clean
 * frame. One recording of the whole run, a still at each step and `transcript.json` (every pose, status and check) go
 * into a new `--out` directory. It starts its own dev client on `--port`, or drives the one `--base-url` names, and
 * closes its browser however the run ends.
 *
 *   pnpm --dir apps/game prove:studio --port 4199 --out <fresh-dir> [--size 1080x1920] [--game frontier]
 *   [--takes hyperstructure-rise,battle]
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
const out = resolve(arg("--out", `.context/studio-proof-${Date.now()}`));
const [width, height] = arg("--size", "1920x1080").split("x").map(Number);
const game = arg("--game", "blitz");
const takes = arg("--takes", "hyperstructure-rise,battle,explore,realm-tiers").split(",");
const GPU_FLAGS =
  "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu";

mkdirSync(out, { recursive: false });
const transcript = { url: null, size: { width, height }, game, adapter: null, load: [], steps: [], checks: [] };
const save = (ok, error) =>
  writeFileSync(join(out, "transcript.json"), JSON.stringify({ ok, error, ...transcript }, null, 2) + "\n");

const check = (condition, claim) => {
  transcript.checks.push({ claim, passed: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${claim}`);
};
const status = (browser) => browser.read("JSON.stringify(window.__studio.status())");
const still = (browser, name) => browser.screenshot(join(out, `${name}.png`));
const step = (browser, name, extra = {}) => {
  transcript.steps.push({ name, at: new Date().toISOString(), load: loadavg()[0], status: status(browser), ...extra });
  still(browser, name);
};

function openStudio(browser, urlBase) {
  transcript.url = `${urlBase}/lab/studio?gameMode=${game}`;
  browser.run(["open", transcript.url, "--ignore-https-errors", "--args", GPU_FLAGS]);
  browser.run(["set", "viewport", String(width), String(height)]);
  // The launch above can leave the first tab blank; opening the address again lands on it.
  browser.run(["open", transcript.url, "--ignore-https-errors"]);
  browser.run([
    "wait",
    "--fn",
    "document.querySelector('[data-studio-lab]')?.dataset.ready === 'true'",
    "--timeout",
    "90000",
  ]);
  transcript.adapter = browser.read(
    "(async()=>{const a=await navigator.gpu?.requestAdapter();return JSON.stringify(a?{vendor:a.info.vendor,architecture:a.info.architecture,isFallbackAdapter:a.info.isFallbackAdapter}:null)})()",
  );
  check(transcript.adapter && !transcript.adapter.isFallbackAdapter, "the studio renders on a hardware GPU");
}

/** The camera goes where the keys and the mouse send it, past the world map's limits. */
function proveFreeCamera(browser) {
  step(browser, "01-free-camera-start");
  const before = status(browser).pose;
  for (const [key, times] of [
    ["KeyQ", 12],
    ["KeyF", 8],
    ["KeyZ", 30],
    ["KeyW", 10],
  ])
    for (let i = 0; i < times; i++) browser.press(key.replace("Key", "").toLowerCase());
  const keyed = status(browser).pose;
  check(Math.abs(keyed.turn - before.turn) > 20, "Q turns the camera round its target");
  check(keyed.tilt > before.tilt + 10, "F tilts the camera towards the horizon");
  check(keyed.distance < before.distance * 0.3, "Z flies the camera in, closer than the world map allows");
  step(browser, "02-free-camera-keys", { before, after: keyed });
  const [cx, cy] = [Math.round(width / 2), Math.round(height / 2)];
  browser.run(["batch", `mouse move ${cx} ${cy}`, "mouse down right"]);
  browser.run([
    "mouse",
    "move",
    String(cx + Math.round(width / 5)),
    String(cy - 40),
    "--steps",
    "40",
    "--duration",
    "1200",
  ]);
  browser.run(["mouse", "up", "right"]);
  browser.run(["mouse", "wheel", "-400"]);
  browser.run(["wait", "400"]);
  const dragged = status(browser).pose;
  check(Math.abs(dragged.turn - keyed.turn) > 10, "a right-drag orbits the camera");
  step(browser, "03-free-camera-mouse", { before: keyed, after: dragged });
}

/** A path through four keys round the realm, played twice: it ends on the same pose both times. */
function proveScriptedMove(browser) {
  const path = `(() => { const [x, y, z] = window.__studio.places().realm; return { keys: [
    { t: 0, target: [x, y + 0.6, z], distance: 26, tilt: 40, turn: 60, fov: 38 },
    { t: 2.5, distance: 12, tilt: 62, turn: 120 },
    { t: 4.5, distance: 8, tilt: 72, turn: 170, fov: 28 },
    { t: 6, distance: 9, tilt: 66, turn: 200, ease: "out" } ] }; })()`;
  const ends = [];
  for (const run of [1, 2]) {
    browser.eval(`window.__studio.reset(); window.__studio.pose({ distance: 40, tilt: 30 }); true`);
    browser.eval(`window.__studio.path(${path}).then(() => true)`);
    const pose = status(browser).pose;
    ends.push(pose);
    step(browser, `04-path-run-${run}-end`, { pose });
  }
  const same = (a, b) => Math.abs(a - b) < 1e-6;
  check(
    same(ends[0].distance, ends[1].distance) &&
      same(ends[0].tilt, ends[1].tilt) &&
      ends[0].target.every((value, index) => same(value, ends[1].target[index])),
    "the replayed path lands on the same pose",
  );
}

/** Each take in a clean frame, with stills at its cues. */
function rollTakes(browser) {
  browser.eval("window.__studio.clean(true); true");
  browser.run(["wait", "500"]);
  const moments = {
    "hyperstructure-rise": [2.6, 5.6, 7.9],
    battle: [1.4, 2.2, 3.9],
    explore: [1.4, 3.2, 6.2],
    "realm-tiers": [1, 2.4, 4, 5.8],
    establisher: [3, 6.9],
  };
  for (const take of takes) {
    const startedAt = Date.now();
    browser.eval(`window.__studio.take(${JSON.stringify(take)}); true`);
    for (const [index, second] of (moments[take] ?? []).entries()) {
      browser.run(["wait", String(Math.max(0, Math.round(second * 1000 - (Date.now() - startedAt))))]);
      step(browser, `05-${take}-${index + 1}`);
    }
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-studio-lab]')?.dataset.take === 'idle'",
      "--timeout",
      "30000",
    ]);
    step(browser, `05-${take}-end`);
    const [played, claim] = TAKE_OUTCOMES[take] ?? [() => true, `${take} played`];
    check(played(status(browser)), claim);
  }
}

/** What each take leaves in the world once it has played. */
const TAKE_OUTCOMES = {
  "hyperstructure-rise": [(end) => end.hyperstructureProgress === 100, "the Hyperstructure rose to completion"],
  battle: [(end) => end.defenderDown, "the attacker struck and the defender fell"],
  explore: [(end) => end.explored === 3, "the explorer uncovered three hexes"],
  "realm-tiers": [(end) => end.realmLevel === 3, "the realm grew to its last tier"],
};

try {
  await withDevClient({ base, port, out }, async (urlBase) => {
    const profile = mkdtempSync(join(tmpdir(), "studio-proof-"));
    const browser = createBrowserSession(`studio-${Date.now().toString(36)}`, { profile, headed: false });
    try {
      openStudio(browser, urlBase);
      browser.run(["record", "start", join(out, "studio-proof.webm"), "--fps", "30"]);
      proveFreeCamera(browser);
      proveScriptedMove(browser);
      rollTakes(browser);
      browser.run(["record", "stop"]);
      const errors = browser.run(["errors"]);
      transcript.errors = errors;
      check(!errors.trim(), "the page logged no errors");
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
