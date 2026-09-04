import type { ProceduralCharacterUpperBodyAction } from "./procedural-character-action";

export type ProceduralHandDigitId = "index" | "middle" | "pinky" | "ring" | "thumb";
export type ProceduralHandGripProfile = "bow" | "draw" | "open" | "power" | "shield" | "support";

export interface ProceduralHandPose {
  curls: Readonly<Record<ProceduralHandDigitId, number>>;
  profile: ProceduralHandGripProfile;
}

export interface ProceduralCharacterHandPose {
  left: ProceduralHandPose;
  right: ProceduralHandPose;
}

export const PROCEDURAL_HAND_DIGIT_IDS = ["thumb", "index", "middle", "ring", "pinky"] as const;

const HAND_POSES: Readonly<Record<ProceduralHandGripProfile, ProceduralHandPose>> = {
  open: createHandPose("open", 0.08, 0.1, 0.12, 0.16, 0.2),
  bow: createHandPose("bow", 0.58, 0.72, 0.82, 0.9, 0.94),
  draw: createHandPose("draw", 0.35, 0.95, 1, 0.95, 0.55),
  power: createHandPose("power", 0.72, 0.88, 0.96, 1, 1),
  shield: createHandPose("shield", 0.68, 0.84, 0.94, 0.98, 1),
  support: createHandPose("support", 0.76, 0.94, 1, 1, 1),
};
const HAND_POSE_PAIRS = {
  archerDraw: { left: HAND_POSES.bow, right: HAND_POSES.draw },
  archerRest: { left: HAND_POSES.bow, right: HAND_POSES.open },
  crossbow: { left: HAND_POSES.support, right: HAND_POSES.support },
  meleeEmpty: { left: HAND_POSES.open, right: HAND_POSES.power },
  meleeShield: { left: HAND_POSES.shield, right: HAND_POSES.power },
  open: { left: HAND_POSES.open, right: HAND_POSES.open },
} satisfies Readonly<Record<string, ProceduralCharacterHandPose>>;

export function resolveProceduralCharacterHandPose(
  action?: ProceduralCharacterUpperBodyAction,
): ProceduralCharacterHandPose {
  if (!action) return HAND_POSE_PAIRS.open;
  if (action.kind === "archer") {
    return action.previewArrowVisible || action.drawFraction > 0.08
      ? HAND_POSE_PAIRS.archerDraw
      : HAND_POSE_PAIRS.archerRest;
  }
  if (action.kind === "crossbow") return HAND_POSE_PAIRS.crossbow;
  return action.offhandId === "none" ? HAND_POSE_PAIRS.meleeEmpty : HAND_POSE_PAIRS.meleeShield;
}

function createHandPose(
  profile: ProceduralHandGripProfile,
  thumb: number,
  index: number,
  middle: number,
  ring: number,
  pinky: number,
): ProceduralHandPose {
  return { curls: { index, middle, pinky, ring, thumb }, profile };
}
