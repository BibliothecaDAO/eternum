import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSceneSmokeUrl, runAgentBrowser } from "../run-renderer-scene-smoke.mjs";
import {
  WORLDMAP_RESOURCE_GROWTH_TOLERANCE,
  evaluateWorldmapTerrainObservation,
  summarizeWorldmapTerrainVerification,
} from "./evaluate-worldmap-terrain.mjs";

const WARM_REVISIT_LOOPS = 3;
const WARM_REVISIT_SETTLE_MS = 350;
const CAPTURE_POLL_MS = 250;
const FIXTURE_IDENTITY = "live-authoritative-worldmap-v2";
const TIMING_POLICY = "informational";
const REQUIRED_SCENARIOS_NOT_EXERCISED = [
  "authoritative boundary exploration",
  "stationary authoritative structure update",
  "close-medium-far-close zoom ladder",
  "network reconnect",
  "world switch",
  "counterpart renderer backend",
  "hardware performance regression comparison",
];
const CONSOLE_FAILURE_PATTERNS = [
  /\b(?:worker|shader|terrain|webgl|webgpu)\b.*\b(?:error|failed|failure|exception)\b/i,
  /\b(?:error|failed|failure|exception)\b.*\b(?:worker|shader|terrain|webgl|webgpu)\b/i,
  /\b(?:uncaught|unhandled rejection)\b/i,
];

const captureScript = `(async () => {
  const [{ getGameNamespace, getScopedGameId }, { getActiveWorld }, { useWorldSlicesStore }] =
    await Promise.all([
      import('/src/sync/game-scope.ts'),
      import('/src/runtime/world/store.ts'),
      import('/src/hooks/store/use-world-slices-store.ts')
    ]);
  const gameRenderer = window.__gameRenderer;
  const worldmap = gameRenderer?.worldmapScene;
  const provider = gameRenderer?.dojo?.network?.provider;
  const contractComponents = gameRenderer?.dojo?.network?.contractComponents;
  const trace = (window.getWorldmapChunkTrace?.() ?? []).slice(-256);
  const latestComposite = trace.findLast?.((entry) => entry.event === 'terrain_composite_rebuilt');
  const terrainCoverage = worldmap?.proceduralTerrain?.getPresentationCoverage?.() ?? null;
  const renderDiagnostics = window.getWorldmapRenderDiagnostics?.() ?? null;
  const rendererMemory = window.__memoryMonitorRenderer?.info?.memory ?? gameRenderer?.renderer?.info?.memory ?? null;
  const activeWorld = getActiveWorld();
  const observation = {
    pathname: location.pathname,
    canvasPresent: Boolean(document.getElementById('main-canvas')),
    cameraTargetHex: worldmap?.getCameraTargetHex?.() ?? null,
    gameIdentity: {
      pathname: location.pathname,
      gameId: provider?.gameId ?? getScopedGameId(),
      namespace: provider?.namespace ?? getGameNamespace(),
      worldAddress: provider?.getWorldAddress?.() ?? activeWorld?.worldAddress ?? null,
      worldName: activeWorld?.name ?? null,
      tileRows: contractComponents?.TileOpt
        ? Array.from(contractComponents.TileOpt.entities?.() ?? []).length
        : renderDiagnostics?.gauges?.worldBiomeSurfaceInstances ?? null,
      structureRows: contractComponents?.Structure
        ? Array.from(contractComponents.Structure.entities?.() ?? []).length
        : useWorldSlicesStore.getState().structures.length
    },
    device: {
      userAgent: navigator.userAgent,
      platform: navigator.platform ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null
    },
    renderer: window.__rendererDiagnostics ?? null,
    renderDiagnostics,
    chunkDiagnostics: window.getWorldmapChunkDiagnostics?.() ?? null,
    trace,
    visualWindow: worldmap?.visualTerrainWindow
      ? {
          centerPageKey: worldmap.visualTerrainWindow.centerPageKey,
          pageKeys: worldmap.visualTerrainWindow.pageKeys.slice(0, 16)
        }
      : null,
    uploads: window.getTerrainUploadMetrics?.() ?? null,
    presents: window.getTerrainPresentMetrics?.() ?? null,
    resourceState: {
      preparedCachePages: latestComposite?.details?.proceduralPreparedCachePages ?? null,
      presentedPageSlots:
        terrainCoverage?.pages?.length ??
        renderDiagnostics?.terrainPresentation?.current?.completePageKeys?.length ??
        null,
      geometries: rendererMemory?.geometries ?? null,
      textures: rendererMemory?.textures ?? null
    }
  };
  return JSON.stringify(observation, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
})()`;

