import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { HistoryStore } from "./history-store";
import { backfillHistory } from "./history-backfill";
import { WorldEventDecodeMonitor } from "./world-event-decoder";
import type { MadaraRpc } from "./madara-rpc";
import type { ModelRegistry } from "./model-registry";

const databaseUrl = process.env.HERALD_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("existing history progress", () => {
  it("preserves the deployed checkpoint on restart without requesting a genesis replay", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `history_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    let store = new HistoryStore(url.toString(), "madara", "0x123");
    try {
      await store.initialize();
      await admin.query(
        `INSERT INTO ${schema}.herald_history_progress (chain, world_address, complete_through_block) VALUES ('madara', '0x123', 500001)`,
      );
      await store.close();
      store = new HistoryStore(url.toString(), "madara", "0x123");
      await store.initialize();
      const getEvents = vi.fn(async function* () {});
      await backfillHistory({
        historyStore: store,
        rpc: { getEvents } as unknown as MadaraRpc,
        registry: { worldAddress: "0x123", events: [] } as unknown as ModelRegistry,
        decodeMonitor: new WorldEventDecodeMonitor(),
        toBlock: 500001,
      });
      expect(getEvents).not.toHaveBeenCalled();
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
describe.skipIf(!databaseUrl)("confirmed story cursor", () => {
  it("waits for backfill, initializes at head, pages ties, and drains ended-game records without rewinding history", async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `story_cursor_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const store = new HistoryStore(url.toString(), "madara", "0x123");
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
