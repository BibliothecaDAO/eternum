import {
  BiomeType,
  BUILDINGS_CENTER,
  BuildingType,
  getHexesWithinRadius,
  getProducedResource,
} from "@bibliothecadao/types";
import { getGameModeConfig } from "@/config/game-modes";
import { resolveBuildingModelSelection } from "@/three/scenes/hexception-building-model";
import { LAB_GAME, type LabFact, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** Every building kind on a snowy Empire board: low roofs expose placement below the raised terrain. */
export function realmHeightScenario() {
  const game = spireScenario(() => BiomeType.Snow);
  const realm = game.store.require("Structure", { game_id: 1, entity_id: 7 });
  const types = Object.values(BuildingType)
    .filter((type): type is BuildingType => typeof type === "number" && type !== BuildingType.None)
    .filter(hasRealmModel);
  const plots = getHexesWithinRadius(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 4).filter(
    ({ col, row }) => col !== BUILDINGS_CENTER[0] || row !== BUILDINGS_CENTER[1],
  );
  if (plots.length < types.length) throw new Error("The height-check board cannot fit every building kind");
  const facts: LabFact[] = [
    ...[...game.store.entries("Building")].map(([key]) => ({ model: "Building", key, value: null })),
    { model: "Structure", key: "0x7", value: wire({ ...realm, base: { ...realm.base, level: 3 } }) },
    ...[BuildingType.ResourceLabor, ...types].map((category, index) => {
      const plot = index === 0 ? { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] } : plots[index - 1];
      return {
        model: "Building",
        key: `0x1ef${index.toString(16)}`,
        value: {
          game_id: 1,
          structure_id: "7",
          inner_col: plot.col,
          inner_row: plot.row,
          category,
          paused: false,
          labor_paid: "0",
        },
      };
    }),
  ];
  game.store.applyFacts(facts as never);
  return game;
}

function hasRealmModel(category: BuildingType): boolean {
  const { group, type } = resolveBuildingModelSelection(
    { category, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], resource: getProducedResource(category) },
    { stage: 0, structureId: 7, wonder: false, frontier: true },
  );
  const paths: Readonly<Record<string, string>> = getGameModeConfig(LAB_GAME.presetId).assets.buildingModelPaths[group];
  return Boolean(paths[type]);
}
