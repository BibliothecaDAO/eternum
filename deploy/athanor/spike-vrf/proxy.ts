// Throwaway spike COPY: never merge or reuse without rewrite.
import { hash } from "starknet";
import { ProverPool } from "./pool";
import { gamesTransaction, stampRequest, type Stamp, type RpcCall } from "./stamp";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { permitsAccountRequest, type ShardIdentity } from "../scripts/account-rpc-policy";
import { accountRequestLimiter, rpcClientAddress } from "../scripts/rpc-client-limit";

const READ_METHODS = new Set([
  "starknet_specVersion",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_blockHashAndNumber",
  "starknet_syncing",
  "starknet_getBlockWithTxHashes",
  "starknet_getStateUpdate",
  "starknet_getStorageAt",
  "starknet_getTransactionStatus",
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
  "starknet_getCompiledCasm",
]);
const BODY_READS = new Set([
  "starknet_getBlockWithTxs",
  "starknet_getBlockWithReceipts",
  "starknet_getTransactionByHash",
  "starknet_getTransactionByBlockIdAndIndex",
]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isRead(call: unknown): boolean {
  if (!call || typeof call !== "object" || Array.isArray(call)) return false;
  const request = call as Record<string, unknown>;
  return (
    request.jsonrpc === "2.0" &&
    typeof request.method === "string" &&
    (READ_METHODS.has(request.method) || BODY_READS.has(request.method))
  );
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
  stamp?: Stamp,
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
      return handlePublicRequest(request, node, identity, client, allowance, stamp);
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
  stamp?: Stamp,
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
  let calls = Array.isArray(payload) ? payload : [payload];
  if (!calls.length) return refuse(-32601, "RPC method is not public");
  try {
    for (const call of calls)
      if (BODY_READS.has(call?.method) && !(await sealedBodyRead(call, node)))
        return refuse(-32601, "Transaction body is not sealed");
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
          (!(stamp && (await permitsSpikeInvoke(call, stamp, node))) &&
            !(await permitsAccountRequest(call, identity, (sender) => readNodeClass(node, sender))))
        )
          return refuse(-32601, "RPC method is not public");
      }
    }
    if (stamp) calls = await Promise.all(calls.map((call) => stampRequest(call, stamp)));
    const forwarded = Array.isArray(payload) ? calls : calls[0];
    const response = await fetch(new URL(path, node), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwarded),
      signal: AbortSignal.timeout(30000),
      redirect: "manual",
    });
    if (!response.ok) return refuse(-32000, "Node unavailable", 502);
    const result = await response.json();
    const replies = Array.isArray(result) ? result : [result];
    const safe = calls.map((call) => {
      const reply = replies.find((reply: any) => reply.id === call.id);
      if (!reply) return { jsonrpc: "2.0", id: call.id, error: { code: -32000, message: "Node unavailable" } };
      if (call.method === "starknet_addInvokeTransaction") {
        const value = reply.result?.transaction_hash;
        return typeof value === "string" && /^0x[0-9a-f]{1,64}$/i.test(value)
          ? { jsonrpc: "2.0", id: call.id, result: { transaction_hash: value } }
          : { jsonrpc: "2.0", id: call.id, error: { code: -32000, message: "Transaction refused" } };
      }
      return reply;
    });
    return Response.json(Array.isArray(payload) ? safe : safe[0], { headers: CORS });
  } catch {
    return refuse(-32000, "Node unavailable", 502);
  }
}

