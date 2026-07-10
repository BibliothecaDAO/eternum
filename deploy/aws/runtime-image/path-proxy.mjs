import http from "node:http";
import net from "node:net";

const publicPort = positiveInteger(process.env.PUBLIC_PORT, 8080);
const internalPort = positiveInteger(process.env.INTERNAL_PORT, 8081);
const runtimeBasePath = (process.env.RUNTIME_BASE_PATH || "").replace(/\/+$/, "");
const runtimeKind = process.env.RUNTIME_KIND || "torii";
const exposurePolicy = process.env.RUNTIME_EXPOSURE_POLICY || "public-read";
const healthCacheMs = nonNegativeInteger(process.env.PROXY_HEALTH_CACHE_MS, 5000);
const maxBodyBytes = positiveInteger(process.env.PROXY_MAX_BODY_BYTES, 1_048_576);
const maxUrlBytes = positiveInteger(process.env.PROXY_MAX_URL_BYTES, 8192);
const upstreamTimeoutMs = positiveInteger(process.env.PROXY_UPSTREAM_TIMEOUT_MS, 30_000);
const websocketIdleTimeoutMs = positiveInteger(process.env.PROXY_WEBSOCKET_IDLE_TIMEOUT_MS, 300_000);
const maxWebsocketConnections = positiveInteger(process.env.PROXY_MAX_WEBSOCKET_CONNECTIONS, 100);
const allowedCorsOrigins = new Set(parseCsv(process.env.PROXY_CORS_ORIGINS));
let cachedHealth = null;
let activeWebsocketConnections = 0;

const server = http.createServer(handleHttpRequest);
server.headersTimeout = positiveInteger(process.env.PROXY_HEADERS_TIMEOUT_MS, 10_000);
server.requestTimeout = positiveInteger(process.env.PROXY_REQUEST_TIMEOUT_MS, 35_000);
server.keepAliveTimeout = positiveInteger(process.env.PROXY_KEEP_ALIVE_TIMEOUT_MS, 5_000);
server.on("upgrade", handleUpgradeRequest);
server.on("clientError", (_error, socket) => writeSocketResponse(socket, 400, "Bad Request"));
server.listen(publicPort, "0.0.0.0");

async function handleHttpRequest(request, response) {
  try {
    if (!hasValidRequestUrl(request)) {
      writeJson(response, 414, { error: "request URL is too long" });
      return;
    }

    const origin = resolveAllowedOrigin(request.headers.origin);
    if (request.headers.origin && !origin) {
      writeJson(response, 403, { error: "origin is not allowed" });
      return;
    }

    if (request.method === "OPTIONS") {
      writeCorsPreflight(response, origin);
      return;
    }

    if (request.url === "/health") {
      writeHealth(response, await probeRuntimeHealth());
      return;
    }

    const upstreamPath = stripBasePath(request.url || "/");
    if (!upstreamPath) {
      writeJson(response, 404, { error: "runtime path not found" });
      return;
    }

    if (upstreamPath === "/health") {
      writeHealth(response, await probeRuntimeHealth());
      return;
    }

    const body = await readRequestBody(request);
    assertValidStructuredBody(request, body);
    if (isBlockedMutation(request, body)) {
      writeJson(response, 403, { error: "runtime mutation endpoint requires an identity gateway" });
      return;
    }

    proxyHttpRequest(request, response, upstreamPath, body, origin);
  } catch (error) {
    if (!response.headersSent) {
      const status = error?.statusCode || (error?.code === "BODY_TOO_LARGE" ? 413 : 502);
      writeJson(response, status, { error: errorMessage(error) });
    } else {
      response.destroy(error instanceof Error ? error : undefined);
    }
  }
}

