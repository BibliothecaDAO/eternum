import { createBrowserSession, openPageDevTools } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const base = arg("--base-url", null);
const port = arg("--port", "4199");
const mode = arg("--mode", "gallery");
const tracing = process.argv.includes("--trace");
const output = resolve(arg("--out", ".context/endgame-proof-" + Date.now()));
const entrance = arg("--spires", null);
if (entrance !== null && entrance !== "awaken" && entrance !== "materialise") throw new Error("Unknown spire entrance");
const iterations = Number(arg("--iterations", "3"));
const duration = 9;
if (!["gallery", "cost"].includes(mode)) throw new Error("Mode must be gallery or cost");
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5)
  throw new Error("Iterations must be from 1 to 5");
mkdirSync(output, { recursive: false });
const records = [];
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
async function captureTimedStage(devTools, seconds, name) {
  const { result, exceptionDetails } = await devTools.send("Runtime.evaluate", {
    expression: `(async()=>{while(window.__terrainVerification.getSnapshot().endgame.seconds<${seconds})await new Promise(requestAnimationFrame);return window.__terrainVerification.getSnapshot();})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  check(!exceptionDetails, "Stage observation failed");
  const { data } = await devTools.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(output, name + ".png"), Buffer.from(data, "base64"));
  return result.value;
}
async function gallery(browser, urlBase, world, spires) {
  const url = urlBase + "/lab/endgame?mode=" + world + "&spires=" + spires;
  const adapter = openScenario(browser, url);
  const name = "fracture-" + world + "-" + spires;
  const before = capture(browser, name + "-before");
  check(before.endgame.phase === "live" && before.endgame.mistDraws === 0, "Effect ran before end");
  let recording = false;
  const devTools = await openPageDevTools(browser);
  const captureStage = (seconds, name) => captureTimedStage(devTools, seconds, name);
  try {
    browser.run(["record", "start", join(output, name + ".webm"), "--fps", "12"]);
    recording = true;
    browser.click("End game");
    const wideStages = {};
    for (const [stage, time] of Object.entries({ materialising: 0.4, contracting: 1.3, burst: 2.3, spreading: 4.75 })) {
      wideStages[stage] = await captureStage(time, name + "-" + stage);
    }
    waitUntilFrozen(browser, duration);
    const frozen = capture(browser, name + "-frozen");
    browser.run(["record", "stop"]);
    recording = false;
    browser.click("Inspect orb");
    browser.click("Reset map");
    capture(browser, name + "-orb-before");
    browser.run(["record", "start", join(output, name + "-orb.webm"), "--fps", "12"]);
    recording = true;
    browser.click("End game");
    const stages = {};
    for (const [stage, time] of Object.entries({
      materialising: 0.4,
      singularity: 1,
      contracted: 1.8,
      burst: 2.4,
      spreading: 4.75,
    })) {
      stages[stage] = await captureStage(time, name + "-orb-" + stage);
    }
    waitUntilFrozen(browser, duration);
    stages.frozen = capture(browser, name + "-orb-frozen");
    browser.run(["record", "stop"]);
    recording = false;
    browser.click("Whole map");
    browser.click("Reset map");
    browser.click("End game");
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
    browser.click("End game");
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
      wideStages,
      results,
      escapeSkipped: true,
      errors,
    });
  } finally {
    if (recording) browser.run(["record", "stop"], { allowFailure: true });
    devTools.close();
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
async function cost(browser, urlBase, rendererMode, iteration) {
  const url = urlBase + "/lab/endgame?capture=1&mode=blitz&spires=awaken&busy=1&rendererMode=" + rendererMode;
  const adapter = openScenario(browser, url);
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
    new Set(sites.realmSites.map((p) => p.col + ":" + p.row)).size === 25,
    "Busy fixture contains overlapping sites",
  );
  const loadBefore = loadavg();
  check(loadBefore[0] <= 12, "Shared machine load exceeded 12");
  browser.run(["wait", "1500"]);
  const live = sample(browser, 120);
  check(
    live.snapshot.cellCount === 1008 &&
      live.snapshot.endgame.realmCount === 25 &&
      live.snapshot.endgame.armyCount === 50,
    "Busy fixture incomplete",
  );
  check(
    live.snapshot.activeMode === (rendererMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback"),
    "Renderer mismatch",
  );
  let devTools;
  let traceComplete;
  if (tracing) {
    devTools = await openPageDevTools(browser);
    traceComplete = new Promise((resolve) =>
      devTools.onEvent((event) => {
        if (event.method === "Tracing.tracingComplete") resolve(event.params.stream);
      }),
    );
    await devTools.send("Profiler.enable");
    await devTools.send("Profiler.start");
    await devTools.send("Tracing.start", {
      categories: "devtools.timeline,v8,disabled-by-default-v8.gc",
      transferMode: "ReturnAsStream",
    });
  }
  browser.click("End game");
  const active = sample(browser, Math.floor((duration - 0.5) * 60), true);
  if (devTools) {
    try {
      const { profile } = await devTools.send("Profiler.stop");
      writeFileSync(join(output, "profile-" + rendererMode + "-" + iteration + ".cpuprofile"), JSON.stringify(profile));
      await devTools.send("Tracing.end");
      const handle = await traceComplete;
      let trace = "";
      for (;;) {
        const part = await devTools.send("IO.read", { handle });
        trace += part.data;
        if (part.eof) break;
      }
      await devTools.send("IO.close", { handle });
      writeFileSync(join(output, "trace-" + rendererMode + "-" + iteration + ".json"), trace);
    } finally {
      devTools.close();
    }
  }
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
    live,
    active,
    frozen,
    errors,
  });
}
try {
  await withDevClient({ base, port, out: output }, async (urlBase) => {
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
            if (mode === "gallery") await gallery(browser, urlBase, scenario, spires);
            else await cost(browser, urlBase, scenario, i + 1);
          } finally {
            browser.close();
            rmSync(profile, { recursive: true, force: true });
            writeFileSync(join(output, "study.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
          }
        }
    }
    writeFileSync(join(output, "study.json"), JSON.stringify({ ok: true, records }, null, 2) + "\n");
    console.log(JSON.stringify({ ok: true, mode, records: records.length, output }));
  });
} catch (error) {
  writeFileSync(
    join(output, "study.json"),
    JSON.stringify({ ok: false, error: String(error), records }, null, 2) + "\n",
  );
  process.exitCode = 1;
  console.error(error);
}
