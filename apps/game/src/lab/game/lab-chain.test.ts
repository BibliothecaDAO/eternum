// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

import { identityClient } from "@/hooks/context/identity-session";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";
import { LAB_CHAIN_ID } from "./lab-shard";

it("lets no route open the game before the tab answers the lab's directory, however many ask for the install", async () => {
  // The network's directory, as the live one answers: no lab shard on it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ shard: { chainId: "0x1" } }), { status: 200 })),
  );
  // A reloaded lab route installs the chain, and React runs its effect twice in dev: the second ask must wait too.
  const first = installLabChain(LAB_SCENARIOS.visit!, Date.now());
  const second = await installLabChain(LAB_SCENARIOS.visit!, Date.now());
  const directory = (await (await window.fetch("/api/directory")).json()) as { shard: { chainId: string } };
  expect(directory.shard.chainId).toBe(LAB_CHAIN_ID);
  expect(await first).toBe(second);
  const board = await (await window.fetch(`${LAB_GAME.url}/games/${LAB_GAME.gameId}/leaderboard`)).json();
  expect(board).toEqual({ game_id: String(LAB_GAME.gameId), mode: "frontier", entries: second.board });
  expect(board.entries.map((entry: { structure_id: string }) => entry.structure_id)).toHaveLength(2);
  expect(await identityClient.createInvite()).toEqual({
    code: `lab-aspect-${LAB_GAME.gameId}`,
    aspect: 1,
    chainId: LAB_GAME.chainId,
    gameId: LAB_GAME.gameId,
  });
});

it("serializes /games and /api/directory cleanly when RaceRules and QuestRules are present", async () => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ shard: { chainId: "0x1" } }), { status: 200 })),
  );
  const { installLabChain: installFresh, LAB_GAME: freshGame } = await import("./lab-chain");
  const { LAB_SCENARIOS: freshScenarios } = await import("./lab-games");
  await installFresh(freshScenarios.race!, Date.now());
  const listed = (await (await window.fetch(`${freshGame.url}/games`)).json()) as {
    games: {
      aspect_race: {
        finish_height: number;
        season_days: number;
        triumph_percents: Record<1 | 2 | 3 | 4, number>;
      } | null;
      quest_bonus_percent: number | null;
    }[];
  };
  expect(listed.games[0]?.aspect_race?.season_days).toEqual(expect.any(Number));
  expect(listed.games[0]?.aspect_race?.finish_height).toEqual(expect.any(Number));
  expect(listed.games[0]?.aspect_race?.triumph_percents).toEqual({
    1: expect.any(Number),
    2: expect.any(Number),
    3: expect.any(Number),
    4: expect.any(Number),
  });
  expect(listed.games[0]?.quest_bonus_percent).toEqual(expect.any(Number));
  const directory = (await (await window.fetch("/api/directory")).json()) as {
    shard: { games: { aspect_race: { season_days: number } | null }[] };
  };
  expect(directory.shard.games[0]?.aspect_race?.season_days).toBe(listed.games[0]?.aspect_race?.season_days);
});
