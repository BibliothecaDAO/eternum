import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareWorldmapBenchmarkRuns,
  DEFAULT_FEEDBACK_THRESHOLDS,
  deriveWorldmapSpectatorDefaults,
  formatWorldmapOptimizationFeedback,
  resolveManagedWorldmapBaseUrl,
} from "./worldmap-optimization-feedback-lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = resolve(__dirname, "..");

function printUsage() {
  console.log(`Usage: node ./scripts/worldmap-optimization-feedback.mjs [options]

Options:
  --update-baseline        Replace the saved baseline with the latest benchmark run
  --headed                 Run Playwright headed
  --skip-web-server        Reuse an already-running local game app instead of letting Playwright launch Vite
  --base-url <url>         Override PLAYWRIGHT_BASE_URL for the benchmark target
  --baseline <path>        Override baseline path
  --output-dir <path>      Override output directory
  --debug-armies <count>   Override WORLDMAP_DEBUG_ARMY_COUNT
  --sweep-iterations <n>   Override WORLDMAP_SWEEP_ITERATIONS
  --frame-budget-ms <n>    Override WORLDMAP_FRAME_P95_BUDGET_MS
  --switch-budget-ms <n>   Override WORLDMAP_SWITCH_P95_BUDGET_MS
  --frame-threshold <n>    Allowed frame p95 regression fraction
  --chunk-threshold <n>    Allowed chunk switch p95 regression fraction
  --heap-threshold <n>     Allowed JS heap regression fraction
  --metric-threshold <n>   Allowed per-metric p95 regression fraction
  --max-hotspots <n>       Maximum regressed metrics to report
  --help                   Show this help
`);
}

