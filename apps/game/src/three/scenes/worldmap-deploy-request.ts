import type { Direction } from "@bibliothecadao/types";

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
