import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { hash } from "starknet";
import type { StampProvider } from "../vrf/native";
import { startStampPool, workerCount } from "../vrf/pool";
import { felt, gameInvoke, type PlayIdentity } from "../vrf/transaction";
import { permitsAccountRequest, type ShardIdentity } from "./account-rpc-policy";
import { accountRequestLimiter, rpcClientAddress } from "./rpc-client-limit";

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
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const READ_NOT_FOUND = new Map<number, string>([
  [20, "Contract not found"],
  [24, "Block not found"],
  [28, "Class hash not found"],
]);

function isRead(call: unknown): boolean {
  if (!call || typeof call !== "object" || Array.isArray(call)) return false;
  const request = call as Record<string, unknown>;
  return request.jsonrpc === "2.0" && typeof request.method === "string" && READ_METHODS.has(request.method);
}

function refuse(code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: CORS });
}

function privateNode(upstream: string): URL {
  const node = new URL(upstream);
  if (node.protocol !== "http:" || node.username || node.password || node.pathname !== "/") {
    throw new Error("NODE_RPC_URL must be the private node's HTTP origin");
  }
  return node;
}

// The node stays private: Games play/control-plane writes and manifest-bound device/account management share this endpoint.
export function startReadRpc(
  upstream: string,
  port: number,
  identity: ShardIdentity & PlayIdentity,
  stamper: StampProvider,
  trustedProxy?: string,
  hostname = "0.0.0.0",
) {
  const node = privateNode(upstream);
  if (trustedProxy && !isIP(trustedProxy)) throw new Error("RPC_TRUSTED_PROXY must be one IP address");
  if (
    ![identity.accountClassHash, identity.guardianPublicKey, identity.games].every(
      (v) => /^0x[0-9a-fA-F]+$/.test(v) && BigInt(v) > 0n,
    )
  ) {
    throw new Error("Shard init state must contain its account class, guardian key and Games address");
  }
  const allowance = accountRequestLimiter();
  const inFlightAccounts = new Set<string>();
  return Bun.serve({
    hostname,
    port,
    maxRequestBodySize: 1024 * 1024,
    fetch(request, server) {
      const peer = server.requestIP(request)?.address;
      const client = peer ? rpcClientAddress(peer, trustedProxy, request.headers) : undefined;
      return handlePublicRequest(request, node, identity, stamper, client, allowance, inFlightAccounts);
    },
  });
}

async function readNodeClass(node: URL, sender: string): Promise<string> {
  const value = await nodeCall(node, "starknet_getClassHashAt", ["pre_confirmed", sender]);
  if (typeof value !== "string" || felt(value) === undefined) throw new Error("Sender class is unavailable");
  return value;
}

async function handlePublicRequest(
  request: Request,
  node: URL,
  identity: ShardIdentity & PlayIdentity,
  stamper: StampProvider,
  client: string | undefined,
  allowance: ReturnType<typeof accountRequestLimiter>,
  inFlightAccounts: Set<string>,
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
  const operations = calls.filter((call) => !isRead(call) && !isGameRequest(call, identity));
  if (operations.length && (!client || !allowance(client, operations.length))) {
    return refuse(-32005, "Account operation rate exceeded", 429);
  }
  let admitted: (Admitted | undefined)[];
  try {
    // Validate the entire batch before producing any proof. Independent accounts then stamp concurrently.
    admitted = await Promise.all(calls.map((call) => admitRequest(call, node, identity)));
  } catch {
    return calls.some((call) => isWrite(call as RpcCall))
      ? refuse(-32010, "Transaction refused", 502)
      : refuse(-32012, "RPC read unavailable", 502);
  }
  if (admitted.some((call) => !call)) return refuse(-32601, "RPC method is not public");
  const answers = await Promise.all(
    admitted.map((call) => forwardRequest(call!, path, node, identity, stamper, inFlightAccounts)),
  );
  return Response.json(Array.isArray(payload) ? answers : answers[0], { headers: CORS });
}

