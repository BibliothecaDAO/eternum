import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { availableParallelism, loadavg, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The client playtest: boots the real client in a browser on the machine's GPU, plays it the way a player does, and
 * leaves the evidence — per-step screenshots, a timing transcript per run, the console, a summary across runs. Boot
 * is gated (entry-ready, world-interactive, renderer fallbacks); the play steps are measured, not gated.
 */

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS_DIR, "../../..");
const PROBE_PATH = join(SCRIPTS_DIR, "client-playtest-probe.js");

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_ITERATIONS = 3;
const DEFAULT_RENDERER_MODES = ["webgpu-auto", "webgpu-force-webgl"];
const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const RENDERER_STALL_THRESHOLD_MS = 7_000;
// Above this one-minute load average the machine, not the client, sets the numbers: such a run is not evidence.
const MAX_LOAD_AVERAGE = 12;
const JANK_FRAME_MS = 1000 / 30;
// The discrete inputs a player feels; pointer enter/leave and hover events would only repeat the click's numbers.
const TIMED_INPUTS = new Set(["click", "keydown", "pointerdown", "wheel"]);
const VIEWPORT = { width: 1920, height: 1080 };
// The home page's call to action: Resume for a player already in the live game, Play free for one who is not.
const PLAYER_ENTRY_BUTTONS = ["Resume", "Play free"];
const SELECT_ARMY = ["find", "role", "button", "click", "--name", "Army 1", "--exact"];
// The army's six neighbours on screen, in pixels from the centre, at the map's default zoom (a player run never zooms).
const NEIGHBOUR_OFFSETS = [
  [65, -95],
  [70, 100],
  [-67, -95],
  [-75, 100],
  [137, 0],
  [-135, 0],
];
const ARMY_FLIGHT_MS = 1_500;
const BURST_PACE_MS = 250;
// The machine's GPU through Vulkan (headless Chrome otherwise renders on SwiftShader), WebGPU as Windows and macOS
// players get it, a callable gc for retained-heap reads, and unrounded heap sizes.
const BROWSER_ARGS = [
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--use-angle=vulkan",
  "--enable-features=Vulkan",
  "--enable-unsafe-webgpu",
  "--js-flags=--expose-gc",
  "--enable-precise-memory-info",
];
const AGENT_BROWSER_RETRIES = 2;
const AGENT_BROWSER_RETRY_DELAY_MS = 2_000;
const RETRYABLE_COMMANDS = new Set(["console", "errors", "eval", "screenshot"]);
const TRANSIENT_FAILURE_PATTERNS = [
  "CDP command timed out",
  "Failed to read: Resource temporarily unavailable",
  "daemon may be busy or unresponsive",
];
const BOOT_METRIC_NAMES = [
  "worldInteractiveMs",
  "firstByteToPlayableMs",
  "enterClickToPlayableMs",
  "entryReadyMs",
  "rendererInitMs",
  "rendererBackendAwaitMs",
  "webgpuModuleImportMs",
  "webgpuRendererInitMs",
  "backendTotalMs",
];

/** What a spectator does: look at the realm, open the map, move the camera, select, read the menu, switch scenes, watch. */
const SPECTATOR_STEPS = [
  { name: "realm-idle", settleMs: 8_000 },
  { name: "open-map", actions: [["find", "role", "button", "click", "--name", "Map", "--exact"]], settleMs: 8_000 },
  { name: "map-idle", settleMs: 10_000 },
  {
    name: "pan",
    actions: [["eval", `void window.__playtest.pan(["KeyD","KeyS","KeyA","KeyW","KeyD","KeyS","KeyA","KeyW"], 2000)`]],
    settleMs: 17_000,
  },
  { name: "zoom", actions: [["eval", "void window.__playtest.zoom(8)"]], settleMs: 4_000 },
  { name: "select-army", actions: [["press", "Tab"]], settleMs: 4_000 },
  {
    name: "menu",
    actions: [
      ["find", "role", "button", "click", "--name", "Menu", "--exact"],
      ["wait", "1500"],
      ["find", "role", "button", "click", "--name", "Season", "--exact"],
      ["wait", "2000"],
      ["press", "Escape"],
    ],
    settleMs: 2_000,
  },
  { name: "open-realm", actions: [["find", "role", "button", "click", "--name", "Realm", "--exact"]], settleMs: 8_000 },
  {
    name: "return-to-map",
    actions: [["find", "role", "button", "click", "--name", "Map", "--exact"]],
    settleMs: 8_000,
  },
  { name: "steady", settleMs: 60_000 },
];

/**
 * What a signed-in player does: look at the realm, open the map, select the army, explore two tiles one by one, then
 * give five orders at a spamming player's pace. Orders tap a tile beside the army, which selecting it centres.
 */
