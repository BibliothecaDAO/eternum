import { BuildingType, getBuildingFromResource, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import { buildConfig } from "./build-config";

function findStartingResourceAmount(
  resources: Array<{ resource: ResourcesIds; amount: number }>,
  resourceId: ResourcesIds,
): number | undefined {
  return resources.find((resource) => resource.resource === resourceId)?.amount;
}

function findRecipeAmount(
  resources: Array<{ resource: ResourcesIds; amount: number }>,
  resourceId: ResourcesIds,
): number | undefined {
  return resources.find((resource) => resource.resource === resourceId)?.amount;
}

const REALM_RESOURCE_IDS_WITH_ERECTION_COSTS: ResourcesIds[] = [
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Wood,
  ResourcesIds.Copper,
  ResourcesIds.Ironwood,
  ResourcesIds.Obsidian,
  ResourcesIds.Gold,
  ResourcesIds.Silver,
  ResourcesIds.Mithral,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.ColdIron,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ruby,
  ResourcesIds.Diamonds,
  ResourcesIds.Hartwood,
  ResourcesIds.Ignium,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.TrueIce,
  ResourcesIds.Adamantine,
  ResourcesIds.Sapphire,
  ResourcesIds.EtherealSilica,
  ResourcesIds.Dragonhide,
];

describe("buildConfig", () => {
  test("changes the duration without changing Blitz balance", async () => {
    const baseConfig = await buildConfig({ chain: "madara", gameType: "blitz" });
    const sixtyMinuteConfig = await buildConfig({ chain: "madara", gameType: "blitz", durationMinutes: 60 });
    const customDurationConfig = await buildConfig({ chain: "madara", gameType: "blitz", durationMinutes: 45 });

    expect(sixtyMinuteConfig.season.durationSeconds).toBe(3_600);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Donkey]).toBe(3);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Labor]).toBe(2);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Essence]).toBe(20);
    expect(sixtyMinuteConfig.troop.stamina.staminaInitial).toBe(30);
    expect(sixtyMinuteConfig.troop.stamina.staminaGainPerTick).toBe(30);
    expect(sixtyMinuteConfig.victoryPoints.pointsForTileExploration).toBe(5_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits).toBe(250_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForRelicDiscovery).toBe(250_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForHyperstructureClaimAgainstBandits).toBe(1_000_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.hyperstructurePointsPerCycle).toBe(1_000_000n);
    expect(sixtyMinuteConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(sixtyMinuteConfig.blitz.exploration.rewards).toHaveLength(6);

    expect(customDurationConfig.season.durationSeconds).toBe(2700);
    expect(customDurationConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
    expect(customDurationConfig.troop.stamina.staminaInitial).toBe(baseConfig.troop.stamina.staminaInitial);
    expect(customDurationConfig.victoryPoints.pointsForTileExploration).toBe(
      baseConfig.victoryPoints.pointsForTileExploration,
    );
  });
});
