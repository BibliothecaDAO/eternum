export interface ProceduralArcherConfig {
  aimDrift: number;
  aimPitchDegrees: number;
  aimSeconds: number;
  aimYawDegrees: number;
  anchorSeconds: number;
  autoFire: boolean;
  bowBend: number;
  bowArmExtension: number;
  bowCantDegrees: number;
  bowGripHeight: number;
  bowGripSide: number;
  bowHeight: number;
  detailedEquipment: boolean;
  drawLength: number;
  drawSeconds: number;
  followThroughSeconds: number;
  nockSeconds: number;
  projectileCapacity: number;
  projectileFixedStep: number;
  projectileFlightSeconds: number;
  projectileGravity: number;
  projectileStickSeconds: number;
  projectileSweepRadius: number;
  raiseSeconds: number;
  recoverSeconds: number;
  releaseSeconds: number;
  showSockets: boolean;
  showTrajectory: boolean;
  targetDistance: number;
  targetHeight: number;
  targetMovement: number;
  targetRadius: number;
  targetSpeed: number;
  trackSeconds: number;
  volleyCount: number;
  volleySpreadDegrees: number;
}

const DEFAULT_ARCHER_CONFIG: ProceduralArcherConfig = {
  aimDrift: 0.012,
  aimPitchDegrees: 0,
  aimSeconds: 0.42,
  aimYawDegrees: 0,
  anchorSeconds: 0.12,
  autoFire: false,
  bowBend: 0.16,
  bowArmExtension: 0.74,
  bowCantDegrees: -5,
  bowGripHeight: 0.28,
  bowGripSide: 0.22,
  bowHeight: 1.62,
  detailedEquipment: true,
  drawLength: 0.72,
  drawSeconds: 0.52,
  followThroughSeconds: 0.34,
  nockSeconds: 0.2,
  projectileCapacity: 256,
  projectileFixedStep: 1 / 120,
  projectileFlightSeconds: 0.72,
  projectileGravity: -7.5,
  projectileStickSeconds: 4.5,
  projectileSweepRadius: 0.045,
  raiseSeconds: 0.24,
  recoverSeconds: 0.38,
  releaseSeconds: 0.065,
  showSockets: false,
  showTrajectory: true,
  targetDistance: 5.2,
  targetHeight: 1.42,
  targetMovement: 0,
  targetRadius: 0.48,
  targetSpeed: 0.7,
  trackSeconds: 0.16,
  volleyCount: 1,
  volleySpreadDegrees: 0.7,
};

export function createDefaultProceduralArcherConfig(): ProceduralArcherConfig {
  return { ...DEFAULT_ARCHER_CONFIG };
}

export function applyProceduralArcherConfigPatch(
  current: ProceduralArcherConfig,
  patch: Partial<ProceduralArcherConfig>,
): ProceduralArcherConfig {
  return normalizeProceduralArcherConfig({ ...current, ...patch });
}

function normalizeProceduralArcherConfig(input: ProceduralArcherConfig): ProceduralArcherConfig {
  return {
    ...input,
    aimDrift: clamp(input.aimDrift, 0, 0.08),
    aimPitchDegrees: clamp(input.aimPitchDegrees, -20, 45),
    aimSeconds: clamp(input.aimSeconds, 0.05, 2),
    aimYawDegrees: clamp(input.aimYawDegrees, -50, 50),
    anchorSeconds: clamp(input.anchorSeconds, 0.03, 0.5),
    bowBend: clamp(input.bowBend, 0, 0.35),
    bowArmExtension: clamp(input.bowArmExtension, 0.5, 0.82),
    bowCantDegrees: clamp(input.bowCantDegrees, -30, 30),
    bowGripHeight: clamp(input.bowGripHeight, 0.05, 0.55),
    bowGripSide: clamp(input.bowGripSide, 0.05, 0.45),
    bowHeight: clamp(input.bowHeight, 0.8, 2.4),
    drawLength: clamp(input.drawLength, 0.35, 1.1),
    drawSeconds: clamp(input.drawSeconds, 0.1, 1.5),
    followThroughSeconds: clamp(input.followThroughSeconds, 0.08, 1),
    nockSeconds: clamp(input.nockSeconds, 0.05, 0.8),
    projectileCapacity: clampInteger(input.projectileCapacity, 16, 1_024),
    projectileFixedStep: clamp(input.projectileFixedStep, 1 / 240, 1 / 30),
    projectileFlightSeconds: clamp(input.projectileFlightSeconds, 0.2, 2),
    projectileGravity: clamp(input.projectileGravity, -30, 0),
    projectileStickSeconds: clamp(input.projectileStickSeconds, 0.25, 15),
    projectileSweepRadius: clamp(input.projectileSweepRadius, 0.005, 0.25),
    raiseSeconds: clamp(input.raiseSeconds, 0.05, 0.8),
    recoverSeconds: clamp(input.recoverSeconds, 0.08, 1.5),
    releaseSeconds: clamp(input.releaseSeconds, 0.02, 0.25),
    targetDistance: clamp(input.targetDistance, 2, 12),
    targetHeight: clamp(input.targetHeight, 0.35, 3.5),
    targetMovement: clamp(input.targetMovement, 0, 3),
    targetRadius: clamp(input.targetRadius, 0.08, 1.5),
    targetSpeed: clamp(input.targetSpeed, 0, 3),
    trackSeconds: clamp(input.trackSeconds, 0.03, 0.8),
    volleyCount: clampInteger(input.volleyCount, 1, 12),
    volleySpreadDegrees: clamp(input.volleySpreadDegrees, 0, 8),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
