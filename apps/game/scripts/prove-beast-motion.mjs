import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);

const out = option("--out", join(tmpdir(), "beast-motion-proof-" + Date.now()));
const port = option("--port", "4425");
const runsPerCase = Number(option("--runs", "3"));
const samplesPerRun = Number(option("--samples", "60"));
const warmupFrames = Number(option("--warmup", "20"));
mkdirSync(out, { recursive: true });

const STILLS = [
  {
    file: "compare-idle-surface",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "idle", layer: 0, phoenix: true, camera: "threeQuarter" },
    seek: 0.6,
  },
  {
    file: "compare-idle-hollow",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "idle", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 0.6,
  },
  {
    file: "compare-idle-deep",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "idle", layer: 3, phoenix: true, camera: "threeQuarter" },
    seek: 0.6,
  },
  {
    file: "compare-walk-a",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "walk", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 0.6,
  },
  {
    file: "compare-walk-b",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "walk", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 1.8,
  },
  {
    file: "compare-attack-coil",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "attack", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 0.56,
  },
  {
    file: "compare-attack-lunge",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "attack", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 1.08,
  },
  {
    file: "compare-hit-flinch",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "hit", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 0.34,
  },
  {
    file: "compare-death-fall",
    width: "1280",
    height: "720",
    state: { mode: "compare", action: "death", layer: 2, phoenix: true, camera: "threeQuarter" },
    seek: 1.65,
  },
  {
    file: "compare-phone-idle",
    width: "390",
    height: "844",
    state: { mode: "compare", action: "idle", layer: 2, phoenix: true, camera: "phoneMap" },
    seek: 0.6,
  },
  {
    file: "compare-phone-attack",
    width: "390",
    height: "844",
    state: { mode: "compare", action: "attack", layer: 2, phoenix: true, camera: "phoneMap" },
    seek: 1.08,
  },
];

const BENCH_WAYS = ["maths", "rig", "hybrid"];
const BENCH_COUNTS = [1, 20, 100];

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

await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
  try {
    browser.run(["set", "viewport", "1280", "720"]);
    browser.run(["open", `${baseUrl}/lab/beast-motion?capture=1&layer=2`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-beast-motion-ready=\"true\"]') !== null && Boolean(window.__beastMotionLab)",
    ]);

    let currentSize = "1280x720";
    for (const still of STILLS) {
      const targetSize = `${still.width}x${still.height}`;
      if (targetSize !== currentSize) {
        browser.run(["set", "viewport", still.width, still.height]);
        currentSize = targetSize;
      }
      browser.run(["eval", `window.__beastMotionLab.setState(${JSON.stringify(still.state)})`]);
      browser.run(["eval", `window.__beastMotionLab.seek(${still.seek})`]);
      browser.run(["wait", "180"]);
      browser.screenshot(join(out, `${still.file}.png`));
    }

    browser.run(["set", "viewport", "390", "844"]);
    const loadBefore = loadavg();
    const benchmarks = [];
    for (const way of BENCH_WAYS) {
      for (const count of BENCH_COUNTS) {
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
        if (count === 20 || count === 100) {
          browser.screenshot(join(out, `bench-phone-${way}-${count}.png`));
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
    const errors = browser.run(["errors"]);
    if (errors.trim()) throw new Error(errors);

    writeFileSync(
      join(out, "measurements.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          model: "apps/game/public/models/frontier/beast-wyvern.glb",
          trianglesPerBeast: 17903,
          viewport: { width: 390, height: 844 },
          loadBefore,
          loadAfter,
          benchmarks,
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
