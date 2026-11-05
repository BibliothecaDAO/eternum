// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { refreshShardRelease } from "@bibliothecadao/eternum/game-client";
import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";

it("serves the scenario's pinned release through the real shard decoder validation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  const scenario = await installLabChain(ruinFightScenario, Date.now());
  const pin = scenario.store.require("GameRelease", { game_id: LAB_GAME.gameId });
  const shard = await refreshShardRelease(LAB_GAME.url, String(pin.release_id), nativeFactSchemaIdentity);
  expect(shard.releaseSchemas[String(pin.release_id)]).toBe(nativeFactSchemaIdentity);
  expect(shard.releaseSchemas[String(pin.created_release_id)]).toBe(nativeFactSchemaIdentity);
  const directory = await (await window.fetch("/api/directory")).json();
  expect(directory.shards[0].manifest.releaseSchemas).toEqual(shard.releaseSchemas);
});
