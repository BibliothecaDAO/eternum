import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_READY_TIMEOUT_MS = 15_000;
const DEFAULT_SCENARIOS = ["baseline", "stress"];
const DEFAULT_WAIT_MS = 1500;
const DEBUG_ROUTE_PATH = "/debug/three-chunks";
const DEBUG_ROUTE_POLL_MS = 250;
const VALID_SCENARIOS = new Set(["baseline", "dense", "stress"]);

const EXPECTED_SCENARIO_METRICS = {
  baseline: {
    chunkCount: "25",
    hotChunkCount: "1",
    tileCount: "6,400",
  },
  dense: {
    chunkCount: "49",
    hotChunkCount: "9",
    tileCount: "12,544",
  },
  stress: {
    chunkCount: "81",
    hotChunkCount: "9",
    tileCount: "20,736",
  },
};

export function buildRendererDebugSmokeUrl({ baseUrl }) {
  const url = new URL(baseUrl);
  url.pathname = DEBUG_ROUTE_PATH;
  url.search = "";
  return url.toString();
}

export function normalizeDebugScenarios(value) {
  if (!value || value.trim().length === 0) {
    return [...DEFAULT_SCENARIOS];
  }

  const scenarios = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const scenario of scenarios) {
    if (!VALID_SCENARIOS.has(scenario)) {
      throw new Error(
        `Unsupported debug scenario "${scenario}". Expected one of: ${Array.from(VALID_SCENARIOS).join(", ")}`,
      );
    }
  }

  return scenarios;
}

