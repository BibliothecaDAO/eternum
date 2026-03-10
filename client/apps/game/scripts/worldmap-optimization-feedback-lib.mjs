import { createServer } from "node:net";

const DEFAULT_FEEDBACK_THRESHOLDS = Object.freeze({
  frameP95RegressionFraction: 0.15,
  chunkSwitchP95RegressionFraction: 0.15,
  jsHeapRegressionFraction: 0.1,
  metricP95RegressionFraction: 0.25,
  maxReportedMetricRegressions: 5,
});

const DEFAULT_MANAGED_BASE_URL = "https://127.0.0.1:4173";
const VALID_SPECTATOR_CHAINS = new Set(["mainnet", "sepolia", "slot", "slottest", "local"]);

function clampPercentile(percentile) {
  return Math.max(0, Math.min(1, percentile));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function formatNumber(value, unit = "") {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${unit}`;
}

function formatPercent(value) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return `${Math.round(value * 1000) / 10}%`;
}

function getNearestRankPercentile(samples, percentile) {
  if (!Array.isArray(samples)) {
    return null;
  }

  const finiteSamples = samples.filter((value) => isFiniteNumber(value) && value >= 0).sort((a, b) => a - b);
  if (finiteSamples.length === 0) {
    return null;
  }

  const rank = Math.max(1, Math.ceil(clampPercentile(percentile) * finiteSamples.length));
  return finiteSamples[rank - 1] ?? finiteSamples[finiteSamples.length - 1] ?? null;
}

function safeObjectEntries(value) {
  return value && typeof value === "object" ? Object.entries(value) : [];
}

async function isPortAvailable(hostname, port) {
  return await new Promise((resolve) => {
    const server = createServer();
    server.unref();

    server.once("error", () => {
      resolve(false);
    });

    server.listen({ host: hostname, port }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

export async function resolveManagedWorldmapBaseUrl({
  preferredBaseUrl = DEFAULT_MANAGED_BASE_URL,
  maxPortScan = 20,
} = {}) {
  const preferredUrl = new URL(preferredBaseUrl);
  const startingPort = Number(preferredUrl.port || (preferredUrl.protocol === "https:" ? "443" : "80"));

  if (!Number.isInteger(startingPort) || startingPort <= 0) {
    throw new Error(`Unable to resolve a port from managed base URL: ${preferredBaseUrl}`);
  }

  for (let offset = 0; offset <= maxPortScan; offset += 1) {
    const candidatePort = startingPort + offset;
    const available = await isPortAvailable(preferredUrl.hostname, candidatePort);
    if (!available) {
      continue;
    }

    const candidateUrl = new URL(preferredUrl.toString());
    candidateUrl.port = String(candidatePort);
    return candidateUrl.toString().replace(/\/$/, "");
  }

  throw new Error(
    `Unable to find an open port for the worldmap benchmark web server starting at ${preferredBaseUrl}.`,
  );
}

function parseSimpleEnvFile(envContents) {
  return Object.fromEntries(
    envContents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const rawValue = line.slice(index + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

function extractCartridgeWorldName(urlValue) {
  if (!urlValue) {
    return null;
  }

  try {
    const parsed = new URL(urlValue);
    const match = parsed.pathname.match(/\/x\/([^/]+)\//i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function deriveWorldmapSpectatorDefaults({
  envContents = "",
  worldName = null,
  worldChain = null,
} = {}) {
  const parsedEnv = parseSimpleEnvFile(envContents);
  const derivedWorldName =
    worldName ??
    extractCartridgeWorldName(parsedEnv.VITE_PUBLIC_TORII) ??
    extractCartridgeWorldName(parsedEnv.VITE_PUBLIC_NODE_URL);
  const derivedWorldChain =
    worldChain ??
    (VALID_SPECTATOR_CHAINS.has(parsedEnv.VITE_PUBLIC_CHAIN) ? parsedEnv.VITE_PUBLIC_CHAIN : null);

  return {
    worldName: derivedWorldName,
    worldChain: derivedWorldChain,
    probeUrl: parsedEnv.VITE_PUBLIC_NODE_URL ?? parsedEnv.VITE_PUBLIC_TORII ?? null,
    toriiUrl: parsedEnv.VITE_PUBLIC_TORII ?? null,
    rpcUrl: parsedEnv.VITE_PUBLIC_NODE_URL ?? null,
    slotName: parsedEnv.VITE_PUBLIC_SLOT ?? null,
  };
}

function extractMetricP95s(metrics) {
  return Object.fromEntries(
    safeObjectEntries(metrics)
      .map(([metricName, summary]) => [metricName, summary?.p95])
      .filter(([, value]) => isFiniteNumber(value)),
  );
}

export function buildWorldmapBenchmarkSummary(run) {
  const terrainOnlySnapshot = run?.terrainOnly?.snapshot ?? {};
  const terrainAndUnitsSnapshot = run?.terrainAndUnits?.snapshot ?? {};

  return {
    metadata: run?.metadata ?? null,
    terrainOnly: summarizeScenario("terrain-only", terrainOnlySnapshot),
    terrainAndUnits: summarizeScenario("terrain-plus-units", terrainAndUnitsSnapshot),
    consoleMessageCount: Array.isArray(run?.consoleMessages) ? run.consoleMessages.length : 0,
    pageErrorCount: Array.isArray(run?.pageErrors) ? run.pageErrors.length : 0,
  };
}

function summarizeScenario(label, snapshot) {
  return {
    label,
    frameP95Ms: normalizeMaybeNumber(snapshot?.performance?.frameTime?.p95),
    chunkSwitchP95Ms: getNearestRankPercentile(snapshot?.diagnostics?.diagnostics?.switchDurationMsSamples, 0.95),
    jsHeapUsedMB: normalizeMaybeNumber(snapshot?.performance?.memory?.jsHeap?.usedMB),
    matrixPoolMemoryMB: normalizeMaybeNumber(snapshot?.performance?.memory?.matrixPool?.memoryMB),
    debugArmyCount: normalizeMaybeInteger(snapshot?.state?.debugArmies?.debugArmyCount),
    metricP95s: extractMetricP95s(snapshot?.performance?.metrics),
  };
}

function normalizeMaybeNumber(value) {
  return isFiniteNumber(value) ? value : null;
}

function normalizeMaybeInteger(value) {
  return Number.isInteger(value) ? value : null;
}

function getRegressionFraction(baselineValue, currentValue) {
  if (!isFiniteNumber(baselineValue) || !isFiniteNumber(currentValue)) {
    return null;
  }

  if (baselineValue <= 0) {
    return currentValue <= 0 ? 0 : null;
  }

  return (currentValue - baselineValue) / baselineValue;
}

function createRegressionCheck({
  key,
  label,
  baselineValue,
  currentValue,
  allowedRegressionFraction,
  baselineAvailable,
}) {
  if (!baselineAvailable) {
    return {
      key,
      label,
      status: "missing-baseline",
      currentValue: currentValue ?? null,
      baselineValue: null,
      allowedRegressionFraction,
      regressionFraction: null,
      deltaValue: null,
    };
  }

  const regressionFraction = getRegressionFraction(baselineValue, currentValue);
  const deltaValue =
    isFiniteNumber(currentValue) && isFiniteNumber(baselineValue) ? round(currentValue - baselineValue, 4) : null;

  if (regressionFraction === null) {
    return {
      key,
      label,
      status: "unavailable",
      currentValue: currentValue ?? null,
      baselineValue: baselineValue ?? null,
      allowedRegressionFraction,
      regressionFraction: null,
      deltaValue,
    };
  }

  return {
    key,
    label,
    status: regressionFraction > allowedRegressionFraction ? "regression" : "pass",
    currentValue: currentValue ?? null,
    baselineValue: baselineValue ?? null,
    allowedRegressionFraction,
    regressionFraction: round(regressionFraction),
    deltaValue,
  };
}

function collectMetricRegressions({
  baselineMetrics,
  currentMetrics,
  allowedRegressionFraction,
  maxReportedMetricRegressions,
}) {
  const regressions = [];

  for (const [metricName, currentValue] of safeObjectEntries(currentMetrics)) {
    const baselineValue = baselineMetrics?.[metricName];
    const regressionFraction = getRegressionFraction(baselineValue, currentValue);

    if (regressionFraction === null || regressionFraction <= allowedRegressionFraction) {
      continue;
    }

    regressions.push({
      metricName,
      currentValue,
      baselineValue,
      regressionFraction: round(regressionFraction),
      deltaValue: round(currentValue - baselineValue, 4),
    });
  }

  regressions.sort((left, right) => {
    const rightFraction = right.regressionFraction ?? Number.NEGATIVE_INFINITY;
    const leftFraction = left.regressionFraction ?? Number.NEGATIVE_INFINITY;
    return rightFraction - leftFraction;
  });

  return regressions.slice(0, Math.max(0, maxReportedMetricRegressions));
}

export function compareWorldmapBenchmarkRuns(input) {
  const thresholds = {
    ...DEFAULT_FEEDBACK_THRESHOLDS,
    ...(input?.thresholds ?? {}),
  };
  const baselineAvailable = input?.baseline != null;
  const currentSummary = buildWorldmapBenchmarkSummary(input?.current ?? null);
  const baselineSummary = baselineAvailable ? buildWorldmapBenchmarkSummary(input.baseline) : null;

  const topMetricRegressions = baselineAvailable
    ? collectMetricRegressions({
        baselineMetrics: baselineSummary?.terrainAndUnits?.metricP95s ?? {},
        currentMetrics: currentSummary.terrainAndUnits.metricP95s,
        allowedRegressionFraction: thresholds.metricP95RegressionFraction,
        maxReportedMetricRegressions: thresholds.maxReportedMetricRegressions,
      })
    : [];

  const checks = [
    createRegressionCheck({
      key: "frame-p95-ms",
      label: "Frame p95",
      baselineAvailable,
      baselineValue: baselineSummary?.terrainAndUnits?.frameP95Ms ?? null,
      currentValue: currentSummary.terrainAndUnits.frameP95Ms,
      allowedRegressionFraction: thresholds.frameP95RegressionFraction,
    }),
    createRegressionCheck({
      key: "chunk-switch-p95-ms",
      label: "Chunk switch p95",
      baselineAvailable,
      baselineValue: baselineSummary?.terrainAndUnits?.chunkSwitchP95Ms ?? null,
      currentValue: currentSummary.terrainAndUnits.chunkSwitchP95Ms,
      allowedRegressionFraction: thresholds.chunkSwitchP95RegressionFraction,
    }),
    createRegressionCheck({
      key: "js-heap-used-mb",
      label: "JS heap used",
      baselineAvailable,
      baselineValue: baselineSummary?.terrainAndUnits?.jsHeapUsedMB ?? null,
      currentValue: currentSummary.terrainAndUnits.jsHeapUsedMB,
      allowedRegressionFraction: thresholds.jsHeapRegressionFraction,
    }),
    baselineAvailable
      ? {
          key: "metric-p95-hotspots",
          label: "Hot metric regressions",
          status: topMetricRegressions.length > 0 ? "regression" : "pass",
          currentValue: topMetricRegressions.length,
          baselineValue: 0,
          allowedRegressionFraction: thresholds.metricP95RegressionFraction,
          regressionFraction: topMetricRegressions.length > 0 ? 1 : 0,
          deltaValue: topMetricRegressions.length,
        }
      : {
          key: "metric-p95-hotspots",
          label: "Hot metric regressions",
          status: "missing-baseline",
          currentValue: 0,
          baselineValue: null,
          allowedRegressionFraction: thresholds.metricP95RegressionFraction,
          regressionFraction: null,
          deltaValue: null,
        },
  ];

  const hasRegression = checks.some((check) => check.status === "regression");

  return {
    status: baselineAvailable ? (hasRegression ? "regression" : "pass") : "missing-baseline",
    thresholds,
    baseline: baselineSummary,
    current: currentSummary,
    checks,
    topMetricRegressions,
  };
}

export function formatWorldmapOptimizationFeedback(result) {
  const lines = [];
  const currentSummary = result?.current?.terrainAndUnits ?? {};
  const baselineSummary = result?.baseline?.terrainAndUnits ?? null;

  lines.push("# Worldmap Optimization Feedback");
  lines.push(`Status: ${result?.status ?? "unknown"}`);
  lines.push("");
  lines.push(
    `Current terrain+units: frame p95 ${formatNumber(currentSummary.frameP95Ms, "ms")}, chunk switch p95 ${formatNumber(currentSummary.chunkSwitchP95Ms, "ms")}, JS heap ${formatNumber(currentSummary.jsHeapUsedMB, "MB")}`,
  );

  if (baselineSummary) {
    lines.push(
      `Baseline terrain+units: frame p95 ${formatNumber(baselineSummary.frameP95Ms, "ms")}, chunk switch p95 ${formatNumber(baselineSummary.chunkSwitchP95Ms, "ms")}, JS heap ${formatNumber(baselineSummary.jsHeapUsedMB, "MB")}`,
    );
  } else {
    lines.push("Baseline: not recorded yet. Re-run with baseline update enabled to seed the loop.");
  }

  lines.push("");
  lines.push("Checks");
  for (const check of result?.checks ?? []) {
    lines.push(
      `- ${check.label}: ${check.status} (current ${formatNumber(check.currentValue, check.key.endsWith("-mb") ? "MB" : check.key.includes("-ms") ? "ms" : "")}, baseline ${formatNumber(check.baselineValue, check.key.endsWith("-mb") ? "MB" : check.key.includes("-ms") ? "ms" : "")}, delta ${formatNumber(check.deltaValue, check.key.endsWith("-mb") ? "MB" : check.key.includes("-ms") ? "ms" : "")}, limit ${formatPercent(check.allowedRegressionFraction)})`,
    );
  }

  if ((result?.topMetricRegressions?.length ?? 0) > 0) {
    lines.push("");
    lines.push("Top Hotspots");
    for (const hotspot of result.topMetricRegressions) {
      lines.push(
        `- ${hotspot.metricName}: p95 ${formatNumber(hotspot.currentValue, "ms")} vs ${formatNumber(hotspot.baselineValue, "ms")} (${formatPercent(hotspot.regressionFraction)})`,
      );
    }
  }

  return lines.join("\n");
}

export { DEFAULT_FEEDBACK_THRESHOLDS };
