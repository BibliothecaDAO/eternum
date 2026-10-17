import type { HexPosition } from "@bibliothecadao/types";

/** What a double-click on a world-map tile can do, as the scene does it. */
interface WorldmapDoubleClickActions {
  isReservedHyperstructureSite: (hex: HexPosition) => boolean;
  foundHyperstructure: (hex: HexPosition) => void;
  enterStructure: (hex: HexPosition) => void;
}

/**
 * A double-click on the world map: on a reserved Hyperstructure site it founds the Hyperstructure there at once (the
 * site's panel also founds it immediately); on any other tile it enters the structure standing there.
 */
export const runWorldmapDoubleClick = (hex: HexPosition, actions: WorldmapDoubleClickActions): void => {
  if (actions.isReservedHyperstructureSite(hex)) actions.foundHyperstructure(hex);
  else actions.enterStructure(hex);
};
