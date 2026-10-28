import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { DESKTOP_MIN_WIDTH, HUD_LAYOUT_EXPRESSION } from "./hud-layout.mjs";

const AGENT_BROWSER_RETRIES = 2;
const AGENT_BROWSER_RETRY_DELAY_MS = 2_000;
const RETRYABLE_COMMANDS = new Set(["console", "errors", "eval", "screenshot"]);
const TRANSIENT_FAILURE_PATTERNS = [
  "CDP command timed out",
  "Failed to read: Resource temporarily unavailable",
  "daemon may be busy or unresponsive",
];
/** The page's size, 1920 by 1080 unless the run asks for another (`--viewport`); steps read it as they play. */
export const VIEWPORT = { width: 1920, height: 1080 };

/** Plays the run at another page size. */
export const setViewport = ({ width, height }) => Object.assign(VIEWPORT, { width, height });

/**
 * One agent-browser session on one browser profile: commands as a player gives them, and reads of what the page shows.
 * Every command names the profile: agent-browser relaunches the browser on a temporary one for a command that does not.
 */
export function createBrowserSession(session, { headed, profile }) {
  const sessionArgs = ["--session", session, "--profile", profile, ...(headed ? ["--headed"] : [])];
  const invoke = (commandArgs) =>
    spawnSync("npx", ["-y", "agent-browser", ...sessionArgs, ...commandArgs], {
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
      throw new Error(
        withoutNpmNoise(result.stderr) || withoutNpmNoise(result.stdout) || `agent-browser ${commandArgs[0]} failed`,
      );
    }
    return result.stdout.trim();
  };

  // agent-browser prints an evaluated string as JSON; this returns the page's value as the string it was.
  const evaluate = (expression) => {
    const parsed = JSON.parse(run(["eval", expression]) || "null");
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  };
  const read = (expression) => JSON.parse(evaluate(expression) || "null");

  return {
    run,
    eval: evaluate,
    read,
    click: (name) => run(["find", "role", "button", "click", "--name", name, "--exact"]),
    clickTab: (name) => run(["find", "role", "tab", "click", "--name", name, "--exact"]),
    press: (key) => run(["press", key]),
    tap: (offset) => run(["batch", ...tapCommands(offset)]),
    tapPlace: (word) => {
      const at = read(placeSlotExpression(word));
      if (!at) throw new Error(`The place bar shows no ${word}`);
      run(["batch", `mouse move ${at.x} ${at.y}`, "mouse down", "mouse up"]);
    },
    hover: (offset) => run(["mouse", "move", ...screenPoint(offset).map(String)]),
    rightClick: (offset) => run(["batch", ...rightClickCommands(offset)]),
    screenshot: (path) => run(["screenshot", path]),
    observe: () => read(OBSERVE_EXPRESSION),
    orderBar: () => read(ORDER_BAR_EXPRESSION),
    armies: () => read(ARMIES_EXPRESSION),
    hudLayout: () => read(HUD_LAYOUT_EXPRESSION),
    close: () => run(["close"], { allowFailure: true }),
  };
}

/** npx prints its own config warnings before the command's output; they are never the reason a command failed. */
const withoutNpmNoise = (output) =>
  output
    .split("\n")
    .filter((line) => !line.startsWith("npm warn"))
    .join("\n")
    .trim();

/** A point at an offset from the screen's centre, where selecting an army puts it. */
const screenPoint = ([dx, dy]) => [VIEWPORT.width / 2 + dx, VIEWPORT.height / 2 + dy];

/**
 * The centre of a phone's place-bar slot, found by its word: a count of what is unread stands beside the word in the
 * button's name, so the name alone does not find it.
 */
const placeSlotExpression = (word) => `JSON.stringify((() => {
  const slot = [...document.querySelectorAll('nav[aria-label="Places"] button')].find(
    (button) => button.lastElementChild?.textContent.trim() === ${JSON.stringify(word)},
  );
  const rect = slot?.getBoundingClientRect();
  // agent-browser's mouse takes whole pixels.
  return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
})())`;

function tapCommands(offset) {
  const [x, y] = screenPoint(offset);
  return [`mouse move ${x} ${y}`, "mouse down", "mouse up"];
}

function rightClickCommands(offset) {
  const [x, y] = screenPoint(offset);
  return [`mouse move ${x} ${y}`, "mouse down right", "mouse up right"];
}

/**
 * What a player can see that says where they are: the route's scene, the scene the renderer last drew, the lit place,
 * open sheets, the HUD's panels drawn (each by its name), selection, zoom.
 */
