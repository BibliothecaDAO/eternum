import { Vector3 } from "three";

import type { PersistentWorldFxEmitter, WorldFxImpactCue } from "../fx/world-fx-runtime";

export const WORLD_FX_GYM_COUNTS = [1, 10, 50] as const;
export const WORLD_FX_GYM_SCENARIOS = ["flame", "impact", "mixed"] as const;

export type WorldFxGymCount = (typeof WORLD_FX_GYM_COUNTS)[number];
export type WorldFxGymScenario = (typeof WORLD_FX_GYM_SCENARIOS)[number];

export interface WorldFxGymFixture {
  flameEmitters: PersistentWorldFxEmitter[];
  impactCues: WorldFxImpactCue[];
  positions: Vector3[];
  span: number;
}

const CELL_SPACING = 2.35;

export function createWorldFxGymFixture(input: {
  count: WorldFxGymCount;
  scenario: WorldFxGymScenario;
  seed: number;
}): WorldFxGymFixture {
  const positions = createCenteredGrid(input.count);
  const flameEmitters =
    input.scenario === "impact" ? [] : positions.map((position, index) => createFlame(position, input.seed, index));
  const impactCues =
    input.scenario === "flame" ? [] : positions.map((position, index) => createImpact(position, input.seed, index));
  const columns = Math.ceil(Math.sqrt(input.count));
  return {
    flameEmitters,
    impactCues,
    positions,
    span: Math.max(3, (columns - 1) * CELL_SPACING + 3),
  };
}

export function resolveWorldFxGymCount(value: string | null): WorldFxGymCount {
  const parsed = Number(value);
  return WORLD_FX_GYM_COUNTS.includes(parsed as WorldFxGymCount) ? (parsed as WorldFxGymCount) : 10;
}

export function resolveWorldFxGymScenario(value: string | null): WorldFxGymScenario {
  return WORLD_FX_GYM_SCENARIOS.includes(value as WorldFxGymScenario) ? (value as WorldFxGymScenario) : "mixed";
}

export function resolveWorldFxGymSeed(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) >>> 0 : 20_260_902;
}

function createCenteredGrid(count: number): Vector3[] {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const zOffset = ((rows - 1) * CELL_SPACING) / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, count - row * columns);
    const rowXOffset = ((rowCount - 1) * CELL_SPACING) / 2;
    return new Vector3(column * CELL_SPACING - rowXOffset, 0.18, row * CELL_SPACING - zOffset);
  });
}

function createFlame(position: Vector3, seed: number, index: number): PersistentWorldFxEmitter {
  return {
    id: `gym-flame:${index}`,
    intensity: 0.9 + deterministicUnit(seed, index, 11) * 0.3,
    kind: "flame",
    position,
    scale: 1.15 + deterministicUnit(seed, index, 17) * 0.55,
    seed: mixSeed(seed, index, 23),
  };
}

function createImpact(position: Vector3, seed: number, index: number): WorldFxImpactCue {
  return {
    kind: "impact",
    normal: new Vector3(0, 1, 0),
    position: new Vector3(position.x, 0.08, position.z),
    scale: 1.05 + deterministicUnit(seed, index, 29) * 0.6,
    seed: mixSeed(seed, index, 31),
    tone: index % 3 === 2 ? "arcane" : "physical",
  };
}

function deterministicUnit(seed: number, index: number, salt: number): number {
  return mixSeed(seed, index, salt) / 4_294_967_296;
}

function mixSeed(seed: number, index: number, salt: number): number {
  let value = (seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}
