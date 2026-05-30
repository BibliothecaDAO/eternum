import { BuildingType, ResourcesIds, type ID } from "@bibliothecadao/types";

export type EmpireSuggestionAction =
  | "build-copper"
  | "build-coal"
  | "build-first"
  | "build-military"
  | "build-market"
  | "build-wheat"
  | "build-wood"
  | "build-worker-hut"
  | "expand-population"
  | "garrison"
  | "provision"
  | "upgrade"
  | "upgrade-and-provision";

export type BlitzBuildKey = "copper" | "coal" | "market" | "military" | "wheat" | "wood" | "workerHut";

type BlitzBuildability = {
  canBuild: boolean;
  reason?: string;
};

export type BlitzBuildingCounts = {
  copper: number;
  coal: number;
  crossbowmanT1: number;
  knightT1: number;
  market: number;
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
  canProvision: boolean;
  canAffordUpgrade: boolean;
  hasAvailableBuildingTile: boolean;
  buildingTilesOccupied: number | null;
  buildingCounts: BlitzBuildingCounts;
  population: number;
  populationCapacity: number;
  occupiedGuards: number;
  maxGuards: number;
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
  emphasis: "primary" | "secondary";
  priority: number;
};

const BLITZ_TARGETS = {
  foundationWheat: 2,
  sprintMarket: 1,
  sprintWheat: 8,
  resourcesPerRealmLevel: 2,
};

