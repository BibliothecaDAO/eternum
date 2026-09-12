import { describe, expect, it } from "vitest";
import { encodeHistoryCursor, parseStoryHistoryQuery, resolveHistoryWindow } from "./history-cursor";

const scope = { chain: "madara", world: "0x123" };
const query = (search: string) =>
  parseStoryHistoryQuery(new URL(`http://herald/madara/history/story-events?${search}`));

describe("confirmed history cursor", () => {
  it("starts at an explicit block and retains a page's completion boundary", () => {
    expect(resolveHistoryWindow(query("after_block=-1&limit=20"), scope, 12)).toEqual({
      after: [-1],
      through: 12,
      complete: 12,
    });
    const cursor = encodeHistoryCursor(scope, [10, 2, 3], 12);
    expect(resolveHistoryWindow({ cursor, limit: 20 }, scope, 15)).toEqual({
      after: [10, 2, 3],
      through: 12,
      complete: 15,
    });
  });

  it("allows a fully drained checkpoint to follow new heads", () => {
    const cursor = encodeHistoryCursor(scope, [12]);
    expect(resolveHistoryWindow({ cursor, limit: 20 }, scope, 15).through).toBe(15);
  });

  it.each([
    "",
    "limit=20",
    "after_block=",
    "after_block=1.5",
    "after_block=-2",
    "after_block=9007199254740992",
    "after_block=0&limit=0",
    "after_block=0&limit=501",
    "after_block=0&offset=1",
    "after_block=0&after_block=1",
    "after_block=0&cursor=x",
  ])("rejects ambiguous or unbounded query %s", (search) => {
    expect(() => query(search)).toThrow();
  });

  it.each(["", "bad!", "a".repeat(2049), Buffer.from("{}").toString("base64url")])(
    "rejects malformed cursor %s",
    (cursor) => {
      expect(() => resolveHistoryWindow({ cursor, limit: 20 }, scope, 12)).toThrow("invalid_history_cursor");
    },
  );

  it("rejects a token from another chain/world and a rewound boundary", () => {
    const cursor = encodeHistoryCursor(scope, [10, 2, 3], 12);
    expect(() => resolveHistoryWindow({ cursor, limit: 20 }, { ...scope, chain: "appchain" }, 12)).toThrow(
      "out_of_scope",
    );
    expect(() => resolveHistoryWindow({ cursor, limit: 20 }, { ...scope, world: "0x456" }, 12)).toThrow("out_of_scope");
    expect(() => resolveHistoryWindow({ cursor, limit: 20 }, scope, 11)).toThrow("boundary_unavailable");
    expect(() => resolveHistoryWindow(query("after_block=13"), scope, 12)).toThrow("boundary_unavailable");
    expect(() => resolveHistoryWindow(query("after_block=0"), scope, null)).toThrow("history_not_ready");
  });
});
