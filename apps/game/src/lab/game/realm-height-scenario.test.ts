import { BuildingType } from "@bibliothecadao/types";
import { getGameModeConfig } from "@/config/game-modes";
import { LAB_GAME } from "./lab-chain";
import { BUILDINGS_GROUPS } from "@/three/constants/scene-constants";
import { expect, it } from "vitest";
import { realmHeightScenario } from "./realm-height-scenario";

it("places every catalogued building kind on its own plot, plus the central keep", () => {
  const { store } = realmHeightScenario();
  const expected = Object.values(BuildingType).filter(
    (type): type is BuildingType => typeof type === "number" && type !== BuildingType.None,
  );
  const buildings = [...store.rows("Building")];
  const mode = getGameModeConfig(LAB_GAME.presetId);
  for (const category of expected.filter((category) => mode.rules.isBuildingTypeAllowed(BuildingType[category]))) {
    expect(
      buildings.some((building) => building.category === category),
      BuildingType[category],
    ).toBe(true);
  }
  for (const category of Object.keys(mode.assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS]).map(Number)) {
    if (category !== BuildingType.None) {
      expect(
        buildings.some((building) => building.category === category),
        BuildingType[category],
      ).toBe(true);
    }
  }
  expect(buildings.length).toBeGreaterThan(1);
  expect(new Set(buildings.map((building) => building.category)).size).toBe(buildings.length - 1);
  expect(new Set(buildings.map((building) => `${building.inner_col},${building.inner_row}`)).size).toBe(
    buildings.length,
  );
  expect(store.require("Structure", { game_id: 1, entity_id: 7 }).base.level).toBe(3);
});
