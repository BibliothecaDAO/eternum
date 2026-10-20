import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { hash } from "starknet";
import { openProver, type StampProvider } from "../vrf/native";
import { felt, gameInvoke, MAX_TRANSACTION_BYTES, type PlayIdentity } from "../vrf/transaction";
import { permitsAccountRequest, type ShardIdentity } from "./account-rpc-policy";
import { accountRequestLimiter, rpcClientAddress } from "./rpc-client-limit";
import { isDevShardChain } from "../../../packages/value-ledger/src/dev-shard";
import { SHARD_RPC_MAX_BATCH_CALLS as MAX_BATCH_CALLS } from "../../../packages/value-ledger/src/rpc";
import { seaterAccountAddresses } from "../../../packages/value-ledger/src/shard-accounts";
import {
  PLAY_REFUSED_CODE,
  PLAYS_IN_FLIGHT,
  type PlayRefusalReason,
} from "../../../packages/provider/src/play-refusal";

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
const PREPARATION_TIMEOUT_MS = 2000;
const FORWARD_TIMEOUT_MS = 5000;
type Preparation = { signal: AbortSignal; deadline: number };
type ProxyIdentity = ShardIdentity & PlayIdentity & { playerCapacity: number };
type AccountClassReader = (sender: string, signal: AbortSignal) => Promise<string>;
/**
 * A player's play may run PLAYS_IN_FLIGHT - 1 nonces past its account's current one, so a burst of orders waits on a
 * round trip per play, not on each play's inclusion; the mempool holds at most PLAYS_IN_FLIGHT of its plays. A stamp
 * ahead of the current nonce is not readable before it executes: no public method returns a transaction's body. A
 * seater, one of the pool accounts that seat fixed rosters, may queue its seats this far ahead.
 */
const SEATER_NONCE_WINDOW = 48n;
const PLAYER_NONCE_WINDOW = BigInt(PLAYS_IN_FLIGHT - 1);

/** The preparation ran out of time before the play could be forwarded. */
class PreparationExpired extends Error {}

function assertBeforeForward(preparation: Preparation) {
  if (preparation.signal.aborted) throw new PreparationExpired();
  // A busy event loop can delay the abort event; elapsed time still refuses a late forward.
  if (performance.now() >= preparation.deadline) throw new PreparationExpired();
}

/** A refusal before forwarding was the preparation's deadline when it ran out of time; otherwise `otherwise`. */
const refusalOf = (error: unknown, preparation: Preparation, otherwise: PlayRefusalReason): PlayRefusalReason =>
  error instanceof PreparationExpired || preparation.signal.aborted ? "deadline" : otherwise;

function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    work.then(
      (value) => {
        signal.removeEventListener("abort", aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", aborted);
        reject(error);
      },
    );
  });
}

// A browser preflights every JSON POST; without a max age it keeps the answer 5 s, so nearly every player action would
// wait one extra round trip for it. Chromium honours at most two hours.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "7200",
};
// Starknet RPC 0.10 transaction/contract errors; internal and unknown errors stay unavailable.
const ESTIMATE_REFUSALS = new Set([-32602, 21, 40, 41, 52, 53, 54, 55, 58, 61, 64, 65, 69]);
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

/**
 * Every refusal the RPC answers is logged with its reason. Lines wait for the next turn of the event loop and are
 * written together, after the answers that caused them: a refusal's log never adds an await or a write to any request.
 */
const refusals: Record<string, unknown>[] = [];
function logRefusal(refusal: Record<string, unknown>) {
  if (refusals.push({ event: "rpc_refused", ...refusal }) === 1) setTimeout(writeRefusals, 0);
}
function writeRefusals() {
  console.log(
    refusals
      .splice(0)
      .map((refusal) => JSON.stringify(refusal))
      .join("\n"),
  );
}

function refuse(code: number, message: string, status = 200, data?: object): Response {
  logRefusal({ code, message, status, ...data });
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code, message, ...(data ? { data } : {}) } },
    { status, headers: CORS },
  );
}

/** A write refused before the node took it, naming the rule (play-refusal.ts): never a detail of the box. */
function refuseTransaction(reason: PlayRefusalReason, status: number): Response {
  return refuse(PLAY_REFUSED_CODE, "Transaction refused", status, { reason });
}

function privateNode(upstream: string): URL {
  const node = new URL(upstream);
  if (node.protocol !== "http:" || node.username || node.password || node.pathname !== "/") {
    throw new Error("NODE_RPC_URL must be the private node's HTTP origin");
  }
  return node;
}

