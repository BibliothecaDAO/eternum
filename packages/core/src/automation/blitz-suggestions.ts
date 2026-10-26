import {
  BuildingType,
  formatExact,
  formatPopulationInWords,
  ResourcesIds,
  TroopTier,
  type ID,
  type TroopType,
} from "@bibliothecadao/types";

import { type BuildOrder, type BuildOrderGoal, type BuildOrderStep, DEFAULT_BUILD_ORDER } from "./build-order";

export type EmpireSuggestionAction =
  | "build-copper"
  | "build-coal"
  | "build-military"
  | "build-wheat"
  | "build-wood"
  | "build-worker-hut"
  | "deploy-army"
  | "upgrade";

export type BlitzBuildKey = "copper" | "coal" | "military" | "wheat" | "wood" | "workerHut";

type BlitzBuildability = {
  canBuild: boolean;
  reason?: string;
  /** The realm's population has no room for it: the construction rule's own verdict. */
  needsRoom: boolean;
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
  /** The T1 troop its barracks trains. */
  troopType: TroopType;
  bonusPercent?: number;
};

/** The realm's field armies, as the order's army step reads them: their troop is the military target's. */
export type BlitzArmyState = {
  /** Its living field armies. */
  armies: number;
  /** Its field army slots. */
  maxArmies: number;
  /** Whole troops of that kind on hand. */
  troops: number;
  /** The most troops of that kind one army holds at the realm's level: a full army. */
  fullArmy: number;
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
  /** Its field armies of the military target's troop; none without a target. */
  army: BlitzArmyState | null;
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
  /** The troops a Deploy step names: the realm's troop, a full army of it, which the deployment opens on. */
  troops?: { type: TroopType; tier: TroopTier; count: number };
  reason?: string;
  priority: number;
};

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
type OrderBuilding = Exclude<BuildOrderGoal, "army">;
const ORDER_KEYS: Record<OrderBuilding, BlitzBuildKey> = {
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

/** What a step counts, in words: "Wood camps", "Knight T1 buildings". */
const STEP_NAMES: Record<Exclude<OrderBuilding, "military">, string> = {
  farm: "Wheat farms",
  wood: "Wood camps",
  coal: "Coal mines",
  copper: "Copper mines",
  hut: "Worker huts",
};
const stepName = (input: BlitzRealmSuggestionInput, building: OrderBuilding): string =>
  building === "military" ? `${input.militaryTarget?.label ?? "T1 military"} buildings` : STEP_NAMES[building];

/** How many of a building the realm has; a realm with no military worth its biome has none to build. */
const builtFor = (input: BlitzRealmSuggestionInput, building: OrderBuilding): number | null => {
  const key = ORDER_KEYS[building];
  if (key !== "military") return input.buildingCounts[key];
  return input.militaryTarget ? input.militaryTarget.count : null;
};

/**
 * A step's verdict for the realm: it passes (met, or under way by itself), it holds the order (it waits on what the
 * realm must pay), or it is the step to take now.
 */
type StepVerdict = "passes" | "holds" | BlitzSuggestionDraft;

/**
 * A building step: built, or the build itself; a worker hut first when the realm's population has no room for it, and
 * only then, so housing never comes before a step that does not need it.
 */
const resolveBuildingStep = (input: BlitzRealmSuggestionInput, building: OrderBuilding, count: number): StepVerdict => {
  const built = builtFor(input, building);
  if (built === null || built >= count) return "passes";
  const key = ORDER_KEYS[building];
  const progress = `${stepName(input, building)}: ${builtOf(built, count)}.`;
  const take = input.buildability[key].needsRoom
    ? resolveBuildSuggestion(
        input,
        "workerHut",
        `${progress} ${formatPopulationInWords(input.population, input.populationCapacity)}: a worker hut makes room.`,
      )
    : resolveBuildSuggestion(input, key, progress);
  return take ?? "holds";
};

/**
 * An army step: the realm's barracks, then the army deployed once a full one is on hand. The barracks' troops are the
 * production automation's to train, so until a full army stands the step passes and the order goes on building; a step
 * the realm cannot field (no free slot) passes too.
 */
const resolveArmyStep = (input: BlitzRealmSuggestionInput, count: number): StepVerdict => {
  const { army, militaryTarget } = input;
  if (!army || !militaryTarget || army.armies >= count || army.armies >= army.maxArmies) return "passes";
  if (army.fullArmy > 0 && army.troops >= army.fullArmy) return createDeploySuggestion(input, militaryTarget, army);
  return militaryTarget.count === 0 ? resolveBuildingStep(input, "military", 1) : "passes";
};

/** The army deployed: a full army of the realm's own troop, which its barracks trains, for the deployment to open on. */
const createDeploySuggestion = (
  input: BlitzRealmSuggestionInput,
  target: BlitzMilitaryTarget,
  army: BlitzArmyState,
): BlitzSuggestionDraft => ({
  ...createBaseSuggestion(
    input,
    "deploy-army",
    "Deploy an army",
    50,
    `${target.label}: ${formatExact(army.troops)} on hand, a full army of ${formatExact(army.fullArmy)}.`,
  ),
  buildingTypeHint: target.buildingType,
  resourceHint: target.resource,
  troops: { type: target.troopType, tier: TroopTier.T1, count: army.fullArmy },
});

const resolveStep = (input: BlitzRealmSuggestionInput, step: BuildOrderStep): StepVerdict =>
  step.goal === "army" ? resolveArmyStep(input, step.count) : resolveBuildingStep(input, step.goal, step.count);

/**
 * The order's next step for the realm: the first step of its rank or lower that does not pass, offered only once it
 * can be taken. An order is a sequence: a step waiting on resources holds the ones after it.
 */
const resolveOrderSuggestion = (input: BlitzRealmSuggestionInput, order: BuildOrder): BlitzSuggestionDraft | null => {
  for (const step of order.steps) {
    if (step.rank > input.realmLevel) continue;
    const verdict = resolveStep(input, step);
    if (verdict === "holds") return null;
    if (verdict !== "passes") return verdict;
  }
  return null;
};

/**
 * A realm's one next step in a running Blitz: level up whenever it can, then the order's next step. The default order
 * is the owner's.
 */
export const buildBlitzRealmSuggestions = (
  input: BlitzRealmSuggestionInput,
  order: BuildOrder = DEFAULT_BUILD_ORDER,
): BlitzSuggestionDraft[] => {
  if (!input.isBlitzActive) return [];
  const suggestion = resolveUpgradeSuggestion(input) ?? resolveOrderSuggestion(input, order);
  return suggestion ? [suggestion] : [];
};
