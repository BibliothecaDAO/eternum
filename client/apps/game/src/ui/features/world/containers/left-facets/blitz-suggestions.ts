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
  | "deploy-explorer"
  | "expand-population"
  | "garrison"
  | "provision"
  | "upgrade"
  | "upgrade-and-provision";

export type BlitzBuildKey = "copper" | "coal" | "military" | "wheat" | "wood" | "workerHut";
type BlitzResourceBuildKey = "wood" | "coal" | "copper";

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
  canProvision: boolean;
  canAffordUpgrade: boolean;
  hasAvailableBuildingTile: boolean;
  buildingTilesOccupied: number | null;
  buildingCounts: BlitzBuildingCounts;
  population: number;
  populationCapacity: number;
  occupiedGuards: number;
  maxGuards: number;
  occupiedExplorers: number;
  maxExplorers: number;
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
  resourcesPerRealmLevel: 2,
};

const MIN_AVAILABLE_POPULATION_BEFORE_WORKER_HUT = 3;
// Always nudge toward keeping at least this many explorer armies on the map.
// Deploying requires picking a hex, so the suggestion only opens the army modal.
const EXPLORER_DEPLOYMENT_TARGET = 2;
const MILITARY_TARGETS_BY_REALM_LEVEL = [0, 1, 3, 5];
// Wheat farm target by realm level (index = realm level). Levels beyond the
// last entry clamp to the final value. Scales the food economy with the realm
// instead of jumping straight from the foundation (2) to a flat sprint target.
const WHEAT_TARGETS_BY_REALM_LEVEL = [2, 4, 8, 12];
const RESOURCE_BUILD_ORDER: BlitzResourceBuildKey[] = ["wood", "coal", "copper"];
const RESOURCE_BUILD_LABELS: Record<BlitzResourceBuildKey, string> = {
  wood: "wood camps",
  coal: "coal mines",
  copper: "copper mines",
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

const isPopulationPressured = ({ population, populationCapacity }: BlitzRealmSuggestionInput) =>
  populationCapacity > 0 && populationCapacity - population <= MIN_AVAILABLE_POPULATION_BEFORE_WORKER_HUT;

const canBuild = (input: BlitzRealmSuggestionInput, key: BlitzBuildKey) => input.buildability[key]?.canBuild === true;

const hasFoundationEconomy = ({ buildingCounts }: BlitzRealmSuggestionInput) =>
  buildingCounts.wheat >= BLITZ_TARGETS.foundationWheat &&
  buildingCounts.wood > 0 &&
  buildingCounts.coal > 0 &&
  buildingCounts.copper > 0;

const resolveRealmResourceTarget = ({ realmLevel }: BlitzRealmSuggestionInput) =>
  Math.max(0, realmLevel * BLITZ_TARGETS.resourcesPerRealmLevel);

const resolveSyncedResourceBuildKey = (input: BlitzRealmSuggestionInput): BlitzResourceBuildKey | null => {
  const resourceTarget = resolveRealmResourceTarget(input);
  if (resourceTarget <= 0) return null;

  for (let targetCount = 1; targetCount <= resourceTarget; targetCount += 1) {
    const nextResourceKey = RESOURCE_BUILD_ORDER.find((key) => input.buildingCounts[key] < targetCount);
    if (nextResourceKey) return nextResourceKey;
  }

  return null;
};

const resolveMilitaryTargetCount = ({ realmLevel }: BlitzRealmSuggestionInput) => {
  const clampedLevel = Math.max(0, Math.min(realmLevel, MILITARY_TARGETS_BY_REALM_LEVEL.length - 1));
  return MILITARY_TARGETS_BY_REALM_LEVEL[clampedLevel] ?? 0;
};

const resolveWheatTargetCount = ({ realmLevel }: BlitzRealmSuggestionInput) => {
  const clampedLevel = Math.max(0, Math.min(realmLevel, WHEAT_TARGETS_BY_REALM_LEVEL.length - 1));
  return WHEAT_TARGETS_BY_REALM_LEVEL[clampedLevel] ?? BLITZ_TARGETS.foundationWheat;
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

const canSubmitBuildSuggestion = (input: BlitzRealmSuggestionInput, key: BlitzBuildKey) =>
  input.hasAvailableBuildingTile && canBuild(input, key);

const resolveBuildSuggestion = (
  input: BlitzRealmSuggestionInput,
  key: BlitzBuildKey,
  reason: string,
): BlitzSuggestionDraft | null => {
  if (!canSubmitBuildSuggestion(input, key)) return null;

  return createBuildSuggestion(input, key, reason);
};

const resolveUpgradeSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  if (!input.canAffordUpgrade) return null;

  return createBaseSuggestion(input, "upgrade", "Level up realm", 0, "Upgrade is affordable.");
};

const resolvePopulationSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  if (!isPopulationPressured(input)) return null;

  return resolveBuildSuggestion(input, "workerHut", `${input.population}/${input.populationCapacity} pop.`);
};

const resolveWheatSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  const wheatTarget = resolveWheatTargetCount(input);
  if (input.buildingCounts.wheat >= wheatTarget) {
    return null;
  }

  return resolveBuildSuggestion(input, "wheat", `${input.buildingCounts.wheat}/${wheatTarget} farms.`);
};

const resolveResourceSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  const resourceKey = resolveSyncedResourceBuildKey(input);
  if (!resourceKey) return null;

  const resourceTarget = resolveRealmResourceTarget(input);
  const resourceCount = input.buildingCounts[resourceKey];
  const resourceLabel = RESOURCE_BUILD_LABELS[resourceKey];

  return resolveBuildSuggestion(input, resourceKey, `${resourceCount}/${resourceTarget} ${resourceLabel}.`);
};

const resolveMilitarySuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  const target = input.militaryTarget;
  if (!target) return null;

  const targetCount = resolveMilitaryTargetCount(input);
  if (targetCount <= 0) return null;
  if (target.count >= targetCount) return null;

  const bonusLabel =
    typeof target.bonusPercent === "number" && target.bonusPercent > 0
      ? ` for +${target.bonusPercent}% biome bonus`
      : "";

  return resolveBuildSuggestion(input, "military", `${target.count}/${targetCount} ${target.label}${bonusLabel}.`);
};

const resolveGarrisonSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  if (!shouldSuggestGuard(input)) return null;

  return createBaseSuggestion(input, "garrison", "Garrison realm", 100, "No defenders stationed.");
};

const resolveExplorerDeploymentSuggestion = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft | null => {
  if (input.maxExplorers <= 0) return null;
  if (input.occupiedExplorers >= EXPLORER_DEPLOYMENT_TARGET) return null;

  // We can't auto-pick a deploy hex, so this only opens the army modal.
  return createBaseSuggestion(
    input,
    "deploy-explorer",
    "Deploy explorer army",
    15,
    `${input.occupiedExplorers}/${EXPLORER_DEPLOYMENT_TARGET} explorers deployed.`,
  );
};

export const buildBlitzRealmSuggestions = (input: BlitzRealmSuggestionInput): BlitzSuggestionDraft[] => {
  if (!input.isBlitzActive) return [];

  if (input.canProvision) {
    const canBundleUpgrade = input.canAffordUpgrade;

    return [
      createBaseSuggestion(
        input,
        canBundleUpgrade ? "upgrade-and-provision" : "provision",
        canBundleUpgrade ? "Provision + level up realm" : "Provision realm",
        0,
        canBundleUpgrade ? "Start your economy and upgrade in one action." : "Start your economy before upgrading.",
      ),
    ];
  }

  const suggestion =
    resolveUpgradeSuggestion(input) ??
    resolvePopulationSuggestion(input) ??
    resolveWheatSuggestion(input) ??
    resolveExplorerDeploymentSuggestion(input) ??
    resolveResourceSuggestion(input) ??
    resolveMilitarySuggestion(input) ??
    resolveGarrisonSuggestion(input);

  return suggestion ? [suggestion] : [];
};
