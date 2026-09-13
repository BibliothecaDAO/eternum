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
