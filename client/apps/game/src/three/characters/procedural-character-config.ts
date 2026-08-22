export type ProceduralCharacterMotionMode = "idle" | "walk" | "run" | "mounted";
export type ProceduralCharacterPresetId = "balanced" | "heavy" | "mythic";
export type ProceduralCharacterTier = 1 | 2 | 3;

export interface ProceduralCharacterConfig {
  tier: ProceduralCharacterTier;
  seed: number;
  primaryColor: string;
  metalness: number;
  roughness: number;
  runeGlow: number;
  animationMode: ProceduralCharacterMotionMode;
  animationSpeed: number;
  stride: number;
  stepHeight: number;
  armSwing: number;
  hipSway: number;
  torsoTwist: number;
  bob: number;
  lean: number;
  breathing: number;
  dutyFactorOffset: number;
  footPlant: number;
  motionVariation: number;
  secondaryMotion: number;
  gravity: number;
  fixedStep: number;
  collisionSteps: number;
  massScale: number;
  linearDamping: number;
  angularDamping: number;
  friction: number;
  restitution: number;
  shoulderSwingDegrees: number;
  shoulderTwistDegrees: number;
  hipSwingDegrees: number;
  hipTwistDegrees: number;
  spineSwingDegrees: number;
  neckSwingDegrees: number;
  elbowMinDegrees: number;
  elbowMaxDegrees: number;
  kneeMinDegrees: number;
  kneeMaxDegrees: number;
  impulseX: number;
  impulseY: number;
  impulseZ: number;
  selfCollision: boolean;
  showJoints: boolean;
  wireframe: boolean;
  autoRotate: boolean;
}

const DEFAULT_CONFIG: ProceduralCharacterConfig = {
  tier: 3,
  seed: 1337,
  primaryColor: "#315f86",
  metalness: 0.72,
  roughness: 0.34,
  runeGlow: 0.38,
  animationMode: "walk",
  animationSpeed: 1,
  stride: 0.72,
  stepHeight: 0.32,
  armSwing: 0.62,
  hipSway: 0.055,
  torsoTwist: 0.16,
  bob: 0.055,
  lean: 0.08,
  breathing: 0.025,
  dutyFactorOffset: 0,
  footPlant: 1,
  motionVariation: 0.1,
  secondaryMotion: 0.72,
  gravity: -9.81,
  fixedStep: 1 / 60,
  collisionSteps: 1,
  massScale: 1,
  linearDamping: 0.12,
  angularDamping: 0.36,
  friction: 0.72,
  restitution: 0.05,
  shoulderSwingDegrees: 72,
  shoulderTwistDegrees: 34,
  hipSwingDegrees: 48,
  hipTwistDegrees: 24,
  spineSwingDegrees: 16,
  neckSwingDegrees: 24,
  elbowMinDegrees: 4,
  elbowMaxDegrees: 136,
  kneeMinDegrees: 2,
  kneeMaxDegrees: 138,
  impulseX: 4.5,
  impulseY: 2.4,
  impulseZ: -7.5,
  selfCollision: false,
  showJoints: false,
  wireframe: false,
  autoRotate: true,
};

const PRESET_PATCHES: Record<ProceduralCharacterPresetId, Partial<ProceduralCharacterConfig>> = {
  balanced: {},
  heavy: {
    tier: 2,
    seed: 2048,
    primaryColor: "#6e2730",
    animationSpeed: 0.78,
    stride: 0.52,
    stepHeight: 0.2,
    armSwing: 0.42,
    hipSway: 0.035,
    bob: 0.035,
    dutyFactorOffset: 0.04,
    motionVariation: 0.06,
    secondaryMotion: 0.52,
    massScale: 1.65,
    angularDamping: 0.5,
    impulseX: 6,
    impulseY: 2,
    impulseZ: -9,
  },
  mythic: {
    tier: 3,
    seed: 7777,
    primaryColor: "#8571b7",
    metalness: 0.86,
    roughness: 0.2,
    runeGlow: 0.92,
    animationMode: "run",
    animationSpeed: 1.15,
    stride: 0.9,
    stepHeight: 0.42,
    armSwing: 0.78,
    torsoTwist: 0.24,
    bob: 0.075,
    dutyFactorOffset: -0.035,
    motionVariation: 0.14,
    secondaryMotion: 0.88,
    impulseX: 5.5,
    impulseY: 3.5,
    impulseZ: -10,
  },
};