function assertPlayerCapacity(capacity: number) {
  if (!Number.isSafeInteger(capacity) || capacity < 1)
    throw new Error("PLAYER_CAPACITY must be a positive safe integer");
}

// The node stays private: Games play/control-plane writes and manifest-bound device/account management share this endpoint.
export function startReadRpc(
  upstream: string,
  port: number,
  identity: ProxyIdentity,
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
  assertPlayerCapacity(identity.playerCapacity);
  const readAccountClass = accountClassReader(node, identity);
  const seaters = new Set(seaterAccountAddresses(identity).map((address) => felt(address)!));
  const allowance = accountRequestLimiter();
  const inFlightAccounts = new Set<string>();
  // Browsers hide a cross-origin request's connect, TLS and wait timings unless the response allows it. Only a dev chain
  // shows them: the chain identity, not a setting, decides, so no production deploy can carry it.
  const timingAllowed = isDevShardChain(identity.chainId);
  return Bun.serve({
    hostname,
    port,
    maxRequestBodySize: MAX_TRANSACTION_BYTES,
    async fetch(request, server) {
      const peer = server.requestIP(request)?.address;
      const client = peer ? rpcClientAddress(peer, trustedProxy, request.headers) : undefined;
      const response = await handlePublicRequest(
        request,
        node,
        identity,
        stamper,
        client,
        allowance,
        inFlightAccounts,
        readAccountClass,
        seaters,
      );
      if (timingAllowed) response.headers.set("Timing-Allow-Origin", "*");
      return response;
    },
  });
}

// Only the pinned player-account class is immutable; foreign contracts cannot fill this cache.
function accountClassReader(node: URL, identity: ProxyIdentity): AccountClassReader {
  const classes = new Map<string, string>();
  return async (sender, signal) => {
    signal.throwIfAborted();
    const account = BigInt(sender).toString(16);
    const cached = classes.get(account);
    if (cached !== undefined) {
      classes.delete(account);
      classes.set(account, cached);
      return cached;
    }
    const value = await readNodeClass(node, sender, signal);
    signal.throwIfAborted();
    if (felt(value) === felt(identity.accountClassHash)) {
      // A concurrent lookup may already have inserted this account while this read was pending.
      classes.delete(account);
      if (classes.size >= identity.playerCapacity) classes.delete(classes.keys().next().value!);
      classes.set(account, value);
    }
    return value;
  };
}