const POPULATION_PRESSURE_RATIO = 0.7;
const MILITARY_TARGETS_BY_REALM_LEVEL = [0, 1, 3, 5];

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
  market: {
    action: "build-market",
    buildingType: BuildingType.ResourceDonkey,
    label: "Build market",
    priority: 50,
    resource: ResourcesIds.Donkey,
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

const isPopulationPressured = ({ population, populationCapacity }: BlitzRealmSuggestionInput) =>
  populationCapacity > 0 && population / populationCapacity >= POPULATION_PRESSURE_RATIO;

const canBuild = (input: BlitzRealmSuggestionInput, key: BlitzBuildKey) => input.buildability[key]?.canBuild === true;

const hasFoundationEconomy = ({ buildingCounts }: BlitzRealmSuggestionInput) =>
  buildingCounts.wheat >= BLITZ_TARGETS.foundationWheat &&
  buildingCounts.wood > 0 &&
  buildingCounts.coal > 0 &&
  buildingCounts.copper > 0;

const resolveRealmResourceTarget = ({ realmLevel }: BlitzRealmSuggestionInput) =>
  Math.max(0, realmLevel * BLITZ_TARGETS.resourcesPerRealmLevel);

const resolveMilitaryTargetCount = ({ realmLevel }: BlitzRealmSuggestionInput) => {
  const clampedLevel = Math.max(0, Math.min(realmLevel, MILITARY_TARGETS_BY_REALM_LEVEL.length - 1));
  return MILITARY_TARGETS_BY_REALM_LEVEL[clampedLevel] ?? 0;
};

const hasRealmLevelBuildingTargets = (input: BlitzRealmSuggestionInput) => {
  const resourceTarget = resolveRealmResourceTarget(input);
  const militaryTargetCount = resolveMilitaryTargetCount(input);
  const militaryTargetMet =
    !input.militaryTarget || militaryTargetCount === 0 || input.militaryTarget.count >= militaryTargetCount;

  return (
    hasFoundationEconomy(input) &&
    input.buildingCounts.wood >= resourceTarget &&
    input.buildingCounts.coal >= resourceTarget &&
    input.buildingCounts.copper >= resourceTarget &&
    militaryTargetMet
  );
};

const shouldSuggestGuard = (input: BlitzRealmSuggestionInput) =>
  input.maxGuards > 0 && input.occupiedGuards === 0 && hasRealmLevelBuildingTargets(input);

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
  emphasis: action === "expand-population" ? "secondary" : "primary",
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

const pushBuildSuggestion = (
  suggestions: BlitzSuggestionDraft[],
  input: BlitzRealmSuggestionInput,
  key: BlitzBuildKey,
  reason: string,
) => {
  if (!input.hasAvailableBuildingTile) return;
  if (!canBuild(input, key)) return;

  suggestions.push(createBuildSuggestion(input, key, reason));
};

const pushPopulationSuggestion = (suggestions: BlitzSuggestionDraft[], input: BlitzRealmSuggestionInput) => {
  if (!isPopulationPressured(input)) return;

  pushBuildSuggestion(suggestions, input, "workerHut", `${input.population}/${input.populationCapacity} pop.`);
};

const pushFoundationSuggestions = (suggestions: BlitzSuggestionDraft[], input: BlitzRealmSuggestionInput) => {
  const { buildingCounts } = input;
  const resourceTarget = resolveRealmResourceTarget(input);

  if (buildingCounts.wheat < BLITZ_TARGETS.foundationWheat) {
    pushBuildSuggestion(
      suggestions,
      input,
      "wheat",
      `${buildingCounts.wheat}/${BLITZ_TARGETS.foundationWheat} foundation farms.`,
    );
  }

  if (buildingCounts.wood < resourceTarget) {
    pushBuildSuggestion(suggestions, input, "wood", `${buildingCounts.wood}/${resourceTarget} wood camps.`);
  }

  if (buildingCounts.wood > 0 && buildingCounts.coal < resourceTarget) {
    pushBuildSuggestion(suggestions, input, "coal", `${buildingCounts.coal}/${resourceTarget} coal mines.`);
  }

  if (buildingCounts.wood > 0 && buildingCounts.coal > 0 && buildingCounts.copper < resourceTarget) {
    pushBuildSuggestion(suggestions, input, "copper", `${buildingCounts.copper}/${resourceTarget} copper mines.`);
  }

  if (buildingCounts.wood > 0 && buildingCounts.market < BLITZ_TARGETS.sprintMarket) {
    pushBuildSuggestion(suggestions, input, "market", "No market production.");
  }
};

const pushSprintSuggestions = (suggestions: BlitzSuggestionDraft[], input: BlitzRealmSuggestionInput) => {
  if (!hasFoundationEconomy(input)) return;

  const { buildingCounts } = input;

  if (buildingCounts.wheat < BLITZ_TARGETS.sprintWheat) {
    pushBuildSuggestion(suggestions, input, "wheat", `${buildingCounts.wheat}/${BLITZ_TARGETS.sprintWheat} farms.`);
  }
};

const pushMilitarySuggestion = (suggestions: BlitzSuggestionDraft[], input: BlitzRealmSuggestionInput) => {
  const target = input.militaryTarget;
  if (!target) return;

  const targetCount = resolveMilitaryTargetCount(input);
  if (targetCount <= 0) return;
  if (target.count >= targetCount) return;

  const bonusLabel =
    typeof target.bonusPercent === "number" && target.bonusPercent > 0
      ? ` for +${target.bonusPercent}% biome bonus`
      : "";

  pushBuildSuggestion(suggestions, input, "military", `${target.count}/${targetCount} ${target.label}${bonusLabel}.`);
};

export const buildBlitzRealmSuggestions = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft[] => {
  if (!input.isBlitzActive) return [];

  if (input.canProvision) {
    return [createBaseSuggestion(input, "provision", "Provision realm", 0, "Provision to start your economy.")];
  }

  const suggestions: BlitzSuggestionDraft[] = [];

  pushPopulationSuggestion(suggestions, input);
  pushFoundationSuggestions(suggestions, input);
  pushSprintSuggestions(suggestions, input);
  pushMilitarySuggestion(suggestions, input);

  if (input.canAffordUpgrade && (!input.hasAvailableBuildingTile || hasRealmLevelBuildingTargets(input))) {
    suggestions.push(createBaseSuggestion(input, "upgrade", "Level up realm", 80, "Upgrade is affordable."));
  }

  if (shouldSuggestGuard(input)) {
    suggestions.push(createBaseSuggestion(input, "garrison", "Garrison realm", 100, "No defenders stationed."));
  }

  return suggestions.toSorted((left, right) => {
    if (left.emphasis !== right.emphasis) return left.emphasis === "primary" ? -1 : 1;
    return left.priority - right.priority;
  });
};