const OBSERVE_EXPRESSION = `JSON.stringify({
  path: location.pathname,
  scene: /\\/(map|hex)$/.exec(location.pathname)?.[1] ?? null,
  rendered: window.__rendererDiagnostics?.sceneName ?? null,
  selection: window.__eternumMapSelection ?? null,
  place:
    document.querySelector('nav[aria-label="Places"] [aria-current="page"]')?.textContent.trim() ??
    document.querySelector('[aria-label="Map view"] [role="tab"][aria-selected="true"]')?.textContent.trim() ??
    ({ world: "Realm", realm: "Map" })[document.querySelector('nav[aria-label="Places"] [data-switch]')?.dataset.switch] ??
    null,
  dialogs: [...document.querySelectorAll('[role="dialog"]')].map((dialog) => dialog.getAttribute("aria-label")),
  panels: [...document.querySelectorAll("section.ui-panel[aria-label]")]
    .filter((panel) => panel.checkVisibility({ visibilityProperty: true }))
    .map((panel) => panel.getAttribute("aria-label")),
  pressed: [...document.querySelectorAll('button[aria-pressed="true"]')].map((button) => button.getAttribute("aria-label")),
  worldmapDistance: JSON.parse(localStorage.getItem("eternum-camera-zoom") ?? "null")?.state?.worldmapDistance ?? null,
  playable: (window.__eternumGameEntryTimeline ?? []).some((milestone) => milestone.name === "world-interactive"),
  timeOrigin: performance.timeOrigin,
  now: performance.now(),
})`;

// The player's army buttons on the HUD, each with the stamina its meter shows. An open slot (Deploy, or one waiting for
// an earlier slot) is drawn as a row like an army's, its meter the stamina its army would start on: it is no army.
const ARMIES_EXPRESSION = `JSON.stringify([...document.querySelectorAll('nav[aria-label="Armies"] button[aria-pressed]')].filter((button) => !button.disabled && button.getAttribute("aria-label") !== "Deploy").map((button) => ({
  label: button.getAttribute("aria-label"),
  stamina: Number(button.querySelector('[role="meter"]')?.getAttribute("aria-valuenow") ?? NaN),
})))`;

// A button's text ends with its key hint; the leading words are its name.
/** The order bar a phone's tap pinned: the order its row names, and whether a cost of it is short; null with none. */
const ORDER_BAR_EXPRESSION = `JSON.stringify((() => {
  const bar = [...document.querySelectorAll("section[aria-label]")].find((section) =>
    /^(Explore|Move)$/.test(section.getAttribute("aria-label")),
  );
  return bar ? { verb: bar.getAttribute("aria-label"), short: Boolean(bar.querySelector('[data-tone="bad"]')) } : null;
})())`;

/** A busy machine times out CDP calls now and then; a read can be asked again, an action cannot. */
function isTransientFailure(commandArgs, result) {
  const output = `${result.stderr}\n${result.stdout}`;
  return (
    result.status !== 0 &&
    RETRYABLE_COMMANDS.has(commandArgs[0]) &&
    TRANSIENT_FAILURE_PATTERNS.some((pattern) => output.includes(pattern))
  );
}

/**
 * A DevTools connection to the run's page, for what page scripts cannot do: throttle the CPU, and see a cross-origin
 * request's connection. Chrome drops its overrides when the connection closes, so it stays open for the whole run.
 */
export async function openPageDevTools(browser) {
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
    /** A command to the browser itself (its tabs), not the driven page. */
    sendToBrowser: (method, params) => send(method, params),
    /** The driven page's tab. */
    targetId: page.targetId,
    /** Calls `listener` with every event the browser sends; the returned function stops it. */
    onEvent: (listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    close: () => socket.close(),
  };
}

/**
 * A phone's touch below a desktop's width, none at a desktop's (DevTools' Emulation.setTouchEmulationEnabled): with it
 * `(pointer: coarse)` matches and the page counts touch points, as on a phone. Headless Chrome has no pointer at all, so
 * without it a phone-width page draws no phone rule (a finger's size). A page's mouse commands still play as before.
 */
const touchEmulation = (width) => ({ enabled: width < DESKTOP_MIN_WIDTH, maxTouchPoints: 5 });

/** That touch on the driven page, held while `devTools` stays open. */
export const touchAtPhoneWidth = (devTools, width) =>
  devTools.send("Emulation.setTouchEmulationEnabled", touchEmulation(width));

