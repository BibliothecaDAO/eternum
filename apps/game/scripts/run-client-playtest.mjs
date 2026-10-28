import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import { availableParallelism, loadavg, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createBrowserSession,
  openPageDevTools,
  recordRpcSends,
  setViewport,
  touchAtPhoneWidth,
  VIEWPORT,
} from "./client-playtest/browser-session.mjs";
import { clickToResultTable } from "./client-playtest/click-latency.mjs";
import { startClient } from "./client-playtest/client-server.mjs";
import {
  assertInTargetGame,
  buildLabGameUrl,
  buildPlayerHomeUrl,
  buildPlaytestUrl,
  collectBrowserErrors,
  collectFrameSpikes,
  comparePlaytestSummary,
  deriveBootMetrics,
  evaluatePlaytestSummary,
  failed,
  hasEntryFinished,
  RENDERER_MODES,
  selectPlaytestGame,
  summarizePlaytestResults,
  summarizeRpcSends,
  summarizeStep,
} from "./client-playtest/evidence.mjs";
import { continuePastTheDaySummary, enterAsPlayer, signInIfSignedOut } from "./client-playtest/player-entry.mjs";
import { Cancelled, createRunOwner } from "./client-playtest/run-owner.mjs";
import { STEP_SETS } from "./client-playtest/steps.mjs";

/**
 * The client playtest: builds and serves the client as players get it, plays it in a browser on the machine's GPU as a
 * spectator or a signed-in player, judges every step by what a player would see, and leaves the evidence in a new
 * directory each time. Everything it starts has one owner and is released on every exit, a signal included; nothing it
 * wrote is ever overwritten.
 */

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS_DIR, "../../..");
const PROBE_PATH = join(SCRIPTS_DIR, "client-playtest/probe.js");
const DEFAULTS = { port: 4173, iterations: 3, rendererModes: RENDERER_MODES, timeoutMs: 30_000, cpuThrottle: 1 };
const POLL_INTERVAL_MS = 500;
const LOAD_SAMPLE_MS = 5_000;
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
/** The GPU WebGPU draws on: the machine's default, or its integrated one (`--gpu low-power`), a laptop's class of GPU. */
const GPUS = { default: [], "low-power": ["--use-webgpu-power-preference=force-low-power"] };

/** The browser's launch flags for a run on `gpu`. */
export const browserArgsFor = (gpu) => [...BROWSER_ARGS, ...GPUS[gpu]];

/** The command's options, refused when they cannot describe a run. Paths are taken from where the command was run. */
export function readPlaytestOptions(argv, callerDir = process.cwd()) {
  const option = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const integer = (name, fallback, minimum) => {
    const value = Number(option(name, String(fallback)));
    if (!Number.isInteger(value) || value < minimum)
      throw new Error(`${name} must be an integer of at least ${minimum}`);
    return value;
  };
  const rendererModes = option("--renderer-modes", DEFAULTS.rendererModes.join(","))
    .split(",")
    .map((mode) => mode.trim())
    .filter(Boolean);
  const unknownModes = rendererModes.filter((mode) => !RENDERER_MODES.includes(mode));
  if (rendererModes.length === 0 || unknownModes.length > 0) {
    throw new Error(`--renderer-modes takes ${RENDERER_MODES.join(" and/or ")}, not "${unknownModes.join(",")}"`);
  }
  const player = option("--player", null);
  if (player !== null && !/^[^@\s]+@[^@\s]+$/.test(player)) throw new Error(`--player takes an email, not "${player}"`);
  const stepSet = option("--steps", player ? "player" : "spectator");
  if (!STEP_SETS[stepSet]) {
    throw new Error(`--steps takes ${Object.keys(STEP_SETS).join(", ")}, not "${stepSet}"`);
  }

  const gpu = option("--gpu", "default");
  if (!GPUS[gpu]) throw new Error(`--gpu takes ${Object.keys(GPUS).join(" or ")}, not "${gpu}"`);
  const network = option("--network", null);
  const link = network === null ? null : /^(\d+(?:\.\d+)?),(\d+)$/.exec(network);
  if (network !== null && !link) throw new Error(`--network takes <down Mbit/s>,<round trip ms>, not "${network}"`);

  const viewport = /^(\d+)x(\d+)$/.exec(option("--viewport", "1920x1080"));
  if (!viewport) throw new Error(`--viewport takes <width>x<height>, not "${option("--viewport")}"`);

  return {
    baseUrl: option("--base-url", null),
    chainId: option("--chain-id", ""),
    comparePath: option("--compare", null) && resolve(callerDir, option("--compare")),
    cpuThrottle: integer("--cpu-throttle", DEFAULTS.cpuThrottle, 1),
    gameId: Number(option("--game-id", "0")),
    gpu,
    headed: argv.includes("--headed"),
    iterations: integer("--iterations", DEFAULTS.iterations, 1),
    network: link && { downMbps: Number(link[1]), roundTripMs: Number(link[2]) },
    outRoot: resolve(callerDir, option("--out", join(REPO_ROOT, ".context/playtest"))),
    player,
    port: integer("--port", DEFAULTS.port, 1),
    rendererModes,
    stepSet,
    timeoutMs: integer("--timeout-ms", DEFAULTS.timeoutMs, 1),
    trace: argv.includes("--trace"),
    viewport: { width: Number(viewport[1]), height: Number(viewport[2]) },
  };
}

