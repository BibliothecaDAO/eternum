// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { identityClient } from "@/hooks/context/identity-session";
import { LAB_SESSION } from "@/shell/lab/app-lab-fixtures";

import { installLabChain, LAB_GAME } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";
import { LAB_CHAIN_ID } from "./lab-shard";

it("lets no route open the game before the tab answers the lab's directory, however many ask for the install", async () => {
  // The network's directory, as the live one answers: no lab shard on it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ shards: [{ chainId: "0x1" }] }), { status: 200 })),
  );
  // A reloaded lab route installs the chain, and React runs its effect twice in dev: the second ask must wait too.
  const first = installLabChain(LAB_SCENARIOS["devcon-season"]!, Date.now());
  const second = await installLabChain(LAB_SCENARIOS["devcon-season"]!, Date.now());
  const directory = (await (await window.fetch("/api/directory")).json()) as { shards: { chainId: string }[] };
  expect(directory.shards.map(({ chainId }) => chainId)).toEqual([LAB_CHAIN_ID]);
  expect(await first).toBe(second);
  const board = await (await window.fetch(`${LAB_GAME.url}/games/${LAB_GAME.gameId}/leaderboard`)).json();
  expect(board).toEqual({ game_id: String(LAB_GAME.gameId), mode: "frontier", entries: second.board });
  expect(
    board.entries.map((entry: { structure_id: string; campaign: { tier: number } | null; has_wonder: boolean }) => [
      entry.structure_id,
      entry.campaign?.tier ?? null,
      entry.has_wonder,
    ]),
  ).toEqual([
    ["901", 1, false],
    ["902", 2, false],
    ["903", null, false],
    ["904", null, true],
  ]);
  const saved = await identityClient.getBuildOrders();
  expect(saved).toMatchObject({ owner: LAB_SESSION.user.realmsId, revision: 3, book: { active: "coal-rush" } });
  const book = { orders: [], active: null };
  expect(await identityClient.saveBuildOrders({ ...saved, book })).toEqual({ ...saved, book, revision: 4 });
  expect(await identityClient.getBuildOrders()).toEqual({ ...saved, book, revision: 4 });
});
