import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/env", () => ({
  env: { VITE_PUBLIC_HERALD_URL: "https://herald.test", VITE_PUBLIC_HERALD_CHAIN: "madara" },
}));
import { HeraldClient, type DirectoryGame } from "@/services/herald";
import { matchHistory } from "./match-history";

const game: DirectoryGame = {
  game_id: 1,
  name: "evening-1",
  mode: "blitz",
  status: "Settled",
  preset_id: 1,
  dev_mode_on: false,
  player_count: 3,
  registration: null,
  clock: { start_settling_at: 1, start_main_at: 2, end_at: 100 },
};
const snapshot = (complete = true) => ({
  models: [
    {
      model: "GameRegistry",
      rows: [
        {
          key: "0x1",
          value: {
            game_id: 1,
            name: "1",
            preset_id: 1,
            creator: "1",
            settled: true,
            ready: true,
            dev_mode_on: false,
            start_settling_at: "1",
            start_main_at: "2",
            end_at: "100",
            end_grace_seconds: 3,
            seed: "0",
          },
        },
      ],
    },
    {
      model: "BlitzRoster",
      rows: [
        {
          key: "0x1",
          value: {
            game_id: 1,
            players: [
              { owner: "0x10", account: "0x100" },
              { owner: "0x20", account: "0x200" },
              { owner: "0x30", account: "0x300" },
            ],
          },
        },
      ],
    },
    {
      model: "BlitzResult",
      rows: [
        {
          key: "0x1",
          value: {
            game_id: 1,
            complete,
            commitment: complete ? "123" : "0",
            players: [
              { player: "0x100", points: "10500000", rank: 1 },
              { player: "0x200", points: "0", rank: 2 },
              { player: "0x300", points: "0", rank: 2 },
            ],
          },
        },
      ],
    },
  ],
});
const run = (owner: string) => Effect.runPromise(matchHistory(owner, [game]).pipe(Effect.provide(HeraldClient.layer)));

describe("native match history", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("resolves the frozen owner binding and preserves tied-last ranks and zero points", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => Response.json(snapshot())),
    );
    expect(await run("0x20")).toEqual([
      { gameId: 1, gameName: "evening-1", endAt: 100, rank: 2, players: 3, points: 0n },
    ]);
    expect((await run("0x10"))[0]?.points).toBe(10_500_000n);
    expect(await run("0x99")).toEqual([]);
  });
  it("does not publish a partial result as final history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(snapshot(false))));
    expect(await run("0x20")).toEqual([]);
  });
  it("rejects malformed native facts rather than supplying zero points", async () => {
    const invalid = snapshot();
    delete (invalid.models[2]!.rows[0]!.value as Record<string, unknown>).players;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(invalid)));
    await expect(run("0x20")).rejects.toThrow();
  });
});
