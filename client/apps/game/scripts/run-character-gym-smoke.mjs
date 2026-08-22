import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseAgentBrowserJson, runAgentBrowser } from "./run-renderer-debug-smoke.mjs";

const CHARACTER_GYM_PATH = "/debug/procedural-characters";
const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 250;
const VALID_REQUESTED_RENDERER_MODES = new Set(["webgpu-auto", "webgpu-force-webgl"]);
const VALID_RENDERER_MODES = new Set(["webgl2-fallback", "webgpu"]);

export function buildCharacterGymSmokeUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.pathname = CHARACTER_GYM_PATH;
  url.search = "";
  if (rendererMode) url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function normalizeRequestedRendererMode(value) {
  if (!value) return undefined;
  if (!VALID_REQUESTED_RENDERER_MODES.has(value)) {
    throw new Error(`Unsupported renderer mode "${value}". Expected webgpu-auto or webgpu-force-webgl`);
  }
  return value;
}

export function evaluateCharacterGymSmokeResult({ aimStats, animatedStats, browserErrors, snapshot }) {
  const reasons = [];
  const stats = snapshot.stats;

  if (!snapshot.routeMounted) reasons.push("character gym route was not mounted");
  if (!snapshot.ready) reasons.push("character gym did not become ready");
  if (!snapshot.canvasPresent) reasons.push("character gym canvas was missing");
  if (snapshot.horizontalOverflow) reasons.push("character gym had horizontal overflow");
  if (!stats) reasons.push("character gym diagnostics bridge was missing");
  if (!animatedStats) reasons.push("animated character diagnostics were missing");
  if (!aimStats) reasons.push("full-draw archer diagnostics were missing");
  if (animatedStats && animatedStats.leftPalmInwardDot <= 0) {
    reasons.push(`left palm faced outward (${animatedStats.leftPalmInwardDot})`);
  }
  if (animatedStats && animatedStats.rightPalmInwardDot <= 0) {
    reasons.push(`right palm faced outward (${animatedStats.rightPalmInwardDot})`);
  }
  if (aimStats && aimStats.leftPalmInwardDot <= 0) {
    reasons.push(`full-draw left palm faced outward (${aimStats.leftPalmInwardDot})`);
  }
  if (aimStats && aimStats.rightPalmInwardDot <= 0) {
    reasons.push(`full-draw right palm faced outward (${aimStats.rightPalmInwardDot})`);
  }
  if (aimStats && !aimStats.previewArrowVisible) reasons.push("full-draw preview arrow was not attached");
  if (aimStats && aimStats.stringContinuityError > 0.01) {
    reasons.push(`full-draw string continuity error was ${aimStats.stringContinuityError}`);
  }
  if (stats && stats.smokePhase !== "passed") reasons.push(`smoke phase was ${stats.smokePhase}, expected passed`);
  if (stats && stats.smokeFailures.length > 0) reasons.push(`smoke reported: ${stats.smokeFailures.join("; ")}`);
  if (stats && stats.boneCount !== 65) reasons.push(`bone count was ${stats.boneCount}, expected 65`);
  if (stats && stats.skinnedMeshCount < 13) {
    reasons.push(`skinned mesh count was ${stats.skinnedMeshCount}, expected the Ranger archer`);
  }
  if (stats && stats.authoredClipCount !== 0) {
    reasons.push(`authored clip count was ${stats.authoredClipCount}, expected fully procedural motion`);
  }
  if (stats && stats.minimumBendAlignment < 0) {
    reasons.push(`horse bend alignment crossed its pole (${stats.minimumBendAlignment})`);
  }
  if (stats && stats.bodyCount !== 11) reasons.push(`body count was ${stats.bodyCount}, expected 11`);
  if (stats && stats.constraintCount !== 10) reasons.push(`constraint count was ${stats.constraintCount}, expected 10`);
  if (stats && stats.rangedReleaseCount < 1) reasons.push("archer emitted no release edge");
  if (stats && stats.projectileHitCount < 1) reasons.push("pooled arrow did not hit the target");
  if (stats && stats.projectileCapacity !== 256) {
    reasons.push(`projectile capacity was ${stats.projectileCapacity}, expected 256`);
  }
  if (stats && stats.projectileDroppedCount !== 0) reasons.push("projectile pool dropped an arrow");
  if (stats && stats.mode !== "ragdoll") reasons.push(`runtime mode was ${stats.mode}, expected ragdoll`);
  if (stats && !VALID_RENDERER_MODES.has(stats.rendererMode)) {
    reasons.push(`renderer mode was ${stats.rendererMode}, expected webgpu or webgl2-fallback`);
  }
  if (stats && stats.drawCalls <= 0) reasons.push("renderer reported no draw calls");
  if (stats && stats.triangles <= 0) reasons.push("renderer reported no triangles");
  if (stats && stats.geometryCount <= 0) reasons.push("renderer reported no live geometries");
  if (stats && stats.textureCount <= 0) reasons.push("renderer reported no live textures");
  if (stats && stats.wasmHeapMiB <= 0) reasons.push("Jolt WASM reported no allocated heap");
  if (browserErrors.length > 0)
    reasons.push(`browser reported ${browserErrors.length} runtime error(s): ${browserErrors[0]}`);

  return { ok: reasons.length === 0, reasons };
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function readPositiveNumberOption(args, name, fallback) {
  const rawValue = readOption(args, name, String(fallback));
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number, received "${rawValue}"`);
  }
  return value;
}

function readFlag(args, name) {
  return args.includes(name);
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readCharacterGymSnapshot(session, headed) {
  const rawSnapshot = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const root = document.querySelector('[data-debug-route="procedural-characters"]');
        const canvas = document.getElementById("procedural-character-gym-canvas");
        const bridge = window.__proceduralCharacterGym;
        return {
          aimStats: bridge?.getAimStats() ?? null,
          canvasPresent: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          ready: root?.getAttribute("data-gym-ready") === "true",
          routeMounted: Boolean(root),
          stats: bridge?.getStats() ?? null,
        };
      })())`,
    ],
    { headed },
  );
  return parseAgentBrowserJson(rawSnapshot);
}

