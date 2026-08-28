import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeRequestedBenchmarkRendererMode } from "./run-character-benchmark-smoke.mjs";
import { parseAgentBrowserJson, runAgentBrowser } from "./run-renderer-debug-smoke.mjs";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 250;
const VALID_RENDERER_MODES = new Set(["webgl2-fallback", "webgpu"]);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export function buildProceduralWorldGymSmokeUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.pathname = "/debug/procedural-world-gym";
  url.search = "";
  if (rendererMode) url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function evaluateProceduralWorldGymSmokeResult(snapshot, browserErrors) {
  const reasons = [];
  const stats = snapshot.stats;
  const config = snapshot.config;
  if (!snapshot.routeMounted) reasons.push("procedural world gym route was not mounted");
  if (!snapshot.ready) reasons.push("procedural world gym did not become ready");
  if (!snapshot.terrainReady) reasons.push("procedural world gym terrain did not become ready");
  if (!snapshot.canvasPresent) reasons.push("procedural world gym canvas was missing");
  if (snapshot.horizontalOverflow) reasons.push("procedural world gym had horizontal overflow");
  if (!stats || !config) reasons.push("procedural world gym diagnostics bridge was missing");
  if (config?.actorCount !== 100 || stats?.actorCount !== 100) reasons.push("world gym did not retain 100 actors");
  if (config?.locomotionMode !== "walk") reasons.push("world gym did not start in walk mode");
  if (config?.unitMix !== "balanced") reasons.push("world gym did not start with the mixed unit profile");
  if (stats?.environmentMode !== "procedural-biomes") reasons.push("world gym did not use procedural biomes");
  if (stats?.runningCount !== 100 || stats?.ragdollCount !== 0) reasons.push("world gym walking population changed");
  if (stats?.terrainBiomeCount !== 16) reasons.push(`world gym exposed ${stats?.terrainBiomeCount ?? 0}/16 biomes`);
  if (stats?.terrainCellCount !== 196)
    reasons.push(`world gym exposed ${stats?.terrainCellCount ?? 0}/196 terrain cells`);
  if (!(stats?.terrainPropCount > 0)) reasons.push("world gym generated no terrain props");
  if (stats?.terrainSurfaceMissCount !== 0) reasons.push("one or more actors left the terrain surface");
  if (stats?.terrainGroundedActorCount !== 100) {
    reasons.push(`world gym grounded ${stats?.terrainGroundedActorCount ?? 0}/100 actors`);
  }
  if ((stats?.terrainMaximumRootError ?? Number.POSITIVE_INFINITY) > 0.025) {
    reasons.push(`world gym root grounding error was ${stats?.terrainMaximumRootError}m`);
  }
  if (!(stats?.simulationElapsedSeconds >= 1)) reasons.push("world gym simulation did not advance");
  if (!(stats?.drawCalls > 0) || !(stats?.triangles > 0))
    reasons.push("world gym renderer submitted no scene geometry");
  if (!VALID_RENDERER_MODES.has(stats?.rendererMode))
    reasons.push(`world gym renderer mode was ${stats?.rendererMode}`);
  if (browserErrors.length > 0) reasons.push(`browser reported ${browserErrors[0]}`);
  return { ok: reasons.length === 0, reasons };
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function resolveOutputPath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(REPOSITORY_ROOT, value);
}

function readSnapshot(session, headed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const root = document.querySelector('[data-debug-route="procedural-world-gym"]');
        const canvas = document.getElementById('procedural-world-gym-canvas');
        const bridge = window.__proceduralWorldGym;
        return {
          canvasPresent: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
          config: bridge?.getConfig?.() ?? null,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          ready: root?.getAttribute('data-benchmark-ready') === 'true',
          routeMounted: Boolean(root),
          stats: bridge?.getStats?.() ?? null,
          terrainReady: root?.getAttribute('data-terrain-ready') === 'true',
        };
      })())`,
    ],
    { headed },
  );
  return parseAgentBrowserJson(raw);
}

function waitForReady(session, headed, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = readSnapshot(session, headed);
  while (!isReadySnapshot(snapshot) && Date.now() < deadline) {
    runAgentBrowser(session, ["wait", String(POLL_INTERVAL_MS)], { headed });
    snapshot = readSnapshot(session, headed);
  }
  if (!isReadySnapshot(snapshot)) throw new Error(`World gym readiness timed out: ${JSON.stringify(snapshot)}`);
  return snapshot;
}

function isReadySnapshot(snapshot) {
  return (
    snapshot.ready &&
    snapshot.terrainReady &&
    snapshot.stats?.actorCount === 100 &&
    snapshot.stats?.terrainGroundedActorCount === 100 &&
    snapshot.stats?.simulationElapsedSeconds >= 1
  );
}

function parseBrowserErrors(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runSmoke({ baseUrl, headed, rendererMode, screenshotPath, timeoutMs }) {
  const session = `procedural-world-gym-smoke-${process.pid}`;
  const url = buildProceduralWorldGymSmokeUrl({ baseUrl, rendererMode });
  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed, timeoutMs });
  try {
    const snapshot = waitForReady(session, headed, timeoutMs);
    const browserErrors = parseBrowserErrors(runAgentBrowser(session, ["errors"], { headed }));
    if (screenshotPath) {
      mkdirSync(dirname(screenshotPath), { recursive: true });
      runAgentBrowser(session, ["screenshot", screenshotPath], { headed });
    }
    return { ...evaluateProceduralWorldGymSmokeResult(snapshot, browserErrors), browserErrors, snapshot, url };
  } finally {
    runAgentBrowser(session, ["close"], { headed });
  }
}

function main(args) {
  const baseUrl = readOption(args, "--base-url", DEFAULT_BASE_URL);
  const headed = args.includes("--headed");
  const rendererMode = normalizeRequestedBenchmarkRendererMode(readOption(args, "--renderer-mode", ""));
  const screenshotPath = resolveOutputPath(
    readOption(args, "--screenshot", ".context/verification/procedural-world-gym/smoke.png"),
  );
  const timeoutMs = Number(readOption(args, "--timeout-ms", String(DEFAULT_TIMEOUT_MS)));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("--timeout-ms must be a positive number");
  const summary = runSmoke({ baseUrl, headed, rendererMode, screenshotPath, timeoutMs });
  const outputPath = resolveOutputPath(readOption(args, "--output", ""));
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
