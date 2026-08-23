import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAgentBrowserJson, runAgentBrowser } from "./run-renderer-debug-smoke.mjs";

const BENCHMARK_PATH = "/debug/procedural-character-benchmark";
const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;
const MAX_READY_AVERAGE_FRAME_MS = 65;
const MAX_READY_DRAW_CALLS = 1_500;
const MAX_READY_P95_FRAME_MS = 80;
const MAX_ANIMATED_MOUNT_BONE_STRETCH = 1.1;
const MAX_RAGDOLL_MOUNT_BONE_STRETCH = 1.5;
const VALID_REQUESTED_RENDERER_MODES = new Set(["webgpu-auto", "webgpu-force-webgl"]);
const VALID_RENDERER_MODES = new Set(["webgl2-fallback", "webgpu"]);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export function buildCharacterBenchmarkSmokeUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.pathname = BENCHMARK_PATH;
  url.search = "";
  if (rendererMode) url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function normalizeRequestedBenchmarkRendererMode(value) {
  if (!value) return undefined;
  if (!VALID_REQUESTED_RENDERER_MODES.has(value)) {
    throw new Error(`Unsupported renderer mode "${value}". Expected webgpu-auto or webgpu-force-webgl`);
  }
  return value;
}

export function evaluateCharacterBenchmarkSmokeResult({
  activeSnapshot,
  browserErrors,
  pausedSnapshot,
  readySnapshot,
  reducedPopulationSnapshot,
  resetSnapshot,
  respawnSnapshot,
  restoredPopulationSnapshot,
  steppedSnapshot,
}) {
  const reasons = [];
  const readyStats = readySnapshot.stats;
  const activeStats = activeSnapshot.stats;
  const respawnStats = respawnSnapshot.stats;
  const resetStats = resetSnapshot.stats;
  const reducedPopulationStats = reducedPopulationSnapshot.stats;
  const restoredPopulationStats = restoredPopulationSnapshot.stats;

  if (!readySnapshot.routeMounted) reasons.push("character benchmark route was not mounted");
  if (!readySnapshot.ready) reasons.push("character benchmark did not become ready");
  if (!readySnapshot.canvasPresent) reasons.push("character benchmark canvas was missing");
  if (readySnapshot.horizontalOverflow) reasons.push("character benchmark had horizontal overflow");
  if (!readyStats) reasons.push("character benchmark diagnostics bridge was missing");
  if (readyStats && readyStats.actorCount !== 100)
    reasons.push(`actor count was ${readyStats.actorCount}, expected 100`);
  if (readyStats && readyStats.hexCount !== 100) reasons.push(`hex count was ${readyStats.hexCount}, expected 100`);
  if (readyStats && readyStats.visibleHexCount !== 100) {
    reasons.push(`visible hex count was ${readyStats.visibleHexCount}, expected 100`);
  }
  if (readyStats && readyStats.runningCount + readyStats.ragdollCount !== 100) {
    reasons.push("ready population was not conserved");
  }
  if (readyStats && !VALID_RENDERER_MODES.has(readyStats.rendererMode)) {
    reasons.push(`renderer mode was ${readyStats.rendererMode}, expected webgpu or webgl2-fallback`);
  }
  if (readyStats && readyStats.drawCalls <= 0) reasons.push("renderer reported no draw calls");
  if (readyStats && readyStats.drawCalls > MAX_READY_DRAW_CALLS) {
    reasons.push(`ready draw calls were ${readyStats.drawCalls}, budget is ${MAX_READY_DRAW_CALLS}`);
  }
  if (readyStats && readyStats.triangles <= 0) reasons.push("renderer reported no triangles");
  if (readyStats && readyStats.averageFrameMs <= 0) reasons.push("average frame time was not measured");
  if (readyStats && readyStats.averageFrameMs > MAX_READY_AVERAGE_FRAME_MS) {
    reasons.push(`average frame time was ${readyStats.averageFrameMs}ms, budget is ${MAX_READY_AVERAGE_FRAME_MS}ms`);
  }
  if (readyStats && readyStats.p95FrameMs <= 0) reasons.push("p95 frame time was not measured");
  if (readyStats && readyStats.p95FrameMs > MAX_READY_P95_FRAME_MS) {
    reasons.push(`p95 frame time was ${readyStats.p95FrameMs}ms, budget is ${MAX_READY_P95_FRAME_MS}ms`);
  }
  if (readyStats && readyStats.projectileHitCount < 1) reasons.push("archer benchmark produced no projectile hits");
  if (readyStats && readyStats.projectileActiveCount > 512) {
    reasons.push(`projectile pool exceeded capacity (${readyStats.projectileActiveCount}/512)`);
  }
  if (readyStats && readyStats.projectileDroppedCount > 0) {
    reasons.push(`projectile pool dropped ${readyStats.projectileDroppedCount} arrows`);
  }
  if (!reducedPopulationStats || reducedPopulationStats.actorCount !== 25) {
    reasons.push("population control did not rebuild the benchmark at 25 actors");
  }
  if (!restoredPopulationStats || restoredPopulationStats.actorCount !== 100) {
    reasons.push("population control did not restore the benchmark to 100 actors");
  }
  if (readyStats && restoredPopulationStats && readyStats.geometryCount !== restoredPopulationStats.geometryCount) {
    reasons.push(
      `geometry count changed across population rebuild (${readyStats.geometryCount} -> ${restoredPopulationStats.geometryCount})`,
    );
  }
  if (readyStats && restoredPopulationStats && readyStats.textureCount !== restoredPopulationStats.textureCount) {
    reasons.push(
      `texture count changed across population rebuild (${readyStats.textureCount} -> ${restoredPopulationStats.textureCount})`,
    );
  }
  if (!activeStats || activeStats.totalDeaths < 1) reasons.push("kill burst produced no deaths");
  if (!activeStats || activeStats.ragdollCount < 1) reasons.push("kill burst produced no ragdolls");
  if (!activeStats || activeStats.physicsBodyCount < 12) reasons.push("Jolt created no articulated death bodies");
  if (!activeStats || activeStats.physicsConstraintCount < 10) reasons.push("Jolt created no death constraints");
  if (!activeStats || activeStats.wasmHeapMiB <= 0) reasons.push("Jolt WASM reported no allocated heap");
  appendMountStretchFailures(reasons, "active", activeStats);
  if (!pausedSnapshot.paused) reasons.push("visible pause control did not pause the simulation");
  if ((steppedSnapshot.stats?.simulationElapsedSeconds ?? 0) <= (pausedSnapshot.stats?.simulationElapsedSeconds ?? 0)) {
    reasons.push("visible step control did not advance the paused simulation");
  }
  if (!respawnStats || respawnStats.respawnCount < 1) reasons.push("death cycle produced no respawn");
  appendMountStretchFailures(reasons, "respawn", respawnStats);
  if (respawnStats && respawnStats.runningCount + respawnStats.ragdollCount !== 100) {
    reasons.push("post-respawn population was not conserved");
  }
  if (!resetStats || resetStats.actorCount !== 100 || resetStats.resetCount < 5) {
    reasons.push("five reset cycles did not restore the initial population");
  }
  appendMountStretchFailures(reasons, "reset", resetStats);
  if (readyStats && resetStats && readyStats.geometryCount !== resetStats.geometryCount) {
    reasons.push(`geometry count changed across resets (${readyStats.geometryCount} -> ${resetStats.geometryCount})`);
  }
  if (readyStats && resetStats && readyStats.textureCount !== resetStats.textureCount) {
    reasons.push(`texture count changed across resets (${readyStats.textureCount} -> ${resetStats.textureCount})`);
  }
  if ((activeStats?.physicsFailures.length ?? 0) > 0 || (respawnStats?.physicsFailures.length ?? 0) > 0) {
    reasons.push(
      `physics failures were reported: ${[...(activeStats?.physicsFailures ?? []), ...(respawnStats?.physicsFailures ?? [])].join("; ")}`,
    );
  }
  if (browserErrors.length > 0) {
    reasons.push(`browser reported ${browserErrors.length} runtime error(s): ${browserErrors[0]}`);
  }

  return { ok: reasons.length === 0, reasons };
}