function waitForSnapshot({ description, headed, session, timeoutMs, until }) {
  const startTime = Date.now();
  let snapshot = readCharacterGymSnapshot(session, headed);
  while (!until(snapshot) && Date.now() - startTime < timeoutMs) {
    runAgentBrowser(session, ["wait", String(POLL_INTERVAL_MS)], { headed });
    snapshot = readCharacterGymSnapshot(session, headed);
  }
  if (!until(snapshot)) {
    throw new Error(`Timed out waiting for ${description}; last snapshot: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

function runCharacterGymSmoke({ baseUrl, headed, rendererMode, timeoutMs }) {
  const session = `character-gym-smoke-${process.pid}`;
  const url = buildCharacterGymSmokeUrl({ baseUrl, rendererMode });
  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed, timeoutMs });

  try {
    return runCharacterGymScenario({ headed, session, timeoutMs, url });
  } finally {
    runAgentBrowser(session, ["close"], { headed });
  }
}

function runCharacterGymScenario({ headed, session, timeoutMs, url }) {
  const readySnapshot = waitForSnapshot({
    description: "the animated longbow archer",
    headed,
    session,
    timeoutMs,
    until: (snapshot) =>
      snapshot.ready &&
      snapshot.stats?.boneCount === 65 &&
      snapshot.stats?.skinnedMeshCount >= 13 &&
      VALID_RENDERER_MODES.has(snapshot.stats?.rendererMode),
  });
  if (readySnapshot.ready) {
    runAgentBrowser(session, ["eval", 'window.__proceduralCharacterGym.runSmoke(); "started"'], { headed });
  }

  const snapshot = waitForSnapshot({
    description: "the archer-shot-to-ragdoll smoke sequence",
    headed,
    session,
    timeoutMs,
    until: (value) => ["failed", "passed"].includes(value.stats?.smokePhase),
  });
  const browserErrors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
  const evaluation = evaluateCharacterGymSmokeResult({
    aimStats: snapshot.aimStats,
    animatedStats: readySnapshot.stats,
    browserErrors,
    snapshot,
  });
  return {
    ...evaluation,
    aimStats: snapshot.aimStats,
    animatedStats: readySnapshot.stats,
    browserErrors,
    snapshot,
    url,
  };
}

function writeOutput(outputPath, summary) {
  if (outputPath) writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const headed = readFlag(argv, "--headed");
  const outputPath = readOption(argv, "--output", "");
  const rendererMode = normalizeRequestedRendererMode(readOption(argv, "--renderer-mode", ""));
  const timeoutMs = readPositiveNumberOption(argv, "--timeout-ms", DEFAULT_TIMEOUT_MS);
  const summary = runCharacterGymSmoke({ baseUrl, headed, rendererMode, timeoutMs });
  writeOutput(outputPath, summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