const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (args[index + 1] ?? fallback);
}

function readOptionalInteger(args, name) {
  const value = readOption(args, name, null);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function readConfiguration(args) {
  const worldName = readOption(args, "--world", "");
  if (!worldName) throw new Error("Pass --world with a populated game name; world selection must be explicit.");
  const rendererMode = readOption(args, "--renderer", "webgpu-force-webgl");
  if (!["webgpu-auto", "webgpu-force-webgl"].includes(rendererMode)) {
    throw new Error("Unsupported --renderer");
  }
  const timeoutMs = Number(readOption(args, "--timeout-ms", "60000"));
  const col = Number(readOption(args, "--col", "0"));
  const row = Number(readOption(args, "--row", "0"));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(col) || !Number.isInteger(row)) {
    throw new Error("Invalid timeout or map coordinates");
  }
  const chain = readOption(args, "--chain", "madara");
  const url = createWorldmapUrl({
    baseUrl: readOption(args, "--base-url", "http://127.0.0.1:4175"),
    chain,
    col,
    rendererMode,
    row,
    worldName,
  });
  return {
    artifactDir: resolve(readOption(args, "--artifact-dir", ".context/verification/worldmap-terrain")),
    chain,
    col,
    gameId: readOptionalInteger(args, "--game-id"),
    headed: args.includes("--headed"),
    pathname: new URL(url).pathname,
    rendererMode,
    row,
    session: `worldmap-terrain-${process.pid}`,
    timeoutMs,
    url,
    worldName,
  };
}

function createWorldmapUrl({ baseUrl, chain, col, rendererMode, row, worldName }) {
  const url = new URL(buildSceneSmokeUrl({ baseUrl, chain, worldName, rendererMode, scene: "map" }));
  url.searchParams.set("col", String(col));
  url.searchParams.set("row", String(row));
  return url.toString();
}

function browser(config, args) {
  return runAgentBrowser(config.session, args, { headed: config.headed });
}

function readObservation(config) {
  let result = JSON.parse(redactArtifactText(browser(config, ["eval", captureScript])));
  if (typeof result === "string") result = JSON.parse(result);
  return result;
}

async function waitForTerrain(config, expected) {
  const deadline = Date.now() + config.timeoutMs;
  let observation = null;
  let evaluation = { status: "inconclusive", reasons: ["no observation received"] };
  while (Date.now() < deadline) {
    observation = readObservation(config);
    evaluation = evaluateWorldmapTerrainObservation(observation, expected);
    if (evaluation.status !== "inconclusive") break;
    await pause(CAPTURE_POLL_MS);
  }
  return { observation, evaluation };
}

async function captureScenario(config, scenario) {
  const paths = createScenarioEvidencePaths(config.artifactDir, scenario.name);
  const startedAt = new Date().toISOString();
  let observation = null;
  let evaluation;
  let browserLogs = emptyBrowserLogs();

  try {
    await scenario.action();
    ({ observation, evaluation } = await waitForTerrain(config, expectedObservation(config, scenario)));
  } catch (error) {
    evaluation = inconclusive(`scenario could not complete: ${error.message}`);
  }

  browserLogs = captureBrowserLogs(config);
  if (observation) {
    observation.errors = browserLogs.errors.lines;
    observation.consoleErrors = findBlockingConsoleLines(browserLogs.console.lines);
    evaluation = evaluateWorldmapTerrainObservation(observation, expectedObservation(config, scenario));
  } else if (findBlockingConsoleLines(browserLogs.console.lines).length > 0) {
    evaluation.status = "fail";
    evaluation.reasons.push("browser console reported a worker, shader, or runtime error");
  }
  persistBrowserLogs(paths, browserLogs);
  addLogCaptureFailures(evaluation, browserLogs);
  const screenshot = captureScreenshot(config, paths.screenshot);
  if (!screenshot.available) addInconclusiveReason(evaluation, `screenshot unavailable: ${screenshot.error}`);

  const result = buildScenarioResult(config, scenario, observation, evaluation, paths, screenshot, startedAt);
  writeFileSync(paths.scenario, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function expectedObservation(config, scenario) {
  return {
    cameraTarget: scenario.cameraTarget,
    gameId: config.gameId,
    pathname: config.pathname,
    previousRevision: scenario.previousRevision,
    rendererMode: config.rendererMode,
    resourcePolicy: scenario.resourcePolicy,
    worldName: config.worldName,
  };
}

function createScenarioEvidencePaths(artifactDir, name) {
  return {
    console: join(artifactDir, `${name}.console.log`),
    errors: join(artifactDir, `${name}.errors.log`),
    scenario: join(artifactDir, `${name}.json`),
    screenshot: join(artifactDir, `${name}.png`),
  };
}

function emptyBrowserLogs() {
  return {
    console: { error: null, lines: [], text: "" },
    errors: { error: null, lines: [], text: "" },
  };
}

function captureBrowserLogs(config) {
  return {
    console: readBrowserLog(config, "console"),
    errors: readBrowserLog(config, "errors"),
  };
}

function readBrowserLog(config, command) {
  try {
    const text = redactArtifactText(browser(config, [command]));
    return { error: null, lines: parseBrowserLogLines(text), text };
  } catch (error) {
    return { error: error.message, lines: [], text: "" };
  }
}

function parseBrowserLogLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^no (?:console messages|errors)$/i.test(line));
}

