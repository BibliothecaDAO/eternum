import { StructureType } from "@bibliothecadao/types";
import { Color } from "three";

import type { GroundLight } from "../terrain/ground-lights";

const glow = (hex: number, strength: number, reach: number): GroundLight => ({
  colour: new Color(hex).multiplyScalar(strength),
  reach,
});

const HEARTH = glow(0xffa055, 3, 3);

export const STRUCTURE_GROUND_LIGHTS: Record<StructureType, GroundLight | null> = {
  [StructureType.Realm]: HEARTH,
  [StructureType.Village]: glow(0xffa055, 2.5, 2.5),
  [StructureType.Camp]: HEARTH,
  [StructureType.Hyperstructure]: glow(0x9b5cff, 4, 4.5),
  [StructureType.Rift]: glow(0xb070ff, 3, 3),
  [StructureType.Bank]: null,
  [StructureType.Mine]: null,
  [StructureType.Ruin]: null,
  [StructureType.Beasts]: null,
};

export const SPIRE_GROUND_LIGHT = glow(0xff4fb0, 3.5, 3);
