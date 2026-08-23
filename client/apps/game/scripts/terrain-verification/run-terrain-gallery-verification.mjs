import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_ARTIFACT_DIRECTORY = ".context/verification/procedural-terrain/gallery";
const READY_TIMEOUT_MS = 20_000;
const POLL_MS = 250;
const RENDERER_MODES = ["webgpu-auto", "webgpu-force-webgl"];
const GROUND_MODES = ["flat", "textured"];

export function buildTerrainGalleryUrl(baseUrl, rendererMode, groundMode = "textured") {
  const url = new URL(baseUrl);
  url.pathname = "/debug/procedural-terrain";
  url.search = "";
  url.searchParams.set("capture", "1");
  url.searchParams.set("rendererMode", rendererMode);
  url.searchParams.set("groundMode", groundMode);
  return url.toString();
}

export function evaluateTerrainGalleryResults(results) {
  const reasons = [];
  for (const rendererMode of RENDERER_MODES) {
    for (const groundMode of GROUND_MODES) {
      if (!results.some((result) => result.rendererMode === rendererMode && result.groundMode === groundMode)) {
        reasons.push(`${rendererMode}/${groundMode}: missing verification scenario`);
      }
    }
  }
  for (const result of results) {
    const label = `${result.rendererMode}/${result.groundMode}`;
    if (!result.routeMounted) reasons.push(`${label}: route did not mount`);
    if (!result.ready) reasons.push(`${label}: route did not become ready`);
    if (result.errors.length > 0) reasons.push(`${label}: browser reported ${result.errors[0]}`);
    if (result.snapshot?.biomeCount !== 16) reasons.push(`${label}: expected 16 biomes`);
    if (!(result.snapshot?.cellCount >= 256)) reasons.push(`${label}: expected at least 256 terrain cells`);
    if (result.snapshot?.groundTextureLayers !== 8) reasons.push(`${label}: expected eight ground texture layers`);
    if (!(result.snapshot?.groundTextureBytes > 0)) reasons.push(`${label}: expected measured ground texture bytes`);
    if (!(result.snapshot?.frameSampleCount >= 30)) reasons.push(`${label}: expected at least 30 stable frame samples`);
    if (!(result.snapshot?.frameP95Ms > 0 && result.snapshot.frameP95Ms <= 33.3)) {
      reasons.push(`${label}: stable frame p95 exceeded 33.3 ms or was unavailable`);
    }
    if (!(result.snapshot?.firstRenderMs >= 0 && result.snapshot.firstRenderMs <= 500)) {
      reasons.push(`${label}: first terrain render exceeded 500 ms`);
    }
    if (result.groundMode === "textured" && !(result.snapshot?.textures >= 2 && result.snapshot.textures <= 32)) {
      reasons.push(`${label}: renderer texture count exceeded policy or was unavailable`);
    }
    if (!(result.snapshot?.propInstances > 0)) reasons.push(`${label}: expected deterministic prop instances`);
    if (!(result.snapshot?.triangles > 0 && result.snapshot.triangles <= 3_000_000)) {
      reasons.push(`${label}: triangle count exceeded policy or was unavailable`);
    }
    if (!(result.snapshot?.drawCalls > 0 && result.snapshot.drawCalls <= 40)) {
      reasons.push(`${label}: draw-call count exceeded policy or was unavailable`);
    }
    if (!(result.snapshot?.commitMs >= 0 && result.snapshot.commitMs <= 8)) {
      reasons.push(`${label}: main-thread commit exceeded 8 ms`);
    }
  }

  const performanceDeltas = createPerformanceDeltas(results);
  for (const delta of performanceDeltas) {
    const p95BudgetMs = delta.rendererMode === "webgpu-auto" ? 1.5 : 2.5;
    if (delta.frameP95Ms > p95BudgetMs) {
      reasons.push(`${delta.rendererMode}: textured frame p95 added ${delta.frameP95Ms.toFixed(2)} ms`);
    }
  }

  const fingerprints = new Set(results.map((result) => result.snapshot?.fingerprint).filter(Boolean));
  if (fingerprints.size !== 1) reasons.push("renderer backends produced different terrain fingerprints");
  const metrics = results.map((result) => result.snapshot).filter(Boolean);
  if (metrics.length === results.length) {
    const reference = metrics[0];
    for (const metric of metrics.slice(1)) {
      if (
        metric.biomeCount !== reference.biomeCount ||
        metric.cellCount !== reference.cellCount ||
        metric.groundTextureBytes !== reference.groundTextureBytes ||
        metric.groundTextureLayers !== reference.groundTextureLayers ||
        metric.propInstances !== reference.propInstances
      ) {
        reasons.push("renderer backends produced different biome, cell, texture, or prop counts");
      }
    }
  }
  return { ok: reasons.length === 0, performanceDeltas, reasons };
}

