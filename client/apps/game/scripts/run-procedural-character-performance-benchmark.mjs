import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAgentBrowserJson, runAgentBrowser } from "./run-renderer-debug-smoke.mjs";

const BENCHMARK_PATH = "/debug/procedural-character-benchmark";
const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const REFERENCE_VIEWPORT = { height: 900, width: 1_440 };
const MAX_WALKING_DRAW_CALLS = 800;
const MAX_WALKING_TRIANGLES = 2_000_000;
const VALID_REQUESTED_RENDERER_MODES = new Set(["webgpu-auto", "webgpu-force-webgl"]);
const VALID_RENDERER_MODES = new Set(["webgl2-fallback", "webgpu"]);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export function buildProceduralCharacterPerformanceUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.pathname = BENCHMARK_PATH;
  url.search = "";
  if (rendererMode) url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function evaluateProceduralCharacterPerformanceResult({ browserErrors, snapshot }) {
  const reasons = [];
  const stats = snapshot.stats;
  const performance = stats?.performance;
  if (!snapshot.routeMounted) reasons.push("character benchmark route was not mounted");
  if (!snapshot.ready) reasons.push("100-unit walking profile was not ready");
  if (!snapshot.canvasPresent) reasons.push("character benchmark canvas was missing");
  if (snapshot.horizontalOverflow) reasons.push("character benchmark had horizontal overflow");
  if (
    snapshot.viewport?.width !== REFERENCE_VIEWPORT.width ||
    snapshot.viewport?.height !== REFERENCE_VIEWPORT.height
  ) {
    reasons.push(
      `viewport was ${snapshot.viewport?.width ?? "missing"}x${snapshot.viewport?.height ?? "missing"}, expected 1440x900`,
    );
  }
  if (!snapshot.walkingProfileActive) reasons.push("standard 100-unit walking profile was not active");
  if (!stats) reasons.push("character benchmark diagnostics bridge was missing");
  if (stats && stats.actorCount !== 100) reasons.push(`actor count was ${stats.actorCount}, expected 100`);
  if (stats && stats.animationUpdateLaneCount !== 3) {
    reasons.push(`animation lane count was ${stats.animationUpdateLaneCount}, expected 3`);
  }
  if (stats && stats.runningCount !== 100) reasons.push(`running count was ${stats.runningCount}, expected 100`);
  if (stats && stats.collisionBodyCount !== 100) {
    reasons.push(`collision body count was ${stats.collisionBodyCount}, expected 100`);
  }
  if (stats && stats.collisionDroppedPairCount > 0) {
    reasons.push(`collision solver dropped ${stats.collisionDroppedPairCount} pair(s)`);
  }
  if (stats && stats.visibleHexCount !== 100) {
    reasons.push(`visible hex count was ${stats.visibleHexCount}, expected 100 at 1440x900`);
  }
  if (stats && stats.drawCalls <= 0) reasons.push("renderer reported no draw calls");
  if (stats && stats.drawCalls > MAX_WALKING_DRAW_CALLS) {
    reasons.push(`walking draw calls were ${stats.drawCalls}, budget is ${MAX_WALKING_DRAW_CALLS}`);
  }
  if (stats && stats.triangles <= 0) reasons.push("renderer reported no triangles");
  if (stats && stats.triangles > MAX_WALKING_TRIANGLES) {
    reasons.push(`walking triangles were ${stats.triangles}, budget is ${MAX_WALKING_TRIANGLES}`);
  }
  if (stats && !VALID_RENDERER_MODES.has(stats.rendererMode)) {
    reasons.push(`renderer mode was ${stats.rendererMode}, expected webgpu or webgl2-fallback`);
  }
  if (!performance || performance.state !== "complete") reasons.push("performance sample did not complete");
  if (performance && !performance.headroomPass) reasons.push(...performance.reasons);
  if (performance?.headroomPass && !performance.onScreenPass && performance.status !== "display-limited") {
    reasons.push(`on-screen result was ${performance.observedFps} FPS, target is 60 FPS`);
  }
  if (browserErrors.length > 0)
    reasons.push(`browser reported ${browserErrors.length} runtime error(s): ${browserErrors[0]}`);
  return {
    displayLimited: performance?.status === "display-limited",
    ok: reasons.length === 0,
    onScreen60Verified: performance?.onScreenPass === true,
    reasons,
  };
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function readPositiveNumberOption(args, name, fallback) {
  const value = Number(readOption(args, name, String(fallback)));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}

function readFlag(args, name) {
  return args.includes(name);
}

function normalizeRendererMode(value) {
  if (!value) return undefined;
  if (!VALID_REQUESTED_RENDERER_MODES.has(value)) {
    throw new Error(`Unsupported renderer mode "${value}". Expected webgpu-auto or webgpu-force-webgl`);
  }
  return value;
}

function readBenchmarkSnapshot(session, headed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const root = document.querySelector('[data-debug-route="procedural-character-benchmark"]');
        const canvas = document.getElementById("procedural-character-benchmark-canvas");
        const bridge = window.__proceduralCharacterBenchmark;
        const config = bridge?.getConfig() ?? null;
        return {
          canvas: canvas ? {
            cssHeight: canvas.getBoundingClientRect().height,
            cssWidth: canvas.getBoundingClientRect().width,
            height: canvas.height,
            width: canvas.width,
          } : null,
          canvasPresent: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
          config,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          ready: root?.getAttribute("data-benchmark-ready") === "true",
          routeMounted: Boolean(root),
          stats: bridge?.getStats() ?? null,
          viewport: { height: window.innerHeight, width: window.innerWidth },
          walkingProfileActive: Boolean(
            config &&
            config.actorCount === 100 &&
            config.animationUpdateLanes === 3 &&
            config.archerVolleys === false &&
            config.autoRotate === false &&
            config.collisions === true &&
            config.deathsPerSecond === 0 &&
            config.locomotionMode === "walk" &&
            config.maxActiveRagdolls === 0 &&
            config.meleeAttacks === false &&
            config.pixelRatio === 1 &&
            config.shadows === false &&
            config.unitMix === "foot"
          ),
        };
      })())`,
    ],
    { headed },
  );
  return parseAgentBrowserJson(raw);
}

function waitForSnapshot({ description, headed, session, timeoutMs, until }) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = readBenchmarkSnapshot(session, headed);
  while (!until(snapshot) && Date.now() < deadline) {
    runAgentBrowser(session, ["wait", String(POLL_INTERVAL_MS)], { headed });
    snapshot = readBenchmarkSnapshot(session, headed);
  }
  if (!until(snapshot))
    throw new Error(`Timed out waiting for ${description}; last snapshot: ${JSON.stringify(snapshot)}`);
  return snapshot;
}

function runPerformanceBenchmark({ baseUrl, headed, rendererMode, timeoutMs }) {
  const session = `procedural-character-performance-${process.pid}`;
  const url = buildProceduralCharacterPerformanceUrl({ baseUrl, rendererMode });
  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed, timeoutMs });
  try {
    runAgentBrowser(session, ["set", "viewport", String(REFERENCE_VIEWPORT.width), String(REFERENCE_VIEWPORT.height)], {
      headed,
    });
    waitForSnapshot({
      description: "the fixed 1440x900 reference viewport",
      headed,
      session,
      timeoutMs,
      until: (snapshot) =>
        snapshot.viewport?.width === REFERENCE_VIEWPORT.width &&
        snapshot.viewport?.height === REFERENCE_VIEWPORT.height,
    });
    waitForSnapshot({
      description: "the initial character benchmark",
      headed,
      session,
      timeoutMs,
      until: (snapshot) => snapshot.ready,
    });
    runAgentBrowser(
      session,
      ["eval", 'window.__proceduralCharacterBenchmark.applyWalkingPerformanceProfile(); "applied"'],
      { headed },
    );
    waitForSnapshot({
      description: "the standard 100-unit walking profile",
      headed,
      session,
      timeoutMs,
      until: (snapshot) => snapshot.ready && snapshot.walkingProfileActive && snapshot.stats?.runningCount === 100,
    });
    runAgentBrowser(
      session,
      ["eval", 'window.__proceduralCharacterBenchmark.startPerformanceEvaluation().then(() => "calibrated")'],
      { headed, timeoutMs },
    );
    const snapshot = waitForSnapshot({
      description: "a complete warm 60 FPS evaluation sample",
      headed,
      session,
      timeoutMs,
      until: (candidate) => candidate.stats?.performance?.state === "complete",
    });
    const browserErrors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
    return {
      ...evaluateProceduralCharacterPerformanceResult({ browserErrors, snapshot }),
      browserErrors,
      snapshot,
      url,
    };
  } finally {
    runAgentBrowser(session, ["close"], { headed });
  }
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveOutputPath(outputPath) {
  if (!outputPath) return "";
  return isAbsolute(outputPath) ? outputPath : resolve(REPOSITORY_ROOT, outputPath);
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const headed = readFlag(argv, "--headed");
  const outputPath = resolveOutputPath(readOption(argv, "--output", ""));
  const rendererMode = normalizeRendererMode(readOption(argv, "--renderer-mode", ""));
  const timeoutMs = readPositiveNumberOption(argv, "--timeout-ms", DEFAULT_TIMEOUT_MS);
  const summary = runPerformanceBenchmark({ baseUrl, headed, rendererMode, timeoutMs });
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
