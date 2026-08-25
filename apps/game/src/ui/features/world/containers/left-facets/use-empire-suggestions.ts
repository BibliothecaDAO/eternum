import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resolveConstructionBuildability } from "@/ui/features/settlement/construction/construction-buildability";
import { resolveRealmHasAvailableBuildingTile } from "@/ui/features/settlement/construction/realm-build-actions";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  Biome,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getRealmInfo,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  type BiomeType,
  BuildingType,
  type ClientComponents,
  type ID,
  ResourcesIds,
  StructureType,
  TroopType,
} from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import type { LucideIcon } from "lucide-react";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Compass from "lucide-react/dist/esm/icons/compass";
import HomeIcon from "lucide-react/dist/esm/icons/home";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Wheat from "lucide-react/dist/esm/icons/wheat";
import { useMemo } from "react";
import { gameEntityKey } from "@/dojo/game-scope";
import {
  buildBlitzRealmSuggestions,
  type BlitzBuildKey,
  type BlitzBuildingCounts,
  type BlitzMilitaryTarget,
  type BlitzRealmSuggestionInput,
  type BlitzSuggestionDraft,
  type EmpireSuggestionAction,
} from "./blitz-suggestions";

export interface EmpireSuggestion extends Omit<BlitzSuggestionDraft, "priority"> {
  icon: LucideIcon;
}

type RawUpgradeCost = {
  resource: number;
  amount: number;
};

type BlitzActivityInput = {
  resolvedWorldGameMode: string;
  currentBlockTimestamp: number;
  gameStartMainAt?: number | null;
  gameEndAt?: number | null;
  devModeOn: boolean;
};

type BuildabilityContext = {
  entityId: number;
  components: ClientComponents;
  realm: ReturnType<typeof getRealmInfo> | null | undefined;
  mode: ReturnType<typeof useGameModeConfig>;
  useSimpleCost: boolean;
  hasAvailableBuildingTile: boolean;
};

const ACTION_ICONS: Record<EmpireSuggestionAction, LucideIcon> = {
  "upgrade-and-provision": Pickaxe,
  "build-copper": Building2,
  "build-coal": Building2,
  "build-first": Building2,
  "build-military": Shield,
  "build-market": Building2,
  "build-wheat": Wheat,
  "build-wood": Building2,
  "build-worker-hut": HomeIcon,
  "deploy-explorer": Compass,
  "expand-population": Sparkles,
  garrison: Shield,
  provision: Pickaxe,
  upgrade: ArrowUpCircle,
};

type StaticBlitzBuildKey = Exclude<BlitzBuildKey, "military">;

const BLITZ_BUILDING_TYPES: Record<StaticBlitzBuildKey, BuildingType> = {
  copper: BuildingType.ResourceCopper,
  coal: BuildingType.ResourceCoal,
  wheat: BuildingType.ResourceWheat,
  wood: BuildingType.ResourceWood,
  workerHut: BuildingType.WorkersHut,
};

const T1_MILITARY_OPTIONS = [
  {
    troopType: TroopType.Crossbowman,
    buildingType: BuildingType.ResourceCrossbowmanT1,
    resource: ResourcesIds.Crossbowman,
    label: "Crossbowman T1",
    countKey: "crossbowmanT1",
  },
  {
    troopType: TroopType.Paladin,
    buildingType: BuildingType.ResourcePaladinT1,
    resource: ResourcesIds.Paladin,
    label: "Paladin T1",
    countKey: "paladinT1",
  },
  {
    troopType: TroopType.Knight,
    buildingType: BuildingType.ResourceKnightT1,
    resource: ResourcesIds.Knight,
    label: "Knight T1",
    countKey: "knightT1",
  },
] as const;

const compareSuggestionDrafts = (left: BlitzSuggestionDraft, right: BlitzSuggestionDraft) => {
  if (left.emphasis !== right.emphasis) return left.emphasis === "primary" ? -1 : 1;
  return left.priority - right.priority;
};

const resolveBlitzActivity = ({
  resolvedWorldGameMode,
  currentBlockTimestamp,
  gameStartMainAt,
  gameEndAt,
  devModeOn,
}: BlitzActivityInput) => {
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const isMainPhase = devModeOn || (typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt);
  const isSeasonOver = !devModeOn && typeof gameEndAt === "number" && currentBlockTimestamp > gameEndAt;

  return isBlitzWorld && isMainPhase && !isSeasonOver;
};

const resolveUpgradeCosts = (level: number): RawUpgradeCost[] =>
  (configManager.realmUpgradeCosts[level] as RawUpgradeCost[] | undefined) ?? [];

const canAffordRealmUpgrade = (
  realmId: ID,
  realmLevel: number,
  components: ClientComponents,
  currentDefaultTick: number,
) => {
  const maxLevel = configManager.getMaxLevel(StructureType.Realm);
  const nextLevel = realmLevel + 1;
  if (realmLevel >= maxLevel || nextLevel > maxLevel) return false;

  const costs = resolveUpgradeCosts(nextLevel);
  if (costs.length === 0) return true;

  return costs.every((cost) => {
    const balance = getBalance(realmId, cost.resource, currentDefaultTick, components);
    return divideByPrecision(balance.balance) >= cost.amount;
  });
};

const resolveBlitzBuildingCounts = (buildingCounts: BlitzBuildingCounts): BlitzBuildingCounts => ({
  copper: buildingCounts.copper,
  coal: buildingCounts.coal,
  crossbowmanT1: buildingCounts.crossbowmanT1,
  knightT1: buildingCounts.knightT1,
  paladinT1: buildingCounts.paladinT1,
  wheat: buildingCounts.wheat,
  wood: buildingCounts.wood,
  workerHut: buildingCounts.workerHut,
});

