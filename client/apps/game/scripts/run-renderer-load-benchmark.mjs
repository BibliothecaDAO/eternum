import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_CHAIN = "slot";
const DEFAULT_ITERATIONS = 5;
const DEFAULT_RENDERER_MODES = ["webgpu-force-webgl", "webgpu-auto"];
const DEFAULT_SCENE = "map";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_WORLD_NAME = "eternum-blitz-slot-4";
const POLL_INTERVAL_MS = 500;
const RENDERER_STALL_THRESHOLD_MS = 7_000;
const METRIC_NAMES = [
  "entryReadyMs",
  "rendererInitMs",
  "rendererBackendAwaitMs",
  "webgpuModuleImportMs",
  "webgpuRendererInitMs",
  "backendTotalMs",
];

export function buildRendererLoadBenchmarkUrl({
  baseUrl,
  chain = DEFAULT_CHAIN,
  rendererMode,
  scene = DEFAULT_SCENE,
  worldName = DEFAULT_WORLD_NAME,
}) {
  const url = new URL(baseUrl);
  url.pathname = `/play/${chain}/${encodeURIComponent(worldName)}/${scene}`;
  url.searchParams.set("col", "0");
  url.searchParams.set("row", "0");
  url.searchParams.set("spectate", "true");
  url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function deriveRendererLoadRunMetrics({ diagnostics, durations, elapsedMs, milestones }) {
  const rendererStarted = findMilestone(milestones, "renderer-init-started");
  const rendererCompleted = findMilestone(milestones, "renderer-init-completed");
  const entryReady = findMilestone(milestones, "entry-ready");
  const startupTimings = diagnostics?.startupTimings ?? {};
  const rendererInitMs =
    readDuration(durations, "renderer-init") ??
    (rendererStarted && rendererCompleted ? rendererCompleted.elapsedMs - rendererStarted.elapsedMs : null);

  return {
    entryReadyMs: entryReady?.elapsedMs ?? null,
    backendTotalMs: readTiming(startupTimings, "webgpu-backend-total"),
    rendererBackendAwaitMs: readDuration(durations, "renderer-init-backend-await"),
    rendererInitMs,
    rendererStalledAfterStartMs: rendererStarted
      ? (rendererCompleted?.elapsedMs ?? elapsedMs ?? rendererStarted.elapsedMs) - rendererStarted.elapsedMs
      : null,
    webgpuModuleImportMs: readTiming(startupTimings, "webgpu-module-import"),
    webgpuRendererInitMs: readTiming(startupTimings, "webgpu-renderer-init"),
  };
}

export function summarizeRendererLoadBenchmarkResults(results) {
  const metricsByMode = {};
  for (const result of results) {
    metricsByMode[result.rendererMode] ??= { failureCount: 0 };
    if (!result.ok) {
      metricsByMode[result.rendererMode].failureCount += 1;
    }
  }

  for (const mode of Object.keys(metricsByMode)) {
    const modeResults = results.filter((result) => result.rendererMode === mode);
    for (const metricName of METRIC_NAMES) {
      metricsByMode[mode][metricName] = summarizeMetric(
        modeResults.map((result) => result.metrics?.[metricName]).filter(isFiniteNumber),
      );
    }
  }

  return {
    metricsByMode,
    results,
  };
}

export function evaluateRendererLoadBenchmarkSummary(summary, options = {}) {
  const entryReadyTimeoutMs = options.entryReadyTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rendererStallThresholdMs = options.rendererStallThresholdMs ?? RENDERER_STALL_THRESHOLD_MS;
  const failures = [];
  const warnings = [];

  for (const result of summary.results ?? []) {
    if (!result.diagnostics) {
      failures.push(formatRunFailure(result, "missing renderer diagnostics"));
    }

    if (!isFiniteNumber(result.metrics?.entryReadyMs) || result.metrics.entryReadyMs > entryReadyTimeoutMs) {
      failures.push(formatRunFailure(result, `entry-ready exceeded ${entryReadyTimeoutMs}ms`));
    }

    if (
      result.rendererMode === "webgpu-auto" &&
      !hasRendererCompletedOrFallback(result) &&
      result.metrics?.rendererStalledAfterStartMs > rendererStallThresholdMs
    ) {
      failures.push(formatRunFailure(result, "stalled after renderer-init-started without completion or fallback"));
    }

    if (hasWebGpuFallback(result)) {
      if (!result.diagnostics?.fallbackReason) {
        failures.push(formatRunFailure(result, "fallback happened without a fallback reason"));
      } else {
        warnings.push(formatRunFailure(result, `native WebGPU fell back: ${result.diagnostics.fallbackReason}`));
      }
    }
  }

  return {
    failures,
    ok: failures.length === 0,
    warnings,
  };
}

export function compareRendererLoadBenchmarkSummary(baseline, current) {
  const failures = [];

  for (const mode of Object.keys(current.metricsByMode ?? {})) {
    compareP95Metric({
      absoluteThresholdMs: 1_500,
      baseline,
      current,
      failures,
      metricName: "entryReadyMs",
      mode,
      percentThreshold: 0.2,
    });
    compareP95Metric({
      absoluteThresholdMs: 750,
      baseline,
      current,
      failures,
      metricName: "rendererInitMs",
      mode,
      percentThreshold: 0.25,
    });
  }

  return {
    failures,
    ok: failures.length === 0,
  };
}

function findMilestone(milestones = [], name) {
  return milestones.find((milestone) => milestone.name === name) ?? null;
}

function readDuration(durations = {}, name) {
  return isFiniteNumber(durations[name]) ? durations[name] : null;
}

function readTiming(startupTimings = {}, name) {
  return isFiniteNumber(startupTimings[name]) ? startupTimings[name] : null;
}

function summarizeMetric(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  return {
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1));
  return sortedValues[index];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasRendererCompletedOrFallback(result) {
  return isFiniteNumber(result.metrics?.rendererInitMs) || hasWebGpuFallback(result);
}

function hasWebGpuFallback(result) {
  const diagnostics = result.diagnostics;
  return Boolean(
    result.rendererMode !== "webgpu-force-webgl" &&
    (diagnostics?.fallbackReason ||
      diagnostics?.fallbacks > 0 ||
      (diagnostics?.requestedMode &&
        diagnostics.requestedMode !== "webgpu-force-webgl" &&
        diagnostics.activeMode === "webgl2-fallback")),
  );
}

function formatRunFailure(result, reason) {
  const label = [result.rendererMode, result.iteration ? `#${result.iteration}` : null].filter(Boolean).join(" ");
  return `${label || "run"}: ${reason}`;
}

function compareP95Metric({ absoluteThresholdMs, baseline, current, failures, metricName, mode, percentThreshold }) {
  const baselineValue = baseline.metricsByMode?.[mode]?.[metricName]?.p95;
  const currentValue = current.metricsByMode?.[mode]?.[metricName]?.p95;
  if (!isFiniteNumber(baselineValue) || !isFiniteNumber(currentValue)) {
    return;
  }

  const delta = currentValue - baselineValue;
  if (delta <= absoluteThresholdMs || delta / Math.max(baselineValue, 1) <= percentThreshold) {
    return;
  }

  failures.push(
    `${mode} ${metricName} p95 regressed from ${Math.round(baselineValue)}ms to ${Math.round(currentValue)}ms`,
  );
}

function readFlag(args, name) {
  return args.includes(name);
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
}

function readNumberOption(args, name, fallback) {
  const value = Number(readOption(args, name, String(fallback)));
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function readRendererModes(args) {
  return readOption(args, "--renderer-modes", DEFAULT_RENDERER_MODES.join(","))
    .split(",")
    .map((mode) => mode.trim())
    .filter(Boolean);
}

function resolveAgentBrowserWorkingDirectory(env = process.env) {
  return env.RUNNER_TEMP || env.TMPDIR || tmpdir();
}

function invokeAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const baseArgs = ["-y", "agent-browser", "--session", session];
  if (headed) {
    baseArgs.push("--headed");
  }

  return spawnSync("npx", [...baseArgs, ...commandArgs], {
    cwd: resolveAgentBrowserWorkingDirectory(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const result = invokeAgentBrowser(session, commandArgs, { headed });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser failed for session ${session}`);
  }
  return result.stdout.trim();
}

function parseAgentBrowserJson(raw) {
  const parsed = JSON.parse(raw || "null");
  return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function runRendererLoadIteration({
  baseUrl,
  chain,
  headed,
  iteration,
  rendererMode,
  scene,
  timeoutMs,
  worldName,
}) {
  const session = `renderer-load-${rendererMode.replace(/[^a-z0-9-]/gi, "-")}-${iteration}-${Date.now().toString(36)}`;
  const url = buildRendererLoadBenchmarkUrl({ baseUrl, chain, rendererMode, scene, worldName });

  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed });
  const snapshot = await waitForEntrySnapshot({ headed, session, timeoutMs });
  const openedUrl = runAgentBrowser(session, ["get", "url"], { headed });
  const errors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
  const metrics = deriveRendererLoadRunMetrics(snapshot);

  return {
    ...snapshot,
    errors,
    iteration,
    metrics,
    ok: errors.length === 0 && snapshot.canvasExists,
    openedUrl,
    rendererMode,
    session,
    url,
  };
}

async function waitForEntrySnapshot({ headed, session, timeoutMs }) {
  const startedAt = Date.now();
  let snapshot = readBrowserSnapshot(session, headed);

  while (!hasEntryFinished(snapshot) && Date.now() - startedAt < timeoutMs) {
    runAgentBrowser(session, ["wait", String(POLL_INTERVAL_MS)], { headed });
    snapshot = readBrowserSnapshot(session, headed);
  }

  return snapshot;
}

function hasEntryFinished(snapshot) {
  return Boolean(
    snapshot.canvasExists ||
    snapshot.milestones?.some((milestone) => milestone.name === "entry-ready") ||
    snapshot.diagnostics?.fallbackReason,
  );
}

function readBrowserSnapshot(session, headed) {
  return parseAgentBrowserJson(
    runAgentBrowser(
      session,
      [
        "eval",
        `JSON.stringify((() => {
          const navigation = performance.getEntriesByType("navigation")[0] ?? null;
          const resources = performance.getEntriesByType("resource");
          const scripts = resources
            .filter((resource) => resource.initiatorType === "script")
            .map((resource) => ({
              duration: Math.round(resource.duration),
              name: resource.name.split("/").pop()?.split("?")[0] ?? resource.name,
              transferSize: resource.transferSize || 0,
            }));

          return {
            canvasExists: Boolean(document.getElementById("main-canvas")),
            diagnostics: window.__rendererDiagnostics ?? null,
            durations: window.__eternumGameEntryDurations ?? {},
            elapsedMs: window.__eternumGameEntryStartMs === undefined
              ? null
              : Math.round(performance.now() - window.__eternumGameEntryStartMs),
            milestones: window.__eternumGameEntryTimeline ?? [],
            navigationTiming: navigation
              ? {
                  domComplete: Math.round(navigation.domComplete),
                  domInteractive: Math.round(navigation.domInteractive),
                  loadEventEnd: Math.round(navigation.loadEventEnd),
                  responseStart: Math.round(navigation.responseStart),
                }
              : null,
            scripts,
            slowestResources: resources
              .map((resource) => ({
                duration: Math.round(resource.duration),
                initiatorType: resource.initiatorType,
                name: resource.name.split("/").pop()?.split("?")[0] ?? resource.name,
                transferSize: resource.transferSize || 0,
              }))
              .sort((left, right) => right.duration - left.duration)
              .slice(0, 15),
            totalTransferBytes: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
          };
        })())`,
      ],
      { headed },
    ),
  );
}

function writeOutputFile(outputPath, summary) {
  if (!outputPath) {
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

async function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const chain = readOption(argv, "--chain", DEFAULT_CHAIN);
  const comparePath = readOption(argv, "--compare", "");
  const headed = readFlag(argv, "--headed");
  const iterations = readNumberOption(argv, "--iterations", DEFAULT_ITERATIONS);
  const outputPath = readOption(argv, "--output", "");
  const rendererModes = readRendererModes(argv);
  const scene = readOption(argv, "--scene", DEFAULT_SCENE);
  const timeoutMs = readNumberOption(argv, "--timeout-ms", DEFAULT_TIMEOUT_MS);
  const worldName = readOption(argv, "--world", DEFAULT_WORLD_NAME);

  const results = [];
  for (const rendererMode of rendererModes) {
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      results.push(
        await runRendererLoadIteration({
          baseUrl,
          chain,
          headed,
          iteration,
          rendererMode,
          scene,
          timeoutMs,
          worldName,
        }),
      );
    }
  }

  const summary = summarizeRendererLoadBenchmarkResults(results);
  const gateEvaluation = evaluateRendererLoadBenchmarkSummary(summary, { entryReadyTimeoutMs: timeoutMs });
  const baselineComparison = comparePath
    ? compareRendererLoadBenchmarkSummary(JSON.parse(readFileSync(comparePath, "utf8")), summary)
    : { failures: [], ok: true };
  const output = {
    ...summary,
    baselineComparison,
    gateEvaluation,
    ok: gateEvaluation.ok && baselineComparison.ok,
    timestamp: new Date().toISOString(),
  };

  writeOutputFile(outputPath, output);
  console.log(JSON.stringify(output, null, 2));

  if (!output.ok) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  await main(process.argv.slice(2));
}