export const PROCEDURAL_CHARACTER_PRESETS: ReadonlyArray<{ id: ProceduralCharacterPresetId; label: string }> = [
  { id: "balanced", label: "Balanced Ranger" },
  { id: "heavy", label: "Peasant Vanguard" },
  { id: "mythic", label: "Mythic Ranger" },
];

export function createDefaultProceduralCharacterConfig(): ProceduralCharacterConfig {
  return { ...DEFAULT_CONFIG };
}

export function resolveProceduralCharacterPreset(presetId: ProceduralCharacterPresetId): ProceduralCharacterConfig {
  return normalizeProceduralCharacterConfig({ ...DEFAULT_CONFIG, ...PRESET_PATCHES[presetId] });
}

export function applyProceduralCharacterConfigPatch(
  current: ProceduralCharacterConfig,
  patch: Partial<ProceduralCharacterConfig>,
): ProceduralCharacterConfig {
  return normalizeProceduralCharacterConfig({ ...current, ...patch });
}

function normalizeProceduralCharacterConfig(input: ProceduralCharacterConfig): ProceduralCharacterConfig {
  const elbowMin = clamp(input.elbowMinDegrees, -15, 100);
  const kneeMin = clamp(input.kneeMinDegrees, -10, 80);

  return {
    ...input,
    tier: clampInteger(input.tier, 1, 3) as ProceduralCharacterTier,
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    primaryColor: normalizeColor(input.primaryColor),
    metalness: clamp(input.metalness, 0, 1),
    roughness: clamp(input.roughness, 0.04, 1),
    runeGlow: clamp(input.runeGlow, 0, 2),
    animationSpeed: clamp(input.animationSpeed, 0, 3),
    stride: clamp(input.stride, 0, 1.4),
    stepHeight: clamp(input.stepHeight, 0, 0.8),
    armSwing: clamp(input.armSwing, 0, 1.5),
    hipSway: clamp(input.hipSway, 0, 0.2),
    torsoTwist: clamp(input.torsoTwist, 0, 0.6),
    bob: clamp(input.bob, 0, 0.18),
    lean: clamp(input.lean, -0.3, 0.45),
    breathing: clamp(input.breathing, 0, 0.08),
    dutyFactorOffset: clamp(input.dutyFactorOffset, -0.16, 0.16),
    footPlant: clamp(input.footPlant, 0, 1),
    motionVariation: clamp(input.motionVariation, 0, 0.3),
    secondaryMotion: clamp(input.secondaryMotion, 0, 1.5),
    gravity: clamp(input.gravity, -30, 0),
    fixedStep: clamp(input.fixedStep, 1 / 120, 1 / 30),
    collisionSteps: clampInteger(input.collisionSteps, 1, 4),
    massScale: clamp(input.massScale, 0.25, 4),
    linearDamping: clamp(input.linearDamping, 0, 2),
    angularDamping: clamp(input.angularDamping, 0, 2),
    friction: clamp(input.friction, 0, 1),
    restitution: clamp(input.restitution, 0, 1),
    shoulderSwingDegrees: clamp(input.shoulderSwingDegrees, 5, 170),
    shoulderTwistDegrees: clamp(input.shoulderTwistDegrees, 0, 170),
    hipSwingDegrees: clamp(input.hipSwingDegrees, 5, 130),
    hipTwistDegrees: clamp(input.hipTwistDegrees, 0, 120),
    spineSwingDegrees: clamp(input.spineSwingDegrees, 0, 60),
    neckSwingDegrees: clamp(input.neckSwingDegrees, 0, 70),
    elbowMinDegrees: elbowMin,
    elbowMaxDegrees: clamp(input.elbowMaxDegrees, elbowMin + 1, 170),
    kneeMinDegrees: kneeMin,
    kneeMaxDegrees: clamp(input.kneeMaxDegrees, kneeMin + 1, 170),
    impulseX: clamp(input.impulseX, -30, 30),
    impulseY: clamp(input.impulseY, -10, 30),
    impulseZ: clamp(input.impulseZ, -30, 30),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function normalizeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_CONFIG.primaryColor;
}
