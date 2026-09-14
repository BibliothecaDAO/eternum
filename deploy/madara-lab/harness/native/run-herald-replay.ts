import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NativeDecoder } from "../../../../apps/herald/src/native/decoder";
import { NativeIngestion } from "../../../../apps/herald/src/native/ingestion";
import { NativeLiveWorld } from "../../../../apps/herald/src/native/live-world";
import { NativeWorldFold as WorldFold } from "../../../../apps/herald/src/native/world-fold";
import { MadaraRpc } from "../../../../apps/herald/src/madara-rpc";
import { WorldEventDecodeMonitor } from "../../../../apps/herald/src/world-event-decoder";
import { createHeraldRequestHandler } from "../../../../apps/herald/src/http";
import type { NativeManifest } from "../../../../apps/herald/src/native/schema";
import type { RpcBlockWithReceipts } from "../../../../apps/herald/src/types";
import spec from "../../../../contracts/l3/world-native/fixtures/slice.json";
import { replayDojo } from "./replay-dojo";
import { sourceProvenance } from "./source-provenance";

const root = resolve(import.meta.dir, "../../../..");
const [dojoManifest, dojoThrough, nativeManifest, nativeThrough] = process.argv.slice(2);
if (!dojoManifest || !nativeManifest || ![dojoThrough, nativeThrough].every((value) => /^\d+$/.test(value)))
  throw new Error("Usage: run-herald-replay.ts DOJO_MANIFEST DOJO_THROUGH NATIVE_MANIFEST NATIVE_THROUGH");
const provenance = await sourceProvenance(true);
const reference = await prepareReference();
const [legacyBaseline, legacyCurrent] = await Promise.all([
  replayDojo(reference, dojoManifest, Number(dojoThrough)),
  replayDojo(root, dojoManifest, Number(dojoThrough)),
]);
assert.deepEqual(legacyCurrent, legacyBaseline);
const native = await proveNativeReplay(await Bun.file(nativeManifest).json(), Number(nativeThrough));
const report = {
  ...native,
  provenance,
  referenceRevision: spec.rulesRevision,
  command: "pnpm run lab:replay:native DOJO_MANIFEST DOJO_THROUGH NATIVE_MANIFEST NATIVE_THROUGH",
  legacyBaseline,
  legacyCurrent,
};
await writeFile(
  resolve(root, "contracts/l3/world-native/fixtures/herald-replay.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    gate: report.gate,
    passed: report.passed,
    checkpointSha256: report.checkpointSha256,
    legacy: legacyCurrent.sha256,
  }),
);

async function prepareReference() {
  const directory = resolve(root, "deploy/madara-lab/.lab/herald-reference");
  await mkdir(directory, { recursive: true });
  const archive = execFileSync("git", ["archive", spec.rulesRevision, "apps/herald"], {
    cwd: root,
    maxBuffer: 32 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", directory], { input: archive });
  try {
    await symlink(resolve(root, "apps/herald/node_modules"), resolve(directory, "apps/herald/node_modules"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return directory;
}

async function proveNativeReplay(manifest: NativeManifest, through: number) {
  const decoder = new NativeDecoder(manifest);
  const native = new NativeIngestion(decoder);
  const rpc = new MadaraRpc("http://127.0.0.1:5050/rpc/v0_10_2");
  const from = manifest.native.deploymentBlock;
  if (through < from) throw new Error("Replay range precedes native deployment");
  const blocks: RpcBlockWithReceipts[] = [];
  for (let number = from; number <= through; number++) blocks.push(await rpc.getBlockWithReceipts(number));
  const recorded = {
    getBlockWithReceipts: async (number: number | string) =>
      number === "pre_confirmed"
        ? { block_number: through + 1, timestamp: blocks.at(-1)!.timestamp + 2, transactions: [] }
        : blocks[Number(number) - from],
  } as unknown as MadaraRpc;
  const liveFold = new WorldFold(decoder.registry);
  const live = new NativeLiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    confirmedBlock: from - 1,
    confirmedFold: liveFold,
    rpc: recorded,
    checkpointEveryBlocks: 100000,
    checkpointStore: { save: async () => {} },
    decodeMonitor: new WorldEventDecodeMonitor(),
  });
  const published: { type: string }[] = [];
  const connection = live.attach("1", { send: (value) => published.push(JSON.parse(value)) });
  live.resume(connection, { type: "resume", epoch: "empty", seq: 0 });
  for (const block of blocks) {
    for (const { receipt, transaction } of block.transactions) {
      live.acceptTransaction({
        ...transaction,
        transaction_hash: receipt.transaction_hash,
        finality_status: "PRE_CONFIRMED",
      });
      live.acceptReceipt({ ...receipt, finality_status: "PRE_CONFIRMED" });
    }
    await live.acceptSubscribedHead({ block_number: block.block_number, timestamp: block.timestamp });
    assert.equal(native.halted, undefined);
  }
  const fold = new WorldFold(decoder.registry);
  const middle = Math.floor((from + through) / 2);
  const first = await native.replay({ fold, rpc: recorded, fromBlock: from, toBlock: middle });
  const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
  const second = await native.replay({ fold: restored, rpc: recorded, fromBlock: middle + 1, toBlock: through });
  assert.deepEqual(restored.checkpoint(), liveFold.checkpoint());
  const events = [...first.events, ...second.events];
  const deletes = events.filter((event) => event.kind === "delete");
  assert(deletes.length >= 2);
  assert(restored.modelRows("LastBattle").length >= 2);
  assert(restored.modelRows("ExplorerTroops").length >= 2);
  const endpoints = await compareEndpoints(restored, live, through, blocks.at(-1)!.timestamp, manifest.world.address);
  return {
    gate: "native-confirmed-history-reconstruction",
    passed: true,
    world: manifest.world.address,
    fromBlock: from,
    throughBlock: through,
    reconnectBlock: middle,
    events: events.length,
    deletes: deletes.length,
    upgrades: events
      .filter((event) => event.model.name === "DomainClass")
      .map((event) => event.position.transactionHash),
    checkpointSha256: digest(restored.checkpoint()),
    retainedRows: restored.retainedRowCount(),
    endpoints,
    liveReceiptDiffs: published.filter((message) => message.type === "diff").length,
    transactions: [...new Set(events.map((event) => event.position.transactionHash))],
  };
}

async function compareEndpoints(fold: WorldFold, live: NativeLiveWorld, block: number, timestamp: number, worldAddress: string) {
  const handler = (source: Pick<WorldFold, "modelRows">) =>
    createHeraldRequestHandler({
      chain: "madara",
      worldAddress,
      confirmedBlock: () => block,
      chainTimestamp: () => timestamp,
      decodedModelCount: 0,
      fold: {
        modelRows: (name) => source.modelRows(name),
        snapshot: () => {
          throw new Error("Unexpected snapshot read during directory proof");
        },
      },
      metrics: {
        decoded_events: 0,
        event_messages: 0,
        store_events: 0,
        pages: 0,
        retained_rows: fold.retainedRowCount(),
      },
      undecodableEventCount: () => 0,
    });
  const endpoints = [];
  for (const path of ["/madara/games", "/madara/games/1/leaderboard"]) {
    const left = await handler(fold)(new Request(`http://localhost${path}`));
    const right = await handler(live)(new Request(`http://localhost${path}`));
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    const body = await left.json();
    assert.deepEqual(body, await right.json());
    const rows = path.endsWith("leaderboard") ? body.entries : body.games;
    assert(rows.length > 0);
    endpoints.push({ path, rows: rows.length, sha256: digest(body) });
  }
  return endpoints;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