const PLAYER_STEPS = [
  { name: "realm-idle", settleMs: 8_000 },
  { name: "open-map", actions: [["find", "role", "button", "click", "--name", "Map", "--exact"]], settleMs: 6_000 },
  { name: "select-army", actions: [SELECT_ARMY], settleMs: 3_000 },
  { name: "explore-1", play: (browser) => placeOrderBesideArmy(browser), settleMs: 6_000 },
  { name: "explore-2", play: (browser) => placeOrderBesideArmy(browser), settleMs: 6_000 },
  { name: "order-burst", play: (browser) => placeOrderBurst(browser, 5), settleMs: 10_000 },
];

export function buildPlaytestUrl({ baseUrl, chainId, gameId, rendererMode }) {
  if (!chainId || !gameId) {
    throw new Error("buildPlaytestUrl requires a chainId and a gameId");
  }
  const url = new URL(baseUrl);
  url.pathname = `/g/${chainId}/${gameId}/map`;
  url.searchParams.set("spectate", "true");
  url.searchParams.set("rendererMode", rendererMode);
  // Measure what players run: the dev overlays stay off even if this browser profile once enabled them.
  url.searchParams.set("dev", "0");
  return url.toString();
}

/** A player starts on the home page, signed in by the browser profile, and enters with its call to action. */
function buildPlayerHomeUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.searchParams.set("rendererMode", rendererMode);
  url.searchParams.set("dev", "0");
  return url.toString();
}

/**
 * Waits for the home page's call to action, closing what opens over it (the latest-features list) as a player would,
 * then marks the moment of the click, so boot is measured from the player's own action.
 */
async function enterAsPlayer(browser, timeoutMs) {
  const startedAt = Date.now();
  let entry = null;
  while (!(entry = PLAYER_ENTRY_BUTTONS.find((name) => JSON.parse(browser.eval(buttonExistsExpression(name)))))) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`No ${PLAYER_ENTRY_BUTTONS.join(" or ")} on the home page`);
    browser.run(["press", "Escape"]);
    await sleep(POLL_INTERVAL_MS);
  }
  const clicked = JSON.parse(browser.eval(`window.__playtest.step("enter")`));
  browser.run(["find", "role", "button", "click", "--name", entry, "--exact"]);
  return { ...clicked, entry };
}

const buttonExistsExpression = (name) =>
  `JSON.stringify([...document.querySelectorAll("button")].some((button) => button.textContent.trim().startsWith(${JSON.stringify(name)})))`;

/** The newest live game of the first active shard in the directory the client itself reads. */
export function selectPlaytestGame(directory) {
  for (const shard of directory?.shards ?? []) {
    if (shard.status !== "active") continue;
    const [newest] = (shard.games ?? [])
      .filter((game) => game.status === "Live")
      .toSorted((left, right) => Number(right.game_id) - Number(left.game_id));
    if (newest) return { chainId: shard.chainId, gameId: Number(newest.game_id), mode: newest.mode };
  }
  return null;
}

async function resolvePlaytestGame({ baseUrl, chainId, gameId }) {
  if (chainId && gameId) return { chainId, gameId, mode: null };
  const game = selectPlaytestGame(await readLocalJson(new URL("/api/directory", baseUrl)));
  if (!game) throw new Error("No live game in the directory: pass --chain-id and --game-id.");
  return game;
}

/** The dev server proxies /api to the environment's directory behind its local mkcert certificate. */
function readLocalJson(url) {
  return new Promise((resolvePromise, reject) => {
    const request = https.get(url, { rejectUnauthorized: false, timeout: 10_000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () =>
        response.statusCode === 200
          ? resolvePromise(JSON.parse(body))
          : reject(new Error(`Game discovery failed: ${response.statusCode} from ${url}`)),
      );
    });
    request.on("timeout", () => request.destroy(new Error(`Game discovery timed out: ${url}`)));
    request.on("error", reject);
  });
}

