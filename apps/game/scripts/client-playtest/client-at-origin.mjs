import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

/**
 * The candidate build answers for a deployed origin in the run's page only: every file the build holds is served from
 * it, and a page navigation that names no file gets its index.html, as the client's own host does. Every other request
 * (anything under `/api`, the chain, anything the build lacks) goes to the deployed origin. The page's origin stays the
 * deployed one, so what is bound to it (a passkey's origin, host-only cookies) works as for a player, while the deployed
 * client stays as it is for everyone else. Service workers are bypassed, so a cached deployed client cannot answer.
 *
 * The answers come from a worker thread on a DevTools connection of its own: the runner drives agent-browser with
 * synchronous commands, and a page load waiting on requests the runner's own thread must answer would never finish.
 */
export async function serveClientAtOrigin({ cdpUrl, targetId, distDir, origin }) {
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { role: WORKER_ROLE, cdpUrl, targetId, distDir, origin: new URL(origin).origin },
  });
  await new Promise((resolveReady, reject) => {
    worker.once("message", (message) =>
      message === "ready" ? resolveReady() : reject(new Error(`client at origin: ${message}`)),
    );
    worker.once("error", reject);
  });
  return {
    /** The paths served from the build so far. */
    served: () =>
      new Promise((resolveServed) => {
        worker.once("message", resolveServed);
        worker.postMessage("served");
      }),
    stop: () => worker.terminate(),
  };
}

/** One paused request answered: from the build, or let through to the network. */
export function answerPaused({ send, distDir, origin, served }, { requestId, request, resourceType }) {
  const file = clientFileFor(distDir, origin, request.url, resourceType);
  if (!file) return send("Fetch.continueRequest", { requestId });
  served.push(relative(distDir, file));
  return send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "content-type", value: CONTENT_TYPES[extname(file)] ?? "application/octet-stream" },
      { name: "cache-control", value: "no-store" },
    ],
    body: readFileSync(file).toString("base64"),
  });
}

/** The build's file for a request to the served origin, index.html for a navigation it holds no file for, else null. */
const clientFileFor = (distDir, served, url, resourceType) => {
  const { origin, pathname } = new URL(url);
  if (origin !== served || pathname.startsWith("/api/")) return null;
  const file = join(distDir, decodeURIComponent(pathname));
  if (!relative(distDir, file).startsWith("..") && existsSync(file) && statSync(file).isFile()) return file;
  return resourceType === "Document" ? join(distDir, "index.html") : null;
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".ktx2": "image/ktx2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};

const WORKER_ROLE = "client-at-origin";

/** The worker: attaches to the run's page, intercepts its origin, and answers until the runner stops it. */
async function runWorker({ cdpUrl, targetId, distDir, origin }) {
  const socket = new WebSocket(cdpUrl);
  await new Promise((resolveOpen, reject) => {
    socket.onopen = resolveOpen;
    socket.onerror = () => reject(new Error("could not open its DevTools connection"));
  });
  let nextId = 0;
  const replies = new Map();
  let sessionId;
  const send = (method, params = {}) =>
    new Promise((resolveReply, reject) => {
      nextId += 1;
      replies.set(nextId, (reply) =>
        reply.error ? reject(new Error(`${method}: ${reply.error.message}`)) : resolveReply(reply.result),
      );
      socket.send(JSON.stringify({ id: nextId, method, params, sessionId }));
    });
  const served = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) return replies.get(message.id)?.(message);
    if (message.method === "Fetch.requestPaused" && message.sessionId === sessionId)
      void answerPaused({ send, distDir, origin, served }, message.params).catch(() => {});
  };
  ({ sessionId } = await send("Target.attachToTarget", { targetId, flatten: true }));
  // The bypass holds only with the Network domain on: without it a service worker the build installed answers a reload
  // itself, from the network, where this page's interception never sees it.
  await send("Network.enable");
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/*`, requestStage: "Request" }] });
  parentPort.on("message", () => parentPort.postMessage([...served]));
  parentPort.postMessage("ready");
}

if (!isMainThread && workerData?.role === WORKER_ROLE)
  runWorker(workerData).catch((error) => parentPort.postMessage(error.message));
