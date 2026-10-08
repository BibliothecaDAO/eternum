import { expect, it, vi } from "vitest";
import { dayOf } from "../../../../packages/core/src/utils/days";
import { closingFrontierDays, replayWithFrontierDays } from "./frontier-day-ranks";
import type { FoldRow, RpcBlockWithReceipts } from "../types";
import { receipt, rowEvent, rulesEvent, seedDerivedRows, setup, structureValue } from "./fixtures";
import { WorldFold } from "../world-fold";

const start = 1800000000;
const calendar = { seed: 42n, startMainAt: start, dayUnitSeconds: 3600 };
const game = { game_id: 1, preset_id: 5, seed: 42n, start_main_at: start, end_at: start + 1000000, settled: false };
const rows = {
  GameRegistry: [{ key: "1", value: game }],
  SliceRules: [{ key: "1", value: { game_id: 1, day_unit_seconds: 3600 } }],
  Structure: [1, 2].map((id) => ({
    key: String(id),
    value: {
      ...structureValue,
      game_id: 1,
      entity_id: id,
      owner: id,
      base: { ...structureValue.base, category: 1 },
      metadata: { ...structureValue.metadata, deepest_depth: id },
    },
  })),
};
const read = (model: string) => (rows[model as keyof typeof rows] as FoldRow[]) ?? [];

it("freezes the preceding confirmed standing exactly at the seeded day boundary", () => {
  const day = dayOf(calendar, start)!;
  expect(closingFrontierDays(read, day.end - 1, day.end - 1, 20, [])).toEqual([]);
  const closed = closingFrontierDays(read, day.end - 1, day.end, 20, []);
  expect(closed).toEqual([
    {
      game_id: "1",
      day_index: 0,
      ends_at: day.end,
      confirmed_block: 20,
      entries: [
        { address: "0x2", structure_id: "2", rank: 1 },
        { address: "0x1", structure_id: "1", rank: 2 },
      ],
    },
  ]);
  rows.Structure[0]!.value.metadata.deepest_depth = 3;
  expect(closed[0]!.entries[0]!.address).toBe("0x2");
  rows.Structure[0]!.value.metadata.deepest_depth = 1;
  expect(closingFrontierDays(read, day.end, day.end + 1, 21, [])).toEqual([]);
});

it("closes every elapsed day across empty blocks, without inventing days past the season", () => {
  const first = dayOf(calendar, start)!;
  const second = dayOf(calendar, first.end)!;
  const third = dayOf(calendar, second.end)!;
  expect(closingFrontierDays(read, start - 1, third.end, 20, []).map((day) => day.day_index)).toEqual([0, 1, 2]);
  const end = game.end_at;
  game.end_at = second.end;
  expect(closingFrontierDays(read, start - 1, third.end, 20, []).map((day) => day.day_index)).toEqual([0, 1]);
  game.end_at = end;
});

it("replays a checkpoint before closure, excluding changes at the boundary and rejecting partial replay", async () => {
  const { fold, native, decoder } = setup();
  const gameEvent = rowEvent("GameRegistry", ["1"], {
    ...game,
    name: 1,
    creator: 1,
    ready: true,
    dev_mode_on: false,
    start_settling_at: start,
    end_grace_seconds: 0,
  });
  native.applyReceipt(fold, receipt([gameEvent]), 10, 0);
  seedDerivedRows(fold, decoder, [rulesEvent("1", "3600")]);
  native.applyReceipt(
    fold,
    receipt([
      rowEvent("Structure", ["1", "1"], {
        ...structureValue,
        owner: 1,
        base: { ...structureValue.base, category: 1 },
        metadata: { ...structureValue.metadata, deepest_depth: 1 },
      }),
    ]),
    10,
    0,
  );
  const end = dayOf(calendar, start)!.end;
  const blocks = new Map<number, RpcBlockWithReceipts>([
    [10, { block_number: 10, timestamp: end - 1, transactions: [] }],
    [
      11,
      {
        block_number: 11,
        timestamp: end,
        transactions: [
          {
            transaction: { type: "INVOKE" },
            receipt: receipt([
              rowEvent("Structure", ["1", "2"], {
                ...structureValue,
                owner: 2,
                base: { ...structureValue.base, category: 1 },
                metadata: { ...structureValue.metadata, deepest_depth: 3 },
              }),
            ]),
          },
        ],
      },
    ],
  ]);
  const history = { frontierHistory: vi.fn(async () => []), appendEvents: vi.fn(async () => {}) };
  const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
  const input = {
    fold: restored,
    rpc: {
      getBlockWithReceipts: async (number: number) => {
        const block = blocks.get(number);
        if (!block) throw new Error("disconnected");
        return block;
      },
    },
    fromBlock: 11,
    toBlock: 11,
  };
  const replay = await replayWithFrontierDays(native, history, input);
  expect(replay.frontierDays[0]!.entries).toEqual([{ address: "0x1", structure_id: "1", rank: 1 }]);
  expect(history.frontierHistory).toHaveBeenCalledWith("1", 10);
  expect(history.appendEvents).toHaveBeenCalledWith([], 11, replay.frontierDays);
  const uncommitted = WorldFold.restore(decoder.registry, fold.checkpoint());
  const beforeHistoryFailure = uncommitted.checkpoint();
  history.appendEvents.mockRejectedValueOnce(new Error("history unavailable"));
  await expect(replayWithFrontierDays(native, history, { ...input, fold: uncommitted })).rejects.toThrow(
    "history unavailable",
  );
  expect(uncommitted.checkpoint()).toEqual(beforeHistoryFailure);
  const before = fold.checkpoint();
  await expect(replayWithFrontierDays(native, history, { ...input, fold, toBlock: 12 })).rejects.toThrow(
    "disconnected",
  );
  expect(fold.checkpoint()).toEqual(before);
});

it("uses the existing receipt leaderboard for closing rank, retaining cumulative clears", () => {
  const day = dayOf(calendar, start)!;
  const history = [
    {
      game_id: "1",
      model: "StoryEvent",
      block_number: 19,
      transaction_index: 0,
      event_index: 0,
      transaction_hash: "0x19",
      value: { owner: "0x1", story: { SitePayout: { category: 7, reward: null } } },
    },
  ];
  const closed = closingFrontierDays(read, day.end - 1, day.end, 20, history);
  expect(closed[0]!.entries).toEqual([
    { address: "0x1", structure_id: "1", rank: 1 },
    { address: "0x2", structure_id: "2", rank: 2 },
  ]);
});