function findBlockingConsoleLines(lines) {
  return lines.filter((line) => CONSOLE_FAILURE_PATTERNS.some((pattern) => pattern.test(line)));
}

function persistBrowserLogs(paths, logs) {
  writeFileSync(paths.console, logs.console.text ? `${logs.console.text}\n` : "");
  writeFileSync(paths.errors, logs.errors.text ? `${logs.errors.text}\n` : "");
}

function addLogCaptureFailures(evaluation, logs) {
  if (logs.console.error) addInconclusiveReason(evaluation, `console log unavailable: ${logs.console.error}`);
  if (logs.errors.error) addInconclusiveReason(evaluation, `browser errors unavailable: ${logs.errors.error}`);
}

function captureScreenshot(config, path) {
  try {
    browser(config, ["screenshot", path]);
    if (!existsSync(path)) return { available: false, error: "browser did not create the screenshot file", path };
    return { available: true, error: null, path };
  } catch (error) {
    return { available: false, error: error.message, path };
  }
}

function addInconclusiveReason(evaluation, reason) {
  evaluation.reasons.push(reason);
  if (evaluation.status === "pass") evaluation.status = "inconclusive";
}

function inconclusive(reason) {
  return { status: "inconclusive", reasons: [reason] };
}

function buildScenarioResult(config, scenario, observation, evaluation, paths, screenshot, startedAt) {
  const current = observation?.renderDiagnostics?.terrainPresentation?.current;
  const trace = observation?.trace ?? [];
  return {
    name: scenario.name,
    ...evaluation,
    startedAt,
    finishedAt: new Date().toISOString(),
    metadata: {
      actualBackend: observation?.renderer?.activeMode ?? null,
      commit: config.revision.commit,
      device: observation?.device ?? null,
      dirty: config.revision.dirty,
      fixtureIdentity: FIXTURE_IDENTITY,
      game: observation?.gameIdentity ?? null,
      requestedCameraTarget: scenario.cameraTarget,
      timingPolicy: TIMING_POLICY,
      traceIdentity: {
        entries: trace.length,
        lastEvent: trace.at(-1)?.event ?? null,
        revision: current?.revision ?? null,
        sceneId: current?.sceneId ?? null,
      },
    },
    evidence: {
      console: paths.console,
      errors: paths.errors,
      scenario: paths.scenario,
      screenshot,
    },
    observation,
  };
}

function moveCamera(config, col, row) {
  browser(config, [
    "eval",
    `window.dispatchEvent(new CustomEvent('minimapCameraMove', { detail: { col: ${col}, row: ${row} } }))`,
  ]);
}

async function runNavigationScenarios(config) {
  const results = [];
  results.push(
    await captureScenario(config, {
      action: () => browser(config, ["open", config.url, "--ignore-https-errors"]),
      cameraTarget: target(config.col, config.row),
      name: "entry",
    }),
  );
  if (results[0].status !== "pass") return results;

  await runDirectedMoves(config, results);
  await runRapidReversal(config, results);
  await runWarmRevisitLoops(config, results);
  await runReloadRecovery(config, results);
  return results;
}

