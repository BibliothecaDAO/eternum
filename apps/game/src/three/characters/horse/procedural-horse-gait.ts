import type { ProceduralHorseConfig, ProceduralHorseGait } from "./procedural-horse-config";
import {
  resolveContactCycle,
  resolveSeededMotionValue,
  wrapUnitPhase,
  type ProceduralContactCycle,
} from "../procedural-motion-curves";

export const HORSE_HOOF_IDS = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
export type HorseHoofId = (typeof HORSE_HOOF_IDS)[number];

interface HorseGaitDefinition {
  cadence: number;
  contactPhases: Readonly<Record<HorseHoofId, number>>;
  dutyFactor: number;
  strideLength: number;
  swingApex: number;
}

export type HorseHoofCycle = ProceduralContactCycle;

const HORSE_GAITS: Readonly<Record<ProceduralHorseGait, HorseGaitDefinition>> = {
  idle: {
    cadence: 0,
    contactPhases: { frontLeft: 0, frontRight: 0, hindLeft: 0, hindRight: 0 },
    dutyFactor: 1,
    strideLength: 0,
    swingApex: 0.5,
  },
  walk: {
    cadence: 0.92,
    // Lateral-sequence walk: HL, FL, HR, FR.
    contactPhases: { frontLeft: 0.25, frontRight: 0.75, hindLeft: 0, hindRight: 0.5 },
    dutyFactor: 0.61,
    strideLength: 1.05,
    swingApex: 0.36,
  },
  trot: {
    cadence: 1.45,
    // Diagonal pairs; the fore contacts receive the configured dissociation.
    contactPhases: { frontLeft: 0.5, frontRight: 0, hindLeft: 0, hindRight: 0.5 },
    dutyFactor: 0.44,
    strideLength: 1.45,
    swingApex: 0.33,
  },
  canter: {
    cadence: 1.72,
    // Right lead: HL, FL, HR, FR. Left lead mirrors this table.
    contactPhases: { frontLeft: 0.24, frontRight: 0.55, hindLeft: 0, hindRight: 0.27 },
    dutyFactor: 0.395,
    strideLength: 1.85,
    swingApex: 0.34,
  },
  gallop: {
    cadence: 2.05,
    // Right lead transverse gallop: HL, HR, FL, FR. Left lead mirrors this table.
    contactPhases: { frontLeft: 0.4, frontRight: 0.6, hindLeft: 0, hindRight: 0.2 },
    dutyFactor: 0.36,
    strideLength: 2.35,
    swingApex: 0.31,
  },
};

export function advanceHorseGaitPhase(
  currentPhase: number,
  config: ProceduralHorseConfig,
  deltaSeconds: number,
  travelledDistance = 0,
): number {
  if (config.gait === "idle" || config.speed <= 0 || deltaSeconds <= 0) return wrapUnitPhase(currentPhase);
  const elapsed = Math.min(deltaSeconds, 0.1);
  const desiredPhaseDelta = elapsed * resolveHorseGaitCadence(config);
  if (!Number.isFinite(travelledDistance) || travelledDistance <= 1e-5) {
    return wrapUnitPhase(currentPhase + desiredPhaseDelta);
  }
  const measuredPhaseDelta = travelledDistance / Math.max(0.05, resolveHorseGaitStride(config));
  const clampedMeasuredDelta = Math.min(measuredPhaseDelta, desiredPhaseDelta * 2.5 + 0.02);
  return wrapUnitPhase(currentPhase + desiredPhaseDelta * 0.35 + clampedMeasuredDelta * 0.65);
}

export function resolveHorseGaitCadence(config: ProceduralHorseConfig): number {
  const gait = HORSE_GAITS[config.gait];
  if (config.gait === "idle" || config.speed <= 0) return 0;
  const strideLength = gait.strideLength * config.strideScale;
  const distanceCadence = strideLength > 0 ? config.speed / strideLength : 0;
  return Math.max(gait.cadence * 0.45, distanceCadence);
}

export function resolveInitialHorseGaitPhase(seed: number): number {
  return wrapUnitPhase((resolveSeededMotionValue(seed, 71) + 1) * 0.5);
}

export function resolveHorseHoofCycle(
  config: ProceduralHorseConfig,
  hoofId: HorseHoofId,
  masterPhase: number,
): HorseHoofCycle {
  if (config.gait === "idle") return { contact: "stance", progress: 0.5 };
  const contactPhase = resolveHorseContactPhase(config, hoofId);
  const dutyFactor = resolveHorseDutyFactor(config);
  return resolveContactCycle(masterPhase, -contactPhase, dutyFactor);
}

export function resolveHorseContactPhase(config: ProceduralHorseConfig, hoofId: HorseHoofId): number {
  const gait = HORSE_GAITS[config.gait];
  const leadAwareHoofId =
    (config.gait === "canter" || config.gait === "gallop") && config.lead === "left" ? mirrorHoofId(hoofId) : hoofId;
  const dissociation = config.gait === "trot" && hoofId.startsWith("front") ? config.diagonalDissociation : 0;
  return wrapUnitPhase(gait.contactPhases[leadAwareHoofId] + dissociation);
}

function resolveHorseDutyFactor(config: ProceduralHorseConfig): number {
  const gait = HORSE_GAITS[config.gait];
  const speedAdjustedDuty = config.gait === "gallop" ? 0.36 - clamp(config.speed / 8, 0, 1) * 0.06 : gait.dutyFactor;
  return clamp(speedAdjustedDuty + config.dutyFactorOffset, 0.12, 0.88);
}

export function resolveHorseGaitStride(config: ProceduralHorseConfig): number {
  return HORSE_GAITS[config.gait].strideLength * config.strideScale;
}

export function resolveHorseSwingApex(gait: ProceduralHorseGait): number {
  return HORSE_GAITS[gait].swingApex;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mirrorHoofId(hoofId: HorseHoofId): HorseHoofId {
  if (hoofId === "frontLeft") return "frontRight";
  if (hoofId === "frontRight") return "frontLeft";
  if (hoofId === "hindLeft") return "hindRight";
  return "hindLeft";
}
