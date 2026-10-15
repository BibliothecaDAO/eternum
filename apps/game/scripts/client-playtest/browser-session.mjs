import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const AGENT_BROWSER_RETRIES = 2;
const AGENT_BROWSER_RETRY_DELAY_MS = 2_000;
const RETRYABLE_COMMANDS = new Set(["console", "errors", "eval", "screenshot"]);
const TRANSIENT_FAILURE_PATTERNS = [
  "CDP command timed out",
  "Failed to read: Resource temporarily unavailable",
  "daemon may be busy or unresponsive",
];
export const VIEWPORT = { width: 1920, height: 1080 };

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
    press: (key) => run(["press", key]),
    tap: (offset) => run(["batch", ...tapCommands(offset)]),
    screenshot: (path) => run(["screenshot", path]),
    observe: () => read(OBSERVE_EXPRESSION),
    buttonTexts: () => read(BUTTON_TEXTS_EXPRESSION),
    armies: () => read(ARMIES_EXPRESSION),
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

/** A tap at an offset from the screen's centre, where selecting an army puts it. */
function tapCommands([dx, dy]) {
  const x = VIEWPORT.width / 2 + dx;
  const y = VIEWPORT.height / 2 + dy;
  return [`mouse move ${x} ${y}`, "mouse down", "mouse up"];
}

/**
 * What a player can see that says where they are: the route's scene, the scene the renderer last drew, the lit place,
 * open sheets, selection, zoom.
 */
const OBSERVE_EXPRESSION = `JSON.stringify({
  path: location.pathname,
  scene: /\\/(map|hex)$/.exec(location.pathname)?.[1] ?? null,
  rendered: window.__rendererDiagnostics?.sceneName ?? null,
  place: document.querySelector('nav[aria-label="Places"] [aria-current="page"]')?.textContent.trim() ?? null,
  dialogs: [...document.querySelectorAll('[role="dialog"]')].map((dialog) => dialog.getAttribute("aria-label")),
  pressed: [...document.querySelectorAll('button[aria-pressed="true"]')].map((button) => button.getAttribute("aria-label")),
  worldmapDistance: JSON.parse(localStorage.getItem("eternum-camera-zoom") ?? "null")?.state?.worldmapDistance ?? null,
  playable: (window.__eternumGameEntryTimeline ?? []).some((milestone) => milestone.name === "world-interactive"),
  timeOrigin: performance.timeOrigin,
  now: performance.now(),
})`;

// The player's army buttons on the HUD, each with the stamina its meter shows.
const ARMIES_EXPRESSION = `JSON.stringify([...document.querySelectorAll('nav[aria-label="Armies"] button[aria-pressed]')].map((button) => ({
  label: button.getAttribute("aria-label"),
  stamina: Number(button.querySelector('[role="meter"]')?.getAttribute("aria-valuenow") ?? NaN),
})))`;

// A button's text ends with its key hint; the leading words are its name.
const BUTTON_TEXTS_EXPRESSION = `JSON.stringify([...document.querySelectorAll("button")].map((button) => button.textContent.trim()).filter(Boolean))`;

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
    /** Calls `listener` with every event the browser sends; the returned function stops it. */
    onEvent: (listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    close: () => socket.close(),
  };
}

/**
 * Every JSON-RPC POST the page makes (the play POST is `starknet_addInvokeTransaction`), with whether it went out on a
 * reused connection and what a fresh one cost, and every CORS preflight the browser sent before one (`rpcMethod`
 * "preflight"). The RPC host sends no Timing-Allow-Origin, so only DevTools sees this. Its clock is not the page's:
 * these are durations and connection facts, in send order, never page times.
 */
export async function recordRpcSends(devTools) {
  const sends = new Map();
  devTools.onEvent(({ method, params }) => {
    if (method === "Network.requestWillBeSent" && isRpcRequest(params.request)) {
      sends.set(params.requestId, { rpcMethod: rpcMethodOf(params.request), startedAt: params.timestamp });
    }
    const send = sends.get(params?.requestId);
    if (method === "Network.responseReceived" && send) Object.assign(send, describeConnection(params.response));
    if (method === "Network.loadingFinished" && send) send.totalMs = round((params.timestamp - send.startedAt) * 1000);
  });
  await devTools.send("Network.enable");
  return () => [...sends.values()].map(({ startedAt, ...send }) => send);
}

/**
 * Holds the page's order sends (`starknet_addInvokeTransaction`) at the network, so a step can act while an order is in
 * flight for as long as it needs, then lets them go or fails them, as a send the network refused. Every other RPC
 * request passes at once, and nothing is paused once the gate is closed.
 */
export async function openOrderSendGate(devTools) {
  const held = [];
  const stopListening = devTools.onEvent(({ method, params }) => {
    if (method !== "Fetch.requestPaused") return;
    if (isOrderSend(params.request)) held.push(params.requestId);
    else void devTools.send("Fetch.continueRequest", { requestId: params.requestId });
  });
  await devTools.send("Fetch.enable", { patterns: [{ urlPattern: "*/rpc/*", requestStage: "Request" }] });
  const settleHeld = (method, params = {}) =>
    Promise.all(held.splice(0).map((requestId) => devTools.send(method, { requestId, ...params })));
  return {
    held: () => held.length,
    release: () => settleHeld("Fetch.continueRequest"),
    fail: () => settleHeld("Fetch.failRequest", { errorReason: "Failed" }),
    close: async () => {
      await settleHeld("Fetch.continueRequest");
      await devTools.send("Fetch.disable");
      stopListening();
    },
  };
}

const isOrderSend = (request) => request.method === "POST" && rpcMethodOf(request) === "starknet_addInvokeTransaction";

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
