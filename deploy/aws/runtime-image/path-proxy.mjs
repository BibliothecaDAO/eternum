import http from "node:http";
import net from "node:net";

const publicPort = Number(process.env.PUBLIC_PORT || "8080");
const internalPort = Number(process.env.INTERNAL_PORT || "8081");
const runtimeBasePath = (process.env.RUNTIME_BASE_PATH || "").replace(/\/+$/, "");
const runtimeKind = process.env.RUNTIME_KIND || "torii";
const healthCacheMs = Number(process.env.PROXY_HEALTH_CACHE_MS || "5000");
let cachedHealth = null;

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

function writeNotFound(response) {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "runtime path not found" }));
}

function writeHealth(response, health) {
  response.writeHead(health.ok ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify(health));
}

function probeKatanaHealth() {
  return probeHttpHealth({
    method: "POST",
    path: "/rpc/v0_9",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
  });
}

function probeToriiHealth() {
  return probeHttpHealth({ method: "GET", path: "/" });
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
        response.resume();
        response.on("end", () => resolve({ ok: (response.statusCode || 500) < 500 }));
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("upstream health probe timed out"));
    });
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

function proxyHttpRequest(clientRequest, clientResponse, upstreamPath) {
  const upstreamRequest = http.request(
    {
      host: "127.0.0.1",
      port: internalPort,
      method: clientRequest.method,
      path: upstreamPath,
      headers: clientRequest.headers,
    },
    (upstreamResponse) => {
      clientResponse.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
    },
  );

  upstreamRequest.on("error", (error) => {
    clientResponse.writeHead(502, { "content-type": "application/json" });
    clientResponse.end(JSON.stringify({ error: error.message }));
  });

  clientRequest.pipe(upstreamRequest);
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

const server = http.createServer(async (request, response) => {
  if (request.url === "/health") {
    writeHealth(response, await probeRuntimeHealth());
    return;
  }

  const upstreamPath = stripBasePath(request.url || "/");
  if (!upstreamPath) {
    writeNotFound(response);
    return;
  }

  if (upstreamPath === "/health") {
    writeHealth(response, await probeRuntimeHealth());
    return;
  }

  proxyHttpRequest(request, response, upstreamPath);
});

server.on("upgrade", (request, socket, head) => {
  const upstreamPath = stripBasePath(request.url || "/");
  if (!upstreamPath) {
    socket.destroy();
    return;
  }

  const upstream = net.connect(internalPort, "127.0.0.1", () => {
    writeUpgradeRequest(upstream, request, upstreamPath, head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
});

server.listen(publicPort, "0.0.0.0");
