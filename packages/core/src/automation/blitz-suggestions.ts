import { BuildingType, ResourcesIds, type ID } from "@bibliothecadao/types";

import { type BuildOrder, type BuildOrderBuilding, type BuildOrderStep, DEFAULT_BUILD_ORDER } from "./build-order";

export type EmpireSuggestionAction =
  | "build-copper"
  | "build-coal"
  | "build-military"
  | "build-wheat"
  | "build-wood"
  | "build-worker-hut"
  | "upgrade";

export type BlitzBuildKey = "copper" | "coal" | "military" | "wheat" | "wood" | "workerHut";

type BlitzBuildability = {
  canBuild: boolean;
  reason?: string;
};

export type BlitzBuildingCounts = {
  copper: number;
  coal: number;
  crossbowmanT1: number;
  knightT1: number;
  paladinT1: number;
  wheat: number;
  wood: number;
  workerHut: number;
};

export type BlitzMilitaryTarget = {
  buildingType: BuildingType;
  count: number;
  label: string;
  resource: ResourcesIds;
  bonusPercent?: number;
};

export type BlitzRealmSuggestionInput = {
  realmId: ID;
  realmName: string;
  realmLevel: number;
  isBlitzActive: boolean;
  canAffordUpgrade: boolean;
  hasAvailableBuildingTile: boolean;
  buildingCounts: BlitzBuildingCounts;
  population: number;
  populationCapacity: number;
  militaryTarget?: BlitzMilitaryTarget | null;
  buildability: Record<BlitzBuildKey, BlitzBuildability>;
};

export type BlitzSuggestionDraft = {
  id: string;
  realmId: ID;
  realmName: string;
  action: EmpireSuggestionAction;
  label: string;
  buildingTypeHint?: BuildingType;
  resourceHint?: ResourcesIds;
  reason?: string;
  priority: number;
};

const MIN_AVAILABLE_POPULATION_BEFORE_WORKER_HUT = 3;

const BUILD_TARGETS: Record<
  BlitzBuildKey,
  {
    action: EmpireSuggestionAction;
    buildingType: BuildingType;
    label: string;
    priority: number;
    resource?: ResourcesIds;
  }
> = {
  wheat: {
    action: "build-wheat",
    buildingType: BuildingType.ResourceWheat,
    label: "Build wheat farm",
    priority: 10,
    resource: ResourcesIds.Wheat,
  },
  wood: {
    action: "build-wood",
    buildingType: BuildingType.ResourceWood,
    label: "Build wood camp",
    priority: 20,
    resource: ResourcesIds.Wood,
  },
  coal: {
    action: "build-coal",
    buildingType: BuildingType.ResourceCoal,
    label: "Build coal mine",
    priority: 30,
    resource: ResourcesIds.Coal,
  },
  copper: {
    action: "build-copper",
    buildingType: BuildingType.ResourceCopper,
    label: "Build copper mine",
    priority: 40,
    resource: ResourcesIds.Copper,
  },
  military: {
    action: "build-military",
    buildingType: BuildingType.None,
    label: "Build T1 military",
    priority: 60,
  },
  workerHut: {
    action: "build-worker-hut",
    buildingType: BuildingType.WorkersHut,
    label: "Build worker hut",
    priority: 5,
  },
};

/** An order's building, as the realm's own count and build target name it. */
const ORDER_KEYS: Record<BuildOrderBuilding, BlitzBuildKey> = {
  farm: "wheat",
  wood: "wood",
  coal: "coal",
  copper: "copper",
  hut: "workerHut",
  military: "military",
};

const createBaseSuggestion = (
  input: BlitzRealmSuggestionInput,
  action: EmpireSuggestionAction,
  label: string,
  priority: number,
  reason?: string,
): BlitzSuggestionDraft => ({
  id: `${input.realmId}-${action}`,
  realmId: input.realmId,
  realmName: input.realmName,
  action,
  label,
  reason,
  priority,
});

