import type { ProceduralCharacterTier } from "../procedural-character-config";

export type ProceduralDragonLocomotionMode = "flight" | "idle" | "walk";
export type ProceduralDragonRenderDetail = "crowd" | "quality";

export interface ProceduralDragonConfig {
  acquireSeconds: number;
  altitude: number;
  autoFire: boolean;
  bank: number;
  fireSeconds: number;
  fireRange: number;
  glide: number;
  inhaleSeconds: number;
  locomotionMode: ProceduralDragonLocomotionMode;
  neckMotion: number;
  pitch: number;
  primaryColor: string;
  recoverSeconds: number;
  renderDetail: ProceduralDragonRenderDetail;
  seed: number;
  showBones: boolean;
  showSockets: boolean;
  speed: number;
  stepHeight: number;
  strideScale: number;
  tailMotion: number;
  tier: ProceduralCharacterTier;
  turnRate: number;
  wingAmplitude: number;
  wingBeatHz: number;
  wireframe: boolean;
}

const DEFAULT_CONFIG: ProceduralDragonConfig = {
  acquireSeconds: 0.3,
  altitude: 2.4,
  autoFire: false,
  bank: 0.12,
  fireSeconds: 0.58,
  fireRange: 5.5,
  glide: 0.22,
  inhaleSeconds: 0.42,
  locomotionMode: "idle",
  neckMotion: 0.34,
  pitch: -0.04,
  primaryColor: "#352a32",
  recoverSeconds: 0.52,
  renderDetail: "quality",
  seed: 1337,
  showBones: false,
  showSockets: true,
  speed: 3.2,
  stepHeight: 0.34,
  strideScale: 1,
  tailMotion: 0.58,
  tier: 3,
  turnRate: 0,
  wingAmplitude: 0.92,
  wingBeatHz: 1.05,
  wireframe: false,
};

export function createDefaultProceduralDragonConfig(): ProceduralDragonConfig {
  return { ...DEFAULT_CONFIG };
}

export function applyProceduralDragonConfigPatch(
  current: ProceduralDragonConfig,
  patch: Partial<ProceduralDragonConfig>,
): ProceduralDragonConfig {
  const input = { ...current, ...patch };
  return {
    ...input,
    acquireSeconds: clamp(input.acquireSeconds, 0.03, 1.5),
    altitude: clamp(input.altitude, 0.6, 8),
    bank: clamp(input.bank, -0.8, 0.8),
    fireRange: clamp(input.fireRange, 1, 12),
    fireSeconds: clamp(input.fireSeconds, 0.12, 2),
    glide: clamp(input.glide, 0, 1),
    inhaleSeconds: clamp(input.inhaleSeconds, 0.08, 1.5),
    neckMotion: clamp(input.neckMotion, 0, 1),
    pitch: clamp(input.pitch, -0.6, 0.6),
    primaryColor: normalizeColor(input.primaryColor),
    recoverSeconds: clamp(input.recoverSeconds, 0.08, 2),
    renderDetail: input.renderDetail === "crowd" ? "crowd" : "quality",
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    speed: clamp(input.speed, 0, 12),
    stepHeight: clamp(input.stepHeight, 0, 1),
    strideScale: clamp(input.strideScale, 0.45, 1.8),
    tailMotion: clamp(input.tailMotion, 0, 1.5),
    tier: clampInteger(input.tier, 1, 3) as ProceduralCharacterTier,
    turnRate: clamp(input.turnRate, -2, 2),
    wingAmplitude: clamp(input.wingAmplitude, 0.05, 1.4),
    wingBeatHz: clamp(input.wingBeatHz, 0.15, 3),
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
