import { configManager } from "@bibliothecadao/eternum";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));

import { ruinFightScenario } from "@/lab/game/ruin-fight-scenario";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { readArmyPlates, readStructurePlates } from "./plate-facts";

afterEach(() => vi.restoreAllMocks());

/** The lab's game of an owner's army beside a ruin, as the map reads it. */
function ruinFight() {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const { store } = ruinFightScenario();
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  return { store, projection };
}

describe("the plates the map reads from the game's facts", () => {
  it("say an army's owner, home, troops and stamina", () => {
    const { store, projection } = ruinFight();
    expect(readArmyPlates(projection, store).map(({ entityId, plate }) => ({ entityId, plate }))).toEqual([
      {
        entityId: SPIRE_ARMY,
        plate: {
          kind: "army",
          relation: "own",
          owner: "…",
          homeName: "Temtinos",
          troops: { type: "knight", tier: 1, count: 4_015 },
          stamina: { current: 100, max: 120, perExplore: 30 },
        },
      },
    ]);
  });

  it("say a ruin's beast and guard without stamina, and a realm's own name", () => {
    const { store, projection } = ruinFight();
    const plates = new Map(readStructurePlates(projection, store).map(({ entityId, plate }) => [entityId, plate]));
    expect([...plates.keys()].toSorted((a, b) => a - b)).toEqual([7, SITE]);
    expect(plates.get(SITE)).toEqual({
      kind: "structure",
      relation: "neutral",
      owner: "The Vanguard",
      beast: "Ammit",
      name: "Ruin",
      named: false,
      place: "Stormfall",
      reward: undefined,
      holding: undefined,
      icon: "beast-ammit",
      guards: [{ type: "knight", tier: 1, count: 999, beast: "ammit" }],
      arrivals: [],
    });
    expect(plates.get(7)).toMatchObject({ relation: "own", name: "Temtinos", named: true, guards: [] });
  });

  it("give no plate to an army whose troops are gone", () => {
    const { store, projection } = ruinFight();
    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
    vi.spyOn(store, "get").mockImplementation(((model: string) =>
      model === "ExplorerTroops" ? { ...army, troops: { ...army.troops, count: 0n } } : undefined) as never);
    expect(readArmyPlates(projection, store)).toEqual([]);
  });
});
