import { Color } from "three";
import { SIDE_HEX, type SeatSide } from "@/tokens";
import { sideOf } from "@/utils/entity-ownership";

/**
 * The colour an army's path is drawn in, by the map labels' own rule: to a watching viewer, its owner's seat colour
 * (`watched`, watchedSide); else its side's (SIDE_HEX): yours green, an ally's blue, everyone else's red.
 */
export const armyPathColour = (
  army: { isMine: boolean; isAlly: boolean; owner: { address: bigint } },
  watched: SeatSide | null,
): Color => new Color(watched?.colour ?? SIDE_HEX[sideOf(army)]);