/**
 * Every JSON-RPC POST the page makes to a node (the shard's, the L2's), by host (the play POST is
 * `starknet_addInvokeTransaction`), with whether it went out on a
 * reused connection and what a fresh one cost, how it was answered (the HTTP status, and the JSON-RPC error if the node
 * refused it), and every CORS preflight the browser sent before one (`rpcMethod` "preflight"). The RPC host sends no
 * Timing-Allow-Origin, so only DevTools sees this. Its clock is not the page's: these are durations and connection
 * facts, in send order, never page times.
 */
export async function recordRpcSends(devTools) {
  const sends = new Map();
  devTools.onEvent(({ method, params }) => {
    if (method === "Network.requestWillBeSent" && isRpcRequest(params.request)) {
      sends.set(params.requestId, {
        host: new URL(params.request.url).host,
        rpcMethod: rpcMethodOf(params.request),
        startedAt: params.timestamp,
      });
    }
    const send = sends.get(params?.requestId);
    if (method === "Network.responseReceived" && send) {
      Object.assign(send, { status: params.response.status, ...describeConnection(params.response) });
    }
    if (method === "Network.loadingFinished" && send) {
      send.totalMs = round((params.timestamp - send.startedAt) * 1000);
      if (send.rpcMethod !== "preflight")
        readRpcError(devTools, params.requestId).then((error) => (send.rpcError = error));
    }
  });
  await devTools.send("Network.enable");
  return () => [...sends.values()].map(({ startedAt, ...send }) => send);
}

/**
 * Holds the page's order sends (`starknet_addInvokeTransaction`) at the network, so a step can act while an order is in
 * flight for as long as it needs, then lets them reach the node or answers them as a node refusing the transaction
 * does (a JSON-RPC validation failure), without them ever reaching it. Every other RPC request passes at once, and
 * nothing is paused once the gate is closed.
 */
export async function openOrderSendGate(devTools) {
  const held = [];
  const stopListening = devTools.onEvent(({ method, params }) => {
    if (method !== "Fetch.requestPaused") return;
    if (isOrderSend(params.request)) held.push({ requestId: params.requestId, id: rpcIdOf(params.request) });
    else void devTools.send("Fetch.continueRequest", { requestId: params.requestId });
  });
  await devTools.send("Fetch.enable", { patterns: [{ urlPattern: "*/rpc/*", requestStage: "Request" }] });
  const release = () =>
    Promise.all(held.splice(0).map(({ requestId }) => devTools.send("Fetch.continueRequest", { requestId })));
  return {
    held: () => held.length,
    release,
    refuse: () =>
      Promise.all(
        held.splice(0).map(({ requestId, id }) => devTools.send("Fetch.fulfillRequest", refusal(requestId, id))),
      ),
    close: async () => {
      await release();
      await devTools.send("Fetch.disable");
      stopListening();
    },
  };
}

const rpcIdOf = (request) => JSON.parse(request.postData ?? "{}").id ?? null;

/** The node's answer to a transaction its account refuses: Starknet's VALIDATION_FAILURE. */
const refusal = (requestId, id) => ({
  requestId,
  responseCode: 200,
  responseHeaders: [
    { name: "content-type", value: "application/json" },
    { name: "access-control-allow-origin", value: "*" },
  ],
  body: Buffer.from(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code: 55, message: "Account validation failed", data: "refused" } }),
  ).toString("base64"),
});

const isOrderSend = (request) => request.method === "POST" && rpcMethodOf(request) === "starknet_addInvokeTransaction";

/** The node's JSON-RPC error for a request it answered, or null; unread bodies count as unknown, not as accepted. */
const readRpcError = (devTools, requestId) =>
  devTools.send("Network.getResponseBody", { requestId }).then(
    ({ body }) => JSON.parse(body).error?.message ?? null,
    () => "unread",
  );

const isRpcRequest = (request) =>
  (request.method === "POST" || request.method === "OPTIONS") && /\/rpc\//.test(new URL(request.url).pathname);

const rpcMethodOf = (request) =>
  request.method === "OPTIONS" ? "preflight" : (/"method"\s*:\s*"(\w+)"/.exec(request.postData ?? "")?.[1] ?? null);

function describeConnection({ connectionReused, timing }) {
  const span = (from, to) => (timing && timing[from] >= 0 && timing[to] >= 0 ? round(timing[to] - timing[from]) : null);
  return {
    connectionReused,
    connectMs: span("connectStart", "connectEnd"),
    tlsMs: span("sslStart", "sslEnd"),
    waitMs: span("sendEnd", "receiveHeadersEnd"),
  };
}

const round = (value) => Math.round(value * 10) / 10;
