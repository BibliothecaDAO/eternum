import { describe, expect, it } from "vitest";

import { createPresenceRegistry } from "./presence-registry";

describe("presence registry", () => {
  it("returns to baseline after the last socket disconnects and exposes no wallet", () => {
    const registry = createPresenceRegistry<object>();
    const socketA = {};
    const socketB = {};
    const session = { playerId: "0xa", membershipPlayerId: "0xgame", displayName: "Alice", aliases: ["0xa"] };

    registry.connect(session, socketA);
    registry.connect(session, socketB);
    expect(registry.snapshot()).toEqual([
      { playerId: "0xa", displayName: "Alice", isOnline: true, isTypingInThreadIds: [] },
    ]);
    expect(registry.disconnect("0xa", socketA)).toBe(false);
    expect(registry.disconnect("0xa", socketB)).toBe(true);
    expect(registry.size()).toBe(0);
    expect(JSON.stringify(registry.snapshot())).not.toContain("walletAddress");
  });
});
