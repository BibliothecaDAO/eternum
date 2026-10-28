/**
 * A shard's public RPC during its final backup, for a shard whose own proxy predates the write switch: backup.py
 * quiesce runs this in that proxy's place, under the same image, network alias and port. The value relay keeps
 * reading confirmed blocks, events and receipts, and so keeps paying, while every write is refused with the closure
 * message. It answers exactly the public reads read-rpc.ts answers and nothing else.
 *
 *   NODE_RPC_URL=http://madara:9944 PORT=8080 bun deploy/shard/read-only-rpc.ts
 */
import { CORS, READ_METHODS, WRITE_METHODS, WRITES_CLOSED_MESSAGE } from "../athanor/scripts/public-rpc";

const PUBLIC_PATH = /^\/(?:rpc\/v0_\d+_\d+)?$/;
const FORWARD_TIMEOUT_MS = 5000;

type Call = { jsonrpc?: unknown; id?: unknown; method?: unknown };

/** Serves a node's public reads and refuses its writes. */
export function readOnlyRpc(node: URL) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (!PUBLIC_PATH.test(path)) return refuse(-32601, "RPC path is not public", 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return refuse(-32600, "POST required", 405);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return refuse(-32700, "Invalid JSON", 400);
    }
    const calls = (Array.isArray(payload) ? payload : [payload]) as Call[];
    if (!calls.length) return refuse(-32601, "RPC method is not public");
    if (calls.some(isWrite)) return refuse(-32010, WRITES_CLOSED_MESSAGE, 503);
    if (!calls.every(isRead)) return refuse(-32601, "RPC method is not public");
    const answer = await fetch(new URL(path, node), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    }).catch(() => undefined);
    if (!answer) return refuse(-32012, "RPC read unavailable", 502);
    return new Response(answer.body, {
      status: answer.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  };
}

const isRead = (call: Call) =>
  !!call && call.jsonrpc === "2.0" && typeof call.method === "string" && READ_METHODS.has(call.method);
const isWrite = (call: Call) => !!call && typeof call.method === "string" && WRITE_METHODS.has(call.method);

function refuse(code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: CORS });
}

if (import.meta.main) {
  const node = new URL(process.env.NODE_RPC_URL ?? "");
  if (node.protocol !== "http:" || node.pathname !== "/")
    throw new Error("NODE_RPC_URL must be the node's HTTP origin");
  Bun.serve({ hostname: "0.0.0.0", port: Number(process.env.PORT), fetch: readOnlyRpc(node) });
  console.log(JSON.stringify({ event: "read_only_rpc_ready" }));
}
