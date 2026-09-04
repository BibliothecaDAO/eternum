import type { ProceduralArcherUpperBodyPose } from "./archer/procedural-archer-pose";
import type { ProceduralCrossbowUpperBodyPose } from "./crossbow/procedural-crossbow-pose";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";

export type ProceduralCharacterUpperBodyAction =
  | ProceduralArcherUpperBodyPose
  | ProceduralCrossbowUpperBodyPose
  | ProceduralMeleeUpperBodyPose;
