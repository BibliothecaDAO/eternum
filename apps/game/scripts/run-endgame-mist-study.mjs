import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const base = arg("--base-url", null);
const port = arg("--port", "4199");
const mode = arg("--mode", "gallery");
const output = resolve(arg("--out", ".context/endgame-study-" + Date.now()));
const entrance = arg("--spires", null);
if (entrance !== null && entrance !== "awaken" && entrance !== "materialise") throw new Error("Unknown spire entrance");
const iterations = Number(arg("--iterations", "3"));
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const urlBase = base ?? "https://127.0.0.1:" + port;
const duration = 9;
if (!["gallery", "cost"].includes(mode)) throw new Error("Mode must be gallery or cost");
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5)
  throw new Error("Iterations must be from 1 to 5");
mkdirSync(output, { recursive: false });
const records = [];
let server;
let log = "";
let cancelled = false;
process.on("SIGINT", () => {
  cancelled = true;
});
process.on("SIGTERM", () => {
  cancelled = true;
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const snapshot = (browser) => browser.read("JSON.stringify(window.__terrainVerification?.getSnapshot?.() ?? null)");

function openScenario(browser, url) {
  browser.run([
    "open",
    url,
    "--ignore-https-errors",
    "--args",
    "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
  ]);
  browser.run(["set", "viewport", "1920", "1080"]);
  const deadline = Date.now() + 40000;
  while (!snapshot(browser)?.endgame) {
    check(!cancelled && Date.now() < deadline, "World failed to become ready");
    const text = browser.read("JSON.stringify(document.body.innerText)");
    check(!text.includes("Error:"), text);
    browser.run(["wait", "300"]);
  }
  const adapter = browser.read(
    "(async()=>{const a=await navigator.gpu?.requestAdapter();return JSON.stringify(a?{vendor:a.info.vendor,architecture:a.info.architecture,isFallbackAdapter:a.info.isFallbackAdapter}:null)})()",
  );
  check(
    adapter && adapter.vendor === "amd" && !adapter.isFallbackAdapter,
    "Hardware adapter was not the expected AMD GPU",
  );
  if (new URL(url).searchParams.get("rendererMode") === "webgpu-force-webgl") {
    const gl = browser.read(
      'JSON.stringify((()=>{const gl=document.querySelector("canvas").getContext("webgl2");const ext=gl?.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;})())',
    );
    check(gl && /AMD|RADV/i.test(gl) && !/SwiftShader|llvmpipe/i.test(gl), "WebGL was not using hardware graphics");
    adapter.webglRenderer = gl;
  }
  return adapter;
}
function capture(browser, name) {
  browser.run([
    "wait",
    "--fn",
    "document.querySelector('[data-endgame-lab]')?.getAttribute('data-ready') === 'true' && window.__terrainVerification?.status === 'ready'",
  ]);
  const state = snapshot(browser);
  check(state?.endgame, "Endgame snapshot was unavailable after the visible world became ready");
  browser.run(["screenshot", join(output, name + ".png")]);
  return state;
}
function waitUntilFrozen(browser, duration) {
  const deadline = Date.now() + (duration + 10) * 1000;
  while (!snapshot(browser)?.endgame.finished) {
    check(!cancelled && Date.now() < deadline, "Sequence failed to finish");
    browser.run(["wait", "200"]);
  }
}
function seek(browser, seconds) {
  browser.run(["focus", "input[aria-label='Sequence position']"]);
  browser.press("Home");
  const steps = Math.round(seconds / 0.05);
  if (steps) browser.run(["batch", ...Array(steps).fill("press ArrowRight")]);
  browser.run(["wait", "150"]);
  check(Math.abs(snapshot(browser).endgame.seconds - seconds) < 0.01, "Scrubber did not seek to requested time");
}
function gallery(browser, world, spires) {
  const url = urlBase + "/lab/endgame?gameMode=" + world + "&spires=" + spires;
  const adapter = openScenario(browser, url);
  const name = "fracture-" + world + "-" + spires;
  const before = capture(browser, name + "-before");
  check(before.endgame.phase === "live" && before.endgame.mistDraws === 0, "Effect ran before end");
  let recording = false;
  try {
    browser.run(["record", "start", join(output, name + ".webm"), "--fps", "12"]);
    recording = true;
    browser.click("End game preview");
    waitUntilFrozen(browser, duration);
    const frozen = capture(browser, name + "-frozen");
    browser.run(["record", "stop"]);
    recording = false;
    browser.click("Inspect orb");
    browser.click("Reset map");
    capture(browser, name + "-orb-before");
    browser.run(["record", "start", join(output, name + "-orb.webm"), "--fps", "12"]);
    recording = true;
    browser.click("End game preview");
    waitUntilFrozen(browser, duration);
    browser.run(["record", "stop"]);
    recording = false;
    const stages = {};
    for (const [stage, seconds] of Object.entries({
      materialising: 0.4,
      singularity: 1,
      contracted: 1.95,
      burst: 2.15,
      spreading: 4.75,
      frozen: 9,
    })) {
      seek(browser, seconds);
      stages[stage] = capture(browser, name + "-orb-" + stage);
    }
    browser.click("Whole map");
    browser.click("Reset map");
    browser.click("End game preview");
    browser.run(["wait", "300"]);
    browser.click("See the results");
    check(
      browser.read('JSON.stringify(!!document.querySelector("[aria-label=\\"Results fixture\\"]"))'),
      "Results did not open during materialisation",
    );
    const results = capture(browser, name + "-results");
    check(results.endgame.finished, "Results did not finish the cosmetic sequence");
    browser.click("Back to the frozen map");
    browser.click("Reset map");
    browser.click("End game preview");
    browser.press("Escape");
    check(snapshot(browser).endgame.finished, "Escape did not skip");
    const errors = browser.run(["errors"]);
    check(!errors.trim(), errors);
    records.push({
      mode: "gallery",
      url,
      adapter,
      world,
      spires,
      before,
      frozen,
      stages,
      results,
      escapeSkipped: true,
      errors,
    });
  } finally {
    if (recording) browser.run(["record", "stop"], { allowFailure: true });
  }
}
const sample = (browser, count, includeBurst = false) =>
  browser.read(
    "(async()=>{const values=[];let burstSnapshot=null;let previous=await new Promise(requestAnimationFrame);for(let i=0;i<" +
      count +
      ";i++){const now=await new Promise(requestAnimationFrame);values.push(now-previous);previous=now;if(i===145 && " +
      includeBurst +
      ")burstSnapshot=window.__terrainVerification.getSnapshot();}return JSON.stringify({intervals:values,burstSnapshot,snapshot:window.__terrainVerification.getSnapshot()});})()",
  );
function cost(browser, rendererMode, iteration) {
  const url = urlBase + "/lab/endgame?capture=1&gameMode=blitz&spires=awaken&busy=1&rendererMode=" + rendererMode;
  const adapter = openScenario(browser, url + "&shipped=1");
  const drawingBuffer = browser.read(
    'JSON.stringify((()=>{const c=document.querySelector("canvas");return {width:c.width,height:c.height,viewportWidth:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio};})())',
  );
  check(
    drawingBuffer.width === 1920 &&
      drawingBuffer.height === 1080 &&
      drawingBuffer.viewportWidth === 1920 &&
      drawingBuffer.viewportHeight === 1080,
    "Cost capture was not rendered at 1920x1080",
  );
  const sites = snapshot(browser).endgame;
  check(
    new Set([...sites.realmSites, ...sites.spireSites].map((p) => p.col + ":" + p.row)).size === 27,
    "Busy fixture contains overlapping sites",
  );
  const loadBefore = loadavg();
  check(loadBefore[0] <= 12, "Shared machine load exceeded 12");
  browser.run(["wait", "1500"]);
  const baseline = sample(browser, 120);
  openScenario(browser, url);
  browser.run(["wait", "2000"]);
  const armed = sample(browser, 120);
  check(
    baseline.snapshot.cellCount === 1008 &&
      baseline.snapshot.endgame.realmCount === 25 &&
      baseline.snapshot.endgame.armyCount === 50,
    "Busy fixture incomplete",
  );
  check(
    baseline.snapshot.activeMode === (rendererMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback"),
    "Renderer mismatch",
  );
  browser.click("End game preview");
  const active = sample(browser, Math.floor((duration - 0.5) * 60), true);
  check(active.burstSnapshot?.endgame.burstDraws === 2, "Active sample missed the orb burst");
  waitUntilFrozen(browser, duration);
  browser.run(["wait", "1500"]);
  const frozen = sample(browser, 120);
  const loadAfter = loadavg();
  check(loadAfter[0] <= 12, "Shared machine load exceeded 12");
  const errors = browser.run(["errors"]);
  check(!errors.trim(), errors);
  capture(browser, "cost-fracture-" + rendererMode + "-" + iteration);
  records.push({
    mode: "cost",
    rendererMode,
    iteration,
    url,
    adapter,
    viewport: { width: 1920, height: 1080 },
    drawingBuffer,
    loadBefore,
    loadAfter,
    baseline,
    armed,
    active,
    frozen,
    errors,
  });
}
try {
  if (!base) {
    server = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
      cwd: app,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    server.stdout.on("data", (chunk) => {
      log += chunk;
    });
    server.stderr.on("data", (chunk) => {
      log += chunk;
    });
    const deadline = Date.now() + 30000;
    while (!log.includes("Local:")) {
      check(server.exitCode === null && Date.now() < deadline, "Client failed to start: " + log);
      await pause(200);
    }
  }
  const scenarios = mode === "gallery" ? ["blitz", "frontier"] : ["webgpu-auto", "webgpu-force-webgl"];
  for (const scenario of scenarios) {
    const entrances = mode === "gallery" ? (entrance ? [entrance] : ["materialise", "awaken"]) : ["awaken"];
    for (const spires of entrances)
      for (let i = 0; i < (mode === "gallery" ? 1 : iterations); i++) {
        await pause(0);
        check(!cancelled, "Cancelled");
        const profile = mkdtempSync(join(tmpdir(), "endgame-study-"));
        const browser = createBrowserSession("endgame-" + Date.now().toString(36), { profile, headed: false });
        try {
          if (mode === "gallery") gallery(browser, scenario, spires);
          else cost(browser, scenario, i + 1);
        } finally {
          browser.close();
          rmSync(profile, { recursive: true, force: true });
          writeFileSync(join(output, "study.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
        }
      }
  }
  writeFileSync(join(output, "study.json"), JSON.stringify({ ok: true, records }, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, mode, records: records.length, output }));
} catch (error) {
  writeFileSync(
    join(output, "study.json"),
    JSON.stringify({ ok: false, error: String(error), records }, null, 2) + "\n",
  );
  process.exitCode = 1;
  console.error(error);
} finally {
  if (server && server.exitCode === null) {
    process.kill(-server.pid, "SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  if (server) writeFileSync(join(output, "client.log"), log);
}