async function readNodeClass(node: URL, sender: string, signal?: AbortSignal): Promise<string> {
  const value = await nodeCall(node, "starknet_getClassHashAt", ["pre_confirmed", sender], signal);
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
  readAccountClass: AccountClassReader,
  seaters: ReadonlySet<bigint>,
): Promise<Response> {
  const preparation: Preparation = {
    deadline: performance.now() + PREPARATION_TIMEOUT_MS,
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(PREPARATION_TIMEOUT_MS)]),
  };
  const path = new URL(request.url).pathname;
  if (!/^\/(?:rpc\/v0_\d+_\d+)?$/.test(path)) return refuse(-32601, "RPC path is not public", 404);
  // Public state streams use Herald; exposing an unfiltered node WebSocket would bypass this boundary.
  if (request.headers.has("upgrade")) return refuse(-32601, "RPC upgrades are not public", 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return refuse(-32600, "POST required", 405);
  let payload: unknown;
  try {
    const raw = await untilAborted(request.arrayBuffer(), preparation.signal);
    if (raw.byteLength > MAX_TRANSACTION_BYTES) return refuseTransaction("validation", 413);
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return refuse(-32700, "Invalid JSON", 400);
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length > MAX_BATCH_CALLS) return refuse(-32600, `RPC batch exceeds ${MAX_BATCH_CALLS} calls`);
  if (!calls.length) return refuse(-32601, "RPC method is not public");
  if (calls.some(isWrite) && calls.some((call) => !isWrite(call))) {
    return refuse(-32600, "Mixed read and write batch refused");
  }
  const operations = calls.filter((call) => !isRead(call) && !isGameRequest(call, identity));
  if (operations.length && (!client || !allowance(client, operations.length))) {
    return refuse(-32005, "Account operation rate exceeded", 429);
  }
  let admitted: (Admitted | undefined)[];
  try {
    // Validate the entire batch before producing any proof.
    admitted = await untilAborted(
      Promise.all(calls.map((call) => admitRequest(call, identity, preparation.signal, readAccountClass))),
      preparation.signal,
    );
  } catch (error) {
    return calls.some(isWrite)
      ? refuseTransaction(refusalOf(error, preparation, "unavailable"), 502)
      : refuse(-32012, "RPC read unavailable", 502);
  }
  if (admitted.some((call) => !call)) return refuse(-32601, "RPC method is not public");
  const answers = await Promise.all(
    admitted.map((call) =>
      forwardRequest(
        call!,
        path,
        node,
        identity,
        stamper,
        inFlightAccounts,
        preparation,
        request.signal,
        readAccountClass,
        seaters,
      ),
    ),
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
  identity: ShardIdentity & PlayIdentity,
  signal: AbortSignal,
  readAccountClass: AccountClassReader,
): Promise<Admitted | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const call = value as RpcCall;
  if (call.jsonrpc !== "2.0") return undefined;
  if (isRead(call)) return { call };
  const game = gameInvoke(invokeFrom(call), identity);
  if (game) return { call, game };
  if (
    await permitsAccountRequest(call as unknown as Record<string, unknown>, identity, (sender) =>
      readAccountClass(sender, signal),
    )
  )
    return { call };
  return undefined;
}
async function nodeCall(
  node: URL,
  method: string,
  params: unknown,
  signal = AbortSignal.timeout(5000),
): Promise<unknown> {
  const response = await fetch(new URL("/rpc/v0_10_2", node), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
    redirect: "error",
  }).catch(() => {
    throw new Error("Private node unavailable");
  });
  const value = (await response.json()) as { result?: unknown };
  if (!response.ok || value.result === undefined || Object.hasOwn(value, "error")) throw new Error("Node unavailable");
  return value.result;
}
function transactionRefused(call: RpcCall, reason: PlayRefusalReason) {
  return refusedCall(call, PLAY_REFUSED_CODE, "Transaction refused", { reason });
}
function rpcError(id: unknown, code: number, message: string, data?: object) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}
/** One call of a batch refused, logged with its method and, for a write, its sender. */
function refusedCall(call: RpcCall, code: number, message: string, data?: object) {
  const sender = (invokeFrom(call) as { sender_address?: unknown } | undefined)?.sender_address;
  logRefusal({ code, message, method: call.method, ...(typeof sender === "string" ? { sender } : {}), ...data });
  return rpcError(call.id, code, message, data);
}
/** The proxy tried to forward and cannot say whether the node took the write: the hash it computed, if any. */
function outcomeUnknown(call: RpcCall, transactionHash?: string) {
  return refusedCall(
    call,
    -32011,
    "Transaction outcome unknown",
    transactionHash ? { transaction_hash: transactionHash } : undefined,
  );
}
function isWrite(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { method } = value as RpcCall;
  return (
    method === "starknet_addInvokeTransaction" ||
    method === "starknet_addDeployAccountTransaction" ||
    method === "starknet_addDeclareTransaction"
  );
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
      (call.method === "starknet_estimateFee" || call.method === "starknet_estimateMessageFee") &&
      typeof code === "number" &&
      ESTIMATE_REFUSALS.has(code)
    )
      return refusedCall(call, -32013, "Estimate refused");
    if (
      code === 29 &&
      (call.method === "starknet_getTransactionStatus" || call.method === "starknet_getTransactionReceipt")
    )
      return rpcError(call.id, 29, "Transaction hash not found");
    if (typeof code === "number" && READ_NOT_FOUND.has(code)) return rpcError(call.id, code, READ_NOT_FOUND.get(code)!);
  }
  return refusedCall(call, -32012, "RPC read unavailable");
}
// Starknet's VALIDATION_FAILURE: the account's own validation refused the transaction at admission, so it never applies.
const VALIDATION_FAILURE = 55;
function writeAnswer(answer: NodeAnswer, call: RpcCall, expectedHash?: string): unknown {
  const result = answer.result as { transaction_hash?: unknown; contract_address?: unknown } | undefined;
  const hash = felt(result?.transaction_hash);
  if (answer.error?.code === VALIDATION_FAILURE && !Object.hasOwn(answer, "result"))
    return transactionRefused(call, "validation");
  if (Object.hasOwn(answer, "error") || hash === undefined || (expectedHash && hash !== felt(expectedHash)))
    return outcomeUnknown(call, expectedHash);
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
  preparation: Preparation,
  clientSignal: AbortSignal,
  readAccountClass: AccountClassReader,
  seaters: ReadonlySet<bigint>,
): Promise<unknown> {
  const { call, game } = admitted;
  const play = game?.entrypoint.stamp ? game.transaction : undefined;
  const account = play ? felt(play.sender_address)!.toString() : undefined;
  if (account && inFlightAccounts.has(account)) return transactionRefused(call, "in-flight");
  if (account) inFlightAccounts.add(account);
  let forwarded = false;
  let expectedHash: string | undefined;
  // What a failure before forwarding refuses for, as the preparation moves on: reading the node, then stamping.
  let stage: PlayRefusalReason = "unavailable";
  try {
    assertBeforeForward(preparation);
    let outgoing = game ? { ...call, params: [game.transaction] } : call;
    if (play) {
      const [nonce, accountClass] = await untilAborted(
        Promise.all([
          nodeCall(node, "starknet_getNonce", ["pre_confirmed", play.sender_address], preparation.signal),
          readAccountClass(play.sender_address, preparation.signal),
        ]),
        preparation.signal,
      );
      // Retrying the same accepted transaction uses the same root.
      if (felt(accountClass) !== felt(identity.accountClassHash)) return transactionRefused(call, "validation");
      if (!admitsNonce(felt(play.nonce), felt(nonce), seaters.has(felt(play.sender_address)!)))
        return transactionRefused(call, "nonce");
      assertBeforeForward(preparation);
      stage = "stamp";
      const stamp = stamper.stamp(play);
      const hash = felt(stamp.transactionHash);
      if (hash === undefined) return transactionRefused(call, "stamp");
      stage = "unavailable";
      expectedHash = `0x${hash.toString(16)}`;
      outgoing = { ...call, params: [{ ...play, signature: [...play.signature, ...stamp.suffix] }] };
    }
    const body = JSON.stringify(outgoing);
    // Once fetch is invoked, a failed reply cannot prove that the node did not accept the write.
    assertBeforeForward(preparation);
    const forwardSignal = AbortSignal.any([clientSignal, AbortSignal.timeout(FORWARD_TIMEOUT_MS)]);
    forwarded = true;
    const response = await fetch(new URL(path, node), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: forwardSignal,
      redirect: "error",
    });
    const answer: unknown = await untilAborted(response.json(), forwardSignal);
    if (!response.ok || !validReply(answer, call)) throw new Error("Invalid private node reply");
    return isWrite(call) ? writeAnswer(answer, call, expectedHash) : readAnswer(answer, call);
  } catch (error) {
    if (!isWrite(call)) return refusedCall(call, -32012, "RPC read unavailable");
    return forwarded
      ? outcomeUnknown(call, expectedHash)
      : transactionRefused(call, refusalOf(error, preparation, stage));
  } finally {
    if (account) inFlightAccounts.delete(account);
  }
}

