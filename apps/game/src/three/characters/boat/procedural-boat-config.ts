export type ProceduralBoatMotionMode = "idle" | "sail";

export interface ProceduralBoatConfig {
  acquireSeconds: number;
  autoFire: boolean;
  braceSeconds: number;
  broadsideCannons: number;
  fireSeconds: number;
  heaveAmplitude: number;
  motionMode: ProceduralBoatMotionMode;
  pitchDegrees: number;
  primaryColor: string;
  projectileFlightSeconds: number;
  projectileSpreadDegrees: number;
  projectileTargetRadius: number;
  recoverSeconds: number;
  recoilSeconds: number;
  rollDegrees: number;
  secondaryMotion: number;
  seed: number;
  showSockets: boolean;
  showWake: boolean;
  sinkDepth: number;
  sinkPitchDegrees: number;
  sinkRollDegrees: number;
  sinkSeconds: number;
  speed: number;
  targetDistance: number;
  targetHeight: number;
  tier: 1 | 2 | 3;
  waveFrequency: number;
}

const DEFAULT_PROCEDURAL_BOAT_CONFIG: ProceduralBoatConfig = {
  acquireSeconds: 0.22,
  autoFire: false,
  braceSeconds: 0.18,
  broadsideCannons: 4,
  fireSeconds: 0.1,
  heaveAmplitude: 0.075,
  motionMode: "sail",
  pitchDegrees: 2.4,
  primaryColor: "#c6a15b",
  projectileFlightSeconds: 0.82,
  projectileSpreadDegrees: 1.8,
  projectileTargetRadius: 0.72,
  recoverSeconds: 0.72,
  recoilSeconds: 0.34,
  rollDegrees: 3.8,
  secondaryMotion: 0.72,
  seed: 7_331,
  showSockets: false,
  showWake: true,
  sinkDepth: 3.6,
  sinkPitchDegrees: 34,
  sinkRollDegrees: 24,
  sinkSeconds: 4.2,
  speed: 1.6,
  targetDistance: 5.4,
  targetHeight: 0.5,
  tier: 2,
  waveFrequency: 0.42,
};

export function createDefaultProceduralBoatConfig(): ProceduralBoatConfig {
  return { ...DEFAULT_PROCEDURAL_BOAT_CONFIG };
}

export function applyProceduralBoatConfigPatch(
  current: ProceduralBoatConfig,
  patch: Partial<ProceduralBoatConfig>,
): ProceduralBoatConfig {
  return normalizeProceduralBoatConfig({ ...current, ...patch });
}

function normalizeProceduralBoatConfig(input: ProceduralBoatConfig): ProceduralBoatConfig {
  return {
    ...input,
    acquireSeconds: clamp(input.acquireSeconds, 0.03, 1.2),
    braceSeconds: clamp(input.braceSeconds, 0.03, 1.2),
    broadsideCannons: clampInteger(input.broadsideCannons, 1, 6),
    fireSeconds: clamp(input.fireSeconds, 0.03, 0.4),
    heaveAmplitude: clamp(input.heaveAmplitude, 0, 0.3),
    pitchDegrees: clamp(input.pitchDegrees, 0, 14),
    projectileFlightSeconds: clamp(input.projectileFlightSeconds, 0.25, 2.5),
    projectileSpreadDegrees: clamp(input.projectileSpreadDegrees, 0, 12),
    projectileTargetRadius: clamp(input.projectileTargetRadius, 0.1, 2),
    recoverSeconds: clamp(input.recoverSeconds, 0.08, 2),
    recoilSeconds: clamp(input.recoilSeconds, 0.05, 1.2),
    rollDegrees: clamp(input.rollDegrees, 0, 18),
    secondaryMotion: clamp(input.secondaryMotion, 0, 1.5),
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    sinkDepth: clamp(input.sinkDepth, 1.5, 8),
    sinkPitchDegrees: clamp(input.sinkPitchDegrees, 0, 65),
    sinkRollDegrees: clamp(input.sinkRollDegrees, 0, 55),
    sinkSeconds: clamp(input.sinkSeconds, 1.5, 10),
    speed: clamp(input.speed, 0, 8),
    targetDistance: clamp(input.targetDistance, 2, 14),
    targetHeight: clamp(input.targetHeight, 0.1, 3),
    tier: clampInteger(input.tier, 1, 3) as 1 | 2 | 3,
    waveFrequency: clamp(input.waveFrequency, 0.08, 1.5),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