async function runDirectedMoves(config, results) {
  const moves = [
    ["pan-east", 24, 0],
    ["pan-diagonal", 48, 24],
    ["pan-return", 0, 0],
    ["long-jump", 96, 96],
    ["revisit", 0, 0],
  ];
  for (const [name, offsetCol, offsetRow] of moves) {
    const cameraTarget = target(config.col + offsetCol, config.row + offsetRow);
    results.push(
      await captureScenario(config, {
        action: () => moveCamera(config, cameraTarget.col, cameraTarget.row),
        cameraTarget,
        name,
        previousRevision: latestRevision(results),
      }),
    );
  }
}

async function runRapidReversal(config, results) {
  results.push(
    await captureScenario(config, {
      action: async () => {
        moveCamera(config, config.col - 48, config.row - 24);
        await pause(80);
        moveCamera(config, config.col + 48, config.row + 24);
        await pause(80);
        moveCamera(config, config.col, config.row);
      },
      cameraTarget: target(config.col, config.row),
      name: "rapid-reversal",
      previousRevision: latestRevision(results),
    }),
  );
}

async function runWarmRevisitLoops(config, results) {
  let baseline = null;
  for (let loop = 1; loop <= WARM_REVISIT_LOOPS; loop += 1) {
    const result = await captureScenario(config, {
      action: async () => {
        moveCamera(config, config.col + 96, config.row + 96);
        await pause(WARM_REVISIT_SETTLE_MS);
        moveCamera(config, config.col, config.row);
      },
      cameraTarget: target(config.col, config.row),
      name: `warm-revisit-${loop}`,
      previousRevision: latestRevision(results),
      resourcePolicy: {
        baseline,
        tolerance: WORLDMAP_RESOURCE_GROWTH_TOLERANCE,
      },
    });
    results.push(result);
    if (!baseline && result.status === "pass") baseline = measuredRendererResources(result.observation);
  }
}

async function runReloadRecovery(config, results) {
  results.push(
    await captureScenario(config, {
      action: () => browser(config, ["reload"]),
      cameraTarget: target(config.col, config.row),
      name: "reload-recovery",
    }),
  );
}

function measuredRendererResources(observation) {
  const resources = observation?.resourceState;
  if (!Number.isFinite(resources?.geometries) || !Number.isFinite(resources?.textures)) return null;
  return { geometries: resources.geometries, textures: resources.textures };
}

function latestRevision(results) {
  return results.at(-1)?.observation?.renderDiagnostics?.terrainPresentation?.current?.revision;
}

function target(col, row) {
  return { col, row };
}

async function main(args) {
  const parsedConfig = readConfiguration(args);
  const config = { ...parsedConfig, revision: readGitRevision() };
  mkdirSync(config.artifactDir, { recursive: true });
  let results;
  try {
    results = await runNavigationScenarios(config);
  } finally {
    try {
      browser(config, ["close"]);
    } catch {
      // Each scenario already records browser evidence. Closing is best-effort cleanup.
    }
  }

  const summary = buildVerificationSummary(config, results);
  writeFileSync(join(config.artifactDir, "verdict.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        artifactDir: config.artifactDir,
        fullAcceptance: summary.fullAcceptance,
        navigation: summary.navigation,
        results: results.map(({ name, status, reasons }) => ({ name, status, reasons })),
        status: summary.status,
      },
      null,
      2,
    ),
  );
  process.exitCode = summary.exitCode;
}

function readGitRevision() {
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
  };
}

function buildVerificationSummary(config, results) {
  return {
    contractVersion: 2,
    commit: config.revision.commit,
    dirty: config.revision.dirty,
    fixtureIdentity: FIXTURE_IDENTITY,
    game: {
      chain: config.chain,
      expectedGameId: config.gameId ?? null,
      worldName: config.worldName,
    },
    notExercised: REQUIRED_SCENARIOS_NOT_EXERCISED,
    requestedBackend: config.rendererMode,
    scope: "live-navigation",
    timingPolicy: TIMING_POLICY,
    ...summarizeWorldmapTerrainVerification(results, {
      notExercised: REQUIRED_SCENARIOS_NOT_EXERCISED,
    }),
  };
}

function redactArtifactText(text) {
  return String(text)
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, "$1<REDACTED>")
    .replace(/([?&](?:access_token|token|api_key)=)[^&\s]+/gi, "$1<REDACTED>")
    .replace(/((?:private[_ -]?key|secret)\s*[:=]\s*)[^\s,"']+/gi, "$1<REDACTED>");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
