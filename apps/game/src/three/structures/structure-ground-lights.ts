import { StructureType } from "@bibliothecadao/types";
import { Color } from "three";

import type { GroundLight } from "../terrain/ground-lights";

const glow = (hex: number, strength: number, reach: number): GroundLight => ({
  colour: new Color(hex).multiplyScalar(strength),
  reach,
});

const HEARTH = glow(0xffa055, 6, 3);

/**
 * The light each kind of structure casts on the ground round it: the hearths of settlements, the glow of a
 * hyperstructure's core and of a rift. Structures that show no fire or glow cast none.
 */
export const STRUCTURE_GROUND_LIGHTS: Record<StructureType, GroundLight | null> = {
  [StructureType.Realm]: HEARTH,
  [StructureType.Village]: glow(0xffa055, 5, 2.5),
  [StructureType.Camp]: HEARTH,
  [StructureType.Hyperstructure]: glow(0x9b5cff, 7.5, 4.5),
  [StructureType.Rift]: glow(0xb070ff, 6, 3),
  [StructureType.Bank]: null,
  [StructureType.Mine]: null,
  [StructureType.BitcoinMine]: null,
  [StructureType.Ruin]: null,
  [StructureType.Beasts]: null,
};

/** The Spire's orb: a deep pink pool round its foot. */
export const SPIRE_GROUND_LIGHT = glow(0xff4fb0, 6.5, 3);
