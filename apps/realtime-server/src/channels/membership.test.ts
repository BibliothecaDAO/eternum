import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import { createHeraldMembershipResolver, HERALD_GAME_MEMBERSHIP_MODELS } from "./membership";

describe("Herald game membership", () => {
  it("derives only joined Blitz game channels and caches the directory", async () => {
    const fetchDirectory = vi.fn().mockResolvedValue(
      Response.json({
        games: [
          { game_id: 7, mode: "blitz", status: "Live", player_state: { registered: true, settled: false } },
          { game_id: 8, mode: "blitz", status: "Live", player_state: null },
          { game_id: 9, mode: "eternum", status: "Live", player_state: { registered: true, settled: true } },
          { game_id: 10, mode: "blitz", status: "Ended", player_state: { registered: true, settled: true } },
        ],
      }),
    );
    const membership = createHeraldMembershipResolver({ heraldUrl: "http://herald:3003", fetch: fetchDirectory });

    await expect(Effect.runPromise(membership.isMember("0xa", "game:7"))).resolves.toBe(true);
    await expect(Effect.runPromise(membership.isMember("0xa", "game:8"))).resolves.toBe(false);
    await expect(Effect.runPromise(membership.isMember("0xa", "game:10"))).resolves.toBe(false);
    expect(fetchDirectory).toHaveBeenCalledOnce();
    expect(String(fetchDirectory.mock.calls[0]?.[0])).toBe("http://herald:3003/madara/games?player=0xa");
    expect(HERALD_GAME_MEMBERSHIP_MODELS).toEqual(["GameRegistry", "WorldConfig", "BlitzSettlement", "Structure"]);
  });
});
