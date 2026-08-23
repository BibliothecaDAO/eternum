export type ProceduralCollisionGymScenario =
  | "arrow-defeat"
  | "arrow-nonlethal"
  | "crowd"
  | "crossflow"
  | "foot-vs-mounted"
  | "glancing"
  | "head-on";

export interface ProceduralCollisionGymConfig {
  actorCount: number;
  enabled: boolean;
  scenario: ProceduralCollisionGymScenario;
  seed: number;
  showDebug: boolean;
  speed: number;
}

const DEFAULT_CONFIG: ProceduralCollisionGymConfig = {
  actorCount: 12,
  enabled: false,
  scenario: "head-on",
  seed: 7_331,
  showDebug: true,
  speed: 1.25,
};

export const PROCEDURAL_COLLISION_GYM_SCENARIOS: ReadonlyArray<{
  id: ProceduralCollisionGymScenario;
  label: string;
}> = [
  { id: "head-on", label: "Equal head-on" },
  { id: "glancing", label: "Glancing pass" },
  { id: "foot-vs-mounted", label: "Foot vs mounted" },
  { id: "crossflow", label: "Anchored crossing" },
  { id: "arrow-nonlethal", label: "Arrow nonlethal" },
  { id: "arrow-defeat", label: "Arrow defeat" },
  { id: "crowd", label: "Crowd stress" },
];

export function createDefaultProceduralCollisionGymConfig(): ProceduralCollisionGymConfig {
  return { ...DEFAULT_CONFIG };
}

export function applyProceduralCollisionGymConfigPatch(
  current: ProceduralCollisionGymConfig,
  patch: Partial<ProceduralCollisionGymConfig>,
): ProceduralCollisionGymConfig {
  const input = { ...current, ...patch };
  return {
    actorCount: clampInteger(input.actorCount, 2, 100),
    enabled: Boolean(input.enabled),
    scenario: PROCEDURAL_COLLISION_GYM_SCENARIOS.some(({ id }) => id === input.scenario)
      ? input.scenario
      : DEFAULT_CONFIG.scenario,
    seed: clampInteger(input.seed, 0, 2_147_483_647),
    showDebug: Boolean(input.showDebug),
    speed: clamp(input.speed, 0.1, 4),
  };
}

export function resolveCollisionGymActorCount(config: ProceduralCollisionGymConfig): number {
  if (config.scenario === "head-on" || config.scenario === "glancing" || config.scenario === "foot-vs-mounted")
    return 2;
  if (config.scenario === "arrow-defeat" || config.scenario === "arrow-nonlethal") return 2;
  return config.actorCount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.round(clamp(value, minimum, maximum));
}
