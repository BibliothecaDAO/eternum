import { gameModel } from "./game-scope";
import type { BoundsModelConfig, GlobalModelStreamConfig } from "./torii-stream-manager";

interface ToriiSpatialMapModelConfig {
  name: string;
  colField?: string;
  rowField?: string;
}

// Bare model names: the namespace (s1_eternum / s2) is resolved at call
// time from the active game scope, so every list here is a factory — module
// constants would bake in the default namespace before bootstrap sets it.
const SPATIAL_MAP_MODEL_CONFIGS = [
  { name: "TileOpt", colField: "col", rowField: "row" },
  { name: "Structure", colField: "base.coord_x", rowField: "base.coord_y" },
  { name: "StructureBuildings", colField: "coord.x", rowField: "coord.y" },
  { name: "Building", colField: "outer_col", rowField: "outer_row" },
  { name: "ExplorerTroops", colField: "coord.x", rowField: "coord.y" },
  { name: "ExplorerRewardEvent", colField: "coord.x", rowField: "coord.y" },
  { name: "BattleEvent", colField: "coord.x", rowField: "coord.y" },
] as const satisfies readonly ToriiSpatialMapModelConfig[];

export const getGlobalSpatialMapModels = (): BoundsModelConfig[] =>
  SPATIAL_MAP_MODEL_CONFIGS.map(({ name, colField, rowField }) => ({
    model: gameModel(name),
    colField: colField ?? "col",
    rowField: rowField ?? "row",
  }));

export const getBoundedSpatialMapModels = (): BoundsModelConfig[] => getGlobalSpatialMapModels();

const SPATIAL_OWNER_MODEL_NAME = "Structure";

// Structure carries ownership, so the live all-entity stream owns that model.
// A late bootstrap snapshot must not replay stale owners after a capture.
export const getGlobalSpatialMapBootstrapModelNames = (): string[] =>
  SPATIAL_MAP_MODEL_CONFIGS.filter(({ name }) => name !== SPATIAL_OWNER_MODEL_NAME).map(({ name }) => gameModel(name));

export const getGlobalSpatialMapBootstrapSnapshotModels = (): GlobalModelStreamConfig[] =>
  getGlobalSpatialMapBootstrapModelNames().map((model) => ({ model }));
