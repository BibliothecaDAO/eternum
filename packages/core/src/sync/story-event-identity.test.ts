import { describe, expect, it } from "vitest";
import { storyEventIdentity, storyEventScopeKey } from "./story-event-identity";

const scope = { chain: "madara", worldAddress: "0xabc", gameId: 54 };
const record = { game_id: "0x36", id: "0x7", tx_hash: "0xfeed" };

describe("StoryEvent identity", () => {
  it("matches history and stream numeric encodings without receipt indices or hashed keys", () => {
    expect(storyEventIdentity(scope, record)).toBe(
      storyEventIdentity({ ...scope, worldAddress: "0x00ABC" }, { game_id: "54", id: 7n, tx_hash: "0x00FEED" }),
    );
    expect(storyEventIdentity(scope, record)).toBe("story:v1:madara:0xabc:0x36:0xfeed:0x7");
  });

  it("preserves separate records in the same transaction and reused ids in another transaction", () => {
    const keys = [record, { ...record, id: "0x8" }, { ...record, tx_hash: "0xbeef" }].map((value) =>
      storyEventIdentity(scope, value),
    );
    expect(new Set(keys).size).toBe(3);
  });

  it("separates chains, deployed worlds and games", () => {
    const scopes = [
      scope,
      { ...scope, chain: "appchain" },
      { ...scope, worldAddress: "0xdef" },
      { ...scope, gameId: 55 },
    ];
    expect(
      new Set(scopes.map((current) => storyEventIdentity(current, { ...record, game_id: current.gameId }))).size,
    ).toBe(4);
  });

  it("rejects events from a different game", () => {
    expect(() => storyEventIdentity(scope, { ...record, game_id: "55" })).toThrow("does not match session");
  });

  it.each([undefined, null, "", "garbage", false, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 1n << 252n])(
    "rejects invalid identity fields: %s",
    (invalid) => {
      for (const field of ["game_id", "id", "tx_hash"]) {
        expect(() => storyEventIdentity(scope, { ...record, [field]: invalid })).toThrow(`StoryEvent ${field}`);
      }
    },
  );

  it("rejects missing deployment scope and a placeholder transaction", () => {
    expect(() => storyEventScopeKey({ ...scope, chain: "" })).toThrow("chain");
    expect(() => storyEventScopeKey({ ...scope, worldAddress: "0x0" })).toThrow("deployed world");
    expect(() => storyEventScopeKey({ ...scope, gameId: 0 })).toThrow("positive game");
    expect(() => storyEventIdentity(scope, { ...record, tx_hash: "0x0" })).toThrow("transaction hash");
  });
});
