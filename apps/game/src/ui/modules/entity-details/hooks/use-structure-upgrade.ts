import { knownBalance } from "@/ui/utils/utils";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { configManager, divideByPrecision, getBalance, getRealmInfo, isViewerOwner } from "@bibliothecadao/eternum";
import { useArrivalsByStructure } from "@/hooks/helpers/use-resource-arrivals";
import { useGame } from "@/hooks/context/game-context";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
import { getLevelName } from "@bibliothecadao/types";
import { useMemo } from "react";
import { getPlayerName } from "@/services/identity/player-profiles";
import { useAccountAddress } from "@/hooks/store/use-account-store";

interface RawUpgradeCost {
  resource: number;
  amount: number;
}

interface IncomingRequirementDelivery {
  amount: number;
  etaSeconds: number;
}

interface UpgradeRequirement {
  resource: number;
  amount: number;
  current: number | undefined;
  progress: number;
  /** Resources already sent to this structure but still riding the delivery tick. */
  incoming: IncomingRequirementDelivery | null;
}

interface StructureUpgradeResult {
  currentLevel: number;
  currentLevelName: string;
  nextLevel: number | null;
  nextLevelName: string | null;
  /** The game defines a recipe for the next level; without one the level cannot be taken, and is never free. */
  hasRecipe: boolean;
  /** The authoritative readiness: a next level, its recipe, and every requirement held. */
  canUpgrade: boolean;
  requirements: UpgradeRequirement[];
  isOwner: boolean;
  isMaxLevel: boolean;
  /** A level-up step (provision or level-up) for this realm is in flight from any surface. */
  isUpgradeLocked: boolean;
}

export const formatIncomingEta = (etaSeconds: number): string => {
  if (etaSeconds <= 0) return "landing";
  if (etaSeconds < 90) return `in ${Math.ceil(etaSeconds)}s`;
  return `in ${Math.ceil(etaSeconds / 60)}m`;
};

export const useStructureUpgrade = (structureEntityId: number | null): StructureUpgradeResult | null => {
  const { setup } = useGame();
  const viewer = useAccountAddress();
  const currentDefaultTick = useCurrentDefaultTick();
  const isUpgradeLocked = useInFlight("castle", structureEntityId) !== undefined;
  const revision = useNativeRevision([
    "StructureBuildings",
    "ResourceWeight",
    "ResourceBalance",
    "ResourceProduction",
    "ProductionBonus",
  ]);
  const liveStructure = useNativeRow(
    "Structure",
    structureEntityId
      ? {
          game_id: configManager.getActiveGameId(),
          entity_id: structureEntityId,
        }
      : undefined,
  );
  const structureInfo = useMemo(
    () =>
      liveStructure && structureEntityId ? (getRealmInfo(structureEntityId, setup.store, getPlayerName) ?? null) : null,
    [liveStructure, setup.store, structureEntityId, revision],
  );

  const nextLevel = useMemo(() => {
    if (!structureInfo) return null;
    const candidate = structureInfo.level + 1;
    return candidate <= configManager.getMaxLevel(structureInfo.category) ? candidate : null;
  }, [structureInfo]);

  // Undefined when this game defines no recipe for the next level: that upgrade is then unavailable, never free.
  const rawCosts = useMemo<RawUpgradeCost[] | undefined>(() => {
    if (!nextLevel) return [];
    return configManager.getRealmUpgradeCosts(nextLevel);
  }, [nextLevel]);

  // Sent resources ride the delivery tick and belong to no balance while in
  // transit; surfacing them here is what tells the player their transfer is
  // coming instead of the requirement row silently staying red.
  const pendingArrivals = useArrivalsByStructure(structureEntityId ?? undefined);
  const incomingByResource = useMemo(() => {
    const incoming = new Map<number, IncomingRequirementDelivery>();
    for (const arrival of pendingArrivals ?? []) {
      const etaSeconds = Math.max(0, Number(arrival.arrivesAt) - currentDefaultTick);
      for (const { resourceId, amount } of arrival.resources) {
        const entry = incoming.get(resourceId) ?? { amount: 0, etaSeconds };
        entry.amount += divideByPrecision(amount);
        entry.etaSeconds = Math.min(entry.etaSeconds, etaSeconds);
        incoming.set(resourceId, entry);
      }
    }
    return incoming;
  }, [currentDefaultTick, pendingArrivals]);

  const requirements = useMemo<UpgradeRequirement[]>(() => {
    if (!structureInfo || !nextLevel || !structureEntityId || !rawCosts) return [];
    return rawCosts.map((cost) => {
      const current = knownBalance(
        getBalance(structureEntityId, cost.resource, currentDefaultTick, setup.store).balance,
      );
      const incoming = incomingByResource.get(cost.resource) ?? null;
      return {
        resource: cost.resource,
        amount: cost.amount,
        current,
        progress: current === undefined ? 0 : cost.amount > 0 ? Math.min(100, (current * 100) / cost.amount) : 100,
        incoming: incoming && incoming.amount > 0 ? incoming : null,
      };
    });
  }, [
    revision,
    currentDefaultTick,
    incomingByResource,
    nextLevel,
    rawCosts,
    setup.store,
    structureEntityId,
    structureInfo,
  ]);

  // A balance this client cannot see never meets a requirement.
  const canUpgrade =
    Boolean(structureInfo && nextLevel && rawCosts) &&
    requirements.every(({ current, amount }) => current !== undefined && current >= amount);

  if (!structureInfo) return null;

  return {
    currentLevel: structureInfo.level,
    currentLevelName: getLevelName(structureInfo.level),
    nextLevel,
    nextLevelName: nextLevel ? getLevelName(nextLevel) : null,
    hasRecipe: rawCosts !== undefined,
    canUpgrade,
    requirements,
    isOwner: isViewerOwner(structureInfo.owner, viewer),
    isMaxLevel: nextLevel === null,
    isUpgradeLocked,
  };
};
