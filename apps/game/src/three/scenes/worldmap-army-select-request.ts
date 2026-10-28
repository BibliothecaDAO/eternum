import type { Position } from "@bibliothecadao/eternum";

/**
 * The HUD asks the world map to select one of the player's armies. Asked from a site's card, the request names the
 * site's place as a Position, so the scene converts it once, whatever space its caller read it in. The card stays open
 * with that army as its actor. The map takes the request at once when it is the shown scene; asked from another view,
 * the request waits until the map is.
 */
export const ARMY_SELECT_REQUEST_EVENT = "armySelectRequest";

/**
 * `look`: the player asked to see the army (a dock's token, Next up, idle armies, a story), so the camera frames what is
 * out of sight. Without it the player picked the actor of the card they have open, and the camera stays.
 */
export type ArmySelectRequest = { entityId: number; forSite: Position | null; look: boolean };

let awaitingMap: ArmySelectRequest | null = null;

const ask = (request: ArmySelectRequest): void => {
  awaitingMap = request;
  window.dispatchEvent(new Event(ARMY_SELECT_REQUEST_EVENT));
};

/** Shows the army, with the site it is sent to when there is one: selected, and framed when out of sight. */
export const requestArmyShown = (entityId: number, forSite: Position | null = null): void =>
  ask({ entityId, forSite, look: true });

/** Picks the army as the actor of the site card the player has open: selected where the camera already is. */
export const requestArmyForSite = (entityId: number, site: Position): void =>
  ask({ entityId, forSite: site, look: false });

/** The latest request the map has not taken yet, taken: the map calls it when it takes a request or is shown. */
export const takeArmySelectRequest = (): ArmySelectRequest | null => {
  const request = awaitingMap;
  awaitingMap = null;
  return request;
};
