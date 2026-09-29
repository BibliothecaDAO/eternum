import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { GameSyncFact } from "@bibliothecadao/eternum/game-sync";
import { WorldFold } from "../world-fold";
import type { FoldChange, GameSnapshot, RpcReceipt, RpcTransaction } from "../types";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { manifest, schema as currentSchema } from "./fixtures";
import type { NativeSchema } from "./schema";

type ContractRead = { kind: string; transactionHash: string; nonce: string; playerPoints: string };
type Recording = {
  sourceHead: string;
  schemaIdentity: string;
  worldAddress: string;
  actor: string;
  gameId?: number;
  records: { receipt: RpcReceipt; transaction: RpcTransaction }[];
  checks: ContractRead[];
  finalSnapshot: GameSnapshot;
};
const recording: Recording = JSON.parse(
  readFileSync(
    new URL(
      "../../../../contracts/l3/world-native/tests/fixtures/gameplay-facts/phase1-recording.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function recordingDecoder(provenance: NativeSchema = currentSchema) {
  expect(recording.schemaIdentity).toBe(provenance.identity);
  return new NativeDecoder({
    ...manifest,
    world: { address: recording.worldAddress },
    native: {
      ...manifest.native,
      activeSchema: currentSchema.identity,
      releaseSchemas: { "1": currentSchema.identity },
      schemas: { [currentSchema.identity]: provenance },
    },
  });
}

// Only the contract-read assertions use current client types; WorldFold replays every row under recorded provenance.
function applyClientFacts(store: NativeFactStore, changes: { change?: FoldChange }[]) {
  store.applyFacts(
    changes.flatMap<GameSyncFact>(({ change }) => {
      const row = change?.set ?? change?.del;
      if (!row || !["ActionNonce", "PlayerPoints", "PointsTotal"].includes(row.model)) return [];
      if (change?.set) return [change.set];
      return change?.del ? [{ ...change.del, value: null }] : [];
    }),
  );
}

function expectContractFacts(store: NativeFactStore, expected: ContractRead) {
  const actor = BigInt(recording.actor);
  const gameId = Number(recording.finalSnapshot.game_id);
  expect(store.require("ActionNonce", { game_id: gameId, actor }).next_nonce).toBe(BigInt(expected.nonce));
  expect(store.requireOrAbsent("PlayerPoints", { game_id: gameId, address: actor }).known?.points).toBe(
    BigInt(expected.playerPoints),
  );
  if (BigInt(expected.playerPoints) === 0n) {
    expect(store.get("PlayerPoints", { game_id: gameId, address: actor })).toBeUndefined();
    return;
  }
  expect(store.require("PointsTotal", { game_id: gameId }).total).toBe(BigInt(expected.playerPoints));
}

async function replayRecording(ingestion: NativeIngestion, fold: WorldFold) {
  const first = Math.min(...recording.records.map(({ receipt }) => receipt.block_number!));
  const last = recording.finalSnapshot.confirmed_block;
  await ingestion.replay({
    fold,
    fromBlock: first,
    toBlock: last,
    rpc: {
      getBlockWithReceipts: async (block) => ({
        block_number: Number(block),
        timestamp: 0,
        transactions: recording.records.filter(({ receipt }) => receipt.block_number === Number(block)),
      }),
    },
  });
  return last;
}

// The snapshot is actor-scoped; replay may also contain valid rows outside that actor's scope.
function expectRecordedSnapshot(fold: WorldFold, confirmedBlock: number) {
  expect(confirmedBlock).toBe(recording.finalSnapshot.confirmed_block);
  for (const { model, rows } of recording.finalSnapshot.models) {
    const definition = currentSchema.models.find(({ name }) => name === model);
    if (!definition) throw new Error(`Recorded snapshot model is absent from the current schema: ${model}`);
    const actualByKey = new Map(fold.modelRows(model).map(({ key, value }) => [key, value]));
    for (const row of rows) expect(actualByKey.get(row.key), `${model} ${row.key}`).toEqual(row.value);
  }
}

describe("phase-1 gameplay recording provenance", () => {
  it("rejects a changed recorded model layout", () => {
    const changed = structuredClone(currentSchema);
    changed.models.find(({ name }) => name === "PlayerPoints")!.members[0].type = "core::integer::u64";
    expect(() => recordingDecoder(changed)).toThrow("Native schema identity mismatch");
  });

  it("rejects a changed recorded event layout", () => {
    const changed = structuredClone(currentSchema);
    changed.games.events.find(({ name }) => name === "PointsAwarded")!.members[0].kind = "data";
    expect(() => recordingDecoder(changed)).toThrow("Native schema identity mismatch");
  });

  it("rejects a changed nested type used by a recorded model", () => {
    const changed = structuredClone(currentSchema);
    const battle = changed.types["world_native::rules::BattleConfig"];
    if (battle.type !== "struct") throw new Error("Expected a BattleConfig struct");
    battle.members.push({ name: "extra_field", type: "core::integer::u32" });
    expect(() => recordingDecoder(changed)).toThrow("Native schema identity mismatch");
  });

  it("replays the recorded actor state against contract reads and Herald's final snapshot", async () => {
    expect(recording.records.length).toBeGreaterThan(0);
    expect(recording.checks.length).toBeGreaterThan(0);
    expect(recording.checks.filter(({ kind }) => kind !== "FinalState").length).toBeGreaterThanOrEqual(3);
    expect(recording.checks.filter(({ kind }) => kind === "FinalState")).toHaveLength(1);
    const decoder = recordingDecoder();
    const ingestion = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const store = new NativeFactStore();
    store.setSnapshot({
      gameId: Number(recording.finalSnapshot.game_id),
      complete: true,
      actor: recording.actor,
      timestamp: undefined,
    });
    for (const { receipt, transaction } of recording.records) {
      const overlay = fold.overlay();
      ingestion.applyReceipt(overlay, receipt, null, 0, transaction.calldata);
      const result = ingestion.applyReceipt(fold, receipt, receipt.block_number!, 0, transaction.calldata);
      applyClientFacts(store, result.changes);
      expect(overlay.checkpoint()).toEqual(fold.checkpoint());
      const expected = recording.checks.find(
        (check) => BigInt(check.transactionHash) === BigInt(receipt.transaction_hash),
      );
      if (expected && expected.kind !== "FinalState") expectContractFacts(store, expected);
    }
    const finalState = recording.checks.find(({ kind }) => kind === "FinalState");
    if (!finalState) throw new Error("Phase-1 recording has no final-state contract read");
    expectContractFacts(store, finalState);
    const replay = new WorldFold(decoder.registry);
    const last = await replayRecording(ingestion, replay);
    expectRecordedSnapshot(replay, last);
    expect(replay.checkpoint()).toEqual(fold.checkpoint());
    expectRecordedSnapshot(WorldFold.restore(decoder.registry, fold.checkpoint()), last);
  });
});
