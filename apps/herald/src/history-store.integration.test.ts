import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GAME_SYNC_MODEL_MANIFEST } from "@bibliothecadao/eternum/game-sync-models";
import { HistoryStore } from "./history-store";
import { createHeraldRequestHandler } from "./http";
import type { DecodedWorldEvent } from "./types";

const databaseUrl = process.env.HERALD_TEST_DATABASE_URL;
const storyModel = GAME_SYNC_MODEL_MANIFEST.find((model) => model.name === "StoryEvent")!;

function story(block: number, index = 0, gameId = 7): DecodedWorldEvent {
  return {
    kind: "event",
    model: storyModel,
    entityId: `0x${block}${index}`,
    key: { game_id: gameId, id: block * 10 + index, tx_hash: `0x${block}` },
    value: { story: { RealmCreatedStory: {} }, timestamp: block },
    position: { blockNumber: block, transactionIndex: 0, eventIndex: index, transactionHash: `0x${block}` },
  };
}

describe.skipIf(!databaseUrl)("PostgreSQL history recovery", () => {
  let admin: Pool;
  let schema: string;
  let scopedUrl: string;
  let store: HistoryStore;

  beforeAll(() => {
    admin = new Pool({ connectionString: databaseUrl, max: 1 });
  });
  beforeEach(async () => {
    schema = `history_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    scopedUrl = url.toString();
    store = new HistoryStore(scopedUrl, "madara", "0x123");
    await store.initialize();
  });
  afterEach(async () => {
    await store.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  });
  afterAll(async () => {
    await admin.end();
  });

  it("repairs a legacy marker while live ingestion continues, without skipping backfill", async () => {
    await admin.query(
      `INSERT INTO ${schema}.herald_history_progress (chain, world_address, complete_through_block) VALUES ('madara', '0x123', 999)`,
    );
    await store.appendEvents([story(11)], 11);
    expect(await store.historyProgress()).toBeNull();
    await expect(store.queryStoryHistory({ afterBlock: 0, limit: 10 })).rejects.toThrow("history_not_ready");
    await store.appendBackfilledEvents([story(1)], 5);
    expect(await store.historyProgress()).toBe(5);
    expect((await store.queryStoryHistory({ afterBlock: 0, limit: 10 })).items.map((row) => row.block_number)).toEqual([
      1,
    ]);
    await store.completeHistoryBackfill(10);
    expect(await store.historyProgress()).toBe(11);
    await store.appendEvents([story(12)], 12);
    expect(await store.historyProgress()).toBe(12);
  });

  it("holds a stable page boundary as new blocks arrive and resumes after a new store instance", async () => {
    await store.appendBackfilledEvents([story(1), story(2), story(2, 1, 8), story(3)], 3);
    await store.completeHistoryBackfill(3);
    const first = await store.queryStoryHistory({ afterBlock: 0, limit: 2 });
    expect(first.items.map((row) => [row.block_number, row.event_index])).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(first.has_more).toBe(true);
    await store.appendEvents([story(4)], 4);
    const second = await store.queryStoryHistory({ cursor: first.next_cursor, limit: 2 });
    expect(second.through_block).toBe(3);
    expect(second.complete_through_block).toBe(4);
    expect(second.items.map((row) => [row.block_number, row.event_index])).toEqual([
      [2, 1],
      [3, 0],
    ]);
    expect(second.items[0].game_id).toBe("8");
    expect(second.has_more).toBe(false);
    await store.close();
    store = new HistoryStore(scopedUrl, "madara", "0x123");
    const resumed = await store.queryStoryHistory({ cursor: second.next_cursor, limit: 2 });
    expect(resumed.items.map((row) => row.block_number)).toEqual([4]);
    const empty = await store.queryStoryHistory({ cursor: resumed.next_cursor, limit: 2 });
    expect(empty.items).toEqual([]);
    expect(empty.next_cursor).toBe(resumed.next_cursor);
  });

  it("fences backfill completion against queued writes and never advances beyond a decode gap", async () => {
    await store.appendBackfilledEvents([story(1)], 1);
    await Promise.all([
      store.appendEvents([story(2)], 2),
      store.completeHistoryBackfill(1),
      store.appendEvents([story(3)], 3),
    ]);
    expect(await store.historyProgress()).toBe(3);
    await store.appendEvents([], 4, false);
    await store.appendEvents([story(5)], 5);
    expect(await store.historyProgress()).toBe(3);
    const page = await store.queryStoryHistory({ afterBlock: 0, limit: 10 });
    expect(page.items.map((row) => row.block_number)).toEqual([1, 2, 3]);
  });

  it("serves the cursor through HTTP, rejects invalid requests, and stays scoped to the world", async () => {
    const other = new HistoryStore(scopedUrl, "madara", "0x456");
    try {
      await other.appendBackfilledEvents([story(1, 1)], 1);
    } finally {
      await other.close();
    }
    await store.appendBackfilledEvents([story(1)], 1);
    const handler = createHeraldRequestHandler({
      chain: "madara",
      confirmedBlock: () => 1,
      chainTimestamp: () => 1,
      decodedModelCount: 0,
      fold: { modelRows: () => [], snapshot: () => ({ game_id: "7", confirmed_block: 1, models: [] }) },
      metrics: { decoded_events: 0, event_messages: 0, pages: 0, retained_rows: 0, store_events: 0 },
      history: store,
      undecodableEventCount: () => 0,
    });
    const response = await handler(new Request("http://herald/madara/history/story-events?after_block=0&limit=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const page = await response.json();
    expect(page.items).toHaveLength(1);
    expect(page.items[0].event_index).toBe(0);
    expect((await handler(new Request("http://herald/madara/history/story-events?cursor=invalid"))).status).toBe(400);
    expect((await handler(new Request("http://herald/madara/history/story-events?after_block=2"))).status).toBe(409);
    const otherCursor = new HistoryStore(scopedUrl, "madara", "0x456");
    try {
      await expect(otherCursor.queryStoryHistory({ cursor: page.next_cursor, limit: 10 })).rejects.toThrow(
        "out_of_scope",
      );
    } finally {
      await otherCursor.close();
    }
  });
});
