export interface ProceduralCharacterBenchmarkConfig {
  actorCount: number;
  animationUpdateLanes: number;
  animationSpeed: number;
  archerVolleys: boolean;
  meleeAttacks: boolean;
  autoRotate: boolean;
  characterScale: number;
  corpseSeconds: number;
  deathsPerSecond: number;
  maxActiveRagdolls: number;
  movementSpeed: number;
  pixelRatio: number;
  seed: number;
  shadows: boolean;
  simulationSpeed: number;
  stepHeight: number;
  stride: number;
  unitMix: "archers" | "balanced" | "foot" | "horses" | "melee" | "mounted";
}

const DEFAULT_CONFIG: ProceduralCharacterBenchmarkConfig = {
  actorCount: 100,
  animationUpdateLanes: 3,
  animationSpeed: 1.15,
  archerVolleys: true,
  meleeAttacks: true,
  autoRotate: false,
  characterScale: 0.46,
  corpseSeconds: 4,
  deathsPerSecond: 2,
  maxActiveRagdolls: 8,
  movementSpeed: 0.72,
  pixelRatio: 1,
  seed: 424_242,
  shadows: false,
  simulationSpeed: 1,
  stepHeight: 0.28,
  stride: 0.68,
  unitMix: "balanced",
};

export function createDefaultProceduralCharacterBenchmarkConfig(): ProceduralCharacterBenchmarkConfig {
  return { ...DEFAULT_CONFIG };
}

export function applyProceduralCharacterBenchmarkConfigPatch(
  current: ProceduralCharacterBenchmarkConfig,
  patch: Partial<ProceduralCharacterBenchmarkConfig>,
): ProceduralCharacterBenchmarkConfig {
  const input = { ...current, ...patch };
  return {
    ...input,
    actorCount: clampInteger(input.actorCount, 1, 100),
    animationUpdateLanes: clampInteger(input.animationUpdateLanes, 1, 4),
    animationSpeed: clamp(input.animationSpeed, 0, 3),
    characterScale: clamp(input.characterScale, 0.2, 0.8),
    corpseSeconds: clamp(input.corpseSeconds, 0.5, 12),
    deathsPerSecond: clamp(input.deathsPerSecond, 0, 10),
    maxActiveRagdolls: clampInteger(input.maxActiveRagdolls, 0, 20),
    movementSpeed: clamp(input.movementSpeed, 0.1, 3),
    pixelRatio: clamp(input.pixelRatio, 0.75, 1.5),
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    simulationSpeed: clamp(input.simulationSpeed, 0.1, 3),
    stepHeight: clamp(input.stepHeight, 0, 0.8),
    stride: clamp(input.stride, 0, 1.4),
  };
}

export function createProceduralCharacterWalkingPerformanceConfig(): ProceduralCharacterBenchmarkConfig {
  return applyProceduralCharacterBenchmarkConfigPatch(createDefaultProceduralCharacterBenchmarkConfig(), {
    actorCount: 100,
    animationUpdateLanes: 3,
    archerVolleys: false,
    autoRotate: false,
    deathsPerSecond: 0,
    maxActiveRagdolls: 0,
    meleeAttacks: false,
    pixelRatio: 1,
    shadows: false,
    unitMix: "foot",
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
