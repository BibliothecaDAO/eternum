/**
 * The HUD asks the world map to select one of the player's armies; the scene frames the camera and selects it. Asked
 * from a site's card, the request names the site's tile, and the card stays open with that army as its actor. The map
 * takes the request at once when it is the shown scene; asked from another view, the request waits until the map is.
 */
export const ARMY_SELECT_REQUEST_EVENT = "armySelectRequest";

type Tile = { col: number; row: number };
type ArmySelectRequest = { entityId: number; forSite: Tile | null };

let awaitingMap: ArmySelectRequest | null = null;

export const requestArmySelection = (entityId: number, forSite: Tile | null = null): void => {
  awaitingMap = { entityId, forSite: forSite && { col: forSite.col, row: forSite.row } };
  window.dispatchEvent(new Event(ARMY_SELECT_REQUEST_EVENT));
};

/** The latest request the map has not taken yet, taken: the map calls it when it takes a request or is shown. */
export const takeArmySelectRequest = (): ArmySelectRequest | null => {
  const request = awaitingMap;
  awaitingMap = null;
  return request;
};