function admitsNonce(sent: bigint | undefined, current: bigint | undefined, isSeater: boolean): boolean {
  if (sent === undefined || current === undefined) return false;
  return sent >= current && sent <= current + (isSeater ? SEATER_NONCE_WINDOW : PLAYER_NONCE_WINDOW);
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
  const port = Number(process.env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const identity: ProxyIdentity = {
    ...manifest.shard,
    games: manifest.world?.address,
    playerCapacity: Number(process.env.PLAYER_CAPACITY),
  };
  assertPlayerCapacity(identity.playerCapacity);
  const limit = felt(identity.l2GasBound);
  if (
    !limit ||
    limit > (1n << 64n) - 1n ||
    ![identity.chainId, identity.vrfPublicKey?.x, identity.vrfPublicKey?.y].every((v) => felt(v) !== undefined)
  )
    throw new Error("Invalid shard VRF manifest");
  const node = privateNode(upstream);
  await assertChainIdentity(node, identity, limit);
  const prover = openVerifiedProver(keyFile, identity);
  try {
    startReadRpc(upstream, port, identity, prover, process.env.RPC_TRUSTED_PROXY);
    console.log(JSON.stringify({ event: "public_rpc_ready" }));
  } catch {
    prover.close();
    throw new Error("Public RPC startup failed");
  }
}

/** The prover for the shard's protected key, refused unless its point is the one Games verifies against. */
function openVerifiedProver(keyFile: string, identity: PlayIdentity) {
  let prover: ReturnType<typeof openProver>;
  try {
    prover = openProver(keyFile, identity.chainId);
  } catch {
    throw new Error("VRF prover initialization failed");
  }
  if (
    felt(prover.publicKey.x) !== felt(identity.vrfPublicKey.x) ||
    felt(prover.publicKey.y) !== felt(identity.vrfPublicKey.y)
  ) {
    prover.close();
    throw new Error("VRF prover initialization failed");
  }
  return prover;
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