function appendMountStretchFailures(reasons, phase, stats) {
  if (!stats) return;
  if (stats.maximumAnimatedMountBoneStretchRatio > MAX_ANIMATED_MOUNT_BONE_STRETCH) {
    reasons.push(
      `${phase} animated mount bone stretch was ${stats.maximumAnimatedMountBoneStretchRatio}x; budget is ${MAX_ANIMATED_MOUNT_BONE_STRETCH}x`,
    );
  }
  if (stats.maximumRagdollMountBoneStretchRatio > MAX_RAGDOLL_MOUNT_BONE_STRETCH) {
    reasons.push(
      `${phase} ragdoll mount bone stretch was ${stats.maximumRagdollMountBoneStretchRatio}x; budget is ${MAX_RAGDOLL_MOUNT_BONE_STRETCH}x`,
    );
  }
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function readPositiveNumberOption(args, name, fallback) {
  const rawValue = readOption(args, name, String(fallback));
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
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

function readBenchmarkSnapshot(session, headed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const root = document.querySelector('[data-debug-route="procedural-character-benchmark"]');
        const canvas = document.getElementById("procedural-character-benchmark-canvas");
        const bridge = window.__proceduralCharacterBenchmark;
        return {
          canvasPresent: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          paused: root?.getAttribute("data-simulation-paused") === "true",
          ready: root?.getAttribute("data-benchmark-ready") === "true",
          routeMounted: Boolean(root),
          stats: bridge?.getStats() ?? null,
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
  if (!until(snapshot)) {
    throw new Error(`Timed out waiting for ${description}; last snapshot: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

function clickButton(session, label, headed) {
  const result = runAgentBrowser(
    session,
    [
      "eval",
      `(() => {
        const label = ${JSON.stringify(label.toUpperCase())};
        const button = [...document.querySelectorAll("button")].find(
          (entry) => entry.textContent?.trim().toUpperCase() === label,
        );
        if (!button) return "missing";
        button.click();
        return "clicked";
      })()`,
    ],
    { headed },
  );
  if (result.trim().replaceAll('"', "") !== "clicked") throw new Error(`Benchmark button "${label}" was not found`);
}

function runCharacterBenchmarkSmoke({ baseUrl, headed, rendererMode, timeoutMs }) {
  const session = `character-benchmark-smoke-${process.pid}`;
  const url = buildCharacterBenchmarkSmokeUrl({ baseUrl, rendererMode });
  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed, timeoutMs });

  try {
    return runCharacterBenchmarkScenario({ headed, session, timeoutMs, url });
  } finally {
    runAgentBrowser(session, ["close"], { headed });
  }
}

function runCharacterBenchmarkScenario({ headed, session, timeoutMs, url }) {
  const readySnapshot = waitForSnapshot({
    description: "the initial 100-actor benchmark",
    headed,
    session,
    timeoutMs,
    until: (snapshot) =>
      snapshot.ready &&
      snapshot.stats?.actorCount === 100 &&
      snapshot.stats?.visibleHexCount === 100 &&
      snapshot.stats?.p95FrameMs > 0 &&
      snapshot.stats?.projectileHitCount > 0 &&
      VALID_RENDERER_MODES.has(snapshot.stats?.rendererMode),
  });

  clickButton(session, "25", headed);
  const reducedPopulationSnapshot = waitForSnapshot({
    description: "the 25-actor population rebuild",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.ready && snapshot.stats?.actorCount === 25 && !snapshot.stats?.loadingActors,
  });
  clickButton(session, "100", headed);
  const restoredPopulationSnapshot = waitForSnapshot({
    description: "the restored 100-actor population",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.ready && snapshot.stats?.actorCount === 100 && !snapshot.stats?.loadingActors,
  });

  if (restoredPopulationSnapshot.ready) clickButton(session, "Kill burst", headed);
  const activeSnapshot = waitForSnapshot({
    description: "an active articulated ragdoll",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.stats?.ragdollCount > 0 && snapshot.stats?.physicsBodyCount >= 12,
  });

  clickButton(session, "Pause", headed);
  const pausedSnapshot = waitForSnapshot({
    description: "the paused simulation state",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.paused,
  });
  clickButton(session, "Step", headed);
  const steppedSnapshot = waitForSnapshot({
    description: "a single paused simulation step",
    headed,
    session,
    timeoutMs,
    until: (snapshot) =>
      (snapshot.stats?.simulationElapsedSeconds ?? 0) > (pausedSnapshot.stats?.simulationElapsedSeconds ?? 0),
  });
  clickButton(session, "Resume", headed);

  const respawnSnapshot = waitForSnapshot({
    description: "a completed death and respawn cycle",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.stats?.respawnCount > 0,
  });

  runAgentBrowser(
    session,
    ["eval", 'for (let index = 0; index < 5; index += 1) window.__proceduralCharacterBenchmark.reset(); "reset"'],
    { headed },
  );
  const resetSnapshot = waitForSnapshot({
    description: "five stable benchmark resets",
    headed,
    session,
    timeoutMs,
    until: (snapshot) => snapshot.stats?.actorCount === 100 && snapshot.stats?.resetCount >= 5,
  });
  const browserErrors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
  const evaluation = evaluateCharacterBenchmarkSmokeResult({
    activeSnapshot,
    browserErrors,
    pausedSnapshot,
    readySnapshot,
    reducedPopulationSnapshot,
    resetSnapshot,
    respawnSnapshot,
    restoredPopulationSnapshot,
    steppedSnapshot,
  });
  return {
    ...evaluation,
    activeSnapshot,
    browserErrors,
    readySnapshot,
    reducedPopulationSnapshot,
    resetSnapshot,
    respawnSnapshot,
    restoredPopulationSnapshot,
    url,
  };
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const headed = readFlag(argv, "--headed");
  const requestedOutputPath = readOption(argv, "--output", "");
  const outputPath = requestedOutputPath
    ? isAbsolute(requestedOutputPath)
      ? requestedOutputPath
      : resolve(REPOSITORY_ROOT, requestedOutputPath)
    : "";
  const rendererMode = normalizeRequestedBenchmarkRendererMode(readOption(argv, "--renderer-mode", ""));
  const timeoutMs = readPositiveNumberOption(argv, "--timeout-ms", DEFAULT_TIMEOUT_MS);
  const summary = runCharacterBenchmarkSmoke({ baseUrl, headed, rendererMode, timeoutMs });
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
