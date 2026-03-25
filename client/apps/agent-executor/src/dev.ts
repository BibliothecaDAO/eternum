import { createServer } from "node:http";
import { Readable } from "node:stream";

import app from "./index";

const port = Number(process.env.PORT ?? 8788);

const server = createServer(async (request, response) => {
  try {
    const honoRequest = buildNodeRequest(request, port);
    const honoResponse = await app.fetch(honoRequest);

    response.writeHead(honoResponse.status, Object.fromEntries(honoResponse.headers.entries()));

    if (!honoResponse.body) {
      response.end();
      return;
    }

    const body = Readable.fromWeb(honoResponse.body as any);
    body.pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`agent-executor listening on http://127.0.0.1:${port}`);
});

function buildNodeRequest(request: Parameters<typeof createServer>[0], port: number): Request {
  const origin = `http://${request.headers.host ?? `127.0.0.1:${port}`}`;
  const url = new URL(request.url ?? "/", origin);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method ?? "GET",
    headers: request.headers as HeadersInit,
  };

  if (!isBodylessMethod(request.method)) {
    init.body = Readable.toWeb(request) as unknown as BodyInit;
    init.duplex = "half";
  }

  return new Request(url, init);
}

function isBodylessMethod(method: string | undefined): boolean {
  return method === "GET" || method === "HEAD";
}
