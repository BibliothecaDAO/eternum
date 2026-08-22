export interface ProceduralContactCycle {
  contact: "stance" | "swing";
  progress: number;
}

export interface ProceduralLimbTrajectory {
  forward: number;
  lift: number;
}

export function resolveContactCycle(
  masterPhase: number,
  phaseOffset: number,
  dutyFactor: number,
): ProceduralContactCycle {
  const phase = wrapUnitPhase(masterPhase + phaseOffset);
  const normalizedDutyFactor = clamp(dutyFactor, 0.12, 0.88);
  if (phase < normalizedDutyFactor) {
    return { contact: "stance", progress: phase / normalizedDutyFactor };
  }
  return { contact: "swing", progress: (phase - normalizedDutyFactor) / (1 - normalizedDutyFactor) };
}

/**
 * A stance travels at near-constant speed to read as planted. Swing uses a
 * fifth-order ease and an early apex so the limb clears quickly and settles
 * into contact instead of tracing a mechanical semicircle.
 */
export function resolveOrganicLimbTrajectory(
  cycle: ProceduralContactCycle,
  stride: number,
  clearance: number,
  planting: number,
  swingApex: number,
): ProceduralLimbTrajectory {
  if (cycle.contact === "stance") {
    const easedProgress = smootherStep(cycle.progress);
    const plantedProgress = mix(easedProgress, cycle.progress, clamp(planting, 0, 1));
    return { forward: stride * (0.5 - plantedProgress), lift: 0 };
  }

  const progress = smootherStep(cycle.progress);
  const apex = clamp(swingApex, 0.25, 0.75);
  const liftProgress =
    cycle.progress < apex ? smootherStep(cycle.progress / apex) : smootherStep((1 - cycle.progress) / (1 - apex));
  return {
    forward: stride * (progress - 0.5),
    lift: clearance * Math.pow(Math.max(0, liftProgress), 0.78),
  };
}

export function resolveSeededMotionValue(seed: number, channel: number): number {
  let value = (seed >>> 0) ^ Math.imul((channel + 1) >>> 0, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return ((value >>> 0) / 0xffff_ffff) * 2 - 1;
}

export function wrapUnitPhase(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
}

export function smootherStep(value: number): number {
  const normalized = clamp(value, 0, 1);
  return normalized * normalized * normalized * (normalized * (normalized * 6 - 15) + 10);
}

function mix(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
