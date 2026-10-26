// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

import { installLabChain } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";
import { LAB_CHAIN_ID } from "./lab-shard";

it("lets no route open the game before the tab answers the lab's directory, however many ask for the install", async () => {
  // The network's directory, as the live one answers: no lab shard on it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ shards: [{ chainId: "0x1" }] }), { status: 200 })),
  );
  // A reloaded lab route installs the chain, and React runs its effect twice in dev: the second ask must wait too.
  const first = installLabChain(LAB_SCENARIOS.spire!, Date.now());
  const second = await installLabChain(LAB_SCENARIOS.spire!, Date.now());
  const directory = (await (await window.fetch("/api/directory")).json()) as { shards: { chainId: string }[] };
  expect(directory.shards.map(({ chainId }) => chainId)).toEqual([LAB_CHAIN_ID]);
  expect(await first).toBe(second);
});
