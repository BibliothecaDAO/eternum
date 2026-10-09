import { describe, expect, it } from "vitest";
import { storyEventIdentity, storyEventScopeKey } from "./story-event-identity";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 54 };
const record = { game_id: "0x36", event_position: { transaction_hash: "0xfeed", event_index: 2 } };

describe("StoryEvent identity", () => {
  it("is the game, the transaction hash and the event's index in the receipt, in any numeric encoding", () => {
    expect(storyEventIdentity(scope, record)).toBe(
      storyEventIdentity(
        { ...scope, worldAddress: "0x00ABC" },
        { game_id: "54", event_position: { transaction_hash: "0x00FEED", event_index: 2 } },
      ),
    );
    expect(storyEventIdentity(scope, record)).toBe("story:v2:0x1:0xabc:0x36:0xfeed:0x2");
  });

  it("separates events of one transaction and of different transactions", () => {
    const keys = [
      record,
      { ...record, event_position: { transaction_hash: "0xfeed", event_index: 3 } },
      { ...record, event_position: { transaction_hash: "0xbeef", event_index: 2 } },
    ].map((value) => storyEventIdentity(scope, value));
    expect(new Set(keys).size).toBe(3);
  });

  it("keeps identity when the transaction confirms at another block or transaction index", () => {
    const pending = {
      ...record,
      event_position: { ...record.event_position, block_number: null, transaction_index: 0 },
    };
    const confirmed = {
      ...record,
      event_position: { ...record.event_position, block_number: 12, transaction_index: 4 },
    };
    expect(storyEventIdentity(scope, pending)).toBe(storyEventIdentity(scope, confirmed));
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
    "rejects an invalid game, transaction hash or event index: %s",
    (invalid) => {
      expect(() => storyEventIdentity(scope, { ...record, game_id: invalid })).toThrow("StoryEvent game_id");
      expect(() =>
        storyEventIdentity(scope, {
          ...record,
          event_position: { ...record.event_position, transaction_hash: invalid },
        }),
      ).toThrow("StoryEvent transaction_hash");
      expect(() =>
        storyEventIdentity(scope, { ...record, event_position: { ...record.event_position, event_index: invalid } }),
      ).toThrow("StoryEvent event_index");
    },
  );

  it("refuses an event with no position", () => {
    expect(() => storyEventIdentity(scope, { game_id: "0x36" })).toThrow("no event position");
  });

  it("rejects missing deployment scope", () => {
    expect(() => storyEventScopeKey({ ...scope, chainId: "" })).toThrow("chain id");
    expect(() => storyEventScopeKey({ ...scope, worldAddress: "0x0" })).toThrow("deployed world");
    expect(() => storyEventScopeKey({ ...scope, gameId: 0 })).toThrow("positive game");
  });
});
