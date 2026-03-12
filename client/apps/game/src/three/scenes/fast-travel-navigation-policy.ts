import { SceneName } from "../types";
import type { FastTravelHexCoords } from "./fast-travel-hydration";
import {
  resolveFastTravelSpireByTravelHex,
  resolveFastTravelSpireByWorldHex,
  type FastTravelSpireMapping,
} from "./fast-travel-spire-mapping";

export interface FastTravelSceneTransition {
  scene: SceneName;
  col: number;
  row: number;
  spireId: string;
}

export function resolveEnterFastTravelTransition(input: {
  worldHexCoords: FastTravelHexCoords;
  spireMappings: readonly FastTravelSpireMapping[];
}): FastTravelSceneTransition | null {
  const spire = resolveFastTravelSpireByWorldHex(input);

  if (!spire) {
    return null;
  }

  return {
    scene: SceneName.FastTravel,
    col: spire.travelHexCoords.col,
    row: spire.travelHexCoords.row,
    spireId: spire.entityId,
  };
}

export function resolveExitFastTravelTransition(input: {
  travelHexCoords: FastTravelHexCoords;
  spireMappings: readonly FastTravelSpireMapping[];
}): FastTravelSceneTransition | null {
  const spire = resolveFastTravelSpireByTravelHex(input);

  if (!spire) {
    return null;
  }

  return {
    scene: SceneName.WorldMap,
    col: spire.worldHexCoords.col,
    row: spire.worldHexCoords.row,
    spireId: spire.entityId,
  };
}
