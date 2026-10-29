/**
 * A shard's public RPC during its final backup, for a shard whose own proxy predates the write switch: backup.py
 * quiesce runs this in that proxy's place, under the same image, network alias and port. The value relay keeps
 * reading confirmed blocks, events and receipts, and so keeps paying, while every write is refused with the closure
 * message. It answers exactly the public reads read-rpc.ts answers, within the same request and batch bounds, and
 * nothing else.
 *
 *   NODE_RPC_URL=http://madara:9944 PORT=8080 bun deploy/shard/read-only-rpc.ts
 */
import { CORS, READ_METHODS, WRITE_METHODS, WRITES_CLOSED_MESSAGE } from "../athanor/scripts/public-rpc";
import {
  SHARD_RPC_MAX_BATCH_CALLS as MAX_BATCH_CALLS,
  SHARD_RPC_MAX_REQUEST_BYTES as MAX_REQUEST_BYTES,
} from "../../packages/value-ledger/src/shard-rpc-limits";

const PUBLIC_PATH = /^\/(?:rpc\/v0_\d+_\d+)?$/;
const FORWARD_TIMEOUT_MS = 5000;

type Call = { jsonrpc?: unknown; id?: unknown; method?: unknown };

/** Serves a node's public reads and refuses its writes; anything past the public bounds never reaches the node. */
export function readOnlyRpc(node: URL) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (!PUBLIC_PATH.test(path)) return refuse(-32601, "RPC path is not public", 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return refuse(-32600, "POST required", 405);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return tooLarge();
    let payload: unknown;
    try {
      const raw = await request.arrayBuffer();
      if (raw.byteLength > MAX_REQUEST_BYTES) return tooLarge();
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    } catch {
      return refuse(-32700, "Invalid JSON", 400);
    }
    const calls = (Array.isArray(payload) ? payload : [payload]) as Call[];
    if (calls.length > MAX_BATCH_CALLS) return refuse(-32600, `RPC batch exceeds ${MAX_BATCH_CALLS} calls`);
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

const tooLarge = () => refuse(-32600, `RPC request exceeds ${MAX_REQUEST_BYTES} bytes`, 413);

function refuse(code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: CORS });
}

/** The stand-in's server: Bun refuses a body past the public bound before the handler reads it. */
export function startReadOnlyRpc(node: URL, port: number, hostname = "0.0.0.0") {
  return Bun.serve({ hostname, port, maxRequestBodySize: MAX_REQUEST_BYTES, fetch: readOnlyRpc(node) });
}

if (import.meta.main) {
  const node = new URL(process.env.NODE_RPC_URL ?? "");
  if (node.protocol !== "http:" || node.pathname !== "/")
    throw new Error("NODE_RPC_URL must be the node's HTTP origin");
  startReadOnlyRpc(node, Number(process.env.PORT));
  console.log(JSON.stringify({ event: "read_only_rpc_ready" }));
}
