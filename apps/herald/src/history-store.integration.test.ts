import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";
import { encodeMembers } from "./native/serde";
import { buildFrontierLeaderboard } from "./native/frontier-leaderboard";
import { manifest, receipt } from "./native/fixtures";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { HistoryStore } from "./history-store";
import { loadNativeWorld } from "./native/load";
import { WorldFold } from "./world-fold";
import { createNativeHistoryCodec } from "./native/history";
import { schema as nativeSchema, setup } from "./native/fixtures";
import type { MadaraRpc } from "./madara-rpc";

const databaseUrl = process.env.HERALD_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("HERALD_TEST_DATABASE_URL is required for the PostgreSQL suite");
describe("existing history progress", () => {
  it("preserves the deployed checkpoint on restart without requesting a genesis replay", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `history_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    let store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
    try {
      await store.initialize();
      await admin.query(
        `INSERT INTO ${schema}.herald_history_progress (chain, world_address, complete_through_block, frontier_ranks_through_block) VALUES ('madara', '0x123', 500001, 500001)`,
      );
      await store.close();
      store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
      await store.initialize();
      const { native, decoder } = setup();
      const readBlock = vi.fn();
      const checkpointStore = {
        initialize: vi.fn(),
        load: vi.fn(async () => ({ fold: new WorldFold(decoder.registry), confirmedBlock: 500001 })),
        save: vi.fn(),
      };
      const rpc = { blockNumber: async () => 500001, readBlock } as unknown as MadaraRpc;
      await loadNativeWorld({ chain: "madara", checkpointStore, history: store, native, rpc });
      expect(readBlock).not.toHaveBeenCalled();
      expect(checkpointStore.save).not.toHaveBeenCalled();
      expect(await store.historyProgress()).toBe(500001);
      expect(
        (await store.queryEvents({ gameId: "7", model: "StoryEvent", limit: 10, offset: 0 })).complete_through_block,
      ).toBe(500001);
    } finally {
      await store.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
});

// Uses persisted receipt positions: ties within a block must not skip events at a page boundary.
describe("confirmed story cursor", () => {
  it("initializes at head, pages ties, and drains ended-game records without rewinding history", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `story_cursor_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
    try {
      await store.initialize();
      await store.appendEvents([], 10);
      const initial = await store.queryStoryCursor(null, 2);
      expect(initial.items).toEqual([]);
      for (const [transaction, event, game] of [
        [0, 0, 1],
        [0, 1, 2],
        [1, 0, 1],
      ]) {
        await admin.query(
          `INSERT INTO ${schema}.herald_history_events (chain,world_address,model,game_id,block_number,transaction_hash,transaction_index,event_index,value) VALUES ('madara','0x123','StoryEvent',$1,11,$2,$3,$4,'{}')`,
          [game, `0x${transaction + 1}`, transaction, event],
        );
      }
      // Rows beyond the durable marker cannot be consumed, even when already present.
      expect((await store.queryStoryCursor(initial.next_cursor, 2)).items).toEqual([]);
      await store.appendEvents([], 11);
      const first = await store.queryStoryCursor(initial.next_cursor, 2);
      expect(first.items.map((x) => [x.transaction_index, x.event_index])).toEqual([
        [0, 0],
        [0, 1],
      ]);
      const last = await store.queryStoryCursor(first.next_cursor, 2);
      expect(last.items.map((x) => [x.transaction_index, x.event_index])).toEqual([[1, 0]]);
      expect(last.next_cursor.block).toBe(11);
      expect((await store.queryStoryCursor(last.next_cursor, 2)).items).toEqual([]);
      expect(await store.historyProgress()).toBe(11);
      await expect(store.queryStoryCursor({ block: 12, transaction: 0, event: 0 }, 2)).rejects.toThrow("regressed");
    } finally {
      await store.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
});

describe("native confirmed history", () => {
  it("rebuilds combat history and review across restart without mirroring state", async () => {
    const { createNativeHistoryCodec } = await import("./native/history");
    const { setup, receipt, battleEvent, schema: nativeSchema, manifest } = await import("./native/fixtures");
    const nativeHistoryCodec = createNativeHistoryCodec(nativeSchema);
    const admin = new Pool({ connectionString: databaseUrl });
    const namespace = `native_history_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${namespace}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${namespace}`);
    let store = new HistoryStore(url.toString(), "madara", manifest.world.address, nativeHistoryCodec);
    try {
      await store.initialize();
      await store.appendEvents([], 9);
      const cursor = (await store.queryStoryCursor(null, 2)).next_cursor;
      const { native, fold } = setup();
      const result = native.applyReceipt(fold, receipt([battleEvent()]), 10, 0);
      await admin.query(`
        CREATE FUNCTION ${namespace}.reject_history_commit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'history commit rejected'; END $$;
        CREATE CONSTRAINT TRIGGER reject_history_commit AFTER INSERT ON ${namespace}.herald_history_events
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${namespace}.reject_history_commit()
      `);
      await expect(store.appendEvents(result.events, 10)).rejects.toThrow("history commit rejected");
      expect(await store.historyProgress()).toBe(9);
      expect((await store.queryStoryCursor(cursor, 10)).items).toEqual([]);
      await admin.query(`DROP TRIGGER reject_history_commit ON ${namespace}.herald_history_events;
        DROP FUNCTION ${namespace}.reject_history_commit()`);
      await store.appendEvents(result.events, 10);
      await store.appendEvents(result.events, 10);
      expect((await store.queryStoryCursor(cursor, 10)).items.map(({ model }) => model)).toEqual(["BattleEvent"]);
      const snapshot = fold.reviewSnapshot(1, 10);
      await store.freezeReviewSnapshot(snapshot.game_id, () => snapshot);
      await store.close();
      store = new HistoryStore(url.toString(), "madara", manifest.world.address, nativeHistoryCodec);
      await store.initialize();
      expect(await store.reviewSnapshot("1")).toEqual(snapshot);
      const repeated = vi.fn(() => {
        throw new Error("Finalized review must not be rebuilt");
      });
      for (let head = 11; head < 20; head++) await store.freezeReviewSnapshot("1", repeated);
      expect(repeated).not.toHaveBeenCalled();
      const battles = await store.queryEvents({ gameId: "1", model: "BattleEvent", limit: 10, offset: 0 });
      expect(battles.total).toBe(1);
      for (const [owner, entityId] of [
        ["0x111", "7"],
        ["0x222", "8"],
      ]) {
        const filtered = await store.queryEvents({
          gameId: "1",
          model: "BattleEvent",
          owner,
          entityId,
          limit: 10,
          offset: 0,
        });
        expect(filtered.total).toBe(1);
      }
      expect(
        (await store.queryEvents({ gameId: "1", model: "BattleEvent", owner: "0x999", limit: 10, offset: 0 })).total,
      ).toBe(0);
      const either = await store.queryEvents({
        gameId: "1",
        model: "BattleEvent",
        owner: ["0x999", "0x222"],
        limit: 10,
        offset: 0,
      });
      expect(either.total).toBe(1);
      expect(battles.items[0].value).toMatchObject({
        attacker: { player: "0x111", before: "0x64", after: "0x5a" },
        defender: { player: "0x222", after: "0x0" },
      });
    } finally {
      await store.close();
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
      await admin.end();
    }
  });
});

describe("Frontier confirmed season history", () => {
  it("prices decoded stories, deduplicates receipts, bounds by the head and replays identically after restart", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const namespace = `frontier_history_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${namespace}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${namespace}`);
    const open = () => new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
    let store = open();
    try {
      await store.initialize();
      const { native, fold } = setup();
      const layout = nativeSchema.games.events.find((e) => e.name === "StoryEvent")!;
      const stories = [0, 1, 2, 3].map(
        (index) =>
          new CairoCustomEnum({
            SitePayout: {
              xp: 85,
              structure_id: 1,
              explorer_id: 7,
              site_id: 20 + index,
              category: 10,
              reward: new CairoOption(CairoOptionVariant.Some, { resource_type: 37, amount: 2_000_000_000_000n }),
            },
          }),
      );
      stories.push(
        new CairoCustomEnum({
          SitePayout: {
            xp: 85,
            structure_id: 1,
            explorer_id: 7,
            site_id: 9,
            category: 7,
            reward: new CairoOption(CairoOptionVariant.Some, { resource_type: 23, amount: 500000000000n }),
          },
        }),
      );
      const events = stories.map((story, index) => {
        const values = {
          version: 2,
          game_id: 1,
          owner: new CairoOption(CairoOptionVariant.Some, 10),
          entity_id: new CairoOption(CairoOptionVariant.Some, 1),
          tx_hash: 85,
          story,
          timestamp: 100,
        };
        return {
          from_address: manifest.world.address,
          keys: [
            ...layout.prefix,
            ...encodeMembers(
              nativeSchema,
              layout.members.filter((m) => m.kind === "key"),
              values,
            ),
          ],
          data: encodeMembers(
            nativeSchema,
            layout.members.filter((m) => m.kind === "data"),
            values,
          ),
        };
      });
      const result = native.applyReceipt(fold, receipt(events), 10, 0);
      await store.appendEvents(result.events, 10);
      await store.appendEvents(result.events, 10);
      await expect(store.frontierHistory("1", 11)).rejects.toThrow("incomplete");
      expect(await store.frontierHistory("1", 9)).toEqual([]);
      const history = await store.frontierHistory("1", 10);
      expect(history).toHaveLength(5);
      const values: Record<string, Record<string, unknown>> = {
        GameRegistry: {},
        Structure: {
          entity_id: 1,
          owner: 10,
          base: { category: 1, level: 1 },
          metadata: { has_wonder: false, deepest_depth: 2, order: 5 },
        },
      };
      const read = (model: string) => (values[model] ? [{ key: "1", value: { game_id: "1", ...values[model] } }] : []);
      const board = buildFrontierLeaderboard(read, "1", history);
      expect(board.entries[0]).toMatchObject({
        chests_earned: 4,
        sites_cleared: { total: 5, camps: 1, ruins: 4 },
        rewards: { lords: "8000", labor: "500000000000", essence: "0" },
      });
      await store.close();
      store = open();
      await store.initialize();
      await store.appendEvents(result.events, 10);
      expect(buildFrontierLeaderboard(read, "1", await store.frontierHistory("1", 10))).toEqual(board);
    } finally {
      await store.close();
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
      await admin.end();
    }
  });
});

