import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_SEED = 20_260_902;
const VALID_RENDERER_MODES = new Set(["webgpu-auto", "webgpu-force-webgl"]);
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_OUTPUT_DIRECTORY = resolve(REPOSITORY_ROOT, "output/playwright/world-fx-gym");

export const WORLD_FX_CAPTURE_CASES = [
  createCaptureCase("flame-early", "flame", 1, 0.55, {
    activeAdditiveParticles: 24,
    activeRings: 0,
    activeSmokeParticles: 8,
    rendererTriangles: 170,
    triangles: 50,
  }),
  createCaptureCase("flame-mature", "flame", 1, 1.15, {
    activeAdditiveParticles: 24,
    activeRings: 0,
    activeSmokeParticles: 8,
    rendererTriangles: 170,
    triangles: 50,
  }),
  createCaptureCase("impact-ignition", "impact", 1, 0.08, {
    activeAdditiveParticles: 24,
    activeRings: 1,
    activeSmokeParticles: 8,
    rendererTriangles: 180,
    triangles: 60,
  }),
  createCaptureCase("impact-bloom", "impact", 1, 0.18, {
    activeAdditiveParticles: 24,
    activeRings: 1,
    activeSmokeParticles: 8,
    rendererTriangles: 180,
    triangles: 60,
  }),
  createCaptureCase("impact-dissipation", "impact", 1, 0.55, {
    activeAdditiveParticles: 24,
    activeRings: 1,
    activeSmokeParticles: 8,
    rendererTriangles: 180,
    triangles: 60,
  }),
  createCaptureCase("explosion-ignition", "explosion", 1, 0.08, {
    activeAdditiveParticles: 40,
    activeRings: 1,
    activeSmokeParticles: 12,
    rendererTriangles: 280,
    triangles: 120,
  }),
  createCaptureCase("explosion-bloom", "explosion", 1, 0.24, {
    activeAdditiveParticles: 40,
    activeRings: 1,
    activeSmokeParticles: 12,
    rendererTriangles: 280,
    triangles: 120,
  }),
  createCaptureCase("explosion-smoke", "explosion", 1, 0.65, {
    activeAdditiveParticles: 40,
    activeRings: 1,
    activeSmokeParticles: 12,
    rendererTriangles: 280,
    triangles: 120,
  }),
  createCaptureCase("shockwave-peak", "shockwave", 1, 0.28, {
    activeAdditiveParticles: 0,
    activeRings: 2,
    activeSmokeParticles: 8,
    rendererTriangles: 190,
    triangles: 24,
  }),
  createCaptureCase("projectile-trail-peak", "projectile-trail", 1, 0.18, {
    activeAdditiveParticles: 18,
    activeRings: 0,
    activeSmokeParticles: 0,
    rendererTriangles: 190,
    triangles: 36,
  }),
  createCaptureCase("beam-peak", "beam", 1, 0.14, {
    activeAdditiveParticles: 32,
    activeRings: 0,
    activeSmokeParticles: 0,
    rendererTriangles: 225,
    triangles: 64,
  }),
  createCaptureCase("dragon-breath-peak", "dragon-breath", 1, 0.18, {
    activeAdditiveParticles: 50,
    activeRings: 0,
    activeSmokeParticles: 5,
    rendererTriangles: 275,
    triangles: 110,
  }),
  createCaptureCase("status-auras", "aura", 10, 0.8, {
    activeAdditiveParticles: 120,
    activeRings: 20,
    activeSmokeParticles: 0,
    rendererTriangles: 1_000,
    triangles: 300,
  }),
  createCaptureCase("resource-flow-map", "resource-flow", 1, 2.5, {
    activeAdditiveParticles: 0,
    activeRings: 0,
    activeSmokeParticles: 0,
    rendererTriangles: 800,
    triangles: 0,
  }),
  createCaptureCase("resource-flow-stress", "resource-flow-stress", 50, 2.5, {
    activeAdditiveParticles: 0,
    activeRings: 0,
    activeSmokeParticles: 0,
    rendererTriangles: 6_000,
    triangles: 0,
  }),
  createCaptureCase("mixed-encounter", "mixed", 10, 0.35, {
    activeAdditiveParticles: 330,
    activeRings: 10,
    activeSmokeParticles: 90,
    rendererTriangles: 2_100,
    triangles: 800,
  }),
  createCaptureCase("mixed-stress", "mixed", 50, 0.35, {
    activeAdditiveParticles: 1_700,
    activeRings: 50,
    activeSmokeParticles: 420,
    rendererTriangles: 10_500,
    triangles: 4_200,
  }),
  createCaptureCase("realm-fire-detail", "realm-flame", 1, 1.15, {
    activeAdditiveParticles: 70,
    activeRings: 0,
    activeSmokeParticles: 25,
    rendererTriangles: 15_350,
    triangles: 180,
  }),
  createCaptureCase(
    "realm-fire-gameplay",
    "realm-flame",
    1,
    1.15,
    {
      activeAdditiveParticles: 70,
      activeRings: 0,
      activeSmokeParticles: 25,
      rendererTriangles: 15_350,
      triangles: 180,
    },
    "gameplay",
  ),
];

