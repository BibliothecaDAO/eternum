import { describe, expect, it, vi } from "vitest";
import { HistoryStore } from "./history-store";

/** A store over a scripted database: the writer can commit a block between the reader's queries. */
const storeWithWriter = (commitDuringRowRead: boolean) => {
  const store = new HistoryStore("postgres://unused", "madara", "0x1", {
    storyModels: ["BattleEvent"],
    pointsModel: "Points",
    readPoints: () => null,
  } as never);
  const pool = (store as unknown as { pool: { query: unknown; end: () => Promise<void> } }).pool;
  const committed = [{ block: 30, own: false }];
  const progress = () => Math.max(...committed.map((row) => row.block));
  pool.query = vi.fn(async (sql: string) => {
    if (sql.includes("COUNT(*)")) return { rows: [{ total: String(committed.length) }] };
    if (sql.includes("FROM herald_history_progress")) return { rows: [{ complete_through_block: String(progress()) }] };
    if (sql.includes("FROM herald_history_events")) {
      const rows = committed.map(({ block }) => ({
        block_number: String(block),
        event_index: 0,
        game_id: "1",
        model: "BattleEvent",
        transaction_hash: `0x${block.toString(16)}`,
        transaction_index: 0,
        value: {},
      }));
      // The player's own sortie at 35 and its progress commit together while these rows are on their way back.
      if (commitDuringRowRead) committed.push({ block: 35, own: true });
      return { rows };
    }
    throw new Error(`unexpected SQL ${sql}`);
  });
  return store;
};

const read = (store: HistoryStore) =>
  store.queryEvents({ gameId: "1", model: "BattleEvent", owner: "0xabc", limit: 100, offset: 0 });

describe("a history page's completeness marker", () => {
  it("never certifies a story committed after its rows were read", async () => {
    const page = await read(storeWithWriter(true));
    // The rows hold the hostile hit at 30 only; the own sortie at 35 landed after them, so the page may not claim 35.
    expect(page.items.map((row) => row.block_number)).toEqual([30]);
    expect(page.complete_through_block).toBe(30);
  });

  it("certifies what it read when no writer interleaves", async () => {
    const page = await read(storeWithWriter(false));
    expect(page.items.map((row) => row.block_number)).toEqual([30]);
    expect(page.complete_through_block).toBe(30);
  });
});