/**
 * The page a run opens: a player's home page, or the spectator's Watch link with the dev overlays only for step lists
 * that play the dev tools.
 */
export function buildRunUrl({ baseUrl, game, player, rendererMode, stepSet }) {
  const { devOverlays = false } = STEP_SETS[stepSet];
  if (game.lab) return buildLabGameUrl({ baseUrl, scenario: game.lab, rendererMode, devOverlays });
  if (player) return buildPlayerHomeUrl({ baseUrl, rendererMode, devOverlays });
  return buildPlaytestUrl({ baseUrl, chainId: game.chainId, gameId: game.gameId, rendererMode, devOverlays });
}

/** A new directory for this invocation's evidence; an existing one is never written into. */
export function allocateRunDirectory(outRoot, role, now = new Date()) {
  mkdirSync(outRoot, { recursive: true });
  const runDir = join(outRoot, `${now.toISOString().replace(/[:.]/g, "-")}-${role}`);
  mkdirSync(runDir);
  return runDir;
}

async function main(argv) {
  const owner = createRunOwner();
  installCancellation(owner);
  const results = [];
  const output = { ok: false, startedAt: new Date().toISOString() };
  let runDir = null;
  let options = null;
  try {
    options = readPlaytestOptions(argv, process.env.INIT_CWD ?? process.cwd());
    setViewport(options.viewport);
    output.viewport = options.viewport;
    runDir = allocateRunDirectory(options.outRoot, options.player ? "player" : "spectator");
    output.source = describeSource();
    output.stage = "starting the client";
    const client = options.baseUrl
      ? { baseUrl: options.baseUrl, external: true }
      : await startClient({ owner, port: options.port, runDir });
    output.client = client;
    output.stage = "finding the game";
    const stepsGame = STEP_SETS[options.stepSet].game;
    // A lab game is its own: the fixture the steps were written for, with its own player.
    if (stepsGame.lab && options.player) throw new Error("A lab game seats its own player: run it without --player.");
    output.game = stepsGame.lab
      ? { chainId: stepsGame.chainId, gameId: stepsGame.gameId, mode: stepsGame.mode, lab: stepsGame.lab }
      : await resolvePlaytestGame({ ...options, baseUrl: client.baseUrl, mode: stepsGame.mode });
    output.stage = "playing";
    for (const rendererMode of options.rendererModes) {
      for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
        owner.throwIfCancelled();
        const run = {
          ...options,
          baseUrl: client.baseUrl,
          iteration,
          owner,
          rendererMode,
          runDir,
          source: output.source,
        };
        results.push(await playRun({ ...run, game: output.game }));
      }
    }
    owner.throwIfCancelled();
    output.stage = "done";
  } catch (error) {
    output.failure = { stage: output.stage, error: error.message, cancelled: owner.cancelledBy };
  } finally {
    await owner.releaseAll();
    finish({ options, output, owner, results, runDir });
  }
}

