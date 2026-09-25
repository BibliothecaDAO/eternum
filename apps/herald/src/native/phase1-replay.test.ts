import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { GameSyncFact } from "@bibliothecadao/eternum/game-sync";
import { isClientGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { WorldFold } from "../world-fold";
import type { FoldChange, GameSnapshot, RpcReceipt, RpcTransaction } from "../types";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { manifest, schema } from "./fixtures";

type ContractRead = { kind: string; transactionHash: string; nonce: string; playerPoints: string };
type Recording = {
  sourceHead: string;
  schemaIdentity: string;
  worldAddress: string;
  actor: string;
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

function applyClientFacts(store: NativeFactStore, changes: { change?: FoldChange }[]) {
  store.applyFacts(
    changes.flatMap<GameSyncFact>(({ change }) => {
      const row = change?.set ?? change?.del;
      if (!row || !isClientGameSyncModel(row.model)) return [];
      if (schema.events.some((event) => event.name === row.model)) return [];
      if (change?.set) return [change.set];
      return change?.del ? [{ ...change.del, value: null }] : [];
    }),
  );
}

function expectContractFacts(store: NativeFactStore, expected: ContractRead) {
  const actor = BigInt(recording.actor);
  expect(store.require("ActionNonce", { game_id: 1, actor }).next_nonce).toBe(BigInt(expected.nonce));
  expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: actor }).known?.points).toBe(
    BigInt(expected.playerPoints),
  );
  if (BigInt(expected.playerPoints) === 0n) {
    expect(store.get("PlayerPoints", { game_id: 1, address: actor })).toBeUndefined();
    return;
  }
  expect(store.require("PointsTotal", { game_id: 1 }).total).toBe(BigInt(expected.playerPoints));
}

async function replayRecording(ingestion: NativeIngestion, fold: WorldFold) {
  const first = Math.min(...recording.records.map(({ receipt }) => receipt.block_number!));
  const last = Math.max(...recording.records.map(({ receipt }) => receipt.block_number!));
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

describe("fresh phase-1 gameplay recording", () => {
  it("replays settle, exploration, points and nonce facts against the recorded contract reads", async () => {
    expect(recording.schemaIdentity).toBe(schema.identity);
    expect(recording.checks.map((check) => check.kind)).toContain("SettleBlitzRoster");
    expect(recording.checks.some((check) => check.kind === "Explore")).toBe(true);
    expect(recording.checks.some((check) => BigInt(check.playerPoints) > 0n)).toBe(true);
    const decoder = new NativeDecoder({ ...manifest, world: { address: recording.worldAddress } });
    const ingestion = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: recording.actor, timestamp: undefined });
    for (const { receipt, transaction } of recording.records) {
      const overlay = fold.overlay();
      ingestion.applyReceipt(overlay, receipt, null, 0, transaction.calldata);
      const result = ingestion.applyReceipt(fold, receipt, receipt.block_number!, 0, transaction.calldata);
      applyClientFacts(store, result.changes);
      expect(overlay.checkpoint()).toEqual(fold.checkpoint());
      const expected = recording.checks.find(
        (check) => BigInt(check.transactionHash) === BigInt(receipt.transaction_hash),
      );
      if (expected) expectContractFacts(store, expected);
    }
    const replay = new WorldFold(decoder.registry);
    const last = await replayRecording(ingestion, replay);
    expect(replay.snapshot(1, last)).toEqual(recording.finalSnapshot);
    expect(replay.checkpoint()).toEqual(fold.checkpoint());
    expect(WorldFold.restore(decoder.registry, fold.checkpoint()).snapshot(1, last)).toEqual(recording.finalSnapshot);
  });
});
