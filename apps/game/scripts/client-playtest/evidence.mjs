/**
 * The playtest's records turned into evidence: per-step numbers, step verdicts, boot metrics, action correlations,
 * and the gate. Pure: everything here takes what the browser recorded and returns what it means.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const RENDERER_STALL_THRESHOLD_MS = 7_000;
// Above this one-minute load average the machine, not the client, sets the numbers: such a run is not evidence.
const MAX_LOAD_AVERAGE = 12;
const JANK_FRAME_MS = 1000 / 30;
// A revealed tile turns from fog to terrain; the same patch of screen, unchanged, differs by a few levels at most.
const REVEALED_TILE_CHANGE_MIN = 12;
// The most a bar regenerates between two of the probe's half-second readings (a Blitz army gains about 0.4 a second).
const PLATE_STAMINA_RISE_MAX = 5;
// The discrete inputs a player feels; pointer enter/leave and hover events would only repeat the click's numbers.
const TIMED_INPUTS = new Set(["click", "keydown", "pointerdown", "wheel"]);
export const RENDERER_MODES = ["webgpu-auto", "webgpu-force-webgl"];
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

export function buildPlaytestUrl({ baseUrl, chainId, gameId, rendererMode, devOverlays = false }) {
  if (!chainId || !gameId) {
    throw new Error("buildPlaytestUrl requires a chainId and a gameId");
  }
  const url = new URL(baseUrl);
  // Play's Watch link (`entryHref(game, "spectate")`): the game, not a scene of it.
  url.pathname = `/g/${chainId}/${gameId}`;
  url.searchParams.set("spectate", "true");
  url.searchParams.set("rendererMode", rendererMode);
  // Measure what players run: the dev overlays stay off even if this browser profile once enabled them, unless the
  // steps need them (they play the dev tools, or read the world the dev build reports).
  url.searchParams.set("dev", devOverlays ? "1" : "0");
  return url.toString();
}

/**
 * A lab game (`/lab/game?scenario=…`): the game's own route on a fixture held in the tab, which seats its own player,
 * so the run opens it directly, with the same renderer and dev-overlay options as a live game's link.
 */
export function buildLabGameUrl({ baseUrl, scenario, rendererMode, devOverlays = false }) {
  const url = new URL(baseUrl);
  url.pathname = "/lab/game";
  url.searchParams.set("scenario", scenario);
  url.searchParams.set("rendererMode", rendererMode);
  url.searchParams.set("dev", devOverlays ? "1" : "0");
  return url.toString();
}

/**
 * A player starts on the home page, signed in by the browser profile, and enters with its call to action. The dev
 * overlays are set there, as for a spectator's link: the page keeps the setting into the game.
 */
export function buildPlayerHomeUrl({ baseUrl, rendererMode, devOverlays = false }) {
  const url = new URL(baseUrl);
  url.searchParams.set("rendererMode", rendererMode);
  url.searchParams.set("dev", devOverlays ? "1" : "0");
  return url.toString();
}