/** The summary is written whatever happened: a failed start or a cancel leaves a structured reason beside the log. */
function finish({ options, output, owner, results, runDir }) {
  const judged = options ? judgeRuns(results, options) : {};
  const failures = [...(judged.gateEvaluation?.failures ?? [])];
  if (output.failure) failures.unshift(`${output.failure.stage} failed: ${output.failure.error}`);
  const summary = {
    ...output,
    ...judged,
    gateEvaluation: { ...judged.gateEvaluation, failures, ok: failures.length === 0 },
    released: { failures: owner.releaseFailures, stillHeld: owner.held() },
    ok: failures.length === 0 && (judged.baselineComparison?.ok ?? true),
    finishedAt: new Date().toISOString(),
  };
  if (runDir) writeJson(join(runDir, "summary.json"), summary);
  const actionTable = clickToResultTable(summary.byMode ?? {});
  if (runDir && actionTable) writeFileSync(join(runDir, "click-to-result.md"), `${actionTable}\n`);
  console.log(JSON.stringify({ runDir, ok: summary.ok, failures, warnings: judged.gateEvaluation?.warnings }, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

/** A first signal cancels: the run stops at its next checkpoint and unwinds normally. A second one only hurries it. */
function installCancellation(owner) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (owner.cancelledBy) console.error(`${signal} again: still releasing ${owner.held().join(", ") || "nothing"}`);
      owner.cancel(signal);
    });
  }
}

