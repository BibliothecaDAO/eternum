import { expect, it, vi } from "vitest";

vi.mock("@/runtime/world/shards", () => ({
  listPastedShards: () => [],
  openPastedShards: async () => [],
  requireOpenShard: async () => {
    throw new Error("not needed");
  },
}));

import { fetchDirectories } from "./herald";

const requests: string[] = [];
vi.stubGlobal("fetch", async (input: string) => {
  requests.push(input);
  return Response.json({
    shards: [
      {
        url: "https://shard-a.test",
        chainId: "0xa",
        status: "active",
        games: [{ game_id: 1, mode: "blitz", status: "Live", player_state: { roster_member: true } }],
      },
    ],
  });
});

it("asks our directory for the signed-in player's state on every shard, and for nothing when signed out", async () => {
  const signedIn = await fetchDirectories("0xabc");
  expect(requests).toEqual(["/api/directory?player=0xabc"]);
  expect(signedIn.games.map((game) => [game.chainId, game.game_id, game.player_state?.roster_member])).toEqual([
    ["0xa", 1, true],
  ]);
  expect(signedIn.shards).toEqual([{ url: "https://shard-a.test", chainId: "0xa", status: "active", available: true }]);

  requests.splice(0);
  await fetchDirectories(null);
  expect(requests).toEqual(["/api/directory"]);
});
