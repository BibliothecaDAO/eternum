import type { GlobalModelStreamConfig } from "./torii-stream-manager";

interface ToriiSpatialMapModelConfig {
  model: string;
  colField?: string;
  rowField?: string;
}

export const GLOBAL_SPATIAL_MAP_MODELS = [
  { model: "s1_eternum-TileOpt", colField: "col", rowField: "row" },
  { model: "s1_eternum-Structure", colField: "base.coord_x", rowField: "base.coord_y" },
  { model: "s1_eternum-StructureBuildings", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-ExplorerTroops", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-ExplorerRewardEvent", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-BattleEvent", colField: "coord.x", rowField: "coord.y" },
] as const satisfies readonly ToriiSpatialMapModelConfig[];

export const GLOBAL_SPATIAL_MAP_MODEL_NAMES = GLOBAL_SPATIAL_MAP_MODELS.map(({ model }) => model);

export const GLOBAL_SPATIAL_MAP_STREAM_MODELS: GlobalModelStreamConfig[] = GLOBAL_SPATIAL_MAP_MODEL_NAMES.map(
  (model) => ({ model }),
);