type RpcCall = { jsonrpc: "2.0"; id?: unknown; method: string; params?: unknown };
type Admitted = { call: RpcCall; game?: NonNullable<ReturnType<typeof gameInvoke>> };
function invokeFrom(call: RpcCall): unknown {
  if (call.method !== "starknet_addInvokeTransaction") return undefined;
  return Array.isArray(call.params)
    ? call.params[0]
    : (call.params as Record<string, unknown> | undefined)?.invoke_transaction;
}
function isGameRequest(value: unknown, identity: PlayIdentity): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const call = value as RpcCall;
  return call.jsonrpc === "2.0" && gameInvoke(invokeFrom(call), identity) !== undefined;
}
async function admitRequest(
  value: unknown,
  node: URL,
  identity: ShardIdentity & PlayIdentity,
): Promise<Admitted | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const call = value as RpcCall;
  if (call.jsonrpc !== "2.0") return undefined;
  if (isRead(call)) return { call };
  const game = gameInvoke(invokeFrom(call), identity);
  if (game) return { call, game };
  if (
    await permitsAccountRequest(call as unknown as Record<string, unknown>, identity, (sender) =>
      readNodeClass(node, sender),
    )
  )
    return { call };
  return undefined;
}
async function nodeCall(node: URL, method: string, params: unknown): Promise<unknown> {
  const response = await fetch(new URL("/rpc/v0_10_2", node), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  }).catch(() => {
    throw new Error("Private node unavailable");
  });
  const value = (await response.json()) as { result?: unknown };
  if (!response.ok || value.result === undefined) throw new Error("Node unavailable");
  return value.result;
}
function transactionRefused(id: unknown) {
  return rpcError(id, -32010, "Transaction refused");
}
function rpcError(id: unknown, code: number, message: string, transactionHash?: string) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(transactionHash ? { data: { transaction_hash: transactionHash } } : {}) },
  };
}
function isWrite(call: RpcCall): boolean {
  return call?.method === "starknet_addInvokeTransaction" || call?.method === "starknet_addDeployAccountTransaction";
}
type NodeAnswer = { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: { code?: unknown } };
function validReply(answer: unknown, call: RpcCall): answer is NodeAnswer {
  return (
    !!answer &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    (answer as NodeAnswer).jsonrpc === "2.0" &&
    (answer as NodeAnswer).id === (call.id ?? null)
  );
}
function readAnswer(answer: NodeAnswer, call: RpcCall): unknown {
  const hasResult = Object.hasOwn(answer, "result");
  const hasError = Object.hasOwn(answer, "error");
  if (hasResult && !hasError) return { jsonrpc: "2.0", id: call.id ?? null, result: answer.result };
  if (hasError && !hasResult) {
    const code = answer.error?.code;
    if (
      code === 29 &&
      (call.method === "starknet_getTransactionStatus" || call.method === "starknet_getTransactionReceipt")
    )
      return rpcError(call.id, 29, "Transaction hash not found");
    if (typeof code === "number" && READ_NOT_FOUND.has(code)) return rpcError(call.id, code, READ_NOT_FOUND.get(code)!);
  }
  return rpcError(call.id, -32012, "RPC read unavailable");
}
function writeAnswer(answer: NodeAnswer, call: RpcCall, expectedHash?: string): unknown {
  const result = answer.result as { transaction_hash?: unknown; contract_address?: unknown } | undefined;
  const hash = felt(result?.transaction_hash);
  if (Object.hasOwn(answer, "error") || hash === undefined || (expectedHash && hash !== felt(expectedHash)))
    return rpcError(call.id, -32011, "Transaction outcome unknown", expectedHash);
  const contract = call.method === "starknet_addDeployAccountTransaction" ? felt(result?.contract_address) : undefined;
  return {
    jsonrpc: "2.0",
    id: call.id ?? null,
    result: {
      transaction_hash: expectedHash ?? `0x${hash.toString(16)}`,
      ...(contract !== undefined ? { contract_address: `0x${contract.toString(16)}` } : {}),
    },
  };
}
async function forwardRequest(
  admitted: Admitted,
  path: string,
  node: URL,
  identity: PlayIdentity,
  stamper: StampProvider,
  inFlightAccounts: Set<string>,
): Promise<unknown> {
  const { call, game } = admitted;
  const play = game?.entrypoint.stamp ? game.transaction : undefined;
  const account = play ? felt(play.sender_address)!.toString() : undefined;
  if (account && inFlightAccounts.has(account)) return transactionRefused(call.id);
  if (account) inFlightAccounts.add(account);
  let forwarded = false;
  let expectedHash: string | undefined;
  try {
    let outgoing = game ? { ...call, params: [game.transaction] } : call;
    if (play) {
      const [nonce, accountClass] = await Promise.all([
        nodeCall(node, "starknet_getNonce", ["pre_confirmed", play.sender_address]),
        readNodeClass(node, play.sender_address),
      ]);
      // No speculative future nonce: retrying the same accepted transaction uses the same root.
      if (felt(nonce) !== felt(play.nonce) || felt(accountClass) !== felt(identity.accountClassHash))
        return transactionRefused(call.id);
      const stamp = await stamper.stamp(play);
      const hash = felt(stamp.transactionHash);
      if (hash === undefined) return transactionRefused(call.id);
      expectedHash = `0x${hash.toString(16)}`;
      outgoing = { ...call, params: [{ ...play, signature: [...play.signature, ...stamp.suffix] }] };
    }
    const body = JSON.stringify(outgoing);
    // Once fetch is invoked, a failed reply cannot prove that the node did not accept the write.
    forwarded = true;
    const response = await fetch(new URL(path, node), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    const answer: unknown = await response.json();
    if (!response.ok || !validReply(answer, call)) throw new Error("Invalid private node reply");
    return isWrite(call) ? writeAnswer(answer, call, expectedHash) : readAnswer(answer, call);
  } catch {
    if (!isWrite(call)) return rpcError(call.id, -32012, "RPC read unavailable");
    return forwarded
      ? rpcError(call.id, -32011, "Transaction outcome unknown", expectedHash)
      : transactionRefused(call.id);
  } finally {
    if (account) inFlightAccounts.delete(account);
  }
}

async function assertChainIdentity(node: URL, identity: PlayIdentity, limit: bigint) {
  const [chain, point, bound] = await Promise.all([
    nodeCall(node, "starknet_chainId", []),
    nodeCall(node, "starknet_call", [
      {
        contract_address: identity.games,
        entry_point_selector: hash.getSelectorFromName("vrf_public_key"),
        calldata: [],
      },
      "latest",
    ]),
    nodeCall(node, "starknet_call", [
      {
        contract_address: identity.games,
        entry_point_selector: hash.getSelectorFromName("l2_gas_bound"),
        calldata: [],
      },
      "latest",
    ]),
  ]);
  if (
    felt(chain) !== felt(identity.chainId) ||
    !Array.isArray(point) ||
    point.length !== 2 ||
    felt(point[0]) !== felt(identity.vrfPublicKey.x) ||
    felt(point[1]) !== felt(identity.vrfPublicKey.y) ||
    !Array.isArray(bound) ||
    bound.length !== 1 ||
    felt(bound[0]) !== limit
  )
    throw new Error("Shard VRF manifest disagrees with chain");
}

async function startConfiguredProxy() {
  const upstream = process.env.NODE_RPC_URL,
    manifestPath = process.env.NATIVE_WORLD_MANIFEST,
    keyFile = process.env.VRF_KEY_FILE;
  if (!upstream || !manifestPath || !keyFile)
    throw new Error("NODE_RPC_URL, NATIVE_WORLD_MANIFEST and VRF_KEY_FILE are required");
  const port = Number(process.env.PORT),
    count = workerCount(process.env.VRF_WORKERS);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const identity: ShardIdentity & PlayIdentity = { ...manifest.shard, games: manifest.world?.address };
  const limit = felt(identity.l2GasBound);
  if (
    !limit ||
    limit > (1n << 64n) - 1n ||
    ![identity.chainId, identity.vrfPublicKey?.x, identity.vrfPublicKey?.y].every((v) => felt(v) !== undefined)
  )
    throw new Error("Invalid shard VRF manifest");
  const node = privateNode(upstream);
  await assertChainIdentity(node, identity, limit);
  const pool = await startStampPool(keyFile, identity, count).catch(() => {
    throw new Error("VRF prover initialization failed");
  });
  try {
    startReadRpc(upstream, port, identity, pool, process.env.RPC_TRUSTED_PROXY);
    console.log(JSON.stringify({ event: "public_rpc_ready", workers: count }));
  } catch {
    pool.close();
    throw new Error("Public RPC startup failed");
  }
}
if (import.meta.main)
  startConfiguredProxy().catch((error: unknown) => {
    console.error(
      error instanceof Error && ["Private node unavailable", "VRF prover initialization failed"].includes(error.message)
        ? error.message
        : "Public RPC initialization failed",
    );
    process.exitCode = 1;
  });
