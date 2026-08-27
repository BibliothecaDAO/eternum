import { describe, expect, it } from "vitest";

import { buildHeraldGameStreamUrl } from "./herald-game-sync-session";

describe("buildHeraldGameStreamUrl", () => {
  it("builds the per-chain, per-game WebSocket endpoint", () => {
    expect(buildHeraldGameStreamUrl("https://herald.realms.test/stream/", "madara", 54)).toBe(
      "wss://herald.realms.test/stream/madara/games/54",
    );
    expect(buildHeraldGameStreamUrl("ws://127.0.0.1:3003", "appchain", 7)).toBe("ws://127.0.0.1:3003/appchain/games/7");
  });

  it("rejects a missing game scope", () => {
    expect(() => buildHeraldGameStreamUrl("https://herald.realms.test", "madara", 0)).toThrow("positive game id");
  });
});