function createPerformanceDeltas(results) {
  return RENDERER_MODES.flatMap((rendererMode) => {
    const flat = results.find(
      (result) => result.rendererMode === rendererMode && result.groundMode === "flat",
    )?.snapshot;
    const textured = results.find(
      (result) => result.rendererMode === rendererMode && result.groundMode === "textured",
    )?.snapshot;
    if (!flat || !textured) return [];
    return [
      {
        firstRenderMs: textured.firstRenderMs - flat.firstRenderMs,
        frameP50Ms: textured.frameP50Ms - flat.frameP50Ms,
        frameP95Ms: textured.frameP95Ms - flat.frameP95Ms,
        frameWorstMs: textured.frameWorstMs - flat.frameWorstMs,
        rendererMode,
      },
    ];
  });
}

function runGalleryScenario({ artifactDirectory, baseUrl, groundMode, headed, rendererMode }) {
  const session = `terrain-gallery-${rendererMode}-${groundMode}-${Date.now().toString(36)}`;
  const url = buildTerrainGalleryUrl(baseUrl, rendererMode, groundMode);
  try {
    runAgentBrowser(session, ["open", url, "--ignore-https-errors"], headed);
    runAgentBrowser(session, ["set", "viewport", "1440", "900"], headed);
    let state = waitForReady(session, headed);
    if (!state.routeMounted) {
      runAgentBrowser(session, ["open", url, "--ignore-https-errors"], headed);
      runAgentBrowser(session, ["set", "viewport", "1440", "900"], headed);
      state = waitForReady(session, headed);
    }
    if (state.status === "ready") {
      runAgentBrowser(session, ["wait", "1200"], headed);
      state = readRouteState(session, headed);
    }
    const errors = parseErrorLines(runAgentBrowser(session, ["errors"], headed));
    const screenshotPath = join(artifactDirectory, `${rendererMode}-${groundMode}.png`);
    runAgentBrowser(session, ["screenshot", screenshotPath], headed);
    return {
      errors,
      groundMode,
      ready: state.status === "ready" && state.dataReady,
      rendererMode,
      routeMounted: state.routeMounted,
      screenshotPath,
      snapshot: state.snapshot,
      url,
    };
  } finally {
    tryRunAgentBrowser(session, ["close"], headed);
  }
}

function waitForReady(session, headed) {
  const startedAt = Date.now();
  let state = readRouteState(session, headed);
  while (state.status === "booting" && Date.now() - startedAt < READY_TIMEOUT_MS) {
    runAgentBrowser(session, ["wait", String(POLL_MS)], headed);
    state = readRouteState(session, headed);
  }
  return state;
}

function readRouteState(session, headed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const route = document.querySelector('[data-debug-route="procedural-terrain"]');
        const debug = window.__terrainVerification;
        return {
          dataReady: route?.getAttribute("data-ready") === "true",
          routeMounted: Boolean(route),
          snapshot: debug?.getSnapshot?.() ?? null,
          status: debug?.status ?? "booting",
        };
      })())`,
    ],
    headed,
  );
  return parseAgentBrowserJson(raw);
}

function runAgentBrowser(session, command, headed) {
  const args = ["-y", "agent-browser", "--session", session];
  if (headed) args.push("--headed");
  const result = spawnSync("npx", [...args, ...command], {
    cwd: process.env.RUNNER_TEMP || process.env.TMPDIR || tmpdir(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser failed for ${session}`);
  }
  return result.stdout.trim();
}

function tryRunAgentBrowser(session, command, headed) {
  try {
    return runAgentBrowser(session, command, headed);
  } catch {
    return "";
  }
}

function parseAgentBrowserJson(raw) {
  const parsed = JSON.parse(raw || "null");
  return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("⚠ --headed ignored"));
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function main(args) {
  const baseUrl = readOption(args, "--base-url", DEFAULT_BASE_URL);
  const artifactDirectory = resolve(readOption(args, "--artifact-dir", DEFAULT_ARTIFACT_DIRECTORY));
  const headed = args.includes("--headed");
  mkdirSync(artifactDirectory, { recursive: true });
  const results = RENDERER_MODES.flatMap((rendererMode) =>
    GROUND_MODES.map((groundMode) =>
      runGalleryScenario({ artifactDirectory, baseUrl, groundMode, headed, rendererMode }),
    ),
  );
  const evaluation = evaluateTerrainGalleryResults(results);
  const summary = { ...evaluation, results };
  writeFileSync(join(artifactDirectory, "terrain-gallery-verification.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) main(process.argv.slice(2));
