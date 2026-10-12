/**
 * The HUD asks the world map to select one of the player's armies; the scene frames the camera and selects it. Asked
 * from a site's card, the request names the site's tile, and the card stays open with that army as its actor.
 */
export const ARMY_SELECT_REQUEST_EVENT = "armySelectRequest";

type Tile = { col: number; row: number };
type ArmySelectRequest = { entityId: number; forSite: Tile | null };

export const requestArmySelection = (entityId: number, forSite: Tile | null = null): void => {
  window.dispatchEvent(new CustomEvent(ARMY_SELECT_REQUEST_EVENT, { detail: { entityId, forSite } }));
};

export const readArmySelectRequest = (event: Event): ArmySelectRequest | null => {
  const detail = (event as CustomEvent<{ entityId?: unknown; forSite?: Partial<Tile> | null }>).detail;
  if (typeof detail?.entityId !== "number") return null;
  const site = detail.forSite;
  return {
    entityId: detail.entityId,
    forSite: typeof site?.col === "number" && typeof site?.row === "number" ? { col: site.col, row: site.row } : null,
  };
};
