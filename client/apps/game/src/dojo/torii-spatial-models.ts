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
  { model: "s1_eternum-Building", colField: "outer_col", rowField: "outer_row" },
  { model: "s1_eternum-ExplorerTroops", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-ExplorerRewardEvent", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-BattleEvent", colField: "coord.x", rowField: "coord.y" },
] as const satisfies readonly ToriiSpatialMapModelConfig[];

const GLOBAL_SPATIAL_OWNER_MODEL_NAME = "s1_eternum-Structure";

// Structure carries ownership, so the live all-entity stream owns that model.
// A late bootstrap snapshot must not replay stale owners after a capture.
const GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODELS = GLOBAL_SPATIAL_MAP_MODELS.filter(
  ({ model }) => model !== GLOBAL_SPATIAL_OWNER_MODEL_NAME,
);

export const GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODEL_NAMES = GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODELS.map(({ model }) => model);

export const GLOBAL_SPATIAL_MAP_BOOTSTRAP_SNAPSHOT_MODELS: GlobalModelStreamConfig[] =
  GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODEL_NAMES.map((model) => ({ model }));
