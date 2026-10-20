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
