import type { ActionHighlightDescriptor } from "@bibliothecadao/eternum";
import type { Direction } from "@bibliothecadao/types";

/**
 * Frontier's deploy sheet shows its order on the world map, which is where its tile is picked (owner, 26 October 2026:
 * "for the deploy we actually need to pick the tile on the map"): the realm selected with its open tiles lit and in
 * sight above the sheet, the order's tile marked among them. The sheet says so while it is open and again whenever the
 * tile changes; null once it closes. The map answers only while it is the shown scene.
 */
export const DEPLOY_ON_MAP_EVENT = "deployOnMapRequest";

export type DeployOnMap = { structureId: number; direction: Direction | null } | null;

export const showDeployOnMap = (order: DeployOnMap): void => {
  window.dispatchEvent(new CustomEvent(DEPLOY_ON_MAP_EVENT, { detail: order }));
};

export const readDeployOnMap = (event: Event): DeployOnMap => {
  const detail = (event as CustomEvent<DeployOnMap>).detail;
  return detail && typeof detail.structureId === "number" ? detail : null;
};

/**
 * The realm's lit tiles with the order's tile marked: it keeps its bright centre, and the other open tiles show only
 * their outline, still lit to be tapped. With no tile named, every open tile stays as it is.
 */
export const markDeployTile = (
  descriptors: readonly ActionHighlightDescriptor[],
  tile: { col: number; row: number } | null,
): ActionHighlightDescriptor[] =>
  descriptors.map((descriptor) =>
    tile !== null &&
    descriptor.kind === "create-army" &&
    (descriptor.hex.col !== tile.col || descriptor.hex.row !== tile.row)
      ? { ...descriptor, isEndpoint: false }
      : descriptor,
  );
