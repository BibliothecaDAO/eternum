import { Position } from "@bibliothecadao/eternum";
import type { HexPosition } from "@bibliothecadao/types";

/**
 * The one place a map position becomes the world map camera's target: the scene hex of its normalized coordinate.
 * Every door into the camera (an army selection asked from the HUD, the entry's first realm, the minimap, a route)
 * hands over a Position, which names the space it was built in; a bare hex says nothing, and a contract hex read as a
 * scene hex lands about 2^31 hexes away on a Frontier site, or the map centre's offset away anywhere else.
 */
export const cameraHexOf = (position: Position): HexPosition => {
  const { x, y } = position.getNormalized();
  return { col: x, row: y };
};

/**
 * Why the world map moves its camera: a player's request to look somewhere, and nothing else. A tap, a selection, an
 * army picked for an open card and an order (attack, explore, move, build, deploy, claim) have no reason here, so they
 * leave the camera where the player put it (owner, 28 October 2026: "it moves the camera when I fight").
 */
export type CameraNavigation =
  /** The map's first view: the realm the entry opens on. */
  | "entry"
  /** The route's place: the map opened or come back to, a link, a go-to, a Feed row, Visit, Map and Realm. */
  | "address"
  | "minimap"
  /** Tab and the structure cycle keys. */
  | "shortcut"
  /** A HUD control that shows an army out of sight: the dock, Next up, idle armies, a coach step. */
  | "show"
  /** An army picked for an open card that the map does not draw where the camera is: drawn there to be selected. */
  | "reach"
  /** The renderer's dev tools. */
  | "dev-tools";
