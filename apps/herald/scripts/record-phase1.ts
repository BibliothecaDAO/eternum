import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { hash, num } from "starknet";
import { NativeDecoder } from "../src/native/decoder";
import { NativeIngestion } from "../src/native/ingestion";
import { manifest as localManifest } from "../src/native/fixtures";
import { WorldFold } from "../src/world-fold";
import type { GameSnapshot, RpcBlockWithReceipts, RpcReceipt, RpcTransaction } from "../src/types";
import type { NativeManifest, NativeSchema } from "../src/native/schema";

type JsonRecord = Record<string, unknown>;

interface Options {
  rpcUrl: string;
  heraldUrl: string;
  gameId: string;
  actor: string;
  output: string;
  fromBlock: number;
}

interface RecordingRecord {
  transaction: RpcTransaction;
  receipt: RpcReceipt;
}

interface ActionCheckpoint {
  transactionHash: string;
  blockNumber: number;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  const allowed = new Set(["--rpc-url", "--herald-url", "--game-id", "--actor", "--output", "--from-block"]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--"))
      throw new Error(`Invalid arguments near ${flag ?? "end"}`);
    if (!allowed.has(flag)) throw new Error(`Unknown option ${flag}`);
    if (values.has(flag)) throw new Error(`${flag} may be supplied only once`);
    values.set(flag, value);
  }
  const required = (flag: string) => {
    const value = values.get(flag);
    if (value === undefined) throw new Error(`Missing required ${flag}`);
    return value;
  };
  const nonNegativeInteger = (flag: string, fallback?: number) => {
    const raw = values.get(flag);
    if (raw === undefined && fallback !== undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${flag} must be a non-negative integer`);
    return value;
  };
  return {
    rpcUrl: required("--rpc-url"),
    heraldUrl: required("--herald-url").replace(/\/$/, ""),
    gameId: BigInt(required("--game-id")).toString(),
    actor: normalizeFelt(required("--actor")),
    output: required("--output"),
    fromBlock: nonNegativeInteger("--from-block", 0),
  };
}

export function snapshotBlock(snapshot: GameSnapshot): number {
  const block = snapshot.confirmed_block;
  if (!Number.isSafeInteger(block) || block < 0) throw new Error("Herald snapshot has an invalid confirmed block");
  return block;
}

export function hasRecordingFacts(
  events: readonly { model: { name: string; scope: string }; key: Record<string, unknown> }[],
  gameId: string,
): boolean {
  return events.some(({ model, key }) => {
    if (model.scope === "deployment") return true;
    return model.scope === "game" && key.game_id !== undefined && feltEquals(key.game_id, gameId);
  });
}

export function hasActorNonceWrite(
  events: readonly { model: { name: string; scope: string }; key: Record<string, unknown> }[],
  gameId: string,
  actor: string,
): boolean {
  return events.some(
    ({ model, key }) =>
      model.name === "ActionNonce" &&
      model.scope === "game" &&
      feltEquals(key.game_id, gameId) &&
      feltEquals(key.actor, actor),
  );
}

export function assertActionCheckpointCoverage(checkpoints: readonly ActionCheckpoint[]): void {
  if (checkpoints.length < 3)
    throw new Error(`Found ${checkpoints.length} actor action contract-read checkpoints; expected at least 3`);
}

function feltEquals(left: unknown, right: string | number | bigint): boolean {
  if (left === undefined || left === null) return false;
  return BigInt(String(left)) === BigInt(right);
}

export function assertSnapshotMatches(expected: GameSnapshot, actual: GameSnapshot): void {
  const actualModels = new Map(actual.models.map((model) => [model.model, model.rows]));
  for (const model of expected.models) {
    const rows = actualModels.get(model.model);
    if (!rows) throw new Error(`Replay snapshot mismatch: missing model ${model.model}`);
    const actualRows = new Map(rows.map((row) => [row.key, row.value]));
    const expectedRows = new Map(model.rows.map((row) => [row.key, row.value]));
    for (const [key, value] of expectedRows) {
      if (!actualRows.has(key)) throw new Error(`Replay snapshot mismatch: ${model.model} row ${key} is missing`);
      if (!isDeepStrictEqual(actualRows.get(key), value))
        throw new Error(`Replay snapshot mismatch: ${model.model} row ${key} differs`);
    }
    for (const key of actualRows.keys()) {
      if (!expectedRows.has(key)) throw new Error(`Replay snapshot mismatch: ${model.model} row ${key} is unexpected`);
    }
  }
  for (const model of actual.models) {
    if (!expected.models.some(({ model: name }) => name === model.model))
      throw new Error(`Replay snapshot mismatch: unexpected model ${model.model}`);
  }
}

export function buildRecording(input: {
  sourceHead: string;
  schemaIdentity: string;
  worldAddress: string;
  actor: string;
  gameId: string;
  records: RecordingRecord[];
  checks: JsonRecord[];
  finalSnapshot: GameSnapshot;
}) {
  if (input.records.length === 0) throw new Error("A phase-1 recording must contain transactions");
  if (input.checks.length === 0) throw new Error("A phase-1 recording must contain contract-read checks");
  if (!/^[0-9a-f]{40}$/i.test(input.sourceHead)) throw new Error("sourceHead must be an exact commit hash");
  if (!feltEquals(input.finalSnapshot.game_id, input.gameId))
    throw new Error("Final snapshot game id does not match the recording");
  return {
    sourceHead: input.sourceHead,
    schemaIdentity: input.schemaIdentity,
    worldAddress: normalizeFelt(input.worldAddress),
    actor: normalizeFelt(input.actor),
    gameId: Number(input.gameId),
    records: input.records,
    checks: input.checks,
    finalSnapshot: input.finalSnapshot,
  };
}

async function run(options: Options): Promise<void> {
  const finalSnapshot = (await getJson(
    `${options.heraldUrl}/games/${options.gameId}/snapshot?actor=${encodeURIComponent(options.actor)}`,
  )) as GameSnapshot;
  const toBlock = snapshotBlock(finalSnapshot);
  const gameRelease = findSnapshotRow(finalSnapshot, "GameRelease", { game_id: options.gameId });
  const releaseId = feltDecimal(gameRelease.release_id);

  const shardManifest = asRecord(await getJson(`${options.heraldUrl}/manifest`), "Herald manifest");
  const releaseSchemas = asRecord(shardManifest.releaseSchemas, "manifest releaseSchemas");
  const schemaIdentity = requiredString(releaseSchemas[releaseId], `schema for release ${releaseId}`);
  const schema = (await getJson(`${options.heraldUrl}/schemas/${schemaIdentity}`)) as NativeSchema;
  if (schema.identity !== schemaIdentity) throw new Error("Deployed schema identity does not match the manifest");
  const worldAddress = requiredString(asRecord(shardManifest.contracts, "manifest contracts").games, "games address");
  const decoder = new NativeDecoder(decoderManifest(worldAddress, schema, Number(releaseId)));
  const ingestion = new NativeIngestion(decoder);
  const fold = new WorldFold(decoder.registry);
  const allBlocks = await readBlocks(options.rpcUrl, options.fromBlock, toBlock);
  const records: RecordingRecord[] = [];
  const actionCheckpoints: ActionCheckpoint[] = [];
  let finalTimestamp: number | undefined;
  for (const block of allBlocks) {
    if (block.block_number === toBlock) finalTimestamp = block.timestamp;
    for (const [transactionIndex, item] of block.transactions.entries()) {
      const { transaction, receipt } = item;
      if (receipt.execution_status !== "SUCCEEDED") continue;
      const decoded = receipt.events.flatMap((event, eventIndex) => {
        if (!decoder.owns(event.from_address)) return [];
        return [
          decoder.decode({
            ...event,
            block_number: block.block_number,
            transaction_hash: receipt.transaction_hash,
            transaction_index: transactionIndex,
            event_index: eventIndex,
          }),
        ];
      });
      if (!hasRecordingFacts(decoded, options.gameId)) continue;
      ingestion.applyReceipt(fold, receipt, block.block_number, transactionIndex, transaction.calldata);
      records.push({ transaction, receipt: { ...receipt, block_number: block.block_number } });
      if (hasActorNonceWrite(decoded, options.gameId, options.actor))
        actionCheckpoints.push({ transactionHash: receipt.transaction_hash, blockNumber: block.block_number });
    }
  }
  if (finalTimestamp === undefined) throw new Error(`Block ${toBlock} was not read from RPC`);
  const actorScope = fold.subscriptionScope(options.gameId, options.actor, finalTimestamp);
  const replaySnapshot = fold.subscriptionSnapshot(options.gameId, toBlock, actorScope);
  assertSnapshotMatches(finalSnapshot, replaySnapshot);

  const last = records.at(-1);
  if (!last) throw new Error("No matching game or preset transactions found in the requested range");
  assertActionCheckpointCoverage(actionCheckpoints);
  const actionChecks = await Promise.all(
    actionCheckpoints.map(({ transactionHash, blockNumber }) =>
      contractReadCheck(options, worldAddress, transactionHash, "ActionState", blockNumber),
    ),
  );
  const finalCheck = await contractReadCheck(
    options,
    worldAddress,
    last.receipt.transaction_hash,
    "FinalState",
    toBlock,
  );
  const checks = [...actionChecks, finalCheck];
  const sourceHead = execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const recording = buildRecording({
    sourceHead,
    schemaIdentity,
    worldAddress,
    actor: options.actor,
    gameId: options.gameId,
    records,
    checks,
    finalSnapshot,
  });
  await mkdir(dirname(resolve(options.output)), { recursive: true });
  await writeFile(resolve(options.output), `${JSON.stringify(recording)}\n`);
  console.log(
    JSON.stringify({
      event: "phase1_recording_written",
      output: resolve(options.output),
      gameId: options.gameId,
      transactions: records.length,
      fromBlock: options.fromBlock,
      toBlock,
      schemaIdentity,
    }),
  );
}

async function contractReadCheck(
  options: Options,
  worldAddress: string,
  transactionHash: string,
  kind: string,
  blockNumber: number,
) {
  const [nonce, playerPoints] = await Promise.all([
    callFelt(options.rpcUrl, worldAddress, "next_nonce", [options.gameId, options.actor], blockNumber),
    callFelt(options.rpcUrl, worldAddress, "player_points", [options.gameId, options.actor], blockNumber),
  ]);
  return { kind, transactionHash, nonce, playerPoints };
}

async function readBlocks(rpcUrl: string, fromBlock: number, toBlock: number): Promise<RpcBlockWithReceipts[]> {
  const blocks: RpcBlockWithReceipts[] = [];
  const concurrency = 12;
  for (let first = fromBlock; first <= toBlock; first += concurrency) {
    const numbers = Array.from({ length: Math.min(concurrency, toBlock - first + 1) }, (_, index) => first + index);
    const batch = await Promise.all(
      numbers.map((block) =>
        rpcRequest<RpcBlockWithReceipts>(rpcUrl, "starknet_getBlockWithReceipts", [{ block_number: block }]),
      ),
    );
    batch.forEach((block, index) => {
      const expected = numbers[index]!;
      if (block.block_number !== expected)
        throw new Error(`RPC block mismatch: requested ${expected}, received ${block.block_number}`);
    });
    blocks.push(...batch);
  }
  return blocks;
}

function decoderManifest(worldAddress: string, schema: NativeSchema, releaseId: number): NativeManifest {
  return {
    ...localManifest,
    world: { address: worldAddress },
    native: {
      ...localManifest.native,
      deploymentBlock: 0,
      activeSchema: schema.identity,
      releaseId,
      releaseSchemas: { [String(releaseId)]: schema.identity },
      schemas: { [schema.identity]: schema },
      logic: Object.fromEntries(Object.keys(schema.logicClasses).map((name) => [name, "0x0"])),
    },
  };
}

async function callFelt(rpcUrl: string, address: string, entrypoint: string, calldata: string[], block: number) {
  const result = await rpcRequest<string[]>(rpcUrl, "starknet_call", [
    {
      contract_address: normalizeFelt(address),
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata: calldata.map((value) => num.toHex(value)),
    },
    { block_number: block },
  ]);
  if (!Array.isArray(result) || result.length !== 1)
    throw new Error(`${entrypoint} returned an unexpected felt result`);
  return normalizeFelt(result[0]!);
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} returned HTTP ${response.status}`);
  return response.json();
}

async function rpcRequest<Result>(rpcUrl: string, method: string, params: unknown[]): Promise<Result> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: Result; error?: { code: number; message: string } };
  if (payload.error) throw new Error(`RPC ${method} failed (${payload.error.code}): ${payload.error.message}`);
  if (!Object.hasOwn(payload, "result")) throw new Error(`RPC ${method} omitted its result`);
  return payload.result as Result;
}

export function findSnapshotRow(snapshot: GameSnapshot, modelName: string, feltFields: Record<string, string>) {
  const model = snapshot.models.find(({ model }) => model === modelName);
  const row = model?.rows.find(({ value }) =>
    Object.entries(feltFields).every(([field, expected]) => feltEquals(value[field], expected)),
  );
  if (!row) throw new Error(`Herald snapshot is missing ${modelName}`);
  return row.value;
}

function feltDecimal(value: unknown): string {
  if (value === undefined || value === null) throw new Error("Expected a felt value in Herald snapshot");
  return BigInt(String(value)).toString();
}

function asRecord(value: unknown, description: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${description} must be an object`);
  return value as JsonRecord;
}

function requiredString(value: unknown, description: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${description} is missing`);
  return value;
}

function normalizeFelt(value: string): string {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    throw new Error(`Invalid felt: ${value}`);
  }
}

if (import.meta.main) {
  run(parseOptions(Bun.argv.slice(2))).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