async function sealedBodyRead(call: RpcCall, node: URL) {
  const params = call.params;
  let method: string, args: unknown[];
  if (call.method === "starknet_getTransactionByHash") {
    const hash = Array.isArray(params) ? params[0] : params?.transaction_hash;
    if (typeof hash !== "string" || !/^0x[0-9a-f]{1,64}$/i.test(hash)) return false;
    method = "starknet_getTransactionReceipt";
    args = [hash];
  } else {
    const block = Array.isArray(params) ? params[0] : params?.block_id;
    if (
      block !== "latest" &&
      !(
        block &&
        typeof block === "object" &&
        !Array.isArray(block) &&
        ((Number.isSafeInteger(block.block_number) && block.block_number >= 0) ||
          (typeof block.block_hash === "string" && /^0x[0-9a-f]{1,64}$/i.test(block.block_hash)))
      )
    )
      return false;
    method = "starknet_getBlockWithTxHashes";
    args = [block];
  }
  const response = await fetch(new URL("/rpc/v0_10_2", node), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: args }),
    signal: AbortSignal.timeout(5000),
    redirect: "manual",
  });
  if (!response.ok) return false;
  const result = ((await response.json()) as any).result;
  return ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(result?.finality_status ?? result?.status);
}

async function permitsSpikeInvoke(call: RpcCall, stamp: Stamp, node: URL): Promise<boolean> {
  const tx = gamesTransaction(call, stamp);
  if (!tx) return false;
  if (BigInt(await readNodeClass(node, tx.sender_address)) !== BigInt(stamp.accountClass)) return false;
  const response = await fetch(new URL("/rpc/v0_10_2", node), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_getNonce",
      params: ["pre_confirmed", tx.sender_address],
    }),
    signal: AbortSignal.timeout(5000),
  });
  const value = (await response.json()) as { result?: string };
  return value.result !== undefined && BigInt(value.result) === BigInt(tx.nonce);
}

if (import.meta.main) {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} required`);
    return value;
  };
  const manifestPath = required("NATIVE_WORLD_MANIFEST");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const deployment = JSON.parse(readFileSync(join(dirname(manifestPath), "gameplay-contracts.json"), "utf8"));
  const fixture = JSON.parse(readFileSync(required("SPIKE_PART2_FIXTURE"), "utf8"));
  if (typeof fixture.verifyProofs !== "boolean" || BigInt(fixture.chainId) !== BigInt(manifest.shard.chainId))
    throw new Error("Part2 proxy fixture mode/chain mismatch");
  const pool = fixture.verifyProofs ? new ProverPool(required("SPIKE_VRF_KEY_FILE"), 4) : undefined;
  if (pool) {
    const key = await pool.ready;
    if (
      !Array.isArray(fixture.vrfPublicKey) ||
      key.some((value, index) => BigInt(value) !== BigInt(fixture.vrfPublicKey[index]))
    )
      throw new Error("Part2 proxy VRF key mismatch");
  }
  const keyResponse = await fetch(new URL("/rpc/v0_10_2", required("NODE_RPC_URL")), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_call",
      params: [
        {
          contract_address: fixture.contract,
          entry_point_selector: hash.getSelectorFromName("vrf_config"),
          calldata: [],
        },
        "latest",
      ],
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  const keyAnswer = (await keyResponse.json()) as { result?: string[] };
  if (
    !keyResponse.ok ||
    keyAnswer.result?.length !== 3 ||
    keyAnswer.result.slice(0, 2).some((value, index) => BigInt(value) !== BigInt(fixture.vrfPublicKey[index])) ||
    BigInt(keyAnswer.result[2]!) !== BigInt(fixture.verifyProofs ? 1 : 0)
  )
    throw new Error("Proxy fixture differs from the game's constructor VRF key/mode");
  const server = startReadRpc(
    required("NODE_RPC_URL"),
    Number(required("PORT")),
    { ...manifest.shard, operatorAccountAddress: deployment.operatorAccountAddress },
    process.env.RPC_TRUSTED_PROXY,
    "127.0.0.1",
    {
      games: fixture.contract,
      chain: fixture.chainId,
      accountClass: fixture.accountClassHash,
      stamp: (tx, chain) => (pool ? pool.stamp(tx, chain) : Promise.resolve(tx)),
    },
  );
  process.once("SIGTERM", () => {
    server.stop(true);
    pool?.stop();
    process.exit(0);
  });
}
