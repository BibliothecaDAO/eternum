import { expect, it, vi } from "vitest";

const recovered = vi.hoisted(() => ({ epoch: 0n }));

// A recovered base scenario already has today's discovery under its original native key.
vi.mock("./ruin-fight-scenario", async (original) => {
  const actual = await original<typeof import("./ruin-fight-scenario")>();
  return {
    ...actual,
    ruinFightScenario: () => {
      const scenario = actual.ruinFightScenario();
      const discovery = [...scenario.store.inGame("ExpeditionDiscovery", 1)][0]!;
      recovered.epoch = discovery.epoch;
      scenario.store.applyFacts([
        {
          model: "ExpeditionDiscovery",
          key: "0x1ab9f",
          value: { ...discovery, empty_reveals: 2, ruin_cleared: false },
        },
      ] as never);
      return scenario;
    },
  };
});

import { ruinChestsScenario, ruinChestsSurfaceScenario } from "./ruin-chests-scenario";

it.each([
  [ruinChestsScenario, 2, true],
  [ruinChestsSurfaceScenario, 0, false],
] as const)("updates an existing discovery under its canonical key (%#)", (makeScenario, depth, claimed) => {
  const { store } = makeScenario();
  const discoveries = [...store.entries("ExpeditionDiscovery")];
  expect(discoveries).toHaveLength(1);
  expect(discoveries[0]?.[1]).toEqual({
    game_id: 1,
    structure_id: 7n,
    epoch: recovered.epoch,
    empty_reveals: 2,
    ruin_cleared: claimed,
  });
  expect(store.wireKeyOf("ExpeditionDiscovery", discoveries[0]![1])).toBe("0x1ab9f");
  expect(store.require("Structure", { game_id: 1, entity_id: 7 }).metadata.deepest_depth).toBe(depth);
});