export function deriveBootMetrics({ diagnostics, durations, elapsedMs, entered, milestones, navigationTiming }) {
  const rendererStarted = findMilestone(milestones, "renderer-init-started");
  const rendererCompleted = findMilestone(milestones, "renderer-init-completed");
  const entryReady = findMilestone(milestones, "entry-ready");
  const worldInteractive = findMilestone(milestones, "world-interactive");
  const startupTimings = diagnostics?.startupTimings ?? {};
  const rendererInitMs =
    readDuration(durations, "renderer-init") ??
    (rendererStarted && rendererCompleted ? rendererCompleted.elapsedMs - rendererStarted.elapsedMs : null);

  return {
    worldInteractiveMs: worldInteractive?.elapsedMs ?? null,
    firstByteToPlayableMs:
      worldInteractive?.timestamp !== undefined && navigationTiming && !entered
        ? Math.round(worldInteractive.timestamp - navigationTiming.responseStart)
        : null,
    enterClickToPlayableMs:
      worldInteractive?.timestamp !== undefined && entered ? Math.round(worldInteractive.timestamp - entered.t) : null,
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

/**
 * One step's numbers, from the probe read when the step ended: frames, draws, long frames, inputs, heap, and Herald
 * messages to the frame after them. A step whose page reloaded is measured on the new page, with what the reload cost.
 */
export function summarizeStep(probe, { name, startedOn }) {
  const reloaded = probe.timeOrigin !== startedOn.timeOrigin;
  const end = probe.steps.find((step) => step.name === `${name}:end`);
  const from = reloaded ? 0 : startedOn.t;
  const to = end?.t ?? probe.now;
  const frameIndexes = indexesWithin(probe.frames, from, to);
  const frameMs = frameIndexes
    .filter((index) => index > 0)
    .map((index) => probe.frames[index] - probe.frames[index - 1]);
  const loafs = probe.loafs.filter((loaf) => loaf.start >= from && loaf.start < to);
  const messages = probe.messages.filter((message) => message.arrived >= from && message.arrived < to);
  const messageFrames = messages.map((message) => frameAfter(probe.frames, message.end));
  const framesAfterMessage = new Set(messageFrames.map(({ index }) => index).filter((index) => index > 0));
  const frameMsAfterMessage = [...framesAfterMessage]
    .filter((index) => index + 1 < probe.frames.length)
    .map((index) => probe.frames[index + 1] - probe.frames[index]);

  return {
    name,
    durationMs: Math.round(to - from),
    reload: reloaded ? describeReload(probe, startedOn) : null,
    frames: {
      count: frameMs.length,
      fps: round((frameMs.length * 1000) / Math.max(to - from, 1)),
      ms: distribution(frameMs),
      jankCount: frameMs.filter((ms) => ms > JANK_FRAME_MS).length,
    },
    drawCalls: distribution(frameIndexes.map((index) => probe.draws[index])),
    longFrames: {
      count: loafs.length,
      totalMs: round(sum(loafs.map((loaf) => loaf.durationMs))),
      blockingMs: round(sum(loafs.map((loaf) => loaf.blockingMs))),
      topScripts: rankScripts(loafs),
    },
    inputs: probe.events
      .filter((event) => event.start >= from && event.start < to && TIMED_INPUTS.has(event.name))
      .map((event) => ({
        name: event.name,
        target: event.target,
        durationMs: round(event.durationMs),
        inputDelayMs: round(event.inputDelayMs),
        processingMs: round(event.processingMs),
        presentationMs: round(event.durationMs - event.inputDelayMs - event.processingMs),
      })),
    heap: {
      startMb: reloaded ? null : toMb(startedOn.heapBytes),
      endMb: toMb(end?.heapBytes),
      retainedDeltaMb: !reloaded && end ? toMb(end.heapBytes - startedOn.heapBytes) : null,
      peakMb: toMb(Math.max(...probe.heap.filter(([t]) => t >= from && t < to).map(([, bytes]) => bytes))),
    },
    herald: {
      count: messages.length,
      kb: round(sum(messages.map((message) => message.bytes)) / 1024),
      types: countBy(messages, (message) => message.type ?? "unknown"),
      queueMs: distribution(messages.map((message) => message.start - message.arrived)),
      handlerMs: distribution(messages.map((message) => message.end - message.start)),
      arrivalToFrameMs: distribution(
        messages.map((message, index) => messageFrames[index].timestamp - message.arrived).filter(Number.isFinite),
      ),
      frameMsAfterMessage: distribution(frameMsAfterMessage),
    },
  };
}

/** From the step's start on the old page to the new page's world-interactive, on one wall clock. */
function describeReload(probe, startedOn) {
  const worldInteractive = findMilestone(probe.timeline, "world-interactive");
  const startedAtWallMs = startedOn.timeOrigin + startedOn.t;
  return {
    navigationAfterStepStartMs: Math.round(probe.timeOrigin - startedAtWallMs),
    toPlayableMs: worldInteractive ? Math.round(probe.timeOrigin + worldInteractive.timestamp - startedAtWallMs) : null,
  };
}

/** Boot metrics and each step's scalar metrics across runs, per renderer mode: run count, median and spread. */
export function summarizePlaytestResults(results) {
  const byMode = {};
  for (const result of results) {
    byMode[result.rendererMode] ??= { failureCount: 0, runs: 0, boot: {}, steps: {} };
    byMode[result.rendererMode].runs += 1;
    if (!result.ok) byMode[result.rendererMode].failureCount += 1;
  }

  for (const [mode, summary] of Object.entries(byMode)) {
    const modeResults = results.filter((result) => result.rendererMode === mode);
    for (const metricName of BOOT_METRIC_NAMES) {
      summary.boot[metricName] = spread(modeResults.map((result) => result.metrics?.[metricName]));
    }
    for (const stepName of [
      ...new Set(modeResults.flatMap((result) => result.steps?.map((step) => step.name) ?? [])),
    ]) {
      const steps = modeResults.map((result) => result.steps?.find((step) => step.name === stepName)).filter(Boolean);
      summary.steps[stepName] = spreadScalars(steps.map((step) => flattenScalars(step)));
    }
  }

  return { byMode, results };
}

export function evaluatePlaytestSummary(summary, options = {}) {
  const entryReadyTimeoutMs = options.entryReadyTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rendererStallThresholdMs = options.rendererStallThresholdMs ?? RENDERER_STALL_THRESHOLD_MS;
  const failures = [];
  const warnings = [];

  for (const result of summary.results ?? []) {
    if (!result.diagnostics) {
      failures.push(describeRun(result, "missing renderer diagnostics"));
    }
    if (!isFiniteNumber(result.metrics?.entryReadyMs) || result.metrics.entryReadyMs > entryReadyTimeoutMs) {
      failures.push(describeRun(result, `entry-ready exceeded ${entryReadyTimeoutMs}ms`));
    }
    if (
      !isFiniteNumber(result.metrics?.worldInteractiveMs) ||
      result.metrics.worldInteractiveMs > entryReadyTimeoutMs
    ) {
      failures.push(describeRun(result, `world-interactive exceeded ${entryReadyTimeoutMs}ms`));
    }
    if (result.machine?.loadAverageMax > MAX_LOAD_AVERAGE) {
      failures.push(
        describeRun(result, `load average reached ${result.machine.loadAverageMax}: its timings are not evidence`),
      );
    }
    if (result.errors?.length) {
      failures.push(describeRun(result, `${result.errors.length} browser errors`));
    }
    for (const reload of result.reloads ?? []) {
      warnings.push(
        describeRun(result, `the page reloaded during ${reload.step} (${reload.toPlayableMs}ms to playable)`),
      );
    }
    if (
      result.rendererMode === "webgpu-auto" &&
      !hasRendererCompletedOrFallback(result) &&
      result.metrics?.rendererStalledAfterStartMs > rendererStallThresholdMs
    ) {
      failures.push(describeRun(result, "stalled after renderer-init-started without completion or fallback"));
    }
    if (hasWebGpuFallback(result)) {
      if (!result.diagnostics?.fallbackReason) {
        failures.push(describeRun(result, "fallback happened without a fallback reason"));
      } else {
        warnings.push(describeRun(result, `native WebGPU fell back: ${result.diagnostics.fallbackReason}`));
      }
    }
  }

  return { failures, ok: failures.length === 0, warnings };
}

export function comparePlaytestSummary(baseline, current) {
  const failures = [];
  const thresholds = [
    { metricName: "worldInteractiveMs", absoluteThresholdMs: 1_500, percentThreshold: 0.2 },
    { metricName: "entryReadyMs", absoluteThresholdMs: 1_500, percentThreshold: 0.2 },
    { metricName: "rendererInitMs", absoluteThresholdMs: 750, percentThreshold: 0.25 },
  ];

  for (const mode of Object.keys(current.byMode ?? {})) {
    for (const threshold of thresholds) {
      const baselineValue = baseline.byMode?.[mode]?.boot?.[threshold.metricName]?.max;
      const currentValue = current.byMode?.[mode]?.boot?.[threshold.metricName]?.max;
      if (!isFiniteNumber(baselineValue) || !isFiniteNumber(currentValue)) continue;
      const delta = currentValue - baselineValue;
      if (delta <= threshold.absoluteThresholdMs || delta / Math.max(baselineValue, 1) <= threshold.percentThreshold) {
        continue;
      }
      failures.push(
        `${mode} ${threshold.metricName} worst run regressed from ${Math.round(baselineValue)}ms to ${Math.round(currentValue)}ms`,
      );
    }
  }

  return { failures, ok: failures.length === 0 };
}

export function hasEntryFinished(snapshot) {
  return Boolean(snapshot.milestones?.some((milestone) => milestone.name === "world-interactive"));
}

export function collectBrowserErrors(browserErrors, consoleOutput) {
  const consoleFailures = parseLines(consoleOutput).filter((line) =>
    /\[error\]|manager.*timed? out|chunk transition hard timeout/i.test(line),
  );
  return [...new Set([...parseLines(browserErrors), ...consoleFailures])];
}

/** The client's own frame-spike reports (`[FramePerf]`): spike frames counted and the work that owned each. */
export function collectFrameSpikes(consoleOutput) {
  const owners = {};
  let digestedSpikeFrames = 0;
  for (const line of parseLines(consoleOutput)) {
    const digest = /\[FramePerf\] (\d+) spike frames in/.exec(line);
    if (digest) digestedSpikeFrames += Number(digest[1]);
    const spike = /\[FramePerf\] spike .*?duration_ms=(\d+) frame_owner=(\S+)/.exec(line);
    if (spike && !digest) {
      owners[spike[2]] ??= { count: 0, worstMs: 0 };
      owners[spike[2]].count += 1;
      owners[spike[2]].worstMs = Math.max(owners[spike[2]].worstMs, Number(spike[1]));
    }
  }
  return { digestedSpikeFrames, reportedOwners: owners };
}

async function runPlaytestIteration({
  baseUrl,
  cpuThrottle,
  game,
  headed,
  iteration,
  outDir,
  player,
  rendererMode,
  timeoutMs,
  trace,
}) {
  const runLabel = `${player ? "player" : "spectator"}-${rendererMode}-${iteration}`;
  const browser = createBrowserSession(`playtest-${runLabel}-${Date.now().toString(36)}`, headed);
  const url = player
    ? buildPlayerHomeUrl({ baseUrl, rendererMode })
    : buildPlaytestUrl({ baseUrl, chainId: game.chainId, gameId: game.gameId, rendererMode });
  // Other work on the machine bounds every number here: the load average is kept beside them.
  const loadSamples = [loadavg()[0]];

  let devTools = null;
  try {
    browser.run([
      "open",
      "about:blank",
      "--ignore-https-errors",
      "--init-script",
      PROBE_PATH,
      "--args",
      BROWSER_ARGS.join(","),
      ...(player ? ["--profile", player] : []),
    ]);
    browser.run(["set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height)]);
    devTools = await openPageDevTools(browser);
    if (cpuThrottle > 1) await devTools.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
    const rpcSends = await recordRpcSends(devTools);
    browser.run(["open", url]);
    const entered = player ? await enterAsPlayer(browser, timeoutMs) : null;
    const boot = { ...(await waitForEntrySnapshot(browser, timeoutMs)), entered };
    browser.run(["screenshot", join(outDir, `${runLabel}-00-boot.png`)]);
    if (trace) browser.run(["trace", "start"]);

    const steps = [];
    for (const [index, step] of (player ? PLAYER_STEPS : SPECTATOR_STEPS).entries()) {
      const screenshot = join(outDir, `${runLabel}-${String(index + 1).padStart(2, "0")}-${step.name}.png`);
      steps.push(await playStep({ browser, screenshot, step }));
      loadSamples.push(loadavg()[0]);
    }

    if (trace) browser.run(["trace", "stop", join(outDir, `${runLabel}-trace.json`)]);
    const machine = {
      cpus: availableParallelism(),
      cpuThrottle,
      loadAverageMax: Math.max(...loadSamples),
      loadSamples,
    };
    return collectIterationResult({
      boot,
      browser,
      iteration,
      machine,
      outDir,
      rendererMode,
      rpcSends: rpcSends(),
      runLabel,
      steps,
      url,
    });
  } finally {
    devTools?.close();
    // A previous live game must not keep rendering during the next measurement.
    browser.run(["close"], { allowFailure: true });
  }
}

/**
 * Marks the step, plays its actions, lets it settle, and reads what the probe saw in that time. Waits are this
 * process's own, so DevTools events keep arriving while the page plays.
 */
async function playStep({ browser, screenshot, step }) {
  const startedOn = JSON.parse(browser.eval(`window.__playtest.step(${JSON.stringify(step.name)})`));
  for (const action of step.actions ?? []) {
    if (action[0] === "wait") await sleep(Number(action[1]));
    else browser.run(action);
  }
  const played = step.play ? await step.play(browser) : undefined;
  await sleep(step.settleMs);
  browser.run(["screenshot", screenshot]);
  browser.run(["eval", `window.__playtest.step(${JSON.stringify(`${step.name}:end`)})`]);
  const probe = JSON.parse(
    browser.eval(`window.__playtest.read(performance.timeOrigin === ${startedOn.timeOrigin} ? ${startedOn.t} : 0)`),
  );
  return { probe, summary: { ...summarizeStep(probe, { name: step.name, startedOn }), ...(played && { played }) } };
}

/** Centres the army, taps its neighbours until one offers an order, and confirms it with Enter. */
async function placeOrderBesideArmy(browser) {
  browser.run(SELECT_ARMY);
  await sleep(ARMY_FLIGHT_MS);
  for (const offset of NEIGHBOUR_OFFSETS) {
    tapFromCentre(browser, offset);
    const verb = JSON.parse(browser.eval(ORDER_VERB_EXPRESSION) || "null");
    if (verb) {
      browser.run(["press", "Enter"]);
      return { orders: [verb] };
    }
  }
  return { orders: [] };
}

/**
 * Orders the army back and forth between a neighbour and its own tile, one tap and Enter every BURST_PACE_MS, as a
 * player spamming orders would: what is refused while an order is in flight shows in what was sent.
 */
async function placeOrderBurst(browser, count) {
  browser.run(SELECT_ARMY);
  await sleep(ARMY_FLIGHT_MS);
  const [neighbour] = NEIGHBOUR_OFFSETS;
  for (let index = 0; index < count; index += 1) {
    browser.run(["batch", ...tapCommands(index % 2 === 0 ? neighbour : [0, 0]), "press Enter"]);
    await sleep(BURST_PACE_MS);
  }
  return { taps: count };
}

function tapFromCentre(browser, offset) {
  browser.run(["batch", ...tapCommands(offset)]);
}

function tapCommands([dx, dy]) {
  const x = VIEWPORT.width / 2 + dx;
  const y = VIEWPORT.height / 2 + dy;
  return [`mouse move ${x} ${y}`, "mouse down", "mouse up"];
}

function collectIterationResult({
  boot,
  browser,
  iteration,
  machine,
  outDir,
  rendererMode,
  rpcSends,
  runLabel,
  steps,
  url,
}) {
  const consoleOutput = browser.run(["console"]);
  writeFileSync(join(outDir, `${runLabel}-console.log`), `${consoleOutput}\n`);
  const errors = collectBrowserErrors(browser.run(["errors"]), consoleOutput);
  const result = {
    ...boot,
    actionLatency: JSON.parse(browser.eval(ACTION_LATENCY_EXPRESSION)),
    errors,
    frameSpikes: collectFrameSpikes(consoleOutput),
    gpu: browser.eval(GPU_RENDERER_EXPRESSION),
    iteration,
    machine,
    metrics: deriveBootMetrics(boot),
    ok: errors.length === 0 && boot.canvasExists && hasEntryFinished(boot),
    reloads: steps
      .filter(({ summary }) => summary.reload)
      .map(({ summary }) => ({ step: summary.name, ...summary.reload })),
    rendererMode,
    rpc: summarizeRpcSends(rpcSends),
    steps: steps.map(({ summary }) => summary),
    url,
  };
  writeJson(join(outDir, `${runLabel}-transcript.json`), {
    ...result,
    probes: steps.map(({ probe, summary }) => ({ step: summary.name, probe })),
    rpcSends,
  });
  return result;
}

async function waitForEntrySnapshot(browser, timeoutMs) {
  const startedAt = Date.now();
  let snapshot = JSON.parse(browser.eval(ENTRY_SNAPSHOT_EXPRESSION));

  while (!hasEntryFinished(snapshot) && Date.now() - startedAt < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);
    snapshot = JSON.parse(browser.eval(ENTRY_SNAPSHOT_EXPRESSION));
  }

  return snapshot;
}

// The client's own action timelines (click to rendered, admission to visible, army movement phases); empty as a
// spectator, filled by a player's actions.
const ACTION_LATENCY_EXPRESSION = `JSON.stringify({
  admissionToVisibleMs: globalThis.__admissionToVisibleMs ?? [],
  armyMovement: globalThis.__armyMovementLatencyTraceEntries ?? [],
  clientActions: globalThis.__clientActionLatencyMeasurements ?? [],
})`;

// The pinned order's verb on the HUD's order bar, when a tapped tile offers one. A button's text ends with its key hint.
const ORDER_VERB_EXPRESSION = `JSON.stringify(
  [...document.querySelectorAll("button")]
    .map((button) => /^(Explore|Move)/.exec(button.textContent.trim())?.[1])
    .find(Boolean) ?? null
)`;

const GPU_RENDERER_EXPRESSION = `(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null;
})()`;

const ENTRY_SNAPSHOT_EXPRESSION = `JSON.stringify((() => {
  const navigation = performance.getEntriesByType("navigation")[0] ?? null;
  const resources = performance.getEntriesByType("resource");
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
    resourceCount: resources.length,
    slowestResources: resources
      .map((resource) => ({
        duration: Math.round(resource.duration),
        initiatorType: resource.initiatorType,
        name: resource.name.split("/").pop()?.split("?")[0] ?? resource.name,
        start: Math.round(resource.startTime),
        transferSize: resource.transferSize || 0,
      }))
      .sort((left, right) => right.duration - left.duration)
      .slice(0, 15),
    totalTransferBytes: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
  };
})())`;

/**
 * A DevTools connection to the run's page, for what page scripts cannot do: throttle the CPU so this fast machine
 * stands in for a player's laptop, and see a cross-origin request's connection. Chrome drops its overrides when the
 * connection closes, so it stays open for the whole run.
 */
async function openPageDevTools(browser) {
  const socket = new WebSocket(browser.run(["get", "cdp-url"]));
  await new Promise((resolveOpen, reject) => {
    socket.onopen = resolveOpen;
    socket.onerror = () => reject(new Error("Could not open the browser's DevTools connection"));
  });
  const replies = new Map();
  const listeners = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) replies.get(message.id)?.(message);
    else listeners.forEach((listener) => listener(message));
  };
  let nextId = 0;
  const send = (method, params = {}, sessionId) =>
    new Promise((resolveReply, reject) => {
      nextId += 1;
      replies.set(nextId, (reply) =>
        reply.error ? reject(new Error(`${method}: ${reply.error.message}`)) : resolveReply(reply.result),
      );
      socket.send(JSON.stringify({ id: nextId, method, params, sessionId }));
    });

  const { targetInfos } = await send("Target.getTargets");
  // The browser may hold a new-tab page beside the one this run drives.
  const drivenUrl = browser.run(["get", "url"]);
  const page = targetInfos.find((target) => target.type === "page" && target.url === drivenUrl);
  if (!page) throw new Error(`No DevTools target for the driven page ${drivenUrl}`);
  const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  return {
    send: (method, params) => send(method, params, sessionId),
    onEvent: (listener) => listeners.push(listener),
    close: () => socket.close(),
  };
}

/**
 * Every JSON-RPC POST the page makes (the play POST is `starknet_addInvokeTransaction`), with whether it went out on a
 * reused connection and what a fresh one cost. The RPC host sends no Timing-Allow-Origin, so only DevTools sees this.
 * Its clock is not the page's: these are durations and connection facts, in send order, never page times.
 */
async function recordRpcSends(devTools) {
  const sends = new Map();
  devTools.onEvent(({ method, params }) => {
    if (method === "Network.requestWillBeSent" && isRpcPost(params.request)) {
      sends.set(params.requestId, {
        rpcMethod: /"method"\s*:\s*"(\w+)"/.exec(params.request.postData ?? "")?.[1] ?? null,
        startedAt: params.timestamp,
      });
    }
    const send = sends.get(params?.requestId);
    if (method === "Network.responseReceived" && send) Object.assign(send, describeConnection(params.response));
    if (method === "Network.loadingFinished" && send) send.totalMs = round((params.timestamp - send.startedAt) * 1000);
  });
  await devTools.send("Network.enable");
  return () => [...sends.values()].map(({ startedAt, ...send }) => send);
}

const isRpcPost = (request) => request.method === "POST" && /\/rpc\//.test(new URL(request.url).pathname);

function describeConnection({ connectionReused, timing }) {
  const span = (from, to) => (timing && timing[from] >= 0 && timing[to] >= 0 ? round(timing[to] - timing[from]) : null);
  return {
    connectionReused,
    connectMs: span("connectStart", "connectEnd"),
    tlsMs: span("sslStart", "sslEnd"),
    waitMs: span("sendEnd", "receiveHeadersEnd"),
  };
}

/** Per JSON-RPC method: how many sends, how many on a fresh connection, and their durations. */
export function summarizeRpcSends(sends) {
  const byMethod = {};
  for (const send of sends) {
    const method = send.rpcMethod ?? "unknown";
    byMethod[method] ??= [];
    byMethod[method].push(send);
  }
  return Object.fromEntries(
    Object.entries(byMethod).map(([method, methodSends]) => [
      method,
      {
        count: methodSends.length,
        freshConnections: methodSends.filter((send) => send.connectionReused === false).length,
        totalMs: distribution(methodSends.map((send) => send.totalMs)),
        freshConnectMs: distribution(
          methodSends.filter((send) => send.connectionReused === false).map((send) => send.connectMs),
        ),
      },
    ]),
  );
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function createBrowserSession(session, headed) {
  const invoke = (commandArgs) =>
    spawnSync("npx", ["-y", "agent-browser", "--session", session, ...(headed ? ["--headed"] : []), ...commandArgs], {
      cwd: process.env.RUNNER_TEMP || process.env.TMPDIR || tmpdir(),
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });

  const run = (commandArgs, { allowFailure = false } = {}) => {
    let result = invoke(commandArgs);
    for (let retry = 1; retry <= AGENT_BROWSER_RETRIES && isTransientFailure(commandArgs, result); retry += 1) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, AGENT_BROWSER_RETRY_DELAY_MS * retry);
      result = invoke(commandArgs);
    }
    if (result.status !== 0 && !allowFailure) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser ${commandArgs[0]} failed`);
    }
    return result.stdout.trim();
  };

  // agent-browser prints an evaluated string as JSON; this returns the page's value as the string it was.
  const evaluate = (expression) => {
    const parsed = JSON.parse(run(["eval", expression]) || "null");
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  };

  return { eval: evaluate, run };
}

/** A busy machine times out CDP calls now and then; a read can be asked again, an action cannot. */
function isTransientFailure(commandArgs, result) {
  const output = `${result.stderr}\n${result.stdout}`;
  return (
    result.status !== 0 &&
    RETRYABLE_COMMANDS.has(commandArgs[0]) &&
    TRANSIENT_FAILURE_PATTERNS.some((pattern) => output.includes(pattern))
  );
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

function indexesWithin(sortedTimes, from, to) {
  const indexes = [];
  sortedTimes.forEach((time, index) => {
    if (time >= from && time < to) indexes.push(index);
  });
  return indexes;
}

function frameAfter(frames, time) {
  const index = frames.findIndex((frame) => frame >= time);
  return { index, timestamp: index === -1 ? Number.NaN : frames[index] };
}

function rankScripts(loafs) {
  const bySource = {};
  for (const script of loafs.flatMap((loaf) => loaf.scripts)) {
    const key = `${script.invoker} ${script.source}${script.fn ? `#${script.fn}` : ""}`;
    bySource[key] ??= { count: 0, totalMs: 0 };
    bySource[key].count += 1;
    bySource[key].totalMs += script.durationMs;
  }
  return Object.entries(bySource)
    .map(([script, stat]) => ({ script, count: stat.count, totalMs: round(stat.totalMs) }))
    .sort((left, right) => right.totalMs - left.totalMs)
    .slice(0, 5);
}

function distribution(values) {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  return {
    n: sorted.length,
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted[sorted.length - 1]),
  };
}

function spread(values) {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  return { n: sorted.length, median: round(percentile(sorted, 0.5)), min: sorted[0], max: sorted[sorted.length - 1] };
}

function flattenScalars(value, prefix = "", into = {}) {
  if (isFiniteNumber(value)) {
    into[prefix] = value;
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenScalars(child, prefix ? `${prefix}.${key}` : key, into);
    }
  }
  return into;
}

function spreadScalars(flatSteps) {
  const keys = [...new Set(flatSteps.flatMap((step) => Object.keys(step)))].sort();
  return Object.fromEntries(keys.map((key) => [key, spread(flatSteps.map((step) => step[key]))]));
}

function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1;
  return counts;
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1));
  return sortedValues[index];
}

function sum(values) {
  return values.reduce((total, value) => total + (isFiniteNumber(value) ? value : 0), 0);
}

function round(value) {
  return isFiniteNumber(value) ? Math.round(value * 10) / 10 : null;
}

function toMb(bytes) {
  return isFiniteNumber(bytes) ? round(bytes / 1024 / 1024) : null;
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

function describeRun(result, reason) {
  const label = [result.rendererMode, result.iteration ? `#${result.iteration}` : null].filter(Boolean).join(" ");
  return `${label || "run"}: ${reason}`;
}

function parseLines(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** A path as the caller typed it: `pnpm --dir apps/game` runs this script from apps/game, not from where it was called. */
function resolveFromCaller(path) {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
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

async function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const comparePath = readOption(argv, "--compare", "");
  const iterations = readNumberOption(argv, "--iterations", DEFAULT_ITERATIONS);
  const outDir = resolveFromCaller(
    readOption(argv, "--out", join(REPO_ROOT, ".context/playtest", new Date().toISOString().replace(/[:.]/g, "-"))),
  );
  const timeoutMs = readNumberOption(argv, "--timeout-ms", DEFAULT_TIMEOUT_MS);
  const game = await resolvePlaytestGame({
    baseUrl,
    chainId: readOption(argv, "--chain-id", ""),
    gameId: Number(readOption(argv, "--game-id", "0")),
  });
  mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const rendererMode of readRendererModes(argv)) {
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      const runOptions = {
        baseUrl,
        cpuThrottle: readNumberOption(argv, "--cpu-throttle", 1),
        player: readOption(argv, "--player", "") ? resolveFromCaller(readOption(argv, "--player", "")) : null,
        game,
        headed: argv.includes("--headed"),
        iteration,
        outDir,
        rendererMode,
        timeoutMs,
      };
      results.push(
        await runPlaytestIteration({ ...runOptions, trace: argv.includes("--trace") }).catch((error) => ({
          error: error.message,
          errors: [error.message],
          iteration,
          ok: false,
          rendererMode,
        })),
      );
    }
  }

  const summary = summarizePlaytestResults(results);
  const gateEvaluation = evaluatePlaytestSummary(summary, { entryReadyTimeoutMs: timeoutMs });
  const baselineComparison = comparePath
    ? comparePlaytestSummary(JSON.parse(readFileSync(comparePath, "utf8")), summary)
    : { failures: [], ok: true };
  const output = {
    game,
    byMode: summary.byMode,
    results: summary.results.map(({ steps, ...result }) => result),
    baselineComparison,
    gateEvaluation,
    ok: gateEvaluation.ok && baselineComparison.ok,
    timestamp: new Date().toISOString(),
  };

  writeJson(join(outDir, "summary.json"), output);
  console.log(JSON.stringify({ outDir, ok: output.ok, gateEvaluation, baselineComparison }, null, 2));

  if (!output.ok) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  await main(process.argv.slice(2));
}