function assertValidStructuredBody(request, body) {
  if (body.length === 0 || !`${request.headers["content-type"] || ""}`.includes("application/json")) {
    return;
  }

  try {
    JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function stripBasePath(url) {
  if (!runtimeBasePath || url === "/health") {
    return url;
  }

  if (url === runtimeBasePath) {
    return "/";
  }

  if (url.startsWith(`${runtimeBasePath}/`)) {
    return url.slice(runtimeBasePath.length) || "/";
  }

  return null;
}

function writeHealth(response, health) {
  writeJson(response, health.ok ? 200 : 503, health);
}

function probeKatanaHealth() {
  return probeHttpHealth({
    method: "POST",
    path: "/rpc/v0_9",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
    validateBody: (body) => {
      const payload = JSON.parse(body);
      return typeof payload.result === "string" && payload.result.length > 0 && payload.error === undefined;
    },
  });
}

function probeToriiHealth() {
  return probeHttpHealth({
    method: "GET",
    path: "/sql?query=SELECT%201%20AS%20ok",
    validateBody: (body) => {
      const payload = JSON.parse(body);
      return Array.isArray(payload) && Number(payload[0]?.ok) === 1;
    },
  });
}

function probeHttpHealth(options) {
  return new Promise((resolve) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: internalPort,
        method: options.method,
        path: options.path,
        headers: options.headers,
        timeout: 2000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const hasHealthyStatus = (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300;
          try {
            const hasHealthyBody = options.validateBody(Buffer.concat(chunks).toString("utf8"));
            resolve({ ok: hasHealthyStatus && hasHealthyBody });
          } catch (error) {
            resolve({ ok: false, error: `invalid health response: ${errorMessage(error)}` });
          }
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("upstream health probe timed out")));
    request.on("error", (error) => resolve({ ok: false, error: error.message }));

    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

async function probeRuntimeHealth() {
  const now = Date.now();
  if (cachedHealth && healthCacheMs > 0 && now - cachedHealth.checkedAt < healthCacheMs) {
    return cachedHealth;
  }

  const result = runtimeKind === "katana" ? await probeKatanaHealth() : await probeToriiHealth();
  cachedHealth = {
    ok: result.ok,
    runtimeKind,
    checkedAt: now,
    ...(result.error ? { error: result.error } : {}),
  };
  return cachedHealth;
}

function proxyHttpRequest(clientRequest, clientResponse, upstreamPath, body, origin) {
  const headers = buildUpstreamHeaders(clientRequest.headers, body.length);
  const upstreamRequest = http.request(
    {
      host: "127.0.0.1",
      port: internalPort,
      method: clientRequest.method,
      path: upstreamPath,
      headers,
      timeout: upstreamTimeoutMs,
    },
    (upstreamResponse) => {
      const responseHeaders = buildClientResponseHeaders(upstreamResponse.headers, origin);
      clientResponse.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(clientResponse);
    },
  );

  upstreamRequest.on("timeout", () => upstreamRequest.destroy(new Error("upstream request timed out")));
  upstreamRequest.on("error", (error) => {
    if (!clientResponse.headersSent) {
      writeJson(clientResponse, 502, { error: error.message });
    } else {
      clientResponse.destroy(error);
    }
  });

  if (body.length > 0) {
    upstreamRequest.write(body);
  }
  upstreamRequest.end();
}

async function readRequestBody(request) {
  const contentLength = Number(request.headers["content-length"] || "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw bodyTooLargeError();
  }

  const chunks = [];
  let bytesRead = 0;
  for await (const chunk of request) {
    bytesRead += chunk.length;
    if (bytesRead > maxBodyBytes) {
      throw bodyTooLargeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function isBlockedMutation(request, body) {
  if (exposurePolicy === "public-dev-rpc") {
    return false;
  }

  if (["PUT", "PATCH", "DELETE"].includes(request.method || "")) {
    return true;
  }

  if (request.method !== "POST" || body.length === 0) {
    return false;
  }

  const text = body.toString("utf8");
  if (/\bmutation\b/i.test(text)) {
    return true;
  }

  try {
    const payloads = Array.isArray(JSON.parse(text)) ? JSON.parse(text) : [JSON.parse(text)];
    return payloads.some((payload) => /^(starknet_add|katana_|dev_)/i.test(`${payload?.method || ""}`));
  } catch {
    return false;
  }
}

function handleUpgradeRequest(request, socket, head) {
  if (
    !hasValidRequestUrl(request) ||
    !resolveAllowedOrigin(request.headers.origin, { allowMissing: true }) ||
    activeWebsocketConnections >= maxWebsocketConnections
  ) {
    writeSocketResponse(socket, activeWebsocketConnections >= maxWebsocketConnections ? 429 : 403, "Rejected");
    return;
  }

  const upstreamPath = stripBasePath(request.url || "/");
  if (!upstreamPath) {
    writeSocketResponse(socket, 404, "Not Found");
    return;
  }

  activeWebsocketConnections += 1;
  const upstream = net.connect(internalPort, "127.0.0.1", () => {
    writeUpgradeRequest(upstream, request, upstreamPath, head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.setTimeout(websocketIdleTimeoutMs, () => upstream.destroy());
  socket.setTimeout(websocketIdleTimeoutMs, () => socket.destroy());

  let closed = false;
  const releaseConnection = () => {
    if (!closed) {
      closed = true;
      activeWebsocketConnections -= 1;
    }
  };
  upstream.on("close", releaseConnection);
  socket.on("close", releaseConnection);
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

function writeUpgradeRequest(upstream, request, upstreamPath, head) {
  upstream.write(`${request.method} ${upstreamPath} HTTP/${request.httpVersion}\r\n`);
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        upstream.write(`${name}: ${item}\r\n`);
      }
    } else if (value !== undefined) {
      upstream.write(`${name}: ${value}\r\n`);
    }
  }
  upstream.write("\r\n");
  if (head.length > 0) {
    upstream.write(head);
  }
}

function buildUpstreamHeaders(headers, bodyLength) {
  const upstreamHeaders = { ...headers, host: `127.0.0.1:${internalPort}`, "content-length": `${bodyLength}` };
  for (const header of [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete upstreamHeaders[header];
  }
  return upstreamHeaders;
}

function buildClientResponseHeaders(headers, origin) {
  const responseHeaders = { ...headers };
  delete responseHeaders.connection;
  delete responseHeaders["keep-alive"];
  delete responseHeaders["proxy-authenticate"];
  delete responseHeaders["proxy-authorization"];
  delete responseHeaders.te;
  delete responseHeaders.trailer;
  delete responseHeaders["transfer-encoding"];
  delete responseHeaders.upgrade;

  if (origin) {
    responseHeaders["access-control-allow-origin"] = origin;
    responseHeaders.vary = appendVaryOrigin(responseHeaders.vary);
  }
  return responseHeaders;
}

function writeCorsPreflight(response, origin) {
  const headers = {
    "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "600",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  };
  response.writeHead(204, headers);
  response.end();
}

function resolveAllowedOrigin(origin, options = {}) {
  if (!origin) {
    return options.allowMissing ? "missing-origin" : undefined;
  }
  return allowedCorsOrigins.has(origin) ? origin : undefined;
}

function hasValidRequestUrl(request) {
  return Buffer.byteLength(request.url || "/", "utf8") <= maxUrlBytes;
}

function appendVaryOrigin(value) {
  const values = `${value || ""}`
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...values, "Origin"])].join(", ");
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function writeSocketResponse(socket, status, reason) {
  if (!socket.destroyed) {
    socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  }
}

function bodyTooLargeError() {
  const error = new Error(`request body exceeds ${maxBodyBytes} bytes`);
  error.code = "BODY_TOO_LARGE";
  return error;
}

function parseCsv(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
