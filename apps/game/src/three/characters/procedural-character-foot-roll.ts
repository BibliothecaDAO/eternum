import { smootherStep, type ProceduralContactCycle } from "./procedural-motion-curves";

export interface CharacterFootGeometry {
  ankleHeight: number;
  heelLength: number;
  ballLength: number;
}

export interface CharacterFootRoll {
  contactKind: "heel" | "sole" | "forefoot" | "air";
  pitchRadians: number;
  toeFlexRadians: number;
  ankleOffset: readonly [number, number, number];
}

const HEEL_PITCH = (-12 * Math.PI) / 180;
const PUSH_OFF_PITCH = (28 * Math.PI) / 180;

/** A fixed sole origin becomes a heel/forefoot pivot; the ankle may move without skating. */
export function resolveWalkingFootRoll(cycle: ProceduralContactCycle, foot: CharacterFootGeometry): CharacterFootRoll {
  const progress = Math.min(1, Math.max(0, cycle.progress));
  const pitchRadians = cycle.contact === "stance" ? stancePitch(progress) : swingPitch(progress);
  const pivot =
    cycle.contact === "stance"
      ? pitchRadians < 0
        ? -foot.heelLength
        : pitchRadians > 0
          ? foot.ballLength
          : 0
      : foot.ballLength * (1 - smootherStep(progress / 0.32)) -
        foot.heelLength * smootherStep((progress - 0.65) / 0.35);
  const contactKind =
    cycle.contact === "swing" ? "air" : pitchRadians < 0 ? "heel" : pitchRadians > 0 ? "forefoot" : "sole";
  const toeFlexRadians =
    Math.max(0, pitchRadians) * (cycle.contact === "stance" ? 1 : 1 - smootherStep(progress / 0.24));
  return {
    contactKind,
    pitchRadians,
    toeFlexRadians,
    ankleOffset: [
      0,
      foot.ankleHeight * Math.cos(pitchRadians) + pivot * Math.sin(pitchRadians),
      foot.ankleHeight * Math.sin(pitchRadians) + pivot * (1 - Math.cos(pitchRadians)),
    ],
  };
}

function stancePitch(progress: number): number {
  if (progress < 0.2) return HEEL_PITCH * (1 - smootherStep(progress / 0.2));
  return PUSH_OFF_PITCH * smootherStep((progress - 0.68) / 0.32);
}

function swingPitch(progress: number): number {
  if (progress < 0.45) return PUSH_OFF_PITCH * (1 - smootherStep(progress / 0.45));
  return HEEL_PITCH * smootherStep((progress - 0.55) / 0.45);
}
