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
import type { NativeSchema } from "./schema";
import recordedSchemaJson from "../../../../contracts/l3/world-native/tests/fixtures/gameplay-facts/phase1-schema.json";

const recordedSchema = recordedSchemaJson as unknown as NativeSchema;

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

function recordingDecoder() {
  expect(recording.schemaIdentity).toBe(recordedSchema.identity);
  return new NativeDecoder({
    ...manifest,
    world: { address: recording.worldAddress },
    native: {
      ...manifest.native,
      activeSchema: recordedSchema.identity,
      releaseSchemas: { "1": recordedSchema.identity },
      schemas: { [recordedSchema.identity]: recordedSchema },
    },
  });
}

function recordedLayoutNames() {
  const decoder = recordingDecoder();
  const models = new Set(
    recording.finalSnapshot.models.filter(({ rows }) => rows.length > 0).map(({ model }) => model),
  );
  const events = new Set<string>();
  for (const { receipt } of recording.records) {
    receipt.events.forEach((event, eventIndex) => {
      if (!decoder.owns(event.from_address)) return;
      const layout = recordedSchema.games.events.find(({ prefix }) =>
        prefix.every((felt, index) => BigInt(felt) === BigInt(event.keys[index] ?? -1)),
      );
      expect(layout, "Recorded event layout is missing").toBeDefined();
      events.add(layout!.name);
      const decoded = decoder.decode({
        ...event,
        block_number: receipt.block_number!,
        transaction_hash: receipt.transaction_hash,
        transaction_index: 0,
        event_index: eventIndex,
      });
      if (decoded.kind !== "event") models.add(decoded.model.name);
    });
  }
  return { models, events };
}

function expectRecordedLayouts(current: NativeSchema) {
  const { models, events } = recordedLayoutNames();
  const types: string[] = [];
  for (const name of models) {
    const original = recordedSchema.models.find((model) => model.name === name);
    expect(original, `Recorded model ${name} is missing`).toBeDefined();
    expect(
      current.models.find((model) => model.name === name),
      `Recorded model ${name} layout changed`,
    ).toEqual(original);
    types.push(...original!.keys.concat(original!.members).map(({ type }) => type));
  }
  for (const name of events) {
    const original = recordedSchema.games.events.find((event) => event.name === name)!;
    expect(
      current.games.events.find((event) => event.name === name),
      `Recorded event ${name} layout changed`,
    ).toEqual(original);
    expect(
      current.events.find((event) => event.name === name),
      `Recorded event ${name} projection changed`,
    ).toEqual(recordedSchema.events.find((event) => event.name === name));
    types.push(...original.members.map(({ type }) => type));
  }
  expectRecordedTypes(current, types);
}

function expectRecordedTypes(current: NativeSchema, pending: string[]) {
  const visited = new Set<string>();
  while (pending.length > 0) {
    // Generic containers refer to their payload types without having a schema entry themselves.
    for (const name of pending.pop()!.match(/[A-Za-z_][A-Za-z_0-9]*(?:::[A-Za-z_][A-Za-z_0-9]*)*/g) ?? []) {
      const original = recordedSchema.types[name];
      if (!original || visited.has(name)) continue;
      visited.add(name);
      expect(current.types[name], `Recorded type ${name} layout changed`).toEqual(original);
      pending.push(...(original.type === "struct" ? original.members : original.variants).map(({ type }) => type));
    }
  }
}

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

describe("phase-1 gameplay recording provenance and compatibility", () => {
  it("accepts the current schema while retaining the recorded identity", () => {
    expectRecordedLayouts(schema);
  });

  it("rejects a changed recorded model layout", () => {
    const changed = structuredClone(schema);
    changed.models.find(({ name }) => name === "PlayerPoints")!.members[0].type = "core::integer::u64";
    expect(() => expectRecordedLayouts(changed)).toThrow("Recorded model PlayerPoints layout changed");
  });

  it("rejects a changed recorded event layout", () => {
    const changed = structuredClone(schema);
    changed.games.events.find(({ name }) => name === "PointsAwarded")!.members[0].kind = "data";
    expect(() => expectRecordedLayouts(changed)).toThrow("Recorded event PointsAwarded layout changed");
  });

  it("rejects a changed nested type used by a recorded model", () => {
    const changed = structuredClone(schema);
    const battle = changed.types["world_native::rules::BattleConfig"];
    if (battle.type !== "struct") throw new Error("Expected a BattleConfig struct");
    battle.members.push({ name: "extra_field", type: "core::integer::u32" });
    expect(() => expectRecordedLayouts(changed)).toThrow(
      "Recorded type world_native::rules::BattleConfig layout changed",
    );
  });

  it("replays settle, exploration, points and nonce facts against the recorded contract reads", async () => {
    expect(recording.checks.map((check) => check.kind)).toContain("SettleBlitzRoster");
    expect(recording.checks.some((check) => check.kind === "Explore")).toBe(true);
    expect(recording.checks.some((check) => BigInt(check.playerPoints) > 0n)).toBe(true);
    const decoder = recordingDecoder();
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
