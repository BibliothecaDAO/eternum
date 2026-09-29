import type { HexPosition } from "@bibliothecadao/types";
import { LOCAL_HEX_SPACE } from "../utils/utils";

/** Where a realm's local hex (a building slot or its ground) is drawn: its own lattice, never the world map's origin. */
export const localHexPosition = (hex: HexPosition) => LOCAL_HEX_SPACE.positionForHex(hex, false);