const resolveBuildabilityForBuilding = (context: BuildabilityContext, buildingType: BuildingType) => {
  const result = resolveConstructionBuildability({
    entityId: context.entityId,
    buildingType,
    useSimpleCost: context.useSimpleCost,
    components: context.components,
    realm: context.realm,
    mode: context.mode,
    hasAvailableBuildingTile: context.hasAvailableBuildingTile,
  });

  return {
    canBuild: result.canSubmit,
    reason: result.reason,
  };
};

const resolveStaticBuildability = (context: BuildabilityContext, key: StaticBlitzBuildKey) =>
  resolveBuildabilityForBuilding(context, BLITZ_BUILDING_TYPES[key]);

const resolveBlitzBuildability = (
  context: BuildabilityContext,
  militaryTarget: BlitzMilitaryTarget | null,
): BlitzRealmSuggestionInput["buildability"] => ({
  copper: resolveStaticBuildability(context, "copper"),
  coal: resolveStaticBuildability(context, "coal"),
  military: militaryTarget
    ? resolveBuildabilityForBuilding(context, militaryTarget.buildingType)
    : { canBuild: false, reason: "No biome military target." },
  wheat: resolveStaticBuildability(context, "wheat"),
  wood: resolveStaticBuildability(context, "wood"),
  workerHut: resolveStaticBuildability(context, "workerHut"),
});

const resolveRecommendedMilitaryTarget = (
  realm: ReturnType<typeof getRealmInfo> | null | undefined,
  buildingCounts: BlitzBuildingCounts,
): BlitzMilitaryTarget | null => {
  if (!realm?.position) return null;

  const realmBiome = Biome.getBiome(Number(realm.position.x), Number(realm.position.y)) as BiomeType;
  const best = T1_MILITARY_OPTIONS.map((option) => ({
    ...option,
    bonus: configManager.getBiomeCombatBonus(option.troopType, realmBiome),
  })).reduce<((typeof T1_MILITARY_OPTIONS)[number] & { bonus: number }) | null>((bestOption, option) => {
    if (!bestOption || option.bonus > bestOption.bonus) return option;
    return bestOption;
  }, null);

  if (!best || best.bonus <= 1) return null;

  return {
    buildingType: best.buildingType,
    count: buildingCounts[best.countKey],
    label: best.label,
    resource: best.resource,
    bonusPercent: Math.round((best.bonus - 1) * 100),
  };
};

const decorateSuggestion = (draft: BlitzSuggestionDraft): EmpireSuggestion => {
  const { priority, ...suggestion } = draft;
  void priority;

  return {
    ...suggestion,
    icon: ACTION_ICONS[draft.action],
  };
};

/**
 * Aggregates per-realm suggestions across the current empire. Blitz suggestions
 * are intentionally affordability-aware and only expose build actions that can
 * be submitted by the same autobuild path used in the construction UI.
 */
export const useEmpireSuggestions = (): EmpireSuggestion[] => {
  const {
    setup: { components, systemCalls },
  } = useDojo();
  const mode = useGameModeConfig();
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const playerStructures = useUIStore((state) => state.playerStructures);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const devModeOn = useUIStore((state) => state.devModeOn);
  const metadata = useStructuresWithMetadata({
    structures: playerStructures,
    components,
    nameUpdateVersion: structureNameVersion,
  });

  const isBlitzActive = resolveBlitzActivity({
    resolvedWorldGameMode,
    currentBlockTimestamp,
    gameStartMainAt,
    gameEndAt,
    devModeOn,
  });

  return useMemo(() => {
    const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

    return metadata
      .flatMap((structure): BlitzSuggestionDraft[] => {
        if (structure.category !== StructureType.Realm) return [];

        const entityId = Number(structure.entityId);
        const realm = getRealmInfo(gameEntityKey([BigInt(entityId)]), components);
        const hasAvailableBuildingTile = resolveRealmHasAvailableBuildingTile({
          entityId,
          realmPosition: realm?.position,
          world: {
            components,
            systemCalls,
          },
        });
        const buildabilityContext: BuildabilityContext = {
          entityId,
          components,
          realm,
          mode,
          useSimpleCost,
          hasAvailableBuildingTile,
        };
        const buildingCounts = resolveBlitzBuildingCounts(structure.buildingCounts);
        const militaryTarget = resolveRecommendedMilitaryTarget(realm, buildingCounts);
        const base = structure.structure?.base;

        return buildBlitzRealmSuggestions({
          realmId: structure.entityId,
          realmName: structure.displayName,
          realmLevel: structure.realmLevel,
          isBlitzActive,
          canProvision: structure.canProvision,
          canAffordUpgrade: canAffordRealmUpgrade(
            structure.entityId,
            structure.realmLevel,
            components,
            currentDefaultTick,
          ),
          hasAvailableBuildingTile,
          buildingTilesOccupied: structure.buildingTilesOccupied,
          buildingCounts,
          population: structure.population,
          populationCapacity: structure.populationCapacity,
          occupiedGuards: Number(base?.troop_guard_count ?? 0),
          maxGuards: Number(base?.troop_max_guard_count ?? 0),
          occupiedExplorers: Number(base?.troop_explorer_count ?? 0),
          maxExplorers: Number(base?.troop_max_explorer_count ?? 0),
          militaryTarget,
          buildability: resolveBlitzBuildability(buildabilityContext, militaryTarget),
        });
      })
      .toSorted(compareSuggestionDrafts)
      .map(decorateSuggestion);
  }, [metadata, components, systemCalls, mode, useSimpleCost, isBlitzActive]);
};
