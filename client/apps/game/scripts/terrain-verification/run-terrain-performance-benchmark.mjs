import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TERRAIN_BENCHMARK_RENDERERS,
  TERRAIN_BENCHMARK_VARIANTS,
  evaluateTerrainPerformanceResults,
} from "./terrain-performance-evaluator.mjs";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_ARTIFACT_DIRECTORY = ".context/verification/procedural-terrain/performance";
const DEFAULT_DENSITY_MULTIPLIER = 1.75;
const POLL_MS = 500;

export function buildTerrainPerformanceUrl(baseUrl, scenario) {
  const url = new URL(baseUrl);
  url.pathname = "/debug/procedural-terrain-benchmark";
  url.search = "";
  url.searchParams.set("capture", "1");
  url.searchParams.set("autorun", "1");
  url.searchParams.set("runMode", scenario.runMode);
  url.searchParams.set("variant", scenario.variant);
  url.searchParams.set("density", String(scenario.densityMultiplier ?? DEFAULT_DENSITY_MULTIPLIER));
  url.searchParams.set("rendererMode", scenario.rendererMode);
  url.searchParams.set("explorationMode", scenario.explorationMode ?? "explored");
  if (scenario.timingPolicy === "informational") url.searchParams.set("traceMode", "structural");
  return url.toString();
}

function runBenchmarkScenario({
  artifactDirectory,
  baseUrl,
  densityMultiplier,
  explorationMode,
  headed,
  rendererMode,
  runMode,
  timingPolicy,
  timeoutMs,
  variant,
}) {
  const session = `terrain-performance-${rendererMode}-${variant}-${Date.now().toString(36)}`;
  const url = buildTerrainPerformanceUrl(baseUrl, {
    densityMultiplier,
    explorationMode,
    rendererMode,
    runMode,
    timingPolicy,
    variant,
  });
  try {
    runAgentBrowser(session, ["open", url, "--ignore-https-errors"], headed);
    runAgentBrowser(session, ["set", "viewport", "1440", "900"], headed);
    const state = waitForCompletion(session, headed, timeoutMs);
    const errors = parseErrorLines(runAgentBrowser(session, ["errors"], headed));
    const screenshotPath = join(artifactDirectory, `${rendererMode}-${variant}.png`);
    runAgentBrowser(session, ["screenshot", screenshotPath], headed);
    return {
      complete: state.status === "complete",
      densityMultiplier,
      errors,
      explorationMode,
      rendererMode,
      routeMounted: state.routeMounted,
      screenshotPath,
      snapshot: state.snapshot,
      url,
      variant,
    };
  } finally {
    tryRunAgentBrowser(session, ["close"], headed);
  }
}

function waitForCompletion(session, headed, timeoutMs) {
  const startedAt = Date.now();
  let state = readBenchmarkState(session, headed);
  while (state.status !== "complete" && state.status !== "error" && Date.now() - startedAt < timeoutMs) {
    runAgentBrowser(session, ["wait", String(POLL_MS)], headed);
    state = readBenchmarkState(session, headed);
  }
  return state;
}

function readBenchmarkState(session, headed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const route = document.querySelector('[data-debug-route="procedural-terrain-benchmark"]');
        const benchmark = window.__terrainBenchmark;
        return {
          routeMounted: Boolean(route),
          snapshot: benchmark?.getSnapshot?.() ?? null,
          status: benchmark?.status ?? (route ? "booting" : "missing"),
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

function readListOption(args, name, fallback) {
  return readOption(args, name, fallback.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireKnownValues(values, allowed, label) {
  const unknown = values.filter((value) => !allowed.includes(value));
  if (unknown.length > 0) throw new Error(`Unknown terrain benchmark ${label}: ${unknown.join(", ")}`);
}

function main(args) {
  const baseUrl = readOption(args, "--base-url", DEFAULT_BASE_URL);
  const artifactDirectory = resolve(readOption(args, "--artifact-dir", DEFAULT_ARTIFACT_DIRECTORY));
  const headed = args.includes("--headed");
  const densityMultiplier = Number(readOption(args, "--density-multiplier", String(DEFAULT_DENSITY_MULTIPLIER)));
  const explorationMode = readOption(args, "--exploration-mode", "explored");
  const renderers = readListOption(args, "--renderers", TERRAIN_BENCHMARK_RENDERERS);
  const runMode = readOption(args, "--run-mode", "quick");
  const timingPolicy = readOption(args, "--timing-policy", "enforced");
  const timeoutMs = Number(readOption(args, "--timeout-ms", runMode === "full" ? "600000" : "120000"));
  const variants = readListOption(args, "--variants", TERRAIN_BENCHMARK_VARIANTS);
  requireKnownValues(renderers, TERRAIN_BENCHMARK_RENDERERS, "renderers");
  requireKnownValues(variants, TERRAIN_BENCHMARK_VARIANTS, "variants");
  requireKnownValues([explorationMode], ["explored", "frontier"], "exploration modes");
  if (!Number.isFinite(densityMultiplier) || densityMultiplier < 0.25 || densityMultiplier > 3) {
    throw new Error(`Terrain benchmark density multiplier must be from 0.25 to 3, received ${densityMultiplier}`);
  }
  if (runMode !== "quick" && runMode !== "full") throw new Error(`Unknown terrain benchmark run mode: ${runMode}`);
  if (timingPolicy !== "enforced" && timingPolicy !== "informational") {
    throw new Error(`Unknown terrain benchmark timing policy: ${timingPolicy}`);
  }

  mkdirSync(artifactDirectory, { recursive: true });
  const results = renderers.flatMap((rendererMode) =>
    variants.map((variant) =>
      runBenchmarkScenario({
        artifactDirectory,
        baseUrl,
        densityMultiplier,
        explorationMode,
        headed,
        rendererMode,
        runMode,
        timingPolicy,
        timeoutMs,
        variant,
      }),
    ),
  );
  const evaluation = evaluateTerrainPerformanceResults(results, { renderers, runMode, timingPolicy, variants });
  const summary = { ...evaluation, explorationMode, results, runMode, timingPolicy };
  writeFileSync(join(artifactDirectory, "terrain-performance-benchmark.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) main(process.argv.slice(2));
