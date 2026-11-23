import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { assertBrowserClean, parseOption, recordClip, transcodeClip } from "./lib/motion-proof.mjs";

const out = parseOption("--out", join(tmpdir(), "beast-motion-proof-" + Date.now()));
const port = parseOption("--port", "4425");
const runsPerCase = Number(parseOption("--runs", "3"));
const samplesPerRun = Number(parseOption("--samples", "60"));
const warmupFrames = Number(parseOption("--warmup", "20"));
mkdirSync(out, { recursive: true });

function recordSoloReel(browser, way, actions, fps = 24) {
  const name = `way-${way}-desktop`;
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run([
    "eval",
    `window.__beastMotionLab.setState(${JSON.stringify({
      mode: "bench",
      way,
      count: 1,
      action: actions[0],
      layer: 2,
      phoenix: true,
      paused: false,
      camera: "close",
    })})`,
  ]);
  browser.run(["wait", "220"]);
  browser.run(["record", "start", webmPath, "--fps", String(fps)]);
  try {
    for (const action of actions) {
      browser.run(["eval", `window.__beastMotionLab.setState(${JSON.stringify({ action, paused: false })})`]);
      browser.run(["wait", "2400"]);
    }
  } finally {
    browser.run(["record", "stop"]);
  }
  transcodeClip(webmPath, mp4Path);
  return `${name}.mp4`;
}

function summarizeRuns(runs) {
  const pick = (key) =>
    runs
      .map((r) => r[key])
      .filter((v) => typeof v === "number")
      .sort((a, b) => a - b);
  const stats = (values) => {
    if (values.length === 0) return null;
    const mid = values[Math.floor(values.length / 2)];
    return { median: mid, min: values[0], max: values[values.length - 1] };
  };
  const last = runs[runs.length - 1];
  return {
    way: last.way,
    count: last.count,
    action: last.action,
    layer: last.layer,
    rendererMode: last.rendererMode,
    viewport: last.viewport,
    runCount: runs.length,
    samplesPerRun: last.sampleCount,
    frameMedianMs: stats(pick("frameMedianMs")),
    frameP95Ms: stats(pick("frameP95Ms")),
    animationCpuAvgMs: stats(pick("animationCpuAvgMs")),
    renderCpuAvgMs: stats(pick("renderCpuAvgMs")),
    totalCpuAvgMs: stats(pick("totalCpuAvgMs")),
    gpuFrameAvgMs: stats(pick("gpuFrameAvgMs")),
    drawCalls: last.drawCalls,
    triangles: last.triangles,
    activeBones: last.activeBones,
    bottleneck: last.bottleneck,
    runs,
  };
}

const profile = mkdtempSync(join(tmpdir(), "beast-motion-proof-"));
const browser = createBrowserSession("beast-motion-" + Date.now(), { profile, headed: false });

await withDevClient({ base: parseOption("--base-url", null), port, out }, async (baseUrl) => {
  try {
    const clips = [];
    browser.run(["set", "viewport", "1280", "720"]);
    browser.run(["open", `${baseUrl}/lab/beast-motion?capture=1&layer=2`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-beast-motion-ready=\"true\"]') !== null && Boolean(window.__beastMotionLab)",
    ]);

    const meta = browser.read("window.__beastMotionLab.getMeta()");
    const actions = meta.actions;
    const benchWays = meta.ways;
    const benchCounts = meta.counts;

    for (const action of actions) {
      clips.push(
        recordClip(
          browser,
          out,
          `compare-desktop-${action}`,
          "__beastMotionLab",
          { mode: "compare", action, layer: 2, phoenix: true, paused: false, camera: "threeQuarter" },
          2600,
        ),
      );
    }

    for (const way of benchWays) {
      clips.push(recordSoloReel(browser, way, actions));
    }

    browser.run(["set", "viewport", "390", "844"]);
    for (const action of actions) {
      clips.push(
        recordClip(
          browser,
          out,
          `compare-phone-${action}`,
          "__beastMotionLab",
          { mode: "compare", action, layer: 2, phoenix: true, paused: false, camera: "phoneMap" },
          2600,
        ),
      );
    }

    const loadBefore = loadavg();
    const benchmarks = [];
    for (const way of benchWays) {
      for (const count of benchCounts) {
        browser.run([
          "eval",
          `window.__beastMotionLab.setState(${JSON.stringify({
            mode: "bench",
            way,
            count,
            action: "walk",
            layer: 2,
            phoenix: true,
            paused: false,
            camera: "threeQuarter",
          })})`,
        ]);
        browser.run(["wait", "300"]);
        if (count === 20) {
          clips.push(
            recordClip(
              browser,
              out,
              `bench-phone-${way}-20`,
              "__beastMotionLab",
              {
                mode: "bench",
                way,
                count: 20,
                action: "walk",
                layer: 2,
                phoenix: true,
                paused: false,
                camera: "threeQuarter",
              },
              2200,
            ),
          );
        }
        const runs = [];
        for (let run = 0; run < runsPerCase; run++) {
          browser.run([
            "eval",
            `window.__bmMeasure = null; window.__beastMotionLab.measure(${samplesPerRun}, ${warmupFrames}).then((r) => { window.__bmMeasure = r; });`,
          ]);
          browser.run(["wait", "--fn", "window.__bmMeasure !== null"]);
          runs.push(browser.read("window.__bmMeasure"));
        }
        benchmarks.push(summarizeRuns(runs));
      }
    }
    const loadAfter = loadavg();

    const webglGpuBenchmarks = [];
    browser.run(["open", `${baseUrl}/lab/beast-motion?capture=1&layer=2&rendererMode=webgpu-force-webgl`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-beast-motion-ready=\"true\"]') !== null && Boolean(window.__beastMotionLab)",
    ]);
    for (const way of benchWays) {
      for (const count of benchCounts) {
        browser.run([
          "eval",
          `window.__beastMotionLab.setState(${JSON.stringify({
            mode: "bench",
            way,
            count,
            action: "walk",
            layer: 2,
            phoenix: true,
            paused: false,
            camera: "threeQuarter",
          })})`,
        ]);
        browser.run(["wait", "250"]);
        browser.run([
          "eval",
          `window.__bmMeasure = null; window.__beastMotionLab.measure(${samplesPerRun}, ${warmupFrames}).then((r) => { window.__bmMeasure = r; });`,
        ]);
        browser.run(["wait", "--fn", "window.__bmMeasure !== null"]);
        webglGpuBenchmarks.push(browser.read("window.__bmMeasure"));
      }
    }
    assertBrowserClean(browser, "__beastMotionLab");

    writeFileSync(
      join(out, "measurements.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          model: meta.modelPath,
          trianglesPerBeast: meta.trianglesPerBeast,
          viewport: { width: 390, height: 844 },
          loadBefore,
          loadAfter,
          clips,
          benchmarks,
          webglGpuBenchmarks,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
console.log(`evidence: ${out}`);
