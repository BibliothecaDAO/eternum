import { getGameSyncModelsForChannel } from "@bibliothecadao/eternum/game-sync";
import { gameModel } from "./game-scope";
import type { GlobalModelStreamConfig } from "./torii-model-clause";
import type { BoundsModelConfig } from "./torii-stream-manager";

interface ToriiSpatialMapModelConfig {
  name: string;
  colField?: string;
  rowField?: string;
}

// Bare model names: the namespace (s1_eternum / s2) is resolved at call
// time from the active game scope, so every list here is a factory — module
// constants would bake in the default namespace before bootstrap sets it.
const getSpatialMapModelConfigs = (): readonly ToriiSpatialMapModelConfig[] =>
  getGameSyncModelsForChannel("bounded-spatial").map((model) => ({
    name: model.name,
    colField: model.spatial?.colField,
    rowField: model.spatial?.rowField,
  }));

export const getGlobalSpatialMapModels = (): BoundsModelConfig[] =>
  getSpatialMapModelConfigs().map(({ name, colField, rowField }) => ({
    model: gameModel(name),
    colField: colField ?? "col",
    rowField: rowField ?? "row",
  }));

export const getBoundedSpatialMapModels = (): BoundsModelConfig[] => getGlobalSpatialMapModels();

// Structure stays out of the late bootstrap snapshot because its owner field
// can overwrite a newer bounded/player update. S2 closes this legacy ownership
// hole by assigning Structure to the game-wide runtime stream.
export const getGlobalSpatialMapBootstrapModelNames = (): string[] =>
  getGameSyncModelsForChannel("spatial-bootstrap").map(({ name }) => gameModel(name));

export const getGlobalSpatialMapBootstrapSnapshotModels = (): GlobalModelStreamConfig[] =>
  getGlobalSpatialMapBootstrapModelNames().map((model) => ({ model }));
