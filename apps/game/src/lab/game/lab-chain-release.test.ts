// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { refreshShardRelease } from "@bibliothecadao/eternum/game-client";
import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { NATIVE_RELEASES } from "../../../../../deploy/release/native-release";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";
import { ruinFightScenario } from "./ruin-fight-scenario";

it("serves the scenario's pinned release through the real shard decoder validation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  const scenario = await installLabChain(ruinFightScenario, Date.now());
  const pin = scenario.store.require("GameRelease", { game_id: LAB_GAME.gameId });
  expect(pin.created_release_id).toBe(pin.release_id);
  const shard = await refreshShardRelease(LAB_GAME.url, String(pin.release_id), nativeFactSchemaIdentity);
  expect(shard.releases[String(pin.release_id)]?.schema).toBe(nativeFactSchemaIdentity);
  expect(shard.releases[String(pin.created_release_id)]?.schema).toBe(nativeFactSchemaIdentity);
  const directory = await (await window.fetch("/api/directory")).json();
  expect(directory.shard.manifest.releases).toEqual(shard.releases);
});

it("pins every lab scenario's game to a release this client reads", () => {
  const { since, release } = NATIVE_RELEASES.frontier;
  const unreadable = Object.entries(LAB_SCENARIOS).flatMap(([name, scenario]) => {
    const pin = scenario!().store.require("GameRelease", { game_id: LAB_GAME.gameId });
    return pin.release_id >= since && pin.release_id <= release ? [] : [`${name} ${pin.release_id}`];
  });
  expect(unreadable).toEqual([]);
});
