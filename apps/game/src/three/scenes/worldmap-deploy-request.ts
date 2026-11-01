import { ActionPaths, ActionType } from "@bibliothecadao/eternum";
import type { Direction, HexPosition } from "@bibliothecadao/types";

/**
 * Frontier's deploy sheet shows its order on the world map, which is where its tile is picked (owner, 26 October 2026:
 * "for the deploy we actually need to pick the tile on the map"): the realm selected with its open tiles lit and in
 * sight above the sheet, the order's tile ringed among them. The sheet says so while it is open and again whenever the
 * tile changes; null once it closes. The order is kept until then, so a map shown after the sheet opened (the sheet
 * opened on the Realm board brings the map up) takes it as it is shown.
 */
export const DEPLOY_ON_MAP_EVENT = "deployOnMapRequest";

export type DeployOnMap = { structureId: number; direction: Direction | null } | null;

let shown: DeployOnMap = null;

export const showDeployOnMap = (order: DeployOnMap): void => {
  shown = order;
  window.dispatchEvent(new CustomEvent(DEPLOY_ON_MAP_EVENT, { detail: order }));
};

/** The deploy order the sheet shows now, for a map shown after it was asked; null while no deploy sheet is open. */
export const deployShownOnMap = (): DeployOnMap => shown;

export const readDeployOnMap = (event: Event): DeployOnMap => {
  const detail = (event as CustomEvent<DeployOnMap>).detail;
  return detail && typeof detail.structureId === "number" ? detail : null;
};

/**
 * The orders a realm lights while its deploy order is shown: one on each tile the sheet can send the army to (the
 * ring's open tiles, the sheet's own read of it), and nothing else, so every lit tile means "deploy here" and the
 * order's ring alone says which (owner, 31 October 2026: "a blue tile that doesnt mean anything since the selected tile
 * as the ring on it"). `home` and the ring are contract hexes.
 */
export const deployOrderPaths = (
  home: HexPosition,
  ring: readonly { col: number; row: number; open: boolean }[],
): ActionPaths => {
  const paths = new ActionPaths();
  for (const tile of ring) {
    if (!tile.open) continue;
    paths.set(ActionPaths.posKey(tile), [
      { hex: home, actionType: ActionType.Move },
      { hex: { col: tile.col, row: tile.row }, actionType: ActionType.CreateArmy },
    ]);
  }
  return paths;
};