function parseArgs(argv) {
  const options = {
    updateBaseline: false,
    headed: false,
    skipWebServer: false,
    baseUrl: null,
    baselinePath: resolve(appDir, "benchmarks/worldmap-performance.baseline.json"),
    outputDir: resolve(appDir, "output/playwright/worldmap-optimization-loop"),
    debugArmies: null,
    sweepIterations: null,
    frameBudgetMs: null,
    switchBudgetMs: null,
    thresholds: {
      ...DEFAULT_FEEDBACK_THRESHOLDS,
    },
  };

  const readValue = (index, flag) => {
    const inline = argv[index].includes("=") ? argv[index].split("=").slice(1).join("=") : null;
    if (inline !== null && inline.length > 0) {
      return { value: inline, nextIndex: index };
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }

    return { value: nextValue, nextIndex: index + 1 };
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--update-baseline") {
      options.updateBaseline = true;
      continue;
    }

    if (arg === "--headed") {
      options.headed = true;
      continue;
    }

    if (arg === "--skip-web-server") {
      options.skipWebServer = true;
      continue;
    }

    if (
      arg.startsWith("--baseline") ||
      arg.startsWith("--base-url") ||
      arg.startsWith("--output-dir") ||
      arg.startsWith("--debug-armies") ||
      arg.startsWith("--sweep-iterations") ||
      arg.startsWith("--frame-budget-ms") ||
      arg.startsWith("--switch-budget-ms") ||
      arg.startsWith("--frame-threshold") ||
      arg.startsWith("--chunk-threshold") ||
      arg.startsWith("--heap-threshold") ||
      arg.startsWith("--metric-threshold") ||
      arg.startsWith("--max-hotspots")
    ) {
      const { value, nextIndex } = readValue(index, arg.split("=")[0]);
      index = nextIndex;

      switch (true) {
        case arg.startsWith("--baseline"):
          options.baselinePath = resolve(appDir, value);
          break;
        case arg.startsWith("--base-url"):
          options.baseUrl = value;
          break;
        case arg.startsWith("--output-dir"):
          options.outputDir = resolve(appDir, value);
          break;
        case arg.startsWith("--debug-armies"):
          options.debugArmies = parseNumberFlag(value, "--debug-armies");
          break;
        case arg.startsWith("--sweep-iterations"):
          options.sweepIterations = parseNumberFlag(value, "--sweep-iterations");
          break;
        case arg.startsWith("--frame-budget-ms"):
          options.frameBudgetMs = parseNumberFlag(value, "--frame-budget-ms");
          break;
        case arg.startsWith("--switch-budget-ms"):
          options.switchBudgetMs = parseNumberFlag(value, "--switch-budget-ms");
          break;
        case arg.startsWith("--frame-threshold"):
          options.thresholds.frameP95RegressionFraction = parseNumberFlag(value, "--frame-threshold");
          break;
        case arg.startsWith("--chunk-threshold"):
          options.thresholds.chunkSwitchP95RegressionFraction = parseNumberFlag(value, "--chunk-threshold");
          break;
        case arg.startsWith("--heap-threshold"):
          options.thresholds.jsHeapRegressionFraction = parseNumberFlag(value, "--heap-threshold");
          break;
        case arg.startsWith("--metric-threshold"):
          options.thresholds.metricP95RegressionFraction = parseNumberFlag(value, "--metric-threshold");
          break;
        case arg.startsWith("--max-hotspots"):
          options.thresholds.maxReportedMetricRegressions = Math.max(
            0,
            Math.floor(parseNumberFlag(value, "--max-hotspots")),
          );
          break;
        default:
          throw new Error(`Unknown option: ${arg}`);
      }

      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function parseNumberFlag(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }
  return parsed;
}

function buildRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toRepoRelative(filePath) {
  return relative(appDir, filePath) || ".";
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function applySpectatorDefaults(env) {
  if (env.WORLDMAP_SPECTATOR_WORLD && env.WORLDMAP_SPECTATOR_CHAIN) {
    return;
  }

  const envCandidates = [".env.local", ".env.slot", ".env.mainnet", ".env.sepolia", ".env.slottest"];

  for (const envFilename of envCandidates) {
    const envPath = resolve(appDir, envFilename);
    if (!existsSync(envPath)) {
      continue;
    }

    const envContents = await readFile(envPath, "utf8");
    const defaults = deriveWorldmapSpectatorDefaults({
      envContents,
      worldName: env.WORLDMAP_SPECTATOR_WORLD ?? null,
      worldChain: env.WORLDMAP_SPECTATOR_CHAIN ?? null,
    });

    if (!defaults.worldName && !defaults.worldChain) {
      continue;
    }

    if (defaults.probeUrl && !(await isWorldmapTargetReachable(defaults.probeUrl))) {
      continue;
    }

    if (!env.WORLDMAP_SPECTATOR_WORLD && defaults.worldName) {
      env.WORLDMAP_SPECTATOR_WORLD = defaults.worldName;
    }

    if (!env.WORLDMAP_SPECTATOR_CHAIN && defaults.worldChain) {
      env.WORLDMAP_SPECTATOR_CHAIN = defaults.worldChain;
    }

    if (defaults.worldChain) {
      env.VITE_PUBLIC_CHAIN = defaults.worldChain;
    }

    if (defaults.toriiUrl) {
      env.VITE_PUBLIC_TORII = defaults.toriiUrl;
    }

    if (defaults.rpcUrl) {
      env.VITE_PUBLIC_NODE_URL = defaults.rpcUrl;
    }

    if (defaults.slotName) {
      env.VITE_PUBLIC_SLOT = defaults.slotName;
    } else if (defaults.worldChain === "slot" || defaults.worldChain === "slottest") {
      env.VITE_PUBLIC_SLOT = defaults.worldName;
    }

    return;
  }
}

async function isWorldmapTargetReachable(probeUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      signal: controller.signal,
    });
    return response.status !== 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function writePrettyJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function appendArtifactsSection(report, artifactPaths) {
  const lines = [report, "", "Artifacts"];

  for (const [label, filePath] of Object.entries(artifactPaths)) {
    if (!filePath) {
      continue;
    }

    lines.push(`- ${label}: ${toRepoRelative(filePath)}`);
  }

  return lines.join("\n");
}

async function runPlaywrightBenchmark({ headed, env }) {
  const args = ["exec", "playwright", "test", "e2e/worldmap-performance.spec.ts", "--project=chromium"];
  if (headed) {
    args.push("--headed");
  }

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("pnpm", args, {
      cwd: appDir,
      env,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runId = buildRunId();
  const runDir = join(options.outputDir, runId);
  const rawResultPath = join(runDir, "worldmap-benchmark.json");
  const screenshotPath = join(runDir, "worldmap-benchmark.png");
  const comparisonJsonPath = join(runDir, "worldmap-feedback.json");
  const comparisonMarkdownPath = join(runDir, "worldmap-feedback.md");

  await mkdir(runDir, { recursive: true });

  const env = {
    ...process.env,
    PATH: `/Users/os/Library/pnpm:${process.env.PATH ?? ""}`,
    WORLDMAP_BENCHMARK_OUTPUT_PATH: rawResultPath,
    WORLDMAP_BENCHMARK_SCREENSHOT_PATH: screenshotPath,
  };

  if (options.skipWebServer) {
    env.PLAYWRIGHT_SKIP_WEB_SERVER = "1";
  }

  if (options.baseUrl) {
    env.PLAYWRIGHT_BASE_URL = options.baseUrl;
  } else if (!options.skipWebServer) {
    env.PLAYWRIGHT_BASE_URL = await resolveManagedWorldmapBaseUrl({
      preferredBaseUrl: process.env.PLAYWRIGHT_BASE_URL,
    });
  }

  if (options.debugArmies !== null) {
    env.WORLDMAP_DEBUG_ARMY_COUNT = String(options.debugArmies);
  }

  if (options.sweepIterations !== null) {
    env.WORLDMAP_SWEEP_ITERATIONS = String(options.sweepIterations);
  }

  if (options.frameBudgetMs !== null) {
    env.WORLDMAP_FRAME_P95_BUDGET_MS = String(options.frameBudgetMs);
  }

  if (options.switchBudgetMs !== null) {
    env.WORLDMAP_SWITCH_P95_BUDGET_MS = String(options.switchBudgetMs);
  }

  await applySpectatorDefaults(env);

  if (!options.skipWebServer && env.PLAYWRIGHT_BASE_URL) {
    console.log(`Managed benchmark server: ${env.PLAYWRIGHT_BASE_URL}`);
  }

  if (env.WORLDMAP_SPECTATOR_WORLD && env.WORLDMAP_SPECTATOR_CHAIN) {
    console.log(`Benchmark spectator target: ${env.WORLDMAP_SPECTATOR_WORLD} (${env.WORLDMAP_SPECTATOR_CHAIN})`);
  }

  const benchmarkExitCode = await runPlaywrightBenchmark({
    headed: options.headed,
    env,
  });

  if (!existsSync(rawResultPath)) {
    throw new Error(
      `Benchmark run did not emit ${toRepoRelative(rawResultPath)}. Check the Playwright output above for the failing step.`,
    );
  }

  const currentRun = await readJson(rawResultPath);
  const baselineRun = existsSync(options.baselinePath) ? await readJson(options.baselinePath) : null;
  const shouldWriteBaseline = options.updateBaseline && benchmarkExitCode === 0;
  const baselineArtifactPath = existsSync(options.baselinePath) || shouldWriteBaseline ? options.baselinePath : null;
  const comparison = compareWorldmapBenchmarkRuns({
    baseline: baselineRun,
    current: currentRun,
    thresholds: options.thresholds,
  });

  const comparisonPayload = {
    runId,
    benchmarkExitCode,
    generatedAt: new Date().toISOString(),
    baselinePath: baselineArtifactPath ? toRepoRelative(baselineArtifactPath) : null,
    rawResultPath: toRepoRelative(rawResultPath),
    screenshotPath: existsSync(screenshotPath) ? toRepoRelative(screenshotPath) : null,
    ...comparison,
  };
  const comparisonReport = appendArtifactsSection(formatWorldmapOptimizationFeedback(comparison), {
    "Raw benchmark": rawResultPath,
    Screenshot: existsSync(screenshotPath) ? screenshotPath : null,
    "Feedback JSON": comparisonJsonPath,
    Baseline: baselineArtifactPath,
  });

  await writePrettyJson(comparisonJsonPath, comparisonPayload);
  await mkdir(dirname(comparisonMarkdownPath), { recursive: true });
  await writeFile(comparisonMarkdownPath, `${comparisonReport}\n`, "utf8");

  if (shouldWriteBaseline) {
    await writePrettyJson(options.baselinePath, currentRun);
  }

  console.log(comparisonReport);
  if (shouldWriteBaseline) {
    console.log(`\nBaseline updated: ${toRepoRelative(options.baselinePath)}`);
  } else if (options.updateBaseline) {
    console.log("\nBaseline not updated because the benchmark run did not complete successfully.");
  }

  if (benchmarkExitCode !== 0) {
    process.exit(benchmarkExitCode);
  }

  if (comparison.status === "regression" && !options.updateBaseline) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
