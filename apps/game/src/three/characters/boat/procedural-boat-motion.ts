import type { ProceduralBoatBroadsideSide, ProceduralBoatBroadsideSignals } from "./procedural-boat-broadside-cycle";
import type { ProceduralBoatConfig } from "./procedural-boat-config";

export interface ProceduralBoatSinkState {
  elapsedSeconds: number;
  side: ProceduralBoatBroadsideSide;
}

export interface ProceduralBoatMotionPose {
  heave: number;
  muzzleFlash: number;
  pitchRadians: number;
  rollRadians: number;
  sinkProgress: number;
  sinkY: number;
  wakeStrength: number;
}

export function resolveProceduralBoatMotion(
  config: ProceduralBoatConfig,
  elapsedSeconds: number,
  broadside: ProceduralBoatBroadsideSignals,
  broadsideSide: ProceduralBoatBroadsideSide,
  sink?: ProceduralBoatSinkState,
  contactRoll = 0,
): ProceduralBoatMotionPose {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const phase = seedPhase(config.seed);
  const angularFrequency = Math.PI * 2 * config.waveFrequency;
  const wave = Math.sin(elapsed * angularFrequency + phase);
  const secondaryWave = Math.sin(elapsed * angularFrequency * 1.73 + phase * 0.61);
  const tertiaryWave = Math.sin(elapsed * angularFrequency * 0.63 + phase * 1.37);
  const motionWeight = config.motionMode === "sail" ? 1 : 0.72;
  const secondaryWeight = config.secondaryMotion / 1.5;
  const sinkProgress = sink ? smootherstep(sink.elapsedSeconds / config.sinkSeconds) : 0;
  const sinkSide = sink?.side === "port" ? 1 : -1;
  const recoilSide = broadsideSide === "port" ? 1 : -1;
  const pitch =
    degreesToRadians(config.pitchDegrees) * (wave * 0.68 + secondaryWave * 0.2 * secondaryWeight) * motionWeight;
  const roll =
    degreesToRadians(config.rollDegrees) *
    (tertiaryWave * 0.72 + secondaryWave * 0.18 * secondaryWeight) *
    motionWeight;
  const sinkPitch = degreesToRadians(config.sinkPitchDegrees) * Math.pow(sinkProgress, 1.18);
  const sinkRoll = degreesToRadians(config.sinkRollDegrees) * sinkSide * Math.pow(sinkProgress, 1.08);
  const recoilRoll = degreesToRadians(4.5) * recoilSide * broadside.recoil;
  const recoilPitch = degreesToRadians(1.6) * broadside.recoil;

  return {
    heave: config.heaveAmplitude * (wave * 0.74 + secondaryWave * 0.2 * secondaryWeight) * (1 - sinkProgress),
    muzzleFlash: broadside.muzzleFlash * (1 - sinkProgress),
    pitchRadians: pitch + recoilPitch + sinkPitch,
    rollRadians: roll + recoilRoll + sinkRoll + contactRoll * (1 - sinkProgress),
    sinkProgress,
    sinkY: -config.sinkDepth * Math.pow(sinkProgress, 1.35),
    wakeStrength:
      config.showWake && config.motionMode === "sail"
        ? Math.min(1, config.speed / 3.5) * (0.78 + 0.22 * Math.abs(wave)) * (1 - sinkProgress)
        : 0,
  };
}

function seedPhase(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) / 0x1_0000_0000) * Math.PI * 2;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function smootherstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}
