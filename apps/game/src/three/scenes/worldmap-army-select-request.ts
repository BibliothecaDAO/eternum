import type { Position } from "@bibliothecadao/eternum";

/**
 * The HUD asks the world map to show one of the player's armies: a pick in the Armies list, the dock, Next up, idle
 * armies or a story is the player's request to look at it, so the scene frames the camera on it, in sight or not, and
 * selects it (owner, 28 October 2026: "picking from here should center the camera indeed its a player request"). Asked
 * with a site (a coach step's target), the request names the site's place as a Position, so the scene converts it once,
 * whatever space its caller read it in, and the site's card opens with that army as its actor. The map takes the
 * request at once when it is the shown scene; asked from another view, the request waits until the map is.
 */
export const ARMY_SELECT_REQUEST_EVENT = "armySelectRequest";

export type ArmySelectRequest = { entityId: number; forSite: Position | null };

let awaitingMap: ArmySelectRequest | null = null;

export const requestArmySelection = (entityId: number, forSite: Position | null = null): void => {
  awaitingMap = { entityId, forSite };
  window.dispatchEvent(new Event(ARMY_SELECT_REQUEST_EVENT));
};

/** The latest request the map has not taken yet, taken: the map calls it when it takes a request or is shown. */
export const takeArmySelectRequest = (): ArmySelectRequest | null => {
  const request = awaitingMap;
  awaitingMap = null;
  return request;
};
