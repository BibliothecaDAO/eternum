import { ResourcesIds } from "@bibliothecadao/types";
import { Vector3 } from "three";

import type { PersistentWorldFxEmitter, TransientWorldFxCue } from "../fx/world-fx-runtime";
import type { ResourceFlowSnapshot } from "../fx/resource-flow-layer";

const WORLD_FX_GYM_COUNTS = [1, 10, 50] as const;
const WORLD_FX_GYM_SCENARIOS = [
  "aura",
  "beam",
  "dragon-breath",
  "explosion",
  "flame",
  "impact",
  "mixed",
  "projectile-trail",
  "resource-flow",
  "resource-flow-stress",
  "realm-flame",
  "shockwave",
] as const;
const WORLD_FX_GYM_VIEWS = ["detail", "gameplay"] as const;

export type WorldFxGymCount = (typeof WORLD_FX_GYM_COUNTS)[number];
export type WorldFxGymScenario = (typeof WORLD_FX_GYM_SCENARIOS)[number];
export type WorldFxGymView = (typeof WORLD_FX_GYM_VIEWS)[number];

export interface WorldFxGymFixture {
  persistentEmitters: PersistentWorldFxEmitter[];
  positions: Vector3[];
  resourceFlows: ResourceFlowSnapshot[];
  span: number;
  stageKind: "pedestals" | "realm" | "resource-map";
  transientCues: TransientWorldFxCue[];
}

interface ResourceFlowGymLegendEntry {
  from: string;
  resourceIds: number[];
  to: string;
}

const CELL_SPACING = 2.35;
const REALM_FLAME_SITES = [
  { intensity: 0.82, position: new Vector3(-0.46, 0.54, 0.42), scale: 0.3 },
  { intensity: 1, position: new Vector3(0.08, 1.12, 0.22), scale: 0.38 },
  { intensity: 0.78, position: new Vector3(0.46, 0.54, -0.42), scale: 0.28 },
] as const;
const RESOURCE_FLOW_MAP_SITES = [
  { entityId: 101, name: "Emberfall", position: new Vector3(-3.1, 0, -1.8) },
  { entityId: 102, name: "Highgarden", position: new Vector3(2.9, 0, -2.1) },
  { entityId: 103, name: "Stonehaven", position: new Vector3(-2.6, 0, 2.2) },
  { entityId: 104, name: "Seawatch", position: new Vector3(2.8, 0, 2.3) },
  { entityId: 105, name: "Crossroads", position: new Vector3(0, 0, 0.15) },
] as const;

export const RESOURCE_FLOW_GYM_LEGEND: ResourceFlowGymLegendEntry[] = [
  { from: "Emberfall", resourceIds: [ResourcesIds.Wood, ResourcesIds.Wheat], to: "Seawatch" },
  { from: "Stonehaven", resourceIds: [ResourcesIds.Gold], to: "Highgarden" },
  {
    from: "Crossroads",
    resourceIds: [ResourcesIds.Stone, ResourcesIds.Coal, ResourcesIds.Donkey],
    to: "Emberfall",
  },
  { from: "Seawatch", resourceIds: [ResourcesIds.Mithral, ResourcesIds.TrueIce], to: "Stonehaven" },
];

