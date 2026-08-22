import type { ProceduralCharacterConfig, ProceduralCharacterMotionMode } from "./procedural-character-config";
import {
  resolveContactCycle,
  resolveSeededMotionValue,
  wrapUnitPhase,
  type ProceduralContactCycle,
} from "./procedural-motion-curves";

export type CharacterFootId = "left" | "right";

export interface ProceduralCharacterGaitSignals {
  cadence: number;
  dutyFactor: number;
  feet: Readonly<Record<CharacterFootId, ProceduralContactCycle>>;
  phase: number;
  phaseRadians: number;
}

interface CharacterGaitDefinition {
  cadenceScale: number;
  dutyFactor: number;
}

const CHARACTER_GAITS: Readonly<Record<ProceduralCharacterMotionMode, CharacterGaitDefinition>> = {
  idle: { cadenceScale: 0.16, dutyFactor: 0.88 },
  walk: { cadenceScale: 1, dutyFactor: 0.62 },
  run: { cadenceScale: 1.55, dutyFactor: 0.4 },
  mounted: { cadenceScale: 1, dutyFactor: 0.88 },
};

export function resolveProceduralCharacterGaitSignals(
  config: ProceduralCharacterConfig,
  elapsedSeconds: number,
  phaseOverride?: number,
): ProceduralCharacterGaitSignals {
  const definition = CHARACTER_GAITS[config.animationMode];
  const cadence = resolveProceduralCharacterCadence(config);
  const rawCycles =
    phaseOverride ?? Math.max(0, elapsedSeconds) * cadence + resolveInitialProceduralCharacterPhase(config.seed);
  const phaseDrift =
    Math.sin(rawCycles * Math.PI + resolveSeededMotionValue(config.seed, 23) * Math.PI) *
    config.motionVariation *
    0.012;
  const phase = wrapUnitPhase(rawCycles + phaseDrift);
  const dutyFactor = clamp(definition.dutyFactor + config.dutyFactorOffset, 0.25, 0.8);
  const phaseAsymmetry = resolveSeededMotionValue(config.seed, 31) * config.motionVariation * 0.018;

  return {
    cadence,
    dutyFactor,
    feet: {
      left: resolveContactCycle(phase, phaseAsymmetry, dutyFactor),
      right: resolveContactCycle(phase, 0.5 - phaseAsymmetry, dutyFactor),
    },
    phase,
    phaseRadians: phase * Math.PI * 2,
  };
}

export function advanceProceduralCharacterGaitPhase(
  currentPhase: number,
  config: ProceduralCharacterConfig,
  deltaSeconds: number,
  travelledDistance: number,
  strideLength: number,
): number {
  const elapsed = Math.min(Math.max(0, deltaSeconds), 0.1);
  const desiredPhaseDelta = resolveProceduralCharacterCadence(config) * elapsed;
  if (desiredPhaseDelta <= 0) return wrapUnitPhase(currentPhase);
  if (
    (config.animationMode !== "walk" && config.animationMode !== "run") ||
    !Number.isFinite(travelledDistance) ||
    travelledDistance <= 1e-5
  ) {
    return wrapUnitPhase(currentPhase + desiredPhaseDelta);
  }
  const measuredPhaseDelta = travelledDistance / Math.max(0.05, strideLength);
  const clampedMeasuredDelta = Math.min(measuredPhaseDelta, desiredPhaseDelta * 2.5 + 0.02);
  return wrapUnitPhase(currentPhase + desiredPhaseDelta * 0.35 + clampedMeasuredDelta * 0.65);
}

export function resolveInitialProceduralCharacterPhase(seed: number): number {
  return wrapUnitPhase((resolveSeededMotionValue(seed, 3) + 1) * 0.5);
}

function resolveProceduralCharacterCadence(config: ProceduralCharacterConfig): number {
  const definition = CHARACTER_GAITS[config.animationMode];
  const cadenceBias = 1 + resolveSeededMotionValue(config.seed, 19) * config.motionVariation * 0.035;
  return config.animationSpeed * definition.cadenceScale * cadenceBias;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
