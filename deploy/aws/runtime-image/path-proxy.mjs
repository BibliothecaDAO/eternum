import http from "node:http";
import net from "node:net";

const publicPort = Number(process.env.PUBLIC_PORT || "8080");
const internalPort = Number(process.env.INTERNAL_PORT || "8081");
const runtimeBasePath = (process.env.RUNTIME_BASE_PATH || "").replace(/\/+$/, "");

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

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  const upstreamPath = stripBasePath(request.url || "/");
  if (!upstreamPath) {
    writeNotFound(response);
    return;
  }

  if (upstreamPath === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
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
