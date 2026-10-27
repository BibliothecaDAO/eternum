// @vitest-environment jsdom
import {
  BLITZ_BUILDINGS,
  BUILD_ORDER_GOAL_GROUPS,
  BUILD_ORDER_GOALS,
  buildOrderGoalName,
  buildOrderTarget,
} from "@bibliothecadao/eternum/automation";
import { BuildingType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { blitzBalance } from "../../../../../../config/source/blitz/balance";
import { blitzPreset } from "../../../../../../config/source/blitz/native";
import { buildOrderGoalIcon } from "./build-order-icons";

const { getGameModeConfig } = await import("@/config/game-modes");

/** Every building a Blitz realm can raise: one Blitz's config prices and its construction panel allows. */
const buildableInBlitz = (): BuildingType[] => {
  const mode = getGameModeConfig(blitzPreset.id);
  const costs = blitzBalance.buildings!.complexBuildingCosts! as Partial<Record<BuildingType, unknown[]>>;
  return Object.values(BuildingType).filter(
    (type): type is BuildingType =>
      typeof type === "number" &&
      (costs[type]?.length ?? 0) > 0 &&
      mode.rules.isBuildingTypeAllowed(BuildingType[type]),
  );
};

const buildingGoals = () =>
  BUILD_ORDER_GOALS.flatMap((goal) => {
    const target = buildOrderTarget(goal);
    return target.kind === "building" ? [target.building] : [];
  });

describe("the build order's goals", () => {
  it("name every building a Blitz realm can raise, each tier's resources and troops among them", () => {
    const buildable = buildableInBlitz();
    expect(buildable).toEqual(
      expect.arrayContaining([
        BuildingType.ResourceIronwood,
        BuildingType.ResourceDragonhide,
        BuildingType.ResourceKnightT2,
        BuildingType.ResourcePaladinT3,
      ]),
    );
    expect(buildingGoals().toSorted()).toEqual(buildable.toSorted());
    expect(BLITZ_BUILDINGS.toSorted()).toEqual(buildable.toSorted());
  });

  it("offer each goal once in the maker, named and painted", () => {
    const offered = BUILD_ORDER_GOAL_GROUPS.flatMap(({ goals }) => goals);
    expect(offered.toSorted()).toEqual([...BUILD_ORDER_GOALS].toSorted());
    expect(new Set(offered).size).toBe(offered.length);
    expect(BUILD_ORDER_GOAL_GROUPS.find(({ label }) => label === "Resources")?.goals.map(buildOrderGoalName)).toEqual([
      "Wood",
      "Coal",
      "Copper",
      "Ironwood",
      "Cold Iron",
      "Gold",
      "Adamantine",
      "Mithral",
      "Dragonhide",
    ]);
    expect(BUILD_ORDER_GOAL_GROUPS.find(({ label }) => label === "Troops")?.goals).toEqual([
      "knightT1",
      "crossbowmanT1",
      "paladinT1",
      "knightT2",
      "crossbowmanT2",
      "paladinT2",
      "knightT3",
      "crossbowmanT3",
      "paladinT3",
    ]);
    expect(offered.map(buildOrderGoalIcon)).toHaveLength(offered.length);
  });
});
