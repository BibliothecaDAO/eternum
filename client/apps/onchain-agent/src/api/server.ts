import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { JsonEmitter } from "../output/json-emitter";

export interface ApiDeps {
  enqueuePrompt: (content: string) => Promise<void>;
  getStatus: () => Record<string, unknown>;
  getState: () => Record<string, unknown>;
  shutdown: () => Promise<void>;
  applyConfig: (changes: Array<{ path: string; value: unknown }>) => Promise<unknown>;
  emitter: JsonEmitter;
}

interface AuthCallbackHandler {
  /** Called when /auth/callback receives session data from Cartridge redirect */
  onCallback: (sessionData: string) => void;
}

function respond(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export function createApiServer(
  deps: ApiDeps,
  port: number,
  host: string = "127.0.0.1",
  authCallback?: AuthCallbackHandler,
): { server: Server; close: () => Promise<void> } {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (req.method === "POST" && url.pathname === "/prompt") {
        const body = await collectBody(req);
        const { content } = JSON.parse(body);
        if (typeof content !== "string" || !content.trim()) {
          respond(res, 400, { error: "content is required" });
          return;
        }
        await deps.enqueuePrompt(content);
        respond(res, 200, { queued: true });
      } else if (req.method === "GET" && url.pathname === "/status") {
        respond(res, 200, deps.getStatus());
      } else if (req.method === "GET" && url.pathname === "/state") {
        respond(res, 200, deps.getState());
      } else if (req.method === "GET" && url.pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const unsub = deps.emitter.subscribe((event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        req.on("close", unsub);
      } else if (req.method === "POST" && url.pathname === "/config") {
        const body = await collectBody(req);
        const { changes } = JSON.parse(body);
        const result = await deps.applyConfig(changes);
        respond(res, 200, result);
      } else if (req.method === "POST" && url.pathname === "/shutdown") {
        respond(res, 200, { ok: true });
        setImmediate(() => deps.shutdown());
      } else if (url.pathname === "/auth/callback") {
        if (req.method === "GET") {
          // Browser redirect: Cartridge redirects here after approval.
          // Session data is in the ?startapp= query param (redirect_uri flow).
          const sessionData = url.searchParams.get("startapp");
          if (!sessionData) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<html><body>Missing session data in callback.</body></html>");
            return;
          }
          if (authCallback) {
            authCallback.onCallback(sessionData);
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><script>window.close();</script>Session registered successfully. You can close this window.</body></html>",
          );
        } else if (req.method === "POST") {
          // Server-side POST: Cartridge POSTs session data (callback_uri flow).
          const body = await collectBody(req);
          if (authCallback) {
            authCallback.onCallback(body);
          }
          respond(res, 200, { ok: true });
        } else {
          respond(res, 405, { error: "method not allowed" });
        }
      } else {
        respond(res, 404, { error: "not found" });
      }
    } catch (err) {
      respond(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.listen(port, host);

  return {
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