export function buildWorldFxCaptureUrl({ baseUrl, captureCase, rendererMode, seed }) {
  const url = new URL("/debug/world-fx", baseUrl);
  url.searchParams.set("capture", "1");
  url.searchParams.set("scene", captureCase.scene);
  url.searchParams.set("count", String(captureCase.count));
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("time", String(captureCase.time));
  url.searchParams.set("view", captureCase.view);
  url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function evaluateWorldFxCapture(captureCase, stats, expectedMode) {
  const reasons = [];
  if (!stats) return { ok: false, reasons: ["diagnostic snapshot was missing"] };
  if (stats.activeMode !== expectedMode)
    reasons.push(`renderer mode was ${stats.activeMode}, expected ${expectedMode}`);
  if (stats.view !== captureCase.view) reasons.push(`camera view was ${stats.view}, expected ${captureCase.view}`);
  if (stats.additiveCapacity !== 2_048) reasons.push(`additive capacity changed to ${stats.additiveCapacity}`);
  if (stats.smokeCapacity !== 1_024) reasons.push(`smoke capacity changed to ${stats.smokeCapacity}`);
  if (stats.ringCapacity !== 256) reasons.push(`ring capacity changed to ${stats.ringCapacity}`);
  if (stats.drawCalls > 3) reasons.push(`FX draw calls were ${stats.drawCalls}, budget is 3`);
  if (stats.rendererDrawCalls > 9) reasons.push(`renderer draw calls were ${stats.rendererDrawCalls}, budget is 9`);
  const geometryBudget = captureCase.scene === "flame" ? 5 : 6;
  if (stats.geometryCount > geometryBudget) {
    reasons.push(`live geometries were ${stats.geometryCount}, budget is ${geometryBudget}`);
  }
  const textureBudget = captureCase.scene === "realm-flame" ? 5 : 3;
  if (stats.textureCount > textureBudget) {
    reasons.push(`live textures were ${stats.textureCount}, budget is ${textureBudget}`);
  }
  if (stats.droppedCount !== 0) reasons.push(`particle pool dropped ${stats.droppedCount} entries`);
  if (captureCase.scene === "resource-flow")
    evaluateResourceFlowStats(stats.resourceFlows, DEMO_RESOURCE_FLOW_BUDGET, reasons);
  if (captureCase.scene === "resource-flow-stress") {
    evaluateResourceFlowStats(stats.resourceFlows, STRESS_RESOURCE_FLOW_BUDGET, reasons);
  }
  for (const [metric, maximum] of Object.entries(captureCase.maximums)) {
    if (stats[metric] > maximum) reasons.push(`${metric} was ${stats[metric]}, budget is ${maximum}`);
  }
  return { ok: reasons.length === 0, reasons };
}

const DEMO_RESOURCE_FLOW_BUDGET = { flows: 4, packets: 16, routeSegments: 72, triangles: 320 };
const STRESS_RESOURCE_FLOW_BUDGET = { flows: 50, packets: 198, routeSegments: 900, triangles: 3_700 };

function evaluateResourceFlowStats(stats, budget, reasons) {
  if (!stats) {
    reasons.push("resource flow diagnostics were missing");
    return;
  }
  if (stats.activeFlows !== budget.flows) {
    reasons.push(`active resource flows were ${stats.activeFlows}, expected ${budget.flows}`);
  }
  if (stats.activePackets !== budget.packets) {
    reasons.push(`active cargo packets were ${stats.activePackets}, expected ${budget.packets}`);
  }
  if (stats.activeRouteSegments !== budget.routeSegments) {
    reasons.push(`active route segments were ${stats.activeRouteSegments}, expected ${budget.routeSegments}`);
  }
  if (stats.drawCalls > 3) reasons.push(`resource flow draw calls were ${stats.drawCalls}, budget is 3`);
  if (stats.triangles > budget.triangles) {
    reasons.push(`resource flow triangles were ${stats.triangles}, budget is ${budget.triangles}`);
  }
  if (stats.packetCapacity !== 384) reasons.push(`resource packet capacity changed to ${stats.packetCapacity}`);
  if (stats.routeSegmentCapacity !== 1_152) {
    reasons.push(`resource route segment capacity changed to ${stats.routeSegmentCapacity}`);
  }
  if (stats.droppedFlows !== 0 || stats.droppedResources !== 0) {
    reasons.push(`resource flow pool dropped ${stats.droppedFlows} flows and ${stats.droppedResources} resources`);
  }
}

function createCaptureCase(name, scene, count, time, maximums, view = "detail") {
  return { count, maximums, name, scene, time, view };
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function readRendererMode(args) {
  const rendererMode = readOption(args, "--renderer-mode", "webgpu-force-webgl");
  if (!VALID_RENDERER_MODES.has(rendererMode)) {
    throw new Error(`Unsupported renderer mode "${rendererMode}"`);
  }
  return rendererMode;
}

function runPlaywright(session, args) {
  const result = spawnSync(
    "npx",
    ["--yes", "--package", "@playwright/cli", "playwright-cli", `-s=${session}`, ...args],
    { cwd: tmpdir(), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n").trim());
  }
  return result.stdout;
}

function parsePlaywrightResult(output) {
  const marker = "### Result\n";
  const start = output.lastIndexOf(marker);
  if (start < 0) throw new Error(`Playwright returned no result: ${output}`);
  const valueStart = start + marker.length;
  const valueEnd = output.indexOf("\n### ", valueStart);
  return JSON.parse(output.slice(valueStart, valueEnd < 0 ? undefined : valueEnd).trim());
}

function captureWorldFxMatrix({ baseUrl, captureCases, headed, outputDirectory, rendererMode, seed }) {
  const session = `world-fx-capture-${process.pid}`;
  const expectedMode = rendererMode === "webgpu-force-webgl" ? "webgl2-fallback" : "webgpu";
  mkdirSync(outputDirectory, { recursive: true });
  runPlaywright(session, ["open", "about:blank", ...(headed ? ["--headed"] : [])]);
  try {
    runPlaywright(session, ["resize", "1280", "720"]);
    return captureCases.map((captureCase) => {
      const url = buildWorldFxCaptureUrl({ baseUrl, captureCase, rendererMode, seed });
      runPlaywright(session, ["goto", url]);
      const output = runPlaywright(session, [
        "run-code",
        `async page => {
          await page.waitForFunction(() => document.documentElement.dataset.bootState === "app-ready");
          await page.waitForTimeout(450);
          return await page.evaluate(() => window.__worldFxGym?.getSnapshot?.() ?? null);
        }`,
      ]);
      const stats = parsePlaywrightResult(output);
      const screenshot = resolve(outputDirectory, `${captureCase.name}-${expectedMode}.png`);
      runPlaywright(session, ["screenshot", "--filename", screenshot]);
      return {
        evaluation: evaluateWorldFxCapture(captureCase, stats, expectedMode),
        name: captureCase.name,
        screenshot,
        stats,
        url,
      };
    });
  } finally {
    runPlaywright(session, ["close"]);
  }
}

function runCli(args) {
  const rendererMode = readRendererMode(args);
  const outputDirectory = resolveOutputDirectory(readOption(args, "--output-dir", DEFAULT_OUTPUT_DIRECTORY));
  const seed = Number(readOption(args, "--seed", String(DEFAULT_SEED))) >>> 0;
  const captureCases = resolveCaptureCases(readOption(args, "--case", ""));
  const captures = captureWorldFxMatrix({
    baseUrl: readOption(args, "--base-url", DEFAULT_BASE_URL),
    captureCases,
    headed: args.includes("--headed"),
    outputDirectory,
    rendererMode,
    seed,
  });
  const report = {
    captures,
    ok: captures.every(({ evaluation }) => evaluation.ok),
    rendererMode,
    seed,
  };
  const reportPath = resolve(outputDirectory, `report-${rendererMode}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: report.ok, reportPath })}\n`);
  if (!report.ok) process.exitCode = 1;
}

function resolveCaptureCases(value) {
  if (!value) return WORLD_FX_CAPTURE_CASES;
  const requestedNames = new Set(value.split(",").filter(Boolean));
  const captureCases = WORLD_FX_CAPTURE_CASES.filter(({ name }) => requestedNames.has(name));
  if (captureCases.length !== requestedNames.size) {
    const missing = [...requestedNames].filter(
      (name) => !captureCases.some((captureCase) => captureCase.name === name),
    );
    throw new Error(`Unknown capture case: ${missing.join(", ")}`);
  }
  return captureCases;
}

function resolveOutputDirectory(value) {
  return isAbsolute(value) ? value : resolve(REPOSITORY_ROOT, value);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) runCli(process.argv.slice(2));