/** The checkout the client was built from, so every artifact stays attributable. */
function describeSource() {
  const git = (...args) => spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
  const changed = git("status", "--porcelain").split("\n").filter(Boolean);
  return { commit: git("rev-parse", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD"), changed };
}

function judgeRuns(results, options) {
  const summary = summarizePlaytestResults(results);
  const gateEvaluation = evaluatePlaytestSummary(summary, { entryReadyTimeoutMs: options.timeoutMs });
  const baselineComparison = options.comparePath
    ? comparePlaytestSummary(JSON.parse(readFileSync(options.comparePath, "utf8")), summary)
    : { failures: [], ok: true };
  return {
    byMode: summary.byMode,
    excluded: summary.excluded,
    results: summary.results.map(({ steps, ...result }) => result),
    baselineComparison,
    gateEvaluation,
  };
}

/** The steps' game: the newest live one of their mode, or the one asked for, refused if it is of another mode. */
async function resolvePlaytestGame({ baseUrl, chainId, gameId, mode }) {
  const directory = await readLocalJson(new URL("/api/directory", baseUrl));
  if (!(chainId && gameId)) {
    const newest = selectPlaytestGame(directory, mode);
    if (!newest) throw new Error(`No live ${mode} game in the directory: pass --chain-id and --game-id.`);
    return newest;
  }
  const listed = (directory?.shards ?? [])
    .filter((shard) => BigInt(shard.chainId) === BigInt(chainId))
    .flatMap((shard) => shard.games ?? [])
    .find((game) => Number(game.game_id) === gameId);
  if (!listed) throw new Error(`game ${gameId} on ${chainId} is not in the directory`);
  if (listed.mode !== mode) {
    throw new Error(`game ${gameId} is ${listed.mode}; the playtest's steps are written for ${mode}`);
  }
  return { chainId, gameId, mode: listed.mode };
}

/**
 * One run in one browser: boot, then every step. Whatever happens (a failure, a cancel), the run's transcript is
 * written with all it recorded, and its browser, DevTools connection and temporary profile are released.
 */
async function playRun(context) {
  const { cpuThrottle, game, iteration, owner, player, rendererMode, runDir, timeoutMs } = context;
  const label = `${player ? "player" : "spectator"}-${rendererMode}-${iteration}`;
  const { game: stepsGame, steps } = STEP_SETS[context.stepSet];
  const record = { iteration, rendererMode, label, steps: [], expectedSteps: steps.map((step) => step.name) };
  record.loadSamples = [loadavg()[0]];
  const sampler = setInterval(() => record.loadSamples.push(loadavg()[0]), LOAD_SAMPLE_MS);
  // A spectator starts with a cold cache, as a first visit does; a player keeps the profile that signed them in.
  const profile = player ? playerProfile(player) : mkdtempSync(join(tmpdir(), "playtest-profile-"));
  const releaseProfile = player
    ? () => {}
    : owner.adopt(`profile ${profile}`, () => rmSync(profile, { recursive: true, force: true }));
  const browser = createBrowserSession(`playtest-${label}-${Date.now().toString(36)}`, {
    headed: context.headed,
    profile,
  });
  const releaseBrowser = owner.adopt(`browser ${label}`, () => browser.close());
  let releaseDevTools = () => {};
  try {
    browser.run([
      "open",
      "about:blank",
      "--ignore-https-errors",
      "--init-script",
      PROBE_PATH,
      "--args",
      browserArgsFor(context.gpu).join(","),
    ]);
    browser.run(["set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height)]);
    const devTools = await openPageDevTools(browser);
    releaseDevTools = owner.adopt(`DevTools ${label}`, () => devTools.close());
    await touchAtPhoneWidth(devTools, VIEWPORT.width);
    if (cpuThrottle > 1) await devTools.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
    if (context.network) await emulateNetwork(devTools, context.network);
    record.rpcSends = await recordRpcSends(devTools);
    record.url = buildRunUrl({ baseUrl: context.baseUrl, game, player, rendererMode, stepSet: context.stepSet });
    // The trace is the boot's: from before the game page opens to the world being interactive. A longer one is not
    // kept whole (the browser records into a ring buffer, and the boot is overwritten first) and costs gigabytes.
    if (context.trace) browser.run(["trace", "start"]);
    // A player is signed in first, through Connect on the home page, then opens the run's page.
    if (player) record.signIn = await signInAsPlayer({ ...context, browser, url: record.url });
    else browser.run(["open", record.url]);
    const entered = player ? await enterAsPlayer(browser, owner, timeoutMs, { card: stepsGame.card, game }) : null;
    record.boot = { ...(await waitForEntrySnapshot(browser, owner, timeoutMs)), entered };
    if (context.trace) browser.run(["trace", "stop", join(runDir, `${label}-trace.json`)]);
    // The boot as a step: from the page's start to now, its downloads, long frames, GPU work and scene marks.
    record.bootWindow = readSafely(() => {
      const probe = JSON.parse(browser.eval("window.__playtest.read(0)"));
      return summarizeStep(probe, { name: "boot", startedOn: { t: 0, timeOrigin: probe.timeOrigin } });
    });
    browser.screenshot(join(runDir, `${label}-00-boot.png`));
    if (player) record.daySummary = await continuePastTheDaySummary(browser, owner);
    // No order is sent before the run is proven to be in the game it was asked to play.
    record.game = assertInTargetGame(browser.observe().path, game);

    for (const [index, step] of steps.entries()) {
      owner.throwIfCancelled();
      const base = join(runDir, `${label}-${String(index + 1).padStart(2, "0")}-${step.name}`);
      const played = await playStep({ browser, devTools, owner, step, base });
      record.steps.push(played);
      if (played.cancelled) throw played.cancelled;
    }
  } catch (error) {
    record.error = error.message;
    record.cancelled = error instanceof Cancelled;
    // What the page showed when the run stopped: a failure before the first step has no step screenshot.
    record.failedScreenshot = readSafely(() => takeScreenshot(browser, join(runDir, `${label}-failed.png`)));
  } finally {
    clearInterval(sampler);
    record.loadSamples.push(loadavg()[0]);
  }
  try {
    return writeRunEvidence({ browser, context, record });
  } finally {
    await releaseDevTools();
    // A previous live game must not keep rendering during the next measurement.
    await releaseBrowser();
    await releaseProfile();
  }
}

/**
 * Marks the step, plays it, lets it settle, and judges it by what the page then shows and what the probe saw. Any
 * failure, capture included, is kept as the step's verdict with what it attempted and whatever could still be read.
 */
async function playStep({ browser, devTools, owner, step, base }) {
  const screenshot = `${base}.png`;
  const attempt = { name: step.name, played: {} };
  let startedOn = null;
  let probe = null;
  try {
    startedOn = JSON.parse(browser.eval(`window.__playtest.step(${JSON.stringify(step.name)})`));
    const extraScreenshot = (suffix) => takeScreenshot(browser, `${base}-${suffix}.png`);
    attempt.played = (await step.play?.({ base, browser, devTools, extraScreenshot, owner })) ?? {};
    await owner.sleep(step.settleMs);
    browser.screenshot(screenshot);
    browser.run(["eval", `window.__playtest.step(${JSON.stringify(`${step.name}:end`)})`]);
    const seen = browser.observe();
    const sameDocument = seen.timeOrigin === startedOn.timeOrigin;
    probe = JSON.parse(browser.eval(`window.__playtest.read(${sameDocument ? startedOn.t : 0})`));
    const window = { from: sameDocument ? startedOn.t : 0, to: probe.steps.at(-1)?.t ?? probe.now };
    const actionLatency = browser.read(ACTION_LATENCY_EXPRESSION);
    const verdict = await step.verify({ seen, played: attempt.played, screenshot, probe, window, actionLatency });
    return {
      probe,
      summary: { ...summarizeStep(probe, { name: step.name, startedOn }), seen, played: attempt.played, verdict },
    };
  } catch (error) {
    probe ??= readSafely(() => JSON.parse(browser.eval(`window.__playtest.read(${startedOn?.t ?? 0})`)));
    const summary = probe && startedOn ? summarizeStep(probe, { name: step.name, startedOn }) : { name: step.name };
    const verdict = failed(`${error instanceof Cancelled ? "cut short" : "the step threw"}: ${error.message}`);
    return {
      probe,
      summary: { ...summary, played: attempt.played, verdict },
      cancelled: error instanceof Cancelled ? error : null,
    };
  }
}

function takeScreenshot(browser, path) {
  browser.screenshot(path);
  return path;
}

/** The run's transcript with everything recorded, complete or not, and the result the gate judges. */
function writeRunEvidence({ browser, context, record }) {
  const consoleOutput = browser.run(["console"], { allowFailure: true });
  writeFileSync(join(context.runDir, `${record.label}-console.log`), `${consoleOutput}\n`);
  const provokedErrors = record.steps.flatMap(({ summary }) => summary.played?.provokedErrors ?? []);
  const errors = collectBrowserErrors(browser.run(["errors"], { allowFailure: true }), consoleOutput, provokedErrors);
  const boot = record.boot ?? {};
  const rpcSends = record.rpcSends?.() ?? [];
  const bootOk = errors.length === 0 && Boolean(boot.canvasExists) && hasEntryFinished(boot);
  const result = {
    ...boot,
    label: record.label,
    source: context.source,
    game: record.game ?? null,
    actionLatency: readSafely(() => browser.read(ACTION_LATENCY_EXPRESSION)),
    bootOk,
    cancelled: Boolean(record.cancelled),
    error: record.error ?? null,
    errors,
    provokedErrors,
    expectedSteps: record.expectedSteps,
    frameSpikes: collectFrameSpikes(consoleOutput),
    gpu: readSafely(() => browser.eval(GPU_RENDERER_EXPRESSION)),
    iteration: record.iteration,
    machine: {
      cpus: availableParallelism(),
      cpuThrottle: context.cpuThrottle,
      gpu: context.gpu,
      network: context.network ?? null,
      loadAverageMax: Math.max(...record.loadSamples),
      loadSampleEveryMs: LOAD_SAMPLE_MS,
      loadSamples: record.loadSamples,
    },
    metrics: deriveBootMetrics(boot),
    bootWindow: record.bootWindow ?? null,
    ok: !record.error && bootOk,
    reloads: record.steps
      .filter(({ summary }) => summary.reload)
      .map(({ summary }) => ({ step: summary.name, ...summary.reload })),
    rendererMode: record.rendererMode,
    rpc: summarizeRpcSends(rpcSends),
    signIn: record.signIn ?? null,
    daySummary: record.daySummary ?? null,
    steps: record.steps.map(({ summary }) => summary),
    url: record.url,
  };
  writeJson(join(context.runDir, `${record.label}-transcript.json`), {
    ...result,
    probes: record.steps.map(({ probe, summary }) => ({ step: summary.name, probe })),
    rpcSends,
  });
  return result;
}

/** Chrome's own link shaping for the page: every download pays the round trip and shares the bandwidth, both ways. */
async function emulateNetwork(devTools, { downMbps, roundTripMs }) {
  const bytesPerSecond = (downMbps * 1_000_000) / 8;
  await devTools.send("Network.enable", {});
  await devTools.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: roundTripMs,
    downloadThroughput: bytesPerSecond,
    uploadThroughput: bytesPerSecond,
  });
}

function readSafely(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

/** One profile per player, kept between runs: what signed them in stays signed in. */
function playerProfile(email) {
  const profile = join(REPO_ROOT, ".context/playtest-profiles", email);
  mkdirSync(profile, { recursive: true });
  return profile;
}

/** A profile whose session was lost signs in again, through Connect, and the run's page opens once more. */
async function signInAsPlayer({ baseUrl, browser, owner, player, runDir, url }) {
  const signIn = await signInIfSignedOut({
    browser,
    owner,
    email: player,
    baseUrl,
    codeFile: join(runDir, "sign-in-code"),
  });
  browser.run(["open", url]);
  return signIn;
}

async function waitForEntrySnapshot(browser, owner, timeoutMs) {
  const startedAt = Date.now();
  let snapshot = browser.read(ENTRY_SNAPSHOT_EXPRESSION);
  while (!hasEntryFinished(snapshot) && Date.now() - startedAt < timeoutMs) {
    await owner.sleep(POLL_INTERVAL_MS);
    snapshot = browser.read(ENTRY_SNAPSHOT_EXPRESSION);
  }
  return snapshot;
}

/** The dev server and preview serve /api from the environment's directory behind the local mkcert certificate. */
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

// The client's own action timelines (click to rendered marker, admission to visible, army movement phases); empty as
// a spectator, filled by a player's actions.
const ACTION_LATENCY_EXPRESSION = `JSON.stringify({
  admissionToVisibleMs: globalThis.__admissionToVisibleMs ?? [],
  armyMovement: globalThis.__armyMovementLatencyTraceEntries ?? [],
  clientActions: globalThis.__clientActionLatencyMeasurements ?? [],
})`;

const GPU_RENDERER_EXPRESSION = `(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null;
})()`;

// Every request of the boot with its own span, and the cache state of what the page loaded. Cross-origin responses
// without Timing-Allow-Origin report no sizes: they count as opaque, not as cached.
const ENTRY_SNAPSHOT_EXPRESSION = `JSON.stringify((() => {
  const navigation = performance.getEntriesByType("navigation")[0] ?? null;
  const resources = performance.getEntriesByType("resource");
  const sameOrigin = (resource) => new URL(resource.name).origin === location.origin;
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
          transferSize: navigation.transferSize,
        }
      : null,
    requests: resources
      .filter((resource) => resource.initiatorType === "fetch" || resource.initiatorType === "xmlhttprequest")
      .map((resource) => ({
        url: resource.name.split("?")[0],
        startMs: Math.round(resource.startTime),
        durationMs: Math.round(resource.duration),
        transferBytes: resource.transferSize,
      })),
    cache: {
      controlledByServiceWorker: Boolean(navigator.serviceWorker?.controller),
      sameOriginFromNetwork: resources.filter((resource) => sameOrigin(resource) && resource.transferSize > 300).length,
      sameOriginRevalidated: resources.filter((resource) => sameOrigin(resource) && resource.responseStatus === 304).length,
      sameOriginFromCache: resources.filter((resource) => sameOrigin(resource) && resource.transferSize === 0 && resource.decodedBodySize > 0).length,
      viaServiceWorker: resources.filter((resource) => resource.workerStart > 0).length,
      crossOriginOpaque: resources.filter((resource) => !sameOrigin(resource) && resource.decodedBodySize === 0).length,
      sameOriginTransferBytes: resources.filter(sameOrigin).reduce((total, resource) => total + resource.transferSize, 0),
      sameOriginDecodedBytes: resources.filter(sameOrigin).reduce((total, resource) => total + resource.decodedBodySize, 0),
    },
  };
})())`;

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  await main(process.argv.slice(2));
}