export function evaluateRendererDebugSmokeResult({
  bootShellPresent,
  errors,
  expectedMetrics,
  horizontalOverflow,
  metrics,
  nonBlankCanvas,
  routeMounted,
  webglContextLost,
}) {
  const reasons = [];

  if (!routeMounted) {
    reasons.push("debug route was not mounted");
  }

  if (bootShellPresent) {
    reasons.push("boot shell was still visible");
  }

  if (!nonBlankCanvas) {
    reasons.push("debug canvas was blank");
  }

  if (webglContextLost) {
    reasons.push("WebGL context was lost");
  }

  if (horizontalOverflow) {
    reasons.push("debug route had horizontal overflow");
  }

  if (errors.length > 0) {
    reasons.push(`browser reported ${errors.length} runtime error(s): ${errors[0]}`);
  }

  appendMetricMismatchReason(reasons, "Chunks", metrics.Chunks, expectedMetrics.chunkCount);
  appendMetricMismatchReason(reasons, "Tiles", metrics.Tiles, expectedMetrics.tileCount);
  appendMetricMismatchReason(reasons, "Hot", metrics.Hot, expectedMetrics.hotChunkCount);

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function parseAgentBrowserJson(raw) {
  const parsed = JSON.parse(raw || "null");
  if (typeof parsed === "string") {
    return JSON.parse(parsed);
  }

  return parsed;
}

export function resolveAgentBrowserWorkingDirectory(env = process.env) {
  return env.RUNNER_TEMP || env.TMPDIR || tmpdir();
}

function appendMetricMismatchReason(reasons, label, actual, expected) {
  if (actual !== expected) {
    reasons.push(`${label} metric was ${actual ?? "missing"}, expected ${expected}`);
  }
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

function readFiniteNumberOption(args, name, fallback) {
  const rawValue = readOption(args, name, String(fallback));
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, received "${rawValue}"`);
  }

  return value;
}

function runAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const baseArgs = ["-y", "agent-browser", "--session", session];
  if (headed) {
    baseArgs.push("--headed");
  }

  const result = spawnSync("npx", [...baseArgs, ...commandArgs], {
    cwd: resolveAgentBrowserWorkingDirectory(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser failed for session ${session}`);
  }

  return result.stdout.trim();
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function selectDebugScenario(session, scenario, headed) {
  runAgentBrowser(
    session,
    [
      "eval",
      `(() => {
        const select = document.querySelector('select[aria-label="Debug scenario"]');
        if (!select) return "missing";
        select.value = ${JSON.stringify(scenario)};
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.value;
      })()`,
    ],
    { headed },
  );
}

function readDebugSnapshot(session, headed) {
  const rawSnapshot = runAgentBrowser(
    session,
    [
      "eval",
      `JSON.stringify((() => {
        const canvas = document.getElementById("three-chunk-debug-canvas");
        const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
        const pixel = new Uint8Array(4);

        if (gl) {
          gl.readPixels(
            Math.floor(gl.drawingBufferWidth / 2),
            Math.floor(gl.drawingBufferHeight / 2),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
          );
        }

        return {
          bootShellPresent: Boolean(document.getElementById("boot-shell")),
          canvas: canvas
            ? {
                height: canvas.height,
                width: canvas.width,
              }
            : null,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          metrics: Object.fromEntries(
            Array.from(document.querySelectorAll("dt")).map((label) => [
              label.textContent,
              label.nextElementSibling?.textContent,
            ]),
          ),
          nonBlankCanvas: Array.from(pixel).some((value) => value !== 0),
          routeMounted: Boolean(document.querySelector('[data-debug-route="three-chunks"]')),
          webglContextLost: gl ? gl.isContextLost() : true,
        };
      })())`,
    ],
    { headed },
  );

  return parseAgentBrowserJson(rawSnapshot);
}

function runDebugScenarioSmoke({ headed, scenario, session, waitMs }) {
  selectDebugScenario(session, scenario, headed);
  runAgentBrowser(session, ["wait", String(waitMs)], { headed });

  const snapshot = readDebugSnapshot(session, headed);
  const errors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
  const expectedMetrics = EXPECTED_SCENARIO_METRICS[scenario];
  const evaluation = evaluateRendererDebugSmokeResult({
    ...snapshot,
    errors,
    expectedMetrics,
  });

  return {
    ...evaluation,
    errors,
    expectedMetrics,
    scenario,
    snapshot,
  };
}

function waitForDebugRouteReady({ headed, session, timeoutMs }) {
  const startTime = Date.now();
  let snapshot = readDebugSnapshot(session, headed);

  while (!snapshot.routeMounted && Date.now() - startTime < timeoutMs) {
    runAgentBrowser(session, ["wait", String(DEBUG_ROUTE_POLL_MS)], { headed });
    snapshot = readDebugSnapshot(session, headed);
  }

  return snapshot;
}

function runRendererDebugSmoke({ baseUrl, headed, scenarios, waitMs }) {
  const session = "renderer-debug-smoke";
  const url = buildRendererDebugSmokeUrl({ baseUrl });

  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed });
  const initialSnapshot = waitForDebugRouteReady({
    headed,
    session,
    timeoutMs: DEFAULT_READY_TIMEOUT_MS,
  });

  const openedUrl = runAgentBrowser(session, ["get", "url"], { headed });
  const results = scenarios.map((scenario) =>
    runDebugScenarioSmoke({
      headed,
      scenario,
      session,
      waitMs,
    }),
  );
  const failed = results.filter((result) => !result.ok);

  return {
    ok: failed.length === 0,
    initialSnapshot,
    openedUrl,
    results,
    url,
  };
}

function writeOutputFile(outputPath, summary) {
  if (!outputPath) {
    return;
  }

  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const scenarios = normalizeDebugScenarios(readOption(argv, "--scenarios", ""));
  const waitMs = readFiniteNumberOption(argv, "--wait-ms", DEFAULT_WAIT_MS);
  const headed = readFlag(argv, "--headed");
  const outputPath = readOption(argv, "--output", "");

  const summary = runRendererDebugSmoke({
    baseUrl,
    headed,
    scenarios,
    waitMs,
  });

  writeOutputFile(outputPath, summary);
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main(process.argv.slice(2));
}
