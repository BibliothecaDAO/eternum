import { describe, expect, it } from "vitest";
import { storyEventIdentity, storyEventScopeKey } from "./story-event-identity";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 54 };
const record = { game_id: "0x36", order: "0x7", index: "0x0", tx_hash: "0xfeed" };

describe("StoryEvent identity", () => {
  it("matches history and stream numeric encodings without receipt indices or hashed keys", () => {
    expect(storyEventIdentity(scope, record)).toBe(
      storyEventIdentity(
        { ...scope, worldAddress: "0x00ABC" },
        { game_id: "54", order: 7n, index: 0, tx_hash: "0x00FEED" },
      ),
    );
    expect(storyEventIdentity(scope, record)).toBe("story:v2:0x1:0xabc:0x36:0x7:0x0");
  });

  it("separates stories within an action and across actions", () => {
    const keys = [record, { ...record, index: "0x1" }, { ...record, order: "0x8" }].map((value) =>
      storyEventIdentity(scope, value),
    );
    expect(new Set(keys).size).toBe(3);
  });

  it("keeps identity when the receipt position or transaction hash changes", () => {
    const pending = { ...record, event_position: { transaction_hash: "0xfeed", event_index: 2 } };
    const confirmed = { ...record, tx_hash: "0xbeef", event_position: { transaction_hash: "0xbeef", event_index: 9 } };
    expect(storyEventIdentity(scope, pending)).toBe(storyEventIdentity(scope, confirmed));
  });

  it.each([
    ["game_id", 1n << 32n],
    ["order", 1n << 64n],
    ["index", 1n << 32n],
  ])("rejects out-of-range %s", (field, invalid) => {
    expect(() => storyEventIdentity(scope, { ...record, [field]: invalid })).toThrow(`StoryEvent ${field}`);
  });

  it("separates chains, deployed worlds and games", () => {
    const scopes = [scope, { ...scope, chainId: "0x2" }, { ...scope, worldAddress: "0xdef" }, { ...scope, gameId: 55 }];
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
      for (const field of ["game_id", "order", "index"]) {
        expect(() => storyEventIdentity(scope, { ...record, [field]: invalid })).toThrow(`StoryEvent ${field}`);
      }
    },
  );

  it("rejects missing deployment scope", () => {
    expect(() => storyEventScopeKey({ ...scope, chainId: "" })).toThrow("chain id");
    expect(() => storyEventScopeKey({ ...scope, worldAddress: "0x0" })).toThrow("deployed world");
    expect(() => storyEventScopeKey({ ...scope, gameId: 0 })).toThrow("positive game");
  });
});