/** The newest live game of `mode` on the first active shard that has one, in the directory the client itself reads. */
export function selectPlaytestGame(directory, mode) {
  for (const shard of directory?.shards ?? []) {
    if (shard.status !== "active") continue;
    const [newest] = (shard.games ?? [])
      .filter((game) => game.status === "Live" && game.mode === mode)
      .toSorted((left, right) => Number(right.game_id) - Number(left.game_id));
    if (newest) return { chainId: shard.chainId, gameId: Number(newest.game_id), mode: newest.mode };
  }
  return null;
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

export function hasEntryFinished(snapshot) {
  return Boolean(snapshot.milestones?.some((milestone) => milestone.name === "world-interactive"));
}

/**
 * One step's numbers, from the probe read when the step ended: frame intervals, draws, long animation frames, inputs,
 * heap, the map labels' element count, and Herald messages to the frame after them. A step whose page reloaded is measured on the new page, with what
 * the reload cost. Frame intervals and long animation frames are different records: a missed frame need not be long.
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
    vertices: distribution(frameIndexes.map((index) => probe.vertices?.[index]).filter(Number.isFinite)),
    frameCallbackMs: distribution(frameIndexes.map((index) => probe.callbackMs?.[index])),
    gpuDoneMs: distribution(frameIndexes.map((index) => probe.gpuDoneMs?.[index])),
    gpuMemoryAtEnd: summarizeGpuMemory(probe.gpuMemory),
    longFrames: {
      count: loafs.length,
      totalMs: round(sum(loafs.map((loaf) => loaf.durationMs))),
      blockingMs: round(sum(loafs.map((loaf) => loaf.blockingMs))),
      topScripts: rankScripts(loafs),
    },
    inputLatency: probe.events
      .filter((event) => event.start >= from && event.start < to && TIMED_INPUTS.has(event.name))
      .map((event) => ({
        name: event.name,
        target: event.target,
        durationMs: round(event.durationMs),
        inputDelayMs: round(event.inputDelayMs),
        processingMs: round(event.processingMs),
        presentationMs: round(event.durationMs - event.inputDelayMs - event.processingMs),
      })),
    presses: (probe.inputs ?? [])
      .filter((input) => input.t >= from && input.t < to)
      .map((input) => ({ type: input.type, key: input.key, atMs: round(input.t - from), trusted: input.trusted })),
    heap: {
      startMb: reloaded ? null : toMb(startedOn.heapBytes),
      endMb: toMb(end?.heapBytes),
      retainedDeltaMb: !reloaded && end ? toMb(end.heapBytes - startedOn.heapBytes) : null,
      peakMb: toMb(Math.max(...probe.heap.filter(([t]) => t >= from && t < to).map(([, bytes]) => bytes))),
    },
    labelNodes: distribution((probe.labelNodes ?? []).filter(([t]) => t >= from && t < to).map(([, count]) => count)),
    loads: summarizeLoads(
      (probe.resources ?? []).filter((entry) => entry.start >= from && entry.start < to),
      from,
    ),
    gpu: summarizeGpuWork(frameIndexes.map((index) => probe.gpu?.[index]).filter(Boolean)),
    scenesDrawn: sceneChanges(probe, frameIndexes, from),
    marks: (probe.marks ?? [])
      .filter((mark) => mark.t >= from && mark.t < to)
      .map((mark) => ({ name: mark.name, atMs: round(mark.t - from) })),
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

/**
 * What the page kept running between two census readings: each frame-callback and timer site, and each element whose
 * style or SVG attributes kept changing, with its rate per second over the window (most first), and, as of the later
 * reading, its repeating timers, running CSS animations,
 * canvases, full-screen layers (with whether a player sees them), the boot shell, the GPU memory held and its largest
 * textures.
 */
export function compareCensus(before, after) {
  const seconds = Math.max(after.t - before.t, 1) / 1000;
  const ratesPerSecond = (counts, earlier) =>
    Object.entries(counts)
      .map(([caller, count]) => ({ caller, perSecond: round((count - (earlier[caller] ?? 0)) / seconds) }))
      .filter((site) => site.perSecond > 0)
      .toSorted((left, right) => right.perSecond - left.perSecond);
  return {
    windowMs: Math.round(after.t - before.t),
    frameCallbacks: ratesPerSecond(after.frameCallbacks, before.frameCallbacks),
    timeouts: ratesPerSecond(after.timeouts, before.timeouts),
    restyles: ratesPerSecond(after.restyles ?? {}, before.restyles ?? {}),
    intervals: after.intervals,
    animations: after.animations,
    unseenAnimations: after.animations.filter((animation) => animation.seen === false).length,
    dom: after.dom,
    gpuMemory: summarizeGpuMemory(after.gpuMemory),
    largestTextures: (after.largestTextures ?? []).map(({ bytes, shape }) => ({ mb: toMb(bytes), shape })),
  };
}

const SETTLED_FRAME_MS = 20;
const SETTLED_SPAN_MS = 1_000;

/**
 * The first seconds of play once the doorway drops, from one continuous frame record: the frames over 33 ms and the
 * worst frame in the `windowMs` after `overlay-dismissed`, and the time until the first second of frames at or under
 * 20 ms. Only frames observed count: the record must hold a frame at or before the dismissal and one at or after the
 * window's end, so the frame crossing either edge is judged too. A record that does not is refused as incomplete, as
 * time between frames that was not observed is no evidence of either a smooth or a long frame.
 */
export function judgeAfterDoorway({ dismissedAt, frames }, { windowMs = 5_000 } = {}) {
  if (!Number.isFinite(dismissedAt)) return { status: "incomplete", reason: "no overlay-dismissed milestone" };
  if (!(frames.length > 0 && frames[0] <= dismissedAt)) {
    return { status: "incomplete", reason: "the record starts after the doorway dropped" };
  }
  const lastFrame = frames.at(-1);
  if (lastFrame < dismissedAt + windowMs) {
    return { status: "incomplete", reason: `the frames end ${Math.round(lastFrame - dismissedAt)} ms after the drop` };
  }
  const inWindow = framesOverlapping(frames, dismissedAt, dismissedAt + windowMs);
  return {
    status: "complete",
    windowMs,
    observedMs: round(lastFrame - dismissedAt),
    framesOver33: inWindow.filter((ms) => ms > 33.4).length,
    worstFrameMs: round(Math.max(...inWindow)),
    settledAfterMs: settledAfter(frames, dismissedAt),
  };
}

/** From the drop to the first frame that opens an observed second whose every frame is at or under 20 ms; null if none. */
function settledAfter(frames, dismissedAt) {
  for (const start of frames) {
    if (start < dismissedAt) continue;
    if (frames.at(-1) < start + SETTLED_SPAN_MS) return null;
    const second = framesOverlapping(frames, start, start + SETTLED_SPAN_MS);
    if (second.every((ms) => ms <= SETTLED_FRAME_MS)) return round(start - dismissedAt);
  }
  return null;
}

/** The duration of every frame interval that overlaps `(from, to)`, those crossing either edge included. */
function framesOverlapping(frames, from, to) {
  const durations = [];
  for (let index = 1; index < frames.length; index++) {
    if (frames[index] > from && frames[index - 1] < to) durations.push(frames[index] - frames[index - 1]);
  }
  return durations;
}

/** The WebGPU memory held when the step's probe was read, in MB; null on WebGL, whose memory is not kept. */
function summarizeGpuMemory(memory) {
  if (!memory || memory.textures + memory.buffers === 0) return null;
  return {
    textures: memory.textures,
    textureMb: toMb(memory.textureBytes),
    buffers: memory.buffers,
    bufferMb: toMb(memory.bufferBytes),
  };
}

const RESOURCE_KINDS = [
  ["script", /\.m?js$/],
  ["style", /\.css$/],
  ["wasm", /\.wasm$/],
  ["model", /\.(glb|gltf|bin)$/],
  ["texture", /\.(ktx2|basis|png|jpe?g|webp|avif|hdr|exr)$/],
  ["font", /\.(woff2?|ttf|otf)$/],
  ["audio", /\.(mp3|ogg|wav|m4a)$/],
  ["data", /\.json$/],
];
const SLOWEST_LOADS = 8;

/** What a download is, by its file's extension; anything else (an API call, a socket) is "other". */
const resourceKind = (url) => RESOURCE_KINDS.find(([, pattern]) => pattern.test(url))?.[0] ?? "other";

/**
 * The downloads a window started: how many, their bytes on the wire and as served (a cache hit costs no wire bytes),
 * by kind, when the last one finished, and the slowest ones by their own span.
 */
function summarizeLoads(entries, from) {
  const byKind = {};
  for (const entry of entries) {
    const kind = (byKind[resourceKind(entry.url)] ??= { count: 0, kb: 0, wireKb: 0 });
    kind.count += 1;
    kind.kb = round(kind.kb + entry.bytes / 1024);
    kind.wireKb = round(kind.wireKb + entry.transferBytes / 1024);
  }
  return {
    count: entries.length,
    kb: round(sum(entries.map((entry) => entry.bytes)) / 1024),
    wireKb: round(sum(entries.map((entry) => entry.transferBytes)) / 1024),
    fromCache: entries.filter((entry) => entry.transferBytes === 0 && entry.decodedBytes > 0).length,
    lastEndMs: entries.length ? round(Math.max(...entries.map((entry) => entry.end)) - from) : null,
    byKind,
    slowest: [...entries]
      .sort((left, right) => right.end - right.start - (left.end - left.start))
      .slice(0, SLOWEST_LOADS)
      .map((entry) => ({
        url: entry.url,
        kb: round(entry.bytes / 1024),
        startMs: round(entry.start - from),
        ms: round(entry.end - entry.start),
      })),
  };
}

/** The GPU work a window's frames asked for: pipelines and shaders compiled, the time spent asking, bytes uploaded. */
function summarizeGpuWork(frames) {
  return {
    pipelines: sum(frames.map((frame) => frame.pipelines)),
    shaders: sum(frames.map((frame) => frame.shaders)),
    compileCallMs: round(sum(frames.map((frame) => frame.callMs))),
    worstFrameCompileCallMs: round(Math.max(0, ...frames.map((frame) => frame.callMs))),
    uploadMb: round(sum(frames.map((frame) => frame.uploadBytes)) / 1024 / 1024),
  };
}

/** Each frame in the window where the drawn scene changed, with its time from the window's start. */
function sceneChanges(probe, frameIndexes, from) {
  const changes = [];
  let previous = probe.scenes?.[frameIndexes[0] - 1] ?? null;
  for (const index of frameIndexes) {
    const scene = probe.scenes?.[index] ?? null;
    if (scene !== previous) changes.push({ scene, atMs: round(probe.frames[index] - from) });
    previous = scene;
  }
  return changes;
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

export const completed = (details = {}) => ({ status: "completed", ...details });
/** The game refused the step for a reason a player would meet too (a short cost, nothing to explore). */
export const blocked = (reason, details = {}) => ({ status: "blocked", reason, ...details });
export const failed = (reason, details = {}) => ({ status: "failed", reason, ...details });

/**
 * An explore is evidence only when Explore was offered and pressed, the client's own record of that press carries a
 * hash, its outcome was applied, and the army's plate never climbed back up while it settled (`plateStamina`, the
 * probe's [time, reading] pairs). Move offered instead, or nothing, is a refusal, never an explore.
 */
export function judgeExplore(played, clientActions) {
  if (played.army === null) return blocked("the player has no army on the HUD");
  if (played.pressedAt === undefined) {
    const reason = played.offered.includes("short")
      ? "the army cannot pay for an order (the order bar shows a short cost)"
      : "no tile beside the army offered Explore";
    return blocked(`${reason} (offered: ${played.offered.map(String).join(", ")})`);
  }
  const explores = clientActions.filter((measurement) => measurement.operation === "explore_reveal");
  // A phone's first tap only pins the tile; its second sends the one explore.
  if (played.pinnedAt !== undefined) {
    const early = explores.filter(
      ({ phases }) => phases.click >= played.pinnedAt - 5 && phases.click < played.pressedAt - 5,
    );
    if (early.length > 0) return failed("the first tap sent the explore before the second tap", { action: early[0] });
    const sent = explores.filter(({ phases }) => phases.click >= played.pressedAt - 5);
    if (sent.length > 1) return failed(`the second tap sent ${sent.length} explores`, { action: sent[0] });
  }
  const action = explores.find((measurement) => measurement.phases.click >= played.pressedAt - 5);
  if (!action) return failed("confirming Explore started no explore");
  if (action.failedReason) return failed(`the explore failed: ${action.failedReason}`, { action });
  if (!action.transactionHash) return failed("the explore was never sent (no hash)", { action });
  if (action.phases.store_applied === undefined) return failed("the explore's outcome was not applied", { action });
  if (action.phases.rendered === undefined) return failed("the client never marked the reveal rendered", { action });
  if (!(played.tileChange >= REVEALED_TILE_CHANGE_MIN)) {
    return failed(`the explored tile did not visibly change on screen (${played.tileChange})`, { action });
  }
  const stale = judgePlateStamina(played.plateStamina ?? [], played.pressedAt, { action });
  if (stale) return stale;
  // `rendered` is the client's marker (a rAF callback after the terrain page rebuilt); the screenshot is what showed.
  return completed({ action, tileChange: played.tileChange });
}

/**
 * Fails an order whose army's plate climbed back to a bar it no longer has: a rise between two of the probe's
 * [time, reading] pairs after `since` that regeneration cannot make. Null when the plate only paid and regenerated.
 */
export function judgePlateStamina(readings, since, detail = {}) {
  const read = readings.filter(([t, stamina]) => t >= since && stamina !== null).map(([, stamina]) => stamina);
  for (let at = 1; at < read.length; at += 1) {
    if (read[at] - read[at - 1] > PLATE_STAMINA_RISE_MAX) {
      return failed(`the army's plate read ${read[at - 1]} stamina, then ${read[at]}: a bar it no longer has`, detail);
    }
  }
  return null;
}

/**
 * A burst is evidence only when at least two armies took an order back to back and every order was sent, confirmed and
 * shown: a move by its army starting to move, an explore (which may leave the army where it stood) by the client's
 * record of its reveal rendered. Each order is timed from the right-click the client recorded (`move_requested`) to
 * its send's answer, Herald's status and that visible moment, in the page's clock.
 */
export function judgeBurst(played, { armyMovement, clientActions }) {
  if ((played.targets?.length ?? 0) < 2) {
    return blocked(`${played.targets?.length ?? 0} armies offered an order: a burst needs two`, {
      targets: played.targets,
    });
  }
  const orders = played.burst.map(({ army }) => timeOrder(army, played.startedAt, armyMovement, clientActions));
  const unfinished = orders.find((order) => order.confirmedMs === undefined || order.visibleMs === undefined);
  if (unfinished) return failed(`army ${unfinished.army}'s order never showed on screen`, { orders });
  if (orders.length < played.targets.length) {
    return failed(`${orders.length} of ${played.targets.length} armies took their order`, { orders });
  }
  const requested = orders.map(({ requestedAt }) => requestedAt);
  return completed({ orders, spanMs: round(Math.max(...requested) - Math.min(...requested)) });
}

/** One army's order in the burst, from its right-click to each phase after it; a phase missing stays undefined. */
function timeOrder(army, since, armyMovement, clientActions) {
  const entries = armyMovement.filter((entry) => entry.entityId === army && entry.wallTimeMs >= since);
  const requested = entries.find((entry) => entry.phase === "move_requested");
  const after = (phase) => {
    const entry =
      requested && entries.find((candidate) => candidate.phase === phase && candidate.sequence > requested.sequence);
    return entry ? round(entry.wallTimeMs - requested.wallTimeMs) : undefined;
  };
  const explore = requested?.details?.actionType === "explore";
  const reveal =
    explore &&
    clientActions.find(
      (action) =>
        action.operation === "explore_reveal" &&
        action.entityId === army &&
        action.phases.click >= requested.wallTimeMs - 5,
    );
  return {
    army,
    order: explore ? "explore" : "move",
    requestedAt: requested?.wallTimeMs,
    answeredMs: after("tx_response_received"),
    confirmedMs: after("tx_confirmed"),
    visibleMs: explore
      ? reveal?.phases.rendered === undefined
        ? undefined
        : round(reveal.phases.rendered - requested.wallTimeMs)
      : after("movement_started"),
  };
}

/**
 * A next order's life is evidence only when it went the way its step expects while the order before it was held in
 * flight: the order bar showed it queued, its steps (queued, run, dropped and why) came in the expected sequence, the
 * expected number of orders were sent with a hash and confirmed, and an order that ran is the tile last queued.
 */
export function judgeNextOrder({ expected, played, orders }) {
  if (!played.army) return blocked("the player has no army on the HUD");
  if (!played.targets) {
    return blocked(
      played.scanned?.some(({ verb }) => verb === "short")
        ? "the army cannot pay for an order (the order bar shows a short cost)"
        : "no tiles beside the army offered the orders the step needs",
    );
  }
  if (!played.firstSent) return failed("the first order never reached the network: nothing was in flight", { orders });
  if (!played.queuedShown) return failed("the order bar never showed the next order queued", { orders });
  const steps = orders.next.map(({ step }) => step);
  if (steps.join() !== expected.next.join()) {
    return failed(`the next order went ${steps.join(" → ") || "nowhere"}, not ${expected.next.join(" → ")}`, {
      orders,
    });
  }
  const confirmed = orders.commands.filter((command) => command.hash && command.confirmed).length;
  if (confirmed !== expected.confirmed) {
    return failed(`${confirmed} orders were sent and confirmed, not ${expected.confirmed}`, { orders });
  }
  const ran = orders.next.find(({ step }) => step === "run");
  const lastQueued = orders.next.findLast(({ step }) => step === "queued");
  if (ran && (ran.hex.col !== lastQueued.hex.col || ran.hex.row !== lastQueued.hex.row)) {
    return failed("the order that ran is not the tile last queued", { orders });
  }
  return completed({ orders });
}

/** The game a route is in, from `/g/<chain>/<game>/…`; null outside a game. */
export function gameOfPath(path) {
  const match = /^\/g\/(0x[0-9a-fA-F]+)\/(\d+)(?:\/|$)/.exec(path ?? "");
  return match ? { chainId: match[1], gameId: Number(match[2]) } : null;
}

/** Orders may only be sent in the game the run was asked to play. */
export function assertInTargetGame(path, target) {
  const entered = gameOfPath(path);
  if (!entered || BigInt(entered.chainId) !== BigInt(target.chainId) || entered.gameId !== Number(target.gameId)) {
    throw new Error(
      `entered ${entered ? `game ${entered.gameId} on ${entered.chainId}` : path}, not the target game ${target.gameId} on ${target.chainId}: no order was sent`,
    );
  }
  return entered;
}

/**
 * An army's orders in a step, from the army trace, in order: each command (explore or move) with its hash and whether
 * Herald confirmed it, and each step of a next order queued behind one in flight (queued, run, or dropped and why) with
 * its tile.
 */
export function describeOrders({ armyTrace, from, to }) {
  const commands = [];
  const next = [];
  for (const entry of armyTrace.filter((trace) => trace.wallTimeMs >= from && trace.wallTimeMs < to)) {
    if (entry.phase.startsWith("next_order_")) {
      next.push(describeNextOrderStep(entry));
      continue;
    }
    if (entry.phase === "move_requested") {
      commands.push({ entityId: entry.entityId, kind: "move", hash: null, confirmed: false });
      continue;
    }
    const command = commands.findLast((candidate) => candidate.entityId === entry.entityId);
    if (!command) continue;
    if (entry.phase === "explore_intent_queued") command.kind = "explore";
    if (entry.txHash && !command.hash) command.hash = entry.txHash;
    if (entry.phase === "tx_confirmed") command.confirmed = true;
  }
  return { commands: commands.map(({ entityId, ...command }) => command), next };
}

const describeNextOrderStep = ({ phase, details }) => ({
  step: phase === "next_order_dropped" ? `dropped:${details.reason}` : phase.replace("next_order_", ""),
  hex: { col: details.col, row: details.row },
});

/**
 * Which populations a run may feed. Timing needs a run that ran to its end on a quiet machine (the maximum sampled load
 * at or under the limit); boot timing needs that and a clean boot. A recovered, verified step can still be evidence
 * after a bad boot, but it never validates that boot.
 */
export function eligibilityOf(result) {
  const timing = [];
  if (!(result.machine?.loadAverageMax <= MAX_LOAD_AVERAGE)) {
    timing.push(
      `maximum sampled load average ${result.machine?.loadAverageMax ?? "unknown"} is over ${MAX_LOAD_AVERAGE}`,
    );
  }
  if (result.cancelled) timing.push(`the run was ${result.error}`);
  const boot = [...timing];
  if (!result.bootOk) boot.push("the boot was not clean");
  return { timing, boot };
}

/**
 * Boot metrics from boot-eligible runs and each completed step's metrics from timing-eligible runs, per renderer mode:
 * run count, median and spread. Every record left out is listed with its reasons.
 */
export function summarizePlaytestResults(results) {
  const byMode = {};
  const excluded = [];
  for (const result of results) {
    byMode[result.rendererMode] ??= { failureCount: 0, runs: 0, boot: {}, steps: {} };
    byMode[result.rendererMode].runs += 1;
    if (!result.ok) byMode[result.rendererMode].failureCount += 1;
    const eligibility = eligibilityOf(result);
    if (eligibility.boot.length) excluded.push({ run: result.label, scope: "boot", reasons: eligibility.boot });
    if (eligibility.timing.length) excluded.push({ run: result.label, scope: "steps", reasons: eligibility.timing });
  }

  for (const [mode, summary] of Object.entries(byMode)) {
    const modeResults = results.filter((result) => result.rendererMode === mode);
    const bootRuns = modeResults.filter((result) => eligibilityOf(result).boot.length === 0);
    for (const metricName of BOOT_METRIC_NAMES) {
      summary.boot[metricName] = spread(bootRuns.map((result) => result.metrics?.[metricName]));
    }
    const timingRuns = modeResults.filter((result) => eligibilityOf(result).timing.length === 0);
    const stepNames = [...new Set(modeResults.flatMap((result) => result.steps?.map((step) => step.name) ?? []))];
    for (const stepName of stepNames) {
      const steps = modeResults.flatMap((result) => result.steps?.filter((step) => step.name === stepName) ?? []);
      const evidence = timingRuns.flatMap(
        (result) =>
          result.steps?.filter((step) => step.name === stepName && step.verdict?.status === "completed") ?? [],
      );
      summary.steps[stepName] = {
        verdicts: countBy(steps, (step) => step.verdict?.status ?? "unverified"),
        ...spreadScalars(evidence.map((step) => flattenScalars(step))),
      };
    }
  }

  return { byMode, excluded, results };
}

export function evaluatePlaytestSummary(summary, options = {}) {
  const entryReadyTimeoutMs = options.entryReadyTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rendererStallThresholdMs = options.rendererStallThresholdMs ?? RENDERER_STALL_THRESHOLD_MS;
  const failures = [];
  const warnings = [];
  const results = summary.results ?? [];

  if (results.length === 0) failures.push("no run was played");
  for (const result of results) {
    if (!result.ok) {
      failures.push(
        describeRun(result, result.error ? `the run failed: ${result.error}` : "the run did not boot cleanly"),
      );
    }
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
    if (result.machine?.gpu === "low-power" && result.machine.drewOnIntegratedGpu !== true) {
      failures.push(describeRun(result, `asked for the integrated GPU, drew on ${result.gpu ?? "an unknown GPU"}`));
    }
    const played = (result.steps ?? []).map((step) => step.name);
    const missing = (result.expectedSteps ?? []).filter((name) => !played.includes(name));
    if (missing.length) failures.push(describeRun(result, `steps not played: ${missing.join(", ")}`));
    if (!result.expectedSteps?.length) failures.push(describeRun(result, "the run declares no steps to play"));
    for (const step of result.steps ?? []) {
      if (step.verdict?.status === "failed")
        failures.push(describeRun(result, `${step.name} failed: ${step.verdict.reason}`));
      if (step.verdict?.status === "blocked")
        warnings.push(describeRun(result, `${step.name} blocked: ${step.verdict.reason}`));
      if (!step.verdict) failures.push(describeRun(result, `${step.name} has no verdict`));
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
    failures.push(...rendererMismatches(result));
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
  const actions = compareClickToResult(baseline, current);
  failures.push(...actions.failures);

  return { failures, ok: failures.length === 0, newActions: actions.newActions };
}

/** A completed action step's press-to-result total, as a summary spreads it across runs. */
const CLICK_TO_RESULT_TOTAL = "verdict.clickToResult.totalMs";
/** A result shows only at a frame: a run landing one 60 Hz frame later than the baseline's slowest is not a regression. */
const ONE_FRAME_MS = 1000 / 60;

/**
 * Every action the baseline timed, judged in the current summary: it fails when its renderer mode or its timed runs are
 * missing (blocked, failed or left out every time: a lost measurement is never a pass), or when its median is past the
 * baseline's slowest run by more than a frame (past the baseline's own spread, so run-to-run noise alone does not fail
 * it). Actions timed now that the baseline never timed are listed as new, not judged.
 */
function compareClickToResult(baseline, current) {
  const failures = [];
  const newActions = [];
  for (const [mode, { steps: baselineSteps = {} } = {}] of Object.entries(baseline.byMode ?? {})) {
    const timedBefore = Object.entries(baselineSteps).filter(([, metrics]) => metrics?.[CLICK_TO_RESULT_TOTAL]);
    if (timedBefore.length === 0) continue;
    const currentSteps = current.byMode?.[mode]?.steps;
    if (!currentSteps) {
      failures.push(`${mode}: the baseline times ${timedBefore.length} action(s) on this renderer, and none was run`);
      continue;
    }
    for (const [step, metrics] of timedBefore) {
      const before = metrics[CLICK_TO_RESULT_TOTAL];
      const now = currentSteps[step]?.[CLICK_TO_RESULT_TOTAL];
      if (!now) {
        failures.push(`${mode} ${step}: no timed run (verdicts ${JSON.stringify(currentSteps[step]?.verdicts ?? {})})`);
      } else if (now.median > before.max + ONE_FRAME_MS) {
        failures.push(
          `${mode} ${step}: click to result median ${Math.round(now.median)}ms (n=${now.n}) is past the baseline's slowest ${Math.round(before.max)}ms and a frame (median ${Math.round(before.median)}ms, n=${before.n})`,
        );
      }
    }
  }
  for (const [mode, { steps = {} }] of Object.entries(current.byMode ?? {})) {
    for (const [step, metrics] of Object.entries(steps)) {
      const timedBefore = baseline.byMode?.[mode]?.steps?.[step]?.[CLICK_TO_RESULT_TOTAL];
      if (metrics?.[CLICK_TO_RESULT_TOTAL] && !timedBefore) newActions.push(`${mode} ${step}`);
    }
  }
  return { failures, newActions };
}

export function collectBrowserErrors(browserErrors, consoleOutput, provoked = []) {
  const consoleFailures = parseLines(consoleOutput).filter((line) =>
    /\[error\]|manager.*timed? out|chunk transition hard timeout/i.test(line),
  );
  // A step that provokes a failure (a refused order) records what the client logged for it; that is its outcome.
  const provokedLines = new Set(provoked);
  return [...new Set([...parseLines(browserErrors), ...consoleFailures])].filter((line) => !provokedLines.has(line));
}

/**
 * The client's log of a refusal a step provoked: the error lines naming the one transaction it reported "not sent
 * (refused)" among `lines`. Any other error stays a browser error, whenever it was logged; with two refused
 * transactions among them the step cannot tell its own, and none is its.
 */
export function refusalErrors(lines) {
  const refused = new Set(lines.flatMap((line) => REFUSED_TRANSACTION.exec(line)?.[1] ?? []));
  if (refused.size !== 1) return [];
  const [hash] = refused;
  return lines.filter((line) => line.startsWith("[error]") && line.includes(hash));
}

const REFUSED_TRANSACTION = /Transaction (0x[0-9a-fA-F]+) not sent \(refused\)/;

/**
 * The client's log of a WebGL context a step lost on purpose (a phone's tab put away): three's own report and the game's
 * among `lines`, once each. Any other error stays a browser error.
 */
export function contextLossErrors(lines) {
  const ofTheLoss = lines.filter((line) => WEBGL_CONTEXT_LOSS.some((pattern) => pattern.test(line)));
  return ofTheLoss.length === WEBGL_CONTEXT_LOSS.length ? ofTheLoss : [];
}

const WEBGL_CONTEXT_LOSS = [
  /^\[error\] THREE\.THREE\.WebGPURenderer: WebGL Device Lost:$/,
  /^\[error\] \[RendererFailure\] kind="device_lost" renderer_mode="webgl2-fallback" /,
];

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

/** Per node host, then per JSON-RPC method: how many sends, refused, on a fresh connection, and their durations. */
export function summarizeRpcSends(sends) {
  const byHost = Object.groupBy(sends, (send) => send.host ?? "unknown");
  return Object.fromEntries(Object.entries(byHost).map(([host, hostSends]) => [host, summarizeRpcMethods(hostSends)]));
}

function summarizeRpcMethods(sends) {
  const byMethod = Object.groupBy(sends, (send) => send.rpcMethod ?? "unknown");
  return Object.fromEntries(
    Object.entries(byMethod).map(([method, methodSends]) => [
      method,
      {
        count: methodSends.length,
        refused: methodSends.filter((send) => !(send.status >= 200 && send.status < 300) || send.rpcError).length,
        freshConnections: methodSends.filter((send) => send.connectionReused === false).length,
        totalMs: distribution(methodSends.map((send) => send.totalMs)),
        freshConnectMs: distribution(
          methodSends.filter((send) => send.connectionReused === false).map((send) => send.connectMs),
        ),
      },
    ]),
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

/**
 * A run is evidence of the renderer it is labelled with only if that renderer ran: the renderer must have been asked
 * for the run's mode (a request the page lost before the renderer read it runs the default), and a WebGL run must
 * have run WebGL.
 */
function rendererMismatches(result) {
  const diagnostics = result.diagnostics;
  if (!diagnostics || !result.rendererMode) return [];
  const mismatches = [];
  if (diagnostics.requestedMode !== result.rendererMode)
    mismatches.push(
      describeRun(
        result,
        `the renderer was asked for ${diagnostics.requestedMode ?? "nothing"}, not ${result.rendererMode}`,
      ),
    );
  if (result.rendererMode === "webgpu-force-webgl" && diagnostics.activeMode !== "webgl2-fallback")
    mismatches.push(describeRun(result, `WebGL was asked for, but ${diagnostics.activeMode ?? "no renderer"} ran`));
  return mismatches;
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