const createBuildSuggestion = (
  input: BlitzRealmSuggestionInput,
  key: BlitzBuildKey,
  reason: string,
): BlitzSuggestionDraft => {
  const target = BUILD_TARGETS[key];
  if (key === "military" && input.militaryTarget) {
    return {
      ...createBaseSuggestion(input, target.action, `Build ${input.militaryTarget.label}`, target.priority, reason),
      buildingTypeHint: input.militaryTarget.buildingType,
      resourceHint: input.militaryTarget.resource,
    };
  }
  return {
    ...createBaseSuggestion(input, target.action, target.label, target.priority, reason),
    buildingTypeHint: target.buildingType,
    resourceHint: target.resource,
  };
};

/** A build the realm can submit now: a free plot and the cost held, as the construction window would send it. */
const resolveBuildSuggestion = (
  input: BlitzRealmSuggestionInput,
  key: BlitzBuildKey,
  reason: string,
): BlitzSuggestionDraft | null =>
  input.hasAvailableBuildingTile && input.buildability[key]?.canBuild === true
    ? createBuildSuggestion(input, key, reason)
    : null;

/** How many of a target are built, in words: "1 of 4 built". */
const builtOf = (count: number, target: number): string => `${count} of ${target} built`;

const resolveUpgradeSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null =>
  input.canAffordUpgrade ? createBaseSuggestion(input, "upgrade", "Level up realm", 0, "It can level up now.") : null;

const isPopulationPressured = ({ population, populationCapacity }: BlitzRealmSuggestionInput) =>
  populationCapacity > 0 && populationCapacity - population <= MIN_AVAILABLE_POPULATION_BEFORE_WORKER_HUT;

const resolvePopulationSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null =>
  isPopulationPressured(input)
    ? resolveBuildSuggestion(
        input,
        "workerHut",
        `Population ${input.population} of ${input.populationCapacity}: a worker hut makes room for more.`,
      )
    : null;

/** What a step counts, in words: "Wood camps", "Knight T1 buildings". */
const STEP_NAMES: Record<Exclude<BuildOrderBuilding, "military">, string> = {
  farm: "Wheat farms",
  wood: "Wood camps",
  coal: "Coal mines",
  copper: "Copper mines",
  hut: "Worker huts",
};
const stepName = (input: BlitzRealmSuggestionInput, building: BuildOrderBuilding): string =>
  building === "military" ? `${input.militaryTarget?.label ?? "T1 military"} buildings` : STEP_NAMES[building];

/** How many of a step's building the realm has; a realm with no military worth its biome has none to build. */
const builtFor = (input: BlitzRealmSuggestionInput, step: BuildOrderStep): number | null => {
  const key = ORDER_KEYS[step.building];
  if (key !== "military") return input.buildingCounts[key];
  return input.militaryTarget ? input.militaryTarget.count : null;
};

/**
 * The order's next step for the realm: the first step of its rank or lower it has not met, offered only once it can be
 * taken. An order is a sequence: a step waiting on resources holds the ones after it.
 */
const resolveOrderSuggestion = (input: BlitzRealmSuggestionInput, order: BuildOrder): BlitzSuggestionDraft | null => {
  const next = order.steps.find((step) => {
    const built = builtFor(input, step);
    return step.rank <= input.realmLevel && built !== null && built < step.count;
  });
  if (!next) return null;
  return resolveBuildSuggestion(
    input,
    ORDER_KEYS[next.building],
    `${stepName(input, next.building)}: ${builtOf(builtFor(input, next) ?? 0, next.count)}.`,
  );
};

/**
 * A realm's one next step in a running Blitz: level up whenever it can, a worker hut whenever population is 3 from
 * full, then the order's next step. The default order is the owner's.
 */
export const buildBlitzRealmSuggestions = (
  input: BlitzRealmSuggestionInput,
  order: BuildOrder = DEFAULT_BUILD_ORDER,
): BlitzSuggestionDraft[] => {
  if (!input.isBlitzActive) return [];
  const suggestion =
    resolveUpgradeSuggestion(input) ?? resolvePopulationSuggestion(input) ?? resolveOrderSuggestion(input, order);
  return suggestion ? [suggestion] : [];
};
