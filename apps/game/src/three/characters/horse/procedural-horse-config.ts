import type { ProceduralCharacterTier } from "../procedural-character-config";
import {
  DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID,
  normalizeProceduralHorseAppearanceId,
  type ProceduralHorseAppearanceId,
} from "./procedural-horse-appearance";

export type ProceduralHorseGait = "idle" | "walk" | "trot" | "canter" | "gallop";
export type ProceduralHorseLead = "left" | "right";
export type ProceduralHorseTerrainPreset = "flat" | "slope" | "waves" | "steps";

export interface ProceduralHorseConfig {
  appearanceId: ProceduralHorseAppearanceId;
  tier: ProceduralCharacterTier;
  seed: number;
  primaryColor: string;
  gait: ProceduralHorseGait;
  lead: ProceduralHorseLead;
  speed: number;
  strideScale: number;
  stepHeight: number;
  dutyFactorOffset: number;
  diagonalDissociation: number;
  suspension: number;
  turnRate: number;
  bodyPitch: number;
  bodyRoll: number;
  neckMotion: number;
  tailMotion: number;
  hoofPlant: number;
  motionVariation: number;
  secondaryMotion: number;
  terrainResponse: number;
  terrainAmplitude: number;
  terrainPreset: ProceduralHorseTerrainPreset;
  showBones: boolean;
  showHoofTargets: boolean;
  showSockets: boolean;
  wireframe: boolean;
}

const DEFAULT_CONFIG: ProceduralHorseConfig = {
  appearanceId: DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID,
  tier: 1,
  seed: 1337,
  primaryColor: "#49342b",
  gait: "walk",
  lead: "right",
  speed: 1.35,
  strideScale: 1,
  stepHeight: 0.22,
  dutyFactorOffset: 0,
  diagonalDissociation: 0.01,
  suspension: 0.07,
  turnRate: 0,
  bodyPitch: 0,
  bodyRoll: 0,
  neckMotion: 0.16,
  tailMotion: 0.2,
  hoofPlant: 1,
  motionVariation: 0.1,
  secondaryMotion: 0.76,
  terrainResponse: 0.72,
  terrainAmplitude: 0.18,
  terrainPreset: "flat",
  showBones: false,
  showHoofTargets: true,
  showSockets: true,
  wireframe: false,
};

export function createDefaultProceduralHorseConfig(): ProceduralHorseConfig {
  return { ...DEFAULT_CONFIG };
}

export function applyProceduralHorseConfigPatch(
  current: ProceduralHorseConfig,
  patch: Partial<ProceduralHorseConfig>,
): ProceduralHorseConfig {
  const input = { ...current, ...patch };
  return {
    ...input,
    appearanceId: normalizeProceduralHorseAppearanceId(input.appearanceId),
    tier: clampInteger(input.tier, 1, 3) as ProceduralCharacterTier,
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    primaryColor: normalizeColor(input.primaryColor),
    speed: clamp(input.speed, 0, 8),
    strideScale: clamp(input.strideScale, 0.45, 1.8),
    stepHeight: clamp(input.stepHeight, 0, 0.8),
    dutyFactorOffset: clamp(input.dutyFactorOffset, -0.2, 0.2),
    diagonalDissociation: clamp(input.diagonalDissociation, -0.04, 0.04),
    suspension: clamp(input.suspension, 0, 0.3),
    turnRate: clamp(input.turnRate, -2, 2),
    bodyPitch: clamp(input.bodyPitch, -0.35, 0.35),
    bodyRoll: clamp(input.bodyRoll, -0.35, 0.35),
    neckMotion: clamp(input.neckMotion, 0, 0.6),
    tailMotion: clamp(input.tailMotion, 0, 0.8),
    hoofPlant: clamp(input.hoofPlant, 0, 1),
    motionVariation: clamp(input.motionVariation, 0, 0.3),
    secondaryMotion: clamp(input.secondaryMotion, 0, 1.5),
    terrainResponse: clamp(input.terrainResponse, 0, 1),
    terrainAmplitude: clamp(input.terrainAmplitude, 0, 0.8),
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
