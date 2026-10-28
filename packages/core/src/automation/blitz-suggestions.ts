import {
  BuildingType,
  buildingName,
  formatExact,
  formatPopulationInWords,
  type ID,
  type ResourcesIds,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import {
  blitzBuildingResource,
  type BuildOrder,
  type BuildOrderStep,
  buildOrderTarget,
  DEFAULT_BUILD_ORDER,
} from "./build-order";

export type EmpireSuggestionAction = "build" | "deploy-army" | "upgrade";

export type BlitzBuildability = {
  canBuild: boolean;
  reason?: string;
  /** The realm's population has no room for it: the construction rule's own verdict. */
  needsRoom: boolean;
};

/** One tier of the troop the realm's biome favours: the building that trains it and the troops it trains. */
export type BlitzTroopTier = { building: BuildingType; resource: ResourcesIds };

/** The troop the realm's biome favours: the troop its order's barracks and armies mean. */
export type BlitzTroop = {
  type: TroopType;
  tiers: Record<TroopTier, BlitzTroopTier>;
};

/** A living field army: its troop and tier. */
export type BlitzArmy = { type: TroopType; tier: TroopTier };

/** The realm's field armies, as the order's army steps read them. */
export type BlitzArmyState = {
  /** Its living field armies: all of them fill its slots, and an army step counts those of its own troop and tier. */
  armies: readonly BlitzArmy[];
  /** Its field army slots. */
  maxArmies: number;
  /** Whole troops of a kind on hand. */
  troopsOnHand: (resource: ResourcesIds) => number;
  /** The most troops of a tier one army holds at the realm's level: a full army. */
  fullArmy: (tier: TroopTier) => number;
};

export type BlitzRealmSuggestionInput = {
  realmId: ID;
  realmName: string;
  realmLevel: number;
  isBlitzActive: boolean;
  canAffordUpgrade: boolean;
  hasAvailableBuildingTile: boolean;
  /** How many of a building the realm has. */
  built: (building: BuildingType) => number;
  /** Whether the realm can build it now, as the construction window judges it. */
  buildability: (building: BuildingType) => BlitzBuildability;
  population: number;
  populationCapacity: number;
  /** The troop its biome favours; none where no troop has a biome edge. */
  troop: BlitzTroop | null;
  army: BlitzArmyState;
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

/** The realms' next steps across realms, by kind: a level up, a hut, a build, an army. */
const PRIORITY = { upgrade: 0, hut: 5, build: 10, deploy: 50 } as const;

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

/** A build the realm can submit now: a free plot and the cost held, as the construction window would send it. */
const resolveBuildSuggestion = (
  input: BlitzRealmSuggestionInput,
  building: BuildingType,
  reason: string,
): BlitzSuggestionDraft | null => {
  if (!input.hasAvailableBuildingTile || !input.buildability(building).canBuild) return null;
  const priority = building === BuildingType.WorkersHut ? PRIORITY.hut : PRIORITY.build;
  return {
    ...createBaseSuggestion(input, "build", `Build ${buildingName(building, false)}`, priority, reason),
    buildingTypeHint: building,
    resourceHint: blitzBuildingResource(building),
  };
};

const resolveUpgradeSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null =>
  input.canAffordUpgrade
    ? createBaseSuggestion(input, "upgrade", "Level up realm", PRIORITY.upgrade, "It can level up now.")
    : null;

/**
 * A step's verdict for the realm: it passes (met, or under way by itself), it holds the order (it waits on what the
 * realm must pay), or it is the step to take now.
 */
type StepVerdict = "passes" | "holds" | BlitzSuggestionDraft;

/**
 * A building step: built, or the build itself; a worker hut first when the realm's population has no room for it, and
 * only then, so housing never comes before a step that does not need it.
 */
const resolveBuildingStep = (input: BlitzRealmSuggestionInput, building: BuildingType, count: number): StepVerdict => {
  const built = input.built(building);
  if (built >= count) return "passes";
  const progress = `${buildingName(building, false)}: ${built} of ${count} built.`;
  const take = input.buildability(building).needsRoom
    ? resolveBuildSuggestion(
        input,
        BuildingType.WorkersHut,
        `${progress} ${formatPopulationInWords(input.population, input.populationCapacity)}: a worker hut makes room.`,
      )
    : resolveBuildSuggestion(input, building, progress);
  return take ?? "holds";
};

/** A barracks step: the biome troop's building at the tier; a realm whose biome favours no troop has none to build. */
const resolveBarracksStep = (input: BlitzRealmSuggestionInput, tier: TroopTier, count: number): StepVerdict =>
  input.troop ? resolveBuildingStep(input, input.troop.tiers[tier].building, count) : "passes";

/**
 * An army step: the biome troop's barracks at the tier, then the army deployed once a full one of that tier is on hand.
 * It is met by armies of that troop and tier only; every army fills a slot. The barracks' troops are the production
 * automation's to train, so until a full army stands the step passes and the order goes on building; a step the realm
 * cannot field (no free slot) passes too.
 */
const resolveArmyStep = (input: BlitzRealmSuggestionInput, tier: TroopTier, count: number): StepVerdict => {
  const { army, troop } = input;
  if (!troop || army.armies.length >= army.maxArmies) return "passes";
  if (fieldedArmies(army, troop.type, tier) >= count) return "passes";
  const { building, resource } = troop.tiers[tier];
  const full = army.fullArmy(tier);
  const onHand = army.troopsOnHand(resource);
  if (full > 0 && onHand >= full) return createDeploySuggestion(input, troop, tier, onHand, full);
  return input.built(building) === 0 ? resolveBuildingStep(input, building, 1) : "passes";
};

/** How many of the realm's living armies are of a troop at a tier. */
const fieldedArmies = (army: BlitzArmyState, type: TroopType, tier: TroopTier): number =>
  army.armies.filter((fielded) => fielded.type === type && fielded.tier === tier).length;

/** The army deployed: a full army of the realm's own troop at the tier, for the deployment to open on. */
const createDeploySuggestion = (
  input: BlitzRealmSuggestionInput,
  troop: BlitzTroop,
  tier: TroopTier,
  onHand: number,
  full: number,
): BlitzSuggestionDraft => {
  const { building, resource } = troop.tiers[tier];
  return {
    ...createBaseSuggestion(
      input,
      "deploy-army",
      "Deploy an army",
      PRIORITY.deploy,
      `${buildingName(building, false)}: ${formatExact(onHand)} on hand, a full army of ${formatExact(full)}.`,
    ),
    buildingTypeHint: building,
    resourceHint: resource,
    troops: { type: troop.type, tier, count: full },
  };
};

/**
 * A level up the order places: done once the realm is past its rank; at its rank, the level up when the realm can pay
 * for it, else the order waits for it.
 */
const resolveLevelUpStep = (input: BlitzRealmSuggestionInput, step: BuildOrderStep): StepVerdict =>
  step.rank < input.realmLevel ? "passes" : (resolveUpgradeSuggestion(input) ?? "holds");

const resolveStep = (input: BlitzRealmSuggestionInput, step: BuildOrderStep): StepVerdict => {
  const target = buildOrderTarget(step.goal);
  if (target.kind === "building") return resolveBuildingStep(input, target.building, step.count);
  if (target.kind === "barracks") return resolveBarracksStep(input, target.tier, step.count);
  if (target.kind === "army") return resolveArmyStep(input, target.tier, step.count);
  return resolveLevelUpStep(input, step);
};

/** Whether the order places the realm's level up at its rank itself, so it waits its turn instead of coming first. */
const ordersLevelUp = (input: BlitzRealmSuggestionInput, order: BuildOrder): boolean =>
  order.steps.some((step) => step.goal === "levelUp" && step.rank === input.realmLevel);

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
 * A realm's one next step in a running Blitz: level up whenever it can (unless the order places that level up itself),
 * then the order's next step. The default order is the owner's.
 */
export const buildBlitzRealmSuggestions = (
  input: BlitzRealmSuggestionInput,
  order: BuildOrder = DEFAULT_BUILD_ORDER,
): BlitzSuggestionDraft[] => {
  if (!input.isBlitzActive) return [];
  const levelUpFirst = ordersLevelUp(input, order) ? null : resolveUpgradeSuggestion(input);
  const suggestion = levelUpFirst ?? resolveOrderSuggestion(input, order);
  return suggestion ? [suggestion] : [];
};
