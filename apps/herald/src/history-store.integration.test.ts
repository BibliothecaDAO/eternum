import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { HistoryStore } from "./history-store";
import { backfillNativeHistory } from "./native/load";
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
        `INSERT INTO ${schema}.herald_history_progress (chain, world_address, complete_through_block) VALUES ('madara', '0x123', 500001)`,
      );
      await store.close();
      store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
      await store.initialize();
      const getBlockWithReceipts = vi.fn();
      await backfillNativeHistory(setup().native, { getBlockWithReceipts } as unknown as MadaraRpc, store, 500001);
      expect(getBlockWithReceipts).not.toHaveBeenCalled();
      expect(await store.historyProgress()).toBe(500001);
      store.markLeaderboardReady();
      expect(store.leaderboard("7")).not.toBeNull();
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
  it("waits for backfill, initializes at head, pages ties, and drains ended-game records without rewinding history", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `story_cursor_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const store = new HistoryStore(url.toString(), "madara", "0x123", createNativeHistoryCodec(nativeSchema));
    try {
      await store.initialize();
      await store.appendEvents([], 10);
      await expect(store.queryStoryCursor(null, 2)).rejects.toThrow("not ready");
      store.markLeaderboardReady();
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
  it("rebuilds native activity, combat history and review across restart without mirroring state", async () => {
    const { createNativeHistoryCodec } = await import("./native/history");
    const { setup, receipt, rowEvent, battleEvent, schema: nativeSchema, manifest } = await import("./native/fixtures");
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
      store.markLeaderboardReady();
      const cursor = (await store.queryStoryCursor(null, 2)).next_cursor;
      const { native, fold } = setup();
      const award = nativeSchema.domains.season.events.find(({ name }) => name === "PointsAwarded")!;
      const result = native.applyReceipt(
        fold,
        receipt([
          rowEvent("PlayerPoints", ["1", "0x111"], ["5000000"]),
          { from_address: manifest.world.address, keys: [...award.prefix, "1", "1", "0x111"], data: ["0", "5000000"] },
          battleEvent(),
        ]),
        10,
        0,
      );
      await admin.query(`
        CREATE FUNCTION ${namespace}.reject_history_commit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'history commit rejected'; END $$;
        CREATE CONSTRAINT TRIGGER reject_history_commit AFTER INSERT ON ${namespace}.herald_history_events
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${namespace}.reject_history_commit()
      `);
      await expect(store.appendEvents(result.events, 10)).rejects.toThrow("history commit rejected");
      expect(store.leaderboard("1")?.entries).toEqual([]);
      expect(await store.historyProgress()).toBe(9);
      expect((await store.queryStoryCursor(cursor, 10)).items).toEqual([]);
      await admin.query(`DROP TRIGGER reject_history_commit ON ${namespace}.herald_history_events;
        DROP FUNCTION ${namespace}.reject_history_commit()`);
      await store.appendEvents(result.events, 10);
      await store.appendEvents(result.events, 10);
      const before = store.leaderboard("1");
      expect(before?.entries[0].activityBreakdown.exploration).toEqual({ count: 1, points: 5 });
      expect((await store.queryStoryCursor(cursor, 10)).items.map(({ model }) => model)).toEqual([
        "PointsAwarded",
        "BattleEvent",
      ]);
      const snapshot = fold.reviewSnapshot(1, 10);
      await store.freezeReviewSnapshot(snapshot.game_id, () => snapshot);
      await store.close();
      store = new HistoryStore(url.toString(), "madara", manifest.world.address, nativeHistoryCodec);
      await store.initialize();
      store.markLeaderboardReady();
      expect(store.leaderboard("1")).toEqual(before);
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
