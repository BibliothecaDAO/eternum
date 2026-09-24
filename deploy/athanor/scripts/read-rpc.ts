import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { permitsAccountRequest, type ShardIdentity } from "./account-rpc-policy";
import { accountRequestLimiter, rpcClientAddress } from "./rpc-client-limit";

const READ_METHODS = new Set([
  "starknet_specVersion",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_blockHashAndNumber",
  "starknet_syncing",
  "starknet_getBlockWithTxHashes",
  "starknet_getBlockWithTxs",
  "starknet_getBlockWithReceipts",
  "starknet_getStateUpdate",
  "starknet_getStorageAt",
  "starknet_getTransactionStatus",
  "starknet_getTransactionByHash",
  "starknet_getTransactionByBlockIdAndIndex",
  "starknet_getTransactionReceipt",
  "starknet_getClass",
  "starknet_getClassHashAt",
  "starknet_getClassAt",
  "starknet_getBlockTransactionCount",
  "starknet_call",
  "starknet_estimateMessageFee",
  "starknet_getEvents",
  "starknet_getNonce",
  "starknet_getStorageProof",
  "starknet_traceTransaction",
  "starknet_traceBlockTransactions",
  "starknet_getCompiledCasm",
]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isRead(call: unknown): boolean {
  if (!call || typeof call !== "object" || Array.isArray(call)) return false;
  const request = call as Record<string, unknown>;
  return request.jsonrpc === "2.0" && typeof request.method === "string" && READ_METHODS.has(request.method);
}

function refuse(code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: CORS });
}

// Replaces direct public forwarding: reads, the host operator and manifest-bound account management may reach the fee-free node.
export function startReadRpc(
  upstream: string,
  port: number,
  identity: ShardIdentity,
  trustedProxy?: string,
  hostname = "0.0.0.0",
) {
  const node = new URL(upstream);
  if (node.protocol !== "http:" || node.username || node.password || node.pathname !== "/") {
    throw new Error("NODE_RPC_URL must be the private node's HTTP origin");
  }
  if (trustedProxy && !isIP(trustedProxy)) throw new Error("RPC_TRUSTED_PROXY must be one IP address");
  if (
    ![identity.accountClassHash, identity.guardianPublicKey, identity.operatorAccountAddress].every(
      (v) => /^0x[0-9a-fA-F]+$/.test(v) && BigInt(v) > 0n,
    )
  ) {
    throw new Error("Shard init state must contain its account class, guardian key and operator address");
  }
  const allowance = accountRequestLimiter();
  return Bun.serve({
    hostname,
    port,
    maxRequestBodySize: 1024 * 1024,
    fetch(request, server) {
      const peer = server.requestIP(request)?.address;
      const client = peer ? rpcClientAddress(peer, trustedProxy, request.headers) : undefined;
      return handlePublicRequest(request, node, identity, client, allowance);
    },
  });
}

async function readNodeClass(node: URL, sender: string) {
  const response = await fetch(new URL("/rpc/v0_10_2", node), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_getClassHashAt",
      params: ["pre_confirmed", sender],
    }),
    signal: AbortSignal.timeout(5000),
  });
  const value = (await response.json()) as { result?: string };
  if (!value.result) throw new Error("Sender class is unavailable");
  return value.result;
}

async function handlePublicRequest(
  request: Request,
  node: URL,
  identity: ShardIdentity,
  client: string | undefined,
  allowance: ReturnType<typeof accountRequestLimiter>,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!/^\/(?:rpc\/v0_\d+_\d+)?$/.test(path)) return refuse(-32601, "RPC path is not public", 404);
  // Public state streams use Herald; exposing an unfiltered node WebSocket would bypass this boundary.
  if (request.headers.has("upgrade")) return refuse(-32601, "RPC upgrades are not public", 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return refuse(-32600, "POST required", 405);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return refuse(-32700, "Invalid JSON", 400);
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  if (!calls.length) return refuse(-32601, "RPC method is not public");
  const operations = calls.filter((call) => !isRead(call));
  if (operations.length) {
    if (!client || !allowance(client, operations.length)) {
      return refuse(-32005, "Account operation rate exceeded", 429);
    }
    for (const call of operations) {
      if (
        !call ||
        typeof call !== "object" ||
        call.jsonrpc !== "2.0" ||
        !(await permitsAccountRequest(call, identity, (sender) => readNodeClass(node, sender)))
      )
        return refuse(-32601, "RPC method is not public");
    }
  }
  try {
    const response = await fetch(new URL(path, node), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    return new Response(response.body, {
      status: response.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch {
    return refuse(-32000, "Node unavailable", 502);
  }
}

if (import.meta.main) {
  if (!process.env.NODE_RPC_URL) throw new Error("NODE_RPC_URL is required");
  if (!process.env.NATIVE_WORLD_MANIFEST) throw new Error("NATIVE_WORLD_MANIFEST is required");
  const port = Number(process.env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error(`Invalid PORT ${process.env.PORT}`);
  const manifest = JSON.parse(readFileSync(process.env.NATIVE_WORLD_MANIFEST, "utf8"));
  const deployment = JSON.parse(
    readFileSync(join(dirname(process.env.NATIVE_WORLD_MANIFEST), "gameplay-contracts.json"), "utf8"),
  );
  startReadRpc(
    process.env.NODE_RPC_URL,
    port,
    { ...manifest.shard, operatorAccountAddress: deployment.operatorAccountAddress },
    process.env.RPC_TRUSTED_PROXY,
  );
}