export function createWorldFxGymFixture(input: {
  count: WorldFxGymCount;
  scenario: WorldFxGymScenario;
  seed: number;
}): WorldFxGymFixture {
  if (input.scenario === "realm-flame") return createRealmFlameFixture(input.seed);
  if (input.scenario === "resource-flow") return createResourceFlowFixture(input.seed);
  if (input.scenario === "resource-flow-stress") return createResourceFlowStressFixture(input.seed);

  const positions = createCenteredGrid(input.count);
  const columns = Math.ceil(Math.sqrt(input.count));
  return {
    persistentEmitters: createPersistentEmitters(input.scenario, positions, input.seed),
    positions,
    resourceFlows: [],
    span: Math.max(3, (columns - 1) * CELL_SPACING + 3),
    stageKind: "pedestals",
    transientCues: createTransientCues(input.scenario, positions, input.seed),
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

export function resolveWorldFxGymView(value: string | null): WorldFxGymView {
  return WORLD_FX_GYM_VIEWS.includes(value as WorldFxGymView) ? (value as WorldFxGymView) : "detail";
}

function createRealmFlameFixture(seed: number): WorldFxGymFixture {
  const positions = REALM_FLAME_SITES.map(({ position }) => position.clone());
  return {
    persistentEmitters: REALM_FLAME_SITES.map(({ intensity, position, scale }, index) => ({
      id: `gym-realm-flame:${index}`,
      intensity,
      kind: "flame",
      position: position.clone(),
      scale,
      seed: mixSeed(seed, index, 211),
    })),
    positions,
    resourceFlows: [],
    span: 3,
    stageKind: "realm",
    transientCues: [],
  };
}

function createResourceFlowFixture(seed: number): WorldFxGymFixture {
  const positionByName = new Map<string, (typeof RESOURCE_FLOW_MAP_SITES)[number]>(
    RESOURCE_FLOW_MAP_SITES.map((site) => [site.name, site]),
  );
  const resolveSite = (name: string) => {
    const site = positionByName.get(name);
    if (!site) throw new Error(`Unknown resource flow gym site: ${name}`);
    return site;
  };
  return {
    persistentEmitters: [],
    positions: RESOURCE_FLOW_MAP_SITES.map(({ position }) => position.clone()),
    resourceFlows: RESOURCE_FLOW_GYM_LEGEND.map((entry, index) => {
      const source = resolveSite(entry.from);
      const target = resolveSite(entry.to);
      return {
        id: `gym-resource-flow:${source.entityId}:${target.entityId}`,
        resources: entry.resourceIds.map((resourceId, resourceIndex) => ({
          amount: 250 * (resourceIndex + 1) * (index + 1),
          resourceId,
        })),
        seed: mixSeed(seed, index, 419),
        source: source.position.clone(),
        sourceEntityId: source.entityId,
        target: target.position.clone(),
        targetEntityId: target.entityId,
      };
    }),
    span: 9,
    stageKind: "resource-map",
    transientCues: [],
  };
}

function createResourceFlowStressFixture(seed: number): WorldFxGymFixture {
  const resourceIds = [
    ResourcesIds.Stone,
    ResourcesIds.Wood,
    ResourcesIds.Gold,
    ResourcesIds.Mithral,
    ResourcesIds.Wheat,
    ResourcesIds.TrueIce,
  ];
  const positions = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return new Vector3(Math.cos(angle) * 4.4, 0, Math.sin(angle) * 4.4);
  });
  return {
    persistentEmitters: [],
    positions,
    resourceFlows: Array.from({ length: 50 }, (_, index) => {
      const sourceIndex = index % positions.length;
      const targetIndex = (index * 5 + 3) % positions.length;
      return {
        id: `gym-resource-flow-stress:${index}`,
        resources: Array.from({ length: 1 + (index % 3) }, (_, resourceIndex) => ({
          amount: 100 * (index + 1) * (resourceIndex + 1),
          resourceId: resourceIds[(index + resourceIndex) % resourceIds.length],
        })),
        seed: mixSeed(seed, index, 431),
        source: positions[sourceIndex],
        sourceEntityId: 200 + sourceIndex,
        target: positions[targetIndex],
        targetEntityId: 200 + targetIndex,
      };
    }),
    span: 12,
    stageKind: "resource-map",
    transientCues: [],
  };
}

function createPersistentEmitters(
  scenario: WorldFxGymScenario,
  positions: readonly Vector3[],
  seed: number,
): PersistentWorldFxEmitter[] {
  if (scenario === "flame") {
    return positions.map((position, index) => createFlame(position, seed, index));
  }
  if (scenario === "mixed") {
    return positions.flatMap((position, index) => (index % 4 === 0 ? [createFlame(position, seed, index)] : []));
  }
  if (scenario === "aura") {
    return positions.map((position, index) => ({
      id: `gym-aura:${index}`,
      intensity: 0.85 + deterministicUnit(seed, index, 353) * 0.25,
      kind: "aura",
      position: new Vector3(position.x, 0.1, position.z),
      scale: 0.72 + deterministicUnit(seed, index, 359) * 0.32,
      seed: mixSeed(seed, index, 367),
      style: (["healing", "shield", "capture"] as const)[index % 3],
    }));
  }
  return [];
}

function createTransientCues(
  scenario: WorldFxGymScenario,
  positions: readonly Vector3[],
  seed: number,
): TransientWorldFxCue[] {
  if (
    scenario === "flame" ||
    scenario === "aura" ||
    scenario === "realm-flame" ||
    scenario === "resource-flow" ||
    scenario === "resource-flow-stress"
  ) {
    return [];
  }
  const mixedScenarios = ["impact", "explosion", "shockwave", "projectile-trail", "beam", "dragon-breath"] as const;
  return positions.map((position, index) =>
    createTransientCue(
      scenario === "mixed" ? mixedScenarios[index % mixedScenarios.length] : scenario,
      position,
      seed,
      index,
    ),
  );
}

function createTransientCue(
  scenario: Exclude<
    WorldFxGymScenario,
    "aura" | "flame" | "mixed" | "realm-flame" | "resource-flow" | "resource-flow-stress"
  >,
  position: Vector3,
  seed: number,
  index: number,
): TransientWorldFxCue {
  const cueSeed = mixSeed(seed, index, 31);
  const scale = 1.05 + deterministicUnit(seed, index, 29) * 0.6;
  if (scenario === "beam" || scenario === "dragon-breath" || scenario === "projectile-trail") {
    return {
      from: new Vector3(position.x - 0.72, 0.32, position.z - 0.18),
      kind: scenario,
      scale,
      seed: cueSeed,
      to: new Vector3(position.x + 0.72, 0.74, position.z + 0.18),
      tone: scenario === "dragon-breath" ? "fire" : index % 3 === 1 ? "healing" : "arcane",
    };
  }
  return {
    kind: scenario,
    normal: new Vector3(0, 1, 0),
    position: new Vector3(position.x, 0.08, position.z),
    scale,
    seed: cueSeed,
    tone: scenario === "explosion" ? "fire" : index % 3 === 2 ? "arcane" : "physical",
  };
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