it("commits day ranks with history, deduplicates replay and recovers them after restart", async () => {
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `day_ranks_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${schema}`);
  let store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
  const ranks = {
    game_id: "1",
    day_index: 0,
    ends_at: 1800010000,
    confirmed_block: 10,
    entries: [{ address: "0x1", structure_id: "7", rank: 1 }],
  };
  try {
    await store.initialize();
    await store.appendEvents([], 10);
    expect(await store.historyProgress(true)).toBeNull(); // Old checkpoints require boundary replay.
    await expect(store.frontierDayRanks("1", 0, 10)).rejects.toThrow("incomplete");
    await store.appendEvents([], 11, [ranks]);
    expect(await store.frontierDayRanks("1", 0, 10)).toBeNull(); // No next-day result before its closing block.
    expect(await store.frontierDayRanks("1", 1, 11)).toBeNull();
    expect(await store.frontierDayRanks("1", 0, 11)).toEqual(ranks);
    await store.appendEvents([], 11, [{ ...ranks, entries: [] }]);
    expect(await store.frontierDayRanks("1", 0, 11)).toEqual(ranks);
    await admin.query(`ALTER TABLE ${schema}.herald_frontier_day_ranks ADD CONSTRAINT fail_day CHECK (day_index < 1)`);
    await expect(store.appendEvents([], 12, [{ ...ranks, day_index: 1 }])).rejects.toThrow();
    expect(await store.historyProgress(true)).toBe(11);
    expect(await store.historyProgress()).toBe(11);
    await store.close();
    store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
    await store.initialize();
    expect(await store.frontierDayRanks("1", 0, 11)).toEqual(ranks);
  } finally {
    await store.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

it("counts each confirmed transaction that left a timed story once, by UTC day, in its own game only", async () => {
  const admin = new Pool({ connectionString: databaseUrl });
  const namespace = `game_transactions_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${namespace}`);
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${namespace}`);
  const store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
  try {
    await store.initialize();
    const { native, fold } = setup();
    const layout = nativeSchema.games.events.find((e) => e.name === "StoryEvent")!;
    const storyEvent = (gameId: number, timestamp: number) => {
      const values = {
        version: 2,
        game_id: gameId,
        owner: new CairoOption(CairoOptionVariant.Some, 10),
        entity_id: new CairoOption(CairoOptionVariant.Some, 1),
        tx_hash: 85,
        story: new CairoCustomEnum({
          SitePayout: {
            xp: 85,
            structure_id: 1,
            explorer_id: 7,
            site_id: 9,
            category: 7,
            reward: new CairoOption(CairoOptionVariant.None),
          },
        }),
        timestamp,
      };
      const members = (kind: string) => layout.members.filter((m) => m.kind === kind);
      return {
        from_address: manifest.world.address,
        keys: [...layout.prefix, ...encodeMembers(nativeSchema, members("key"), values)],
        data: encodeMembers(nativeSchema, members("data"), values),
      };
    };
    const firstDay = 1_762_560_000;
    const transactions = [
      [receipt([storyEvent(1, firstDay + 5), storyEvent(1, firstDay + 5)], "0xa1"), 10, 0],
      [receipt([storyEvent(1, firstDay + 86_399)], "0xa2"), 10, 1],
      [receipt([storyEvent(1, firstDay + 86_400)], "0xa3"), 11, 0],
      [receipt([storyEvent(2, firstDay + 5)], "0xa4"), 11, 1],
    ] as const;
    for (const [transaction, block, index] of transactions)
      await store.appendEvents(native.applyReceipt(fold, transaction, block, index).events, block);
    expect(await store.gameTransactions("1")).toEqual({
      total: 3,
      days: [
        { day: "2025-11-08", transactions: 2 },
        { day: "2025-11-09", transactions: 1 },
      ],
    });
    expect(await store.gameTransactions("3")).toEqual({ total: 0, days: [] });
  } finally {
    await store.close();
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    await admin.end();
  }
});
