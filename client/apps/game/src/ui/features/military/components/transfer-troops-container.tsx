import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import Button from "@/ui/design-system/atoms/button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { formatNumber } from "@/ui/utils/utils";

import {
  configManager,
  divideByPrecision,
  formatTime,
  getBlockTimestamp,
  getGuardsByStructure,
  getTroopResourceId,
  multiplyByPrecision,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import {
  DISPLAYED_SLOT_NUMBER_MAP,
  getDirectionBetweenAdjacentHexes,
  GUARD_SLOT_NAMES,
  ID,
  RELICS,
  ResourcesIds,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getStructureDefenseSlotLimit, getUnlockedGuardSlots, MAX_GUARD_SLOT_COUNT } from "../utils/defense-slot-utils";
import { TransferDirection } from "./help-container";
import { TransferBalanceCardData, TransferBalanceCards } from "./transfer-troops/transfer-balance-cards";
import { TransferSlotSelection } from "./transfer-troops/transfer-slot-selection";

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
  onToggleDirection?: () => void;
  canToggleDirection?: boolean;
}

const BALANCE_SLOT = "balance" as const;

type GuardSelection = number | typeof BALANCE_SLOT | null;

type RelicResourceTransfer = {
  resourceId: number;
  amount: number;
};

const RELIC_RESOURCE_IDS: number[] = RELICS.map((relic) => Number(relic.id));

export const TransferTroopsContainer = ({
  selectedEntityId,
  targetEntityId,
  selectedHex,
  targetHex,
  transferDirection,
  onTransferComplete,
  onToggleDirection,
  canToggleDirection = false,
}: TransferTroopsContainerProps) => {
  const {
    account: { account },
    network: { toriiClient },
    setup: {
      systemCalls: {
        explorer_explorer_swap,
        explorer_guard_swap,
        guard_explorer_swap,
        explorer_add,
        troop_troop_adjacent_transfer,
        troop_structure_adjacent_transfer,
      },
    },
  } = useDojo();
  const { currentBlockTimestamp, currentDefaultTick } = useBlockTimestamp();

  const [loading, setLoading] = useState(false);
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<GuardSelection>(null);

  const troopMaxSizeRaw = configManager.getTroopConfig().troop_limit_config.explorer_guard_max_troop_count;
  const parsedTroopCap = Number(troopMaxSizeRaw ?? 0);
  const troopCapacityLimit = Number.isFinite(parsedTroopCap) && parsedTroopCap > 0 ? parsedTroopCap : null;

  // Query for selected entity data
  const { data: selectedEntityData, isLoading: isSelectedLoading } = useQuery({
    queryKey: ["selectedEntity", String(selectedEntityId)],
    queryFn: async () => {
      const [structureData, explorerData] = await Promise.all([
        getStructureFromToriiClient(toriiClient, selectedEntityId),
        getExplorerFromToriiClient(toriiClient, selectedEntityId),
      ]);

      return {
        structure: structureData.structure,
        structureResources: structureData.resources,
        explorer: explorerData.explorer,
        explorerResources: explorerData.resources,
      };
    },
    staleTime: 10000, // 10 seconds
  });

  // Query for target entity data
  const { data: targetEntityData, isLoading: isTargetLoading } = useQuery({
    queryKey: ["targetEntity", String(targetEntityId)],
    queryFn: async () => {
      const [structureData, explorerData] = await Promise.all([
        getStructureFromToriiClient(toriiClient, targetEntityId),
        getExplorerFromToriiClient(toriiClient, targetEntityId),
      ]);

      return {
        structure: structureData.structure,
        explorer: explorerData.explorer,
      };
    },
    staleTime: 10000, // 10 seconds
  });

  const isStructureOwnerOfExplorer = useMemo(() => {
    return selectedEntityId === targetEntityData?.explorer?.owner;
  }, [selectedEntityId, targetEntityData?.explorer?.owner]);

  const structureTroopBalance = useMemo(() => {
    const resources = selectedEntityData?.structureResources;
    if (!targetEntityData?.explorer?.troops || !resources) return undefined;
    const { category, tier } = targetEntityData.explorer.troops;
    const resourceId = getTroopResourceId(category as TroopType, tier as TroopTier);
    const { currentDefaultTick } = getBlockTimestamp();
    return {
      resourceId,
      balance: ResourceManager.balanceWithProduction(resources, currentDefaultTick, resourceId).balance,
      category,
      tier,
    };
  }, [selectedEntityData?.structureResources, targetEntityData?.explorer?.troops]);

  const selectedStructure = selectedEntityData?.structure;
  const selectedExplorerTroops = selectedEntityData?.explorer;
  const selectedExplorerResources = selectedEntityData?.explorerResources;
  const targetStructure = targetEntityData?.structure;
  const targetExplorerTroops = targetEntityData?.explorer;

  const directionLabel = useMemo(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return "Explorer → Structure";
    }
    if (transferDirection === TransferDirection.StructureToExplorer) {
      return "Structure → Explorer";
    }
    return "Explorer → Explorer";
  }, [transferDirection]);

  const isBalanceSelected = guardSlot === BALANCE_SLOT;

  const resolveUnlockedSlotsForStructure = (structure?: typeof selectedStructure) => {
    if (!structure?.base) {
      return [];
    }

    const { base, category } = structure;
    const limits: number[] = [];
    const derivedLimit = getStructureDefenseSlotLimit(category as StructureType | undefined, base.level ?? null);
    if (typeof derivedLimit === "number" && Number.isFinite(derivedLimit)) {
      limits.push(derivedLimit);
    }

    const baseLimitRaw = base.troop_max_guard_count;
    if (baseLimitRaw !== undefined && baseLimitRaw !== null) {
      const baseLimit = Number(baseLimitRaw);
      if (Number.isFinite(baseLimit)) {
        limits.push(baseLimit);
      }
    }

    if (limits.length === 0) {
      return [];
    }

    const resolvedLimit = Math.max(0, Math.min(Math.min(...limits), MAX_GUARD_SLOT_COUNT));
    if (resolvedLimit === 0) {
      return [];
    }

    return getUnlockedGuardSlots(resolvedLimit);
  };

  const selectedStructureGuardSlots = useMemo(
    () => resolveUnlockedSlotsForStructure(selectedStructure),
    [selectedStructure],
  );

  const targetStructureGuardSlots = useMemo(() => resolveUnlockedSlotsForStructure(targetStructure), [targetStructure]);

  const availableGuards = useMemo<number[]>(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return targetStructureGuardSlots;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      return selectedStructureGuardSlots;
    }

    return [];
  }, [selectedStructureGuardSlots, targetStructureGuardSlots, transferDirection]);

  const selectedGuardSlotSet = useMemo(() => new Set(selectedStructureGuardSlots), [selectedStructureGuardSlots]);
  const targetGuardSlotSet = useMemo(() => new Set(targetStructureGuardSlots), [targetStructureGuardSlots]);

  const orderedGuardSlots = useMemo(() => [...availableGuards].sort((a, b) => b - a), [availableGuards]);
  const visualGuardSlots = useMemo(
    () =>
      [...availableGuards].sort(
        (a, b) =>
          DISPLAYED_SLOT_NUMBER_MAP[a as keyof typeof DISPLAYED_SLOT_NUMBER_MAP] -
          DISPLAYED_SLOT_NUMBER_MAP[b as keyof typeof DISPLAYED_SLOT_NUMBER_MAP],
      ),
    [availableGuards],
  );
  const lastGuardSlot = orderedGuardSlots[0];
  const frontlineSlot = orderedGuardSlots[orderedGuardSlots.length - 1];

  // starts from highest slot to lowest slot
  const advanceLabel =
    orderedGuardSlots.length > 0
      ? [...availableGuards]
          .sort((a, b) => a - b)
          .map((slotId) => `Slot ${DISPLAYED_SLOT_NUMBER_MAP[slotId as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]}`)
          .join(" → ")
      : null;
  const displayAdvanceLabel = advanceLabel;

  const guardSelectionRequired = useMemo(() => {
    return (
      transferDirection === TransferDirection.StructureToExplorer ||
      transferDirection === TransferDirection.ExplorerToStructure
    );
  }, [transferDirection]);

  // list of guards
  const targetGuards = useMemo(() => {
    if (!targetStructure) return [];
    const guards = getGuardsByStructure(targetStructure).filter((guard) => targetGuardSlotSet.has(Number(guard.slot)));
    return guards.map((guard) => {
      const cooldownEnd = guard.cooldownEnd !== undefined && guard.cooldownEnd !== null ? Number(guard.cooldownEnd) : 0;

      return {
        ...guard,
        cooldownEnd,
        troops: {
          ...guard.troops,
          tier: guard.troops.tier as TroopTier,
          category: guard.troops.category as TroopType,
          count: divideByPrecision(Number(guard.troops.count)),
        },
      };
    });
  }, [targetStructure, targetGuardSlotSet]);

  // list of guards
  const selectedGuards = useMemo(() => {
    if (!selectedStructure) return [];
    const guards = getGuardsByStructure(selectedStructure).filter((guard) =>
      selectedGuardSlotSet.has(Number(guard.slot)),
    );
    return guards.map((guard) => {
      const cooldownEnd = guard.cooldownEnd !== undefined && guard.cooldownEnd !== null ? Number(guard.cooldownEnd) : 0;

      return {
        ...guard,
        cooldownEnd,
        troops: {
          ...guard.troops,
          tier: guard.troops.tier as TroopTier,
          category: guard.troops.category as TroopType,
          count: divideByPrecision(Number(guard.troops.count)),
        },
      };
    });
  }, [selectedStructure, selectedGuardSlotSet]);

  const selectedTroop = useMemo(() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (isBalanceSelected && structureTroopBalance) {
        return {
          category: structureTroopBalance.category as TroopType,
          tier: structureTroopBalance.tier as TroopTier,
          count: divideByPrecision(Number(structureTroopBalance.balance)),
        };
      }

      if (typeof guardSlot === "number") {
        const guard = selectedGuards.find((entry) => entry.slot === guardSlot);
        if (guard) {
          return guard.troops;
        }
      }
    }
    return null;
  }, [transferDirection, isBalanceSelected, structureTroopBalance, selectedGuards, guardSlot]);

  const selectedExplorerCount = useMemo(() => {
    const count = selectedExplorerTroops?.troops.count;
    if (count === undefined) return 0;
    return divideByPrecision(Number(count));
  }, [selectedExplorerTroops?.troops.count]);

  const targetExplorerCount = useMemo(() => {
    const count = targetExplorerTroops?.troops.count;
    if (count === undefined) return 0;
    return divideByPrecision(Number(count));
  }, [targetExplorerTroops?.troops.count]);

  const structureBalanceCount = useMemo(() => {
    if (!structureTroopBalance) return 0;
    return divideByPrecision(Number(structureTroopBalance.balance));
  }, [structureTroopBalance]);

  const structureBalanceTroopInfo = structureTroopBalance
    ? {
        category: structureTroopBalance.category as TroopType,
        tier: structureTroopBalance.tier as TroopTier,
        count: structureBalanceCount,
      }
    : null;

  const balanceMatchesDestination =
    !!structureBalanceTroopInfo &&
    (targetExplorerCount === 0 ||
      !targetExplorerTroops?.troops ||
      (structureBalanceTroopInfo.tier === targetExplorerTroops.troops.tier &&
        structureBalanceTroopInfo.category === targetExplorerTroops.troops.category));

  const canShowStructureBalanceOption =
    transferDirection === TransferDirection.StructureToExplorer && !!structureBalanceTroopInfo;

  const balanceOptionMismatch = canShowStructureBalanceOption && !balanceMatchesDestination;

  const balanceOptionDisabled =
    balanceOptionMismatch || !isStructureOwnerOfExplorer || (structureBalanceTroopInfo?.count ?? 0) <= 0;

  const balanceOptionDisabledReason = (() => {
    if (!structureBalanceTroopInfo) {
      return null;
    }

    if (balanceOptionMismatch && targetExplorerTroops?.troops) {
      return `Explorer expects Tier ${targetExplorerTroops.troops.tier} ${targetExplorerTroops.troops.category}. Structure balance holds Tier ${structureBalanceTroopInfo.tier} ${structureBalanceTroopInfo.category}.`;
    }

    if (!isStructureOwnerOfExplorer) {
      return "Explorer is not owned by this structure";
    }

    return null;
  })();

  const { maxTroops, capacityBlocked } = useMemo<{
    maxTroops: number;
    capacityBlocked: { type: "explorer" } | { type: "guard"; slotIndex: number } | null;
  }>(() => {
    const cap = troopCapacityLimit;
    const capLimit = cap !== null ? cap : Number.POSITIVE_INFINITY;

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetCapacity = Math.max(0, capLimit - targetExplorerCount);
      if (cap !== null && targetCapacity <= 0) {
        return { maxTroops: 0, capacityBlocked: { type: "explorer" as const } };
      }
      const sourceAvailable = isBalanceSelected
        ? structureBalanceCount
        : typeof guardSlot === "number"
          ? (() => {
              const availableValue = selectedGuards.find((guard) => guard.slot === guardSlot)?.troops.count ?? 0;
              return Number.isFinite(availableValue) ? availableValue : 0;
            })()
          : 0;
      return { maxTroops: Math.min(sourceAvailable, targetCapacity), capacityBlocked: null };
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot !== "number") {
        return { maxTroops: 0, capacityBlocked: null };
      }
      const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
      const targetGuardCountValue = targetGuard?.troops.count ?? 0;
      const targetGuardCount = Number.isFinite(targetGuardCountValue) ? targetGuardCountValue : 0;
      const guardCapacity = Math.max(0, capLimit - targetGuardCount);
      if (cap !== null && guardCapacity <= 0) {
        return { maxTroops: 0, capacityBlocked: { type: "guard" as const, slotIndex: guardSlot } };
      }
      const availableFromExplorer = Math.max(0, selectedExplorerCount - 1);
      return { maxTroops: Math.min(availableFromExplorer, guardCapacity), capacityBlocked: null };
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      const targetCapacity = Math.max(0, capLimit - targetExplorerCount);
      if (cap !== null && targetCapacity <= 0) {
        return { maxTroops: 0, capacityBlocked: { type: "explorer" as const } };
      }
      return { maxTroops: Math.min(selectedExplorerCount, targetCapacity), capacityBlocked: null };
    }

    return { maxTroops: 0, capacityBlocked: null };
  }, [
    troopCapacityLimit,
    transferDirection,
    targetExplorerCount,
    isBalanceSelected,
    structureBalanceCount,
    guardSlot,
    selectedGuards,
    selectedExplorerCount,
    targetGuards,
  ]);

  useEffect(() => {
    setTroopAmount((current) => Math.max(0, Math.min(current, maxTroops)));
  }, [maxTroops]);

  const capacityRemainingTarget = useMemo(() => {
    if (troopCapacityLimit === null) {
      return null;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      return Math.max(0, troopCapacityLimit - targetExplorerCount);
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot === "number") {
        const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
        const targetGuardCountValue = Number(targetGuard?.troops.count ?? 0);
        const targetGuardCount = Number.isFinite(targetGuardCountValue) ? targetGuardCountValue : 0;
        return Math.max(0, troopCapacityLimit - targetGuardCount);
      }
      return null;
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return Math.max(0, troopCapacityLimit - targetExplorerCount);
    }

    return null;
  }, [troopCapacityLimit, transferDirection, guardSlot, targetExplorerCount, targetGuards]);

  const capacityRemainingDisplay =
    capacityRemainingTarget !== null && Number.isFinite(capacityRemainingTarget)
      ? Math.max(0, Math.floor(capacityRemainingTarget))
      : null;

  const effectiveTroopAmount = Math.max(0, Math.min(troopAmount, maxTroops));
  const capacityRemainingAfterTransfer =
    capacityRemainingTarget !== null && Number.isFinite(capacityRemainingTarget)
      ? Math.max(0, capacityRemainingTarget - effectiveTroopAmount)
      : null;

  const capacityBlockedMessage = useMemo(() => {
    if (troopCapacityLimit === null || !capacityBlocked) {
      return null;
    }

    const limitText = troopCapacityLimit.toLocaleString();

    if (capacityBlocked.type === "guard" && typeof capacityBlocked.slotIndex === "number") {
      return `Guard slot ${DISPLAYED_SLOT_NUMBER_MAP[capacityBlocked.slotIndex as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} is at maximum capacity (${limitText} troops).`;
    }

    return `Target explorer is at maximum capacity (${limitText} troops).`;
  }, [capacityBlocked, troopCapacityLimit]);

  const capacityNotice = useMemo(() => {
    if (troopCapacityLimit === null) {
      return null;
    }

    if (capacityBlockedMessage) {
      return { tone: "danger" as const, message: capacityBlockedMessage };
    }

    if (capacityRemainingDisplay === null) {
      return null;
    }

    const limitText = troopCapacityLimit.toLocaleString();
    const remainingBefore = capacityRemainingDisplay;
    const remainingAfter =
      capacityRemainingAfterTransfer !== null ? capacityRemainingAfterTransfer : capacityRemainingDisplay;

    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return {
          tone: "danger" as const,
          message: `Destination explorer will be at maximum capacity (${limitText} troops) after this transfer.`,
        };
      }

      return {
        tone: "muted" as const,
        message: `Explorer capacity after transfer: ${remainingAfter.toLocaleString()} (current remaining: ${remainingBefore.toLocaleString()}, max ${limitText})`,
      };
    }

    if (transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot === "number") {
      const guardName =
        GUARD_SLOT_NAMES[guardSlot as keyof typeof GUARD_SLOT_NAMES] ??
        `Guard slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]}`;
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return {
          tone: "danger" as const,
          message: `${guardName} will be at maximum capacity (${limitText} troops) after this transfer.`,
        };
      }

      return {
        tone: "muted" as const,
        message: `${guardName} capacity after transfer: ${remainingAfter.toLocaleString()} (current remaining: ${remainingBefore.toLocaleString()}, max ${limitText})`,
      };
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return {
          tone: "danger" as const,
          message: `Destination explorer will be at maximum capacity (${limitText} troops) after this transfer.`,
        };
      }

      return {
        tone: "muted" as const,
        message: `Explorer capacity after transfer: ${remainingAfter.toLocaleString()} (current remaining: ${remainingBefore.toLocaleString()}, max ${limitText})`,
      };
    }

    return null;
  }, [
    capacityBlockedMessage,
    capacityRemainingAfterTransfer,
    capacityRemainingDisplay,
    effectiveTroopAmount,
    guardSlot,
    transferDirection,
    troopCapacityLimit,
  ]);

  const findDefaultGuardSlot = useCallback((): GuardSelection => {
    if (!guardSelectionRequired) {
      return null;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;
      const targetTroopCount = targetTroop?.count;
      const hasExistingTargetTroops =
        typeof targetTroopCount === "bigint"
          ? targetTroopCount !== 0n
          : typeof targetTroopCount === "number"
            ? targetTroopCount > 0
            : typeof targetTroopCount === "string" && Number(targetTroopCount) > 0;

      const canUseBalance =
        Boolean(structureTroopBalance) &&
        isStructureOwnerOfExplorer &&
        structureBalanceCount > 0 &&
        (!hasExistingTargetTroops ||
          (targetTroop?.tier === structureTroopBalance?.tier &&
            targetTroop?.category === structureTroopBalance?.category));

      if (canUseBalance) {
        return BALANCE_SLOT;
      }

      for (const slotId of availableGuards) {
        const guard = selectedGuards.find((entry) => entry.slot === slotId);
        if (!guard?.troops) {
          continue;
        }

        const { tier, category, count } = guard.troops;
        if (count <= 0) {
          continue;
        }

        if (hasExistingTargetTroops && targetTroop) {
          if (targetTroop.tier !== tier || targetTroop.category !== category) {
            continue;
          }
        }

        return guard.slot;
      }
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      const explorerTroop = selectedExplorerTroops?.troops;
      if (!explorerTroop) {
        return null;
      }

      for (const slotId of availableGuards) {
        const guard = targetGuards.find((entry) => entry.slot === slotId);
        const troop = guard?.troops;
        const cooldownEnd = guard?.cooldownEnd ?? 0;

        if (cooldownEnd > currentBlockTimestamp) {
          continue;
        }

        if (!troop || troop.count === 0) {
          return slotId;
        }

        if (explorerTroop.tier === troop.tier && explorerTroop.category === troop.category) {
          return slotId;
        }
      }
    }

    return null;
  }, [
    guardSelectionRequired,
    transferDirection,
    structureTroopBalance,
    structureBalanceCount,
    isStructureOwnerOfExplorer,
    targetExplorerTroops,
    availableGuards,
    selectedGuards,
    selectedExplorerTroops,
    targetGuards,
    currentBlockTimestamp,
  ]);

  // Handle troop amount change
  const handleTroopAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Ensure we don't exceed available troops
      setTroopAmount(Math.min(value, maxTroops));
    }
  };

  useEffect(() => {
    setTroopAmount(0);
  }, [transferDirection, guardSlot]);

  useEffect(() => {
    if (!guardSelectionRequired) {
      if (guardSlot !== null) {
        setGuardSlot(null);
      }
      return;
    }

    if (guardSlot === BALANCE_SLOT) {
      if (transferDirection !== TransferDirection.StructureToExplorer) {
        setGuardSlot(null);
      }
      return;
    }

    if (typeof guardSlot === "number" && !availableGuards.includes(guardSlot)) {
      setGuardSlot(null);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot, transferDirection]);

  useEffect(() => {
    if (!guardSelectionRequired) {
      return;
    }

    if (guardSlot === BALANCE_SLOT) {
      if (transferDirection === TransferDirection.StructureToExplorer) {
        return;
      }
      setGuardSlot(null);
      return;
    }

    if (typeof guardSlot === "number" && availableGuards.includes(guardSlot)) {
      return;
    }

    const defaultSlot = findDefaultGuardSlot();
    if (defaultSlot !== null) {
      setGuardSlot(defaultSlot);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot, transferDirection, findDefaultGuardSlot]);

  useEffect(() => {
    if (transferDirection !== TransferDirection.ExplorerToStructure) {
      return;
    }

    if (typeof guardSlot !== "number") {
      return;
    }

    const guard = targetGuards.find((entry) => entry.slot === guardSlot);
    if (!guard) {
      return;
    }

    if ((guard.cooldownEnd ?? 0) > currentBlockTimestamp) {
      setGuardSlot(null);
    }
  }, [transferDirection, guardSlot, targetGuards, currentBlockTimestamp]);

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedHex || !targetEntityId) return;

    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedHex.x, row: selectedHex.y },
      { col: targetHex.x, row: targetHex.y },
    );
    if (direction === null) return;

    try {
      setLoading(true);

      // Apply precision to troop amount for the transaction
      const troopAmountWithPrecision = multiplyByPrecision(troopAmount);
      if (transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot !== "number") {
        return;
      }

      const sourceExplorerCount = selectedExplorerTroops?.troops.count ?? null;
      const willEmptySourceExplorer =
        (transferDirection === TransferDirection.ExplorerToExplorer ||
          transferDirection === TransferDirection.ExplorerToStructure) &&
        sourceExplorerCount !== null &&
        BigInt(troopAmountWithPrecision) >= sourceExplorerCount;

      if (willEmptySourceExplorer) {
        const resolvedExplorerResources =
          selectedExplorerResources ?? (await getExplorerFromToriiClient(toriiClient, selectedEntityId)).resources;

        if (!resolvedExplorerResources) {
          throw new Error("Unable to load explorer resources for auto relic transfer");
        }

        const relicResources: RelicResourceTransfer[] = RELIC_RESOURCE_IDS.map((resourceId) => {
          const { balance } = ResourceManager.balanceWithProduction(
            resolvedExplorerResources,
            currentDefaultTick,
            resourceId as ResourcesIds,
          );
          return {
            resourceId,
            amount: balance,
          };
        }).filter((entry) => entry.amount > 0);

        if (relicResources.length > 0) {
          if (transferDirection === TransferDirection.ExplorerToExplorer) {
            await troop_troop_adjacent_transfer({
              signer: account,
              from_troop_id: selectedEntityId,
              to_troop_id: targetEntityId,
              resources: relicResources,
            });
          }

          if (transferDirection === TransferDirection.ExplorerToStructure) {
            await troop_structure_adjacent_transfer({
              signer: account,
              from_explorer_id: selectedEntityId,
              to_structure_id: targetEntityId,
              resources: relicResources,
            });
          }
        }
      }

      if (transferDirection === TransferDirection.StructureToExplorer) {
        if (guardSlot === BALANCE_SLOT && structureTroopBalance) {
          // Get home direction for the explorer
          const homeDirection = getDirectionBetweenAdjacentHexes(
            // from army to structure to find home direction
            { col: targetHex.x, row: targetHex.y },
            { col: selectedHex.x, row: selectedHex.y },
          );
          if (homeDirection === null) return;

          await explorer_add({
            signer: account,
            to_explorer_id: targetEntityId,
            amount: troopAmountWithPrecision,
            home_direction: homeDirection,
          });
        } else if (typeof guardSlot === "number") {
          await guard_explorer_swap({
            signer: account,
            from_structure_id: selectedEntityId,
            from_guard_slot: guardSlot,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmountWithPrecision,
          });
        } else {
          return;
        }
      } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
        await explorer_explorer_swap({
          signer: account,
          from_explorer_id: selectedEntityId,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      } else if (transferDirection === TransferDirection.ExplorerToStructure) {
        if (typeof guardSlot !== "number") return;

        const calldata = {
          signer: account,
          from_explorer_id: selectedEntityId,
          to_structure_id: targetEntityId,
          to_structure_direction: direction,
          to_guard_slot: guardSlot,
          count: troopAmountWithPrecision,
        };
        await explorer_guard_swap(calldata);
      }

      onTransferComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isTroopsTransferDisabled = (() => {
    if (troopAmount === 0) return true;

    if (guardSelectionRequired && guardSlot === null) {
      return true;
    }

    if (
      transferDirection === TransferDirection.StructureToExplorer &&
      guardSlot === BALANCE_SLOT &&
      !isStructureOwnerOfExplorer
    ) {
      return true;
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot !== "number") return true;
      const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
      if (!targetGuard) {
        return true;
      }
      if ((targetGuard.cooldownEnd ?? 0) > currentBlockTimestamp) {
        return true;
      }

      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuard.troops;
      if (targetTroop?.count === 0) {
        return false;
      }
      return selectedTroopData?.tier !== targetTroop?.tier || selectedTroopData?.category !== targetTroop?.category;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;

      if (guardSlot === BALANCE_SLOT) {
        if (targetTroop?.count === 0n) {
          return false;
        }
        if (!structureTroopBalance) {
          return true;
        }
        return (
          structureTroopBalance.tier !== targetTroop?.tier || structureTroopBalance.category !== targetTroop?.category
        );
      }

      if (typeof guardSlot !== "number") {
        return true;
      }

      if (targetTroop?.count === 0n) {
        return false;
      }

      return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (selectedExplorerTroops?.troops.category !== targetExplorerTroops?.troops.category) {
        return true;
      }
      if (selectedExplorerTroops?.troops.tier !== targetExplorerTroops?.troops.tier) {
        return true;
      }
      return false;
    }

    return false;
  })();

  const getTroopMismatchMessage = () => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot !== "number") return null;
      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuards.find((guard) => guard.slot === guardSlot)?.troops;

      if (!selectedTroopData || !targetTroop || targetTroop.count === 0) {
        return null;
      }

      if (selectedTroopData.tier !== targetTroop.tier || selectedTroopData.category !== targetTroop.category) {
        return `Troop mismatch: You can only transfer troops of the same tier and type (Tier ${selectedTroopData.tier} ${selectedTroopData.category} ≠ Tier ${targetTroop.tier} ${targetTroop.category})`;
      }
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;

      if (guardSlot === BALANCE_SLOT) {
        if (!structureTroopBalance || targetTroop?.count === 0n) {
          return null;
        }

        if (
          structureTroopBalance.tier !== targetTroop?.tier ||
          structureTroopBalance.category !== targetTroop?.category
        ) {
          return `Troop mismatch: Explorer requires Tier ${targetTroop?.tier ?? "?"} ${targetTroop?.category ?? "?"}`;
        }

        return null;
      }

      if (typeof guardSlot !== "number") return null;
      const selectedTroopData = selectedTroop;

      if (!selectedTroopData || !targetTroop || targetTroop.count === 0n) {
        return null;
      }

      if (selectedTroopData.tier !== targetTroop.tier || selectedTroopData.category !== targetTroop.category) {
        return `Troop mismatch: You can only transfer troops of the same tier and type (Tier ${selectedTroopData.tier} ${selectedTroopData.category} ≠ Tier ${targetTroop.tier} ${targetTroop.category})`;
      }
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (selectedExplorerTroops?.troops.category !== targetExplorerTroops?.troops.category) {
        return `Troop mismatch: Category mismatch (${selectedExplorerTroops?.troops.category} ≠ ${targetExplorerTroops?.troops.category})`;
      }
      if (selectedExplorerTroops?.troops.tier !== targetExplorerTroops?.troops.tier) {
        return `Troop mismatch: Tier mismatch (Tier ${selectedExplorerTroops?.troops.tier} ≠ Tier ${targetExplorerTroops?.troops.tier})`;
      }
    }

    return null;
  };

  const getDisabledMessage = () => {
    if (loading) return "Processing transfer...";
    if (troopAmount === 0) return "Please select an amount of troops to transfer";

    if (guardSelectionRequired && guardSlot === null) {
      return "Please select a guard slot";
    }

    if (
      transferDirection === TransferDirection.StructureToExplorer &&
      guardSlot === BALANCE_SLOT &&
      !isStructureOwnerOfExplorer
    ) {
      return "Cannot use structure balance: Explorer is not owned by this structure";
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (selectedExplorerTroops?.troops.category !== targetExplorerTroops?.troops.category) {
        return `Cannot transfer troops: Category mismatch (${selectedExplorerTroops?.troops.category} ≠ ${targetExplorerTroops?.troops.category})`;
      }
      if (selectedExplorerTroops?.troops.tier !== targetExplorerTroops?.troops.tier) {
        return `Cannot transfer troops: Tier mismatch (Tier ${selectedExplorerTroops?.troops.tier} ≠ Tier ${targetExplorerTroops?.troops.tier})`;
      }
    }

    if (transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot === "number") {
      const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
      if (targetGuard) {
        const cooldownRemaining = Math.max(0, (targetGuard.cooldownEnd ?? 0) - currentBlockTimestamp);
        if (cooldownRemaining > 0) {
          return `Cannot transfer troops: Slot is on cooldown (${formatTime(cooldownRemaining)} remaining)`;
        }
      }

      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuard?.troops;
      if (
        targetTroop?.count !== 0 &&
        (selectedTroopData?.tier !== targetTroop?.tier || selectedTroopData?.category !== targetTroop?.category)
      ) {
        return `Cannot transfer troops: Type mismatch (Tier ${selectedTroopData?.tier} ${selectedTroopData?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;

      if (guardSlot === BALANCE_SLOT) {
        if (
          structureTroopBalance &&
          targetTroop?.count !== 0n &&
          (structureTroopBalance.tier !== targetTroop?.tier || structureTroopBalance.category !== targetTroop?.category)
        ) {
          return `Cannot transfer troops: Explorer requires Tier ${targetTroop?.tier ?? "?"} ${targetTroop?.category ?? "?"}`;
        }
      } else if (typeof guardSlot === "number") {
        if (
          targetTroop?.count !== 0n &&
          (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category)
        ) {
          return `Cannot transfer troops: Type mismatch (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
        }
      }
    }

    return null;
  };

  const guardSelectionComplete = !guardSelectionRequired || guardSlot !== null;
  const amountStepComplete = troopAmount > 0;
  const stepOneReady = guardSelectionComplete && amountStepComplete;
  const transferReady = stepOneReady && !isTroopsTransferDisabled;

  const disabledMessage = getDisabledMessage();
  const troopMismatchMessage = getTroopMismatchMessage();

  const quickAmountOptions = useMemo(() => {
    if (maxTroops <= 0) return [];

    const options: Array<{ label: string; value: number }> = [];
    const percentToAmount = (fraction: number) => Math.min(maxTroops, Math.max(1, Math.round(maxTroops * fraction)));

    const quarter = percentToAmount(0.25);
    if (quarter > 0 && quarter < maxTroops) {
      options.push({ label: "25%", value: quarter });
    }

    const half = percentToAmount(0.5);
    if (half > 0 && half < maxTroops && half !== quarter) {
      options.push({ label: "50%", value: half });
    }

    options.push({ label: "Max", value: maxTroops });

    return options;
  }, [maxTroops]);

  const handleQuickAmountSelect = (value: number) => {
    setTroopAmount(Math.min(value, maxTroops));
  };

  const transferBalanceCards = useMemo<TransferBalanceCardData[]>(() => {
    if (troopAmount <= 0) return [];
    const cards: TransferBalanceCardData[] = [];

    const pushCard = (
      label: string,
      beforeRaw: number,
      afterRaw: number,
      gainText = "gain",
      lossText = "sent",
      troop?: { tier: TroopTier | string; category: TroopType | string },
    ) => {
      const before = Math.max(0, beforeRaw);
      const after = Math.max(0, afterRaw);
      const delta = after - before;
      let tone: "positive" | "negative" | "neutral" = "neutral";
      let changeLabel = "No change";

      if (delta > 0) {
        tone = "positive";
        changeLabel = `+${formatNumber(delta, 0)} ${gainText}`;
      } else if (delta < 0) {
        tone = "negative";
        changeLabel = `-${formatNumber(Math.abs(delta), 0)} ${lossText}`;
      }

      cards.push({ label, before, after, tone, changeLabel, troop });
    };

    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (guardSlot === BALANCE_SLOT && structureTroopBalance) {
        pushCard("Structure balance", structureBalanceCount, structureBalanceCount - troopAmount, "remaining", "sent", {
          tier: structureTroopBalance?.tier ?? null,
          category: structureTroopBalance?.category,
        });
      } else if (typeof guardSlot === "number") {
        const guardInfo = selectedGuards.find((guard) => guard.slot === guardSlot);
        if (guardInfo) {
          pushCard(
            `Guard slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} (${GUARD_SLOT_NAMES[guardSlot as keyof typeof GUARD_SLOT_NAMES]})`,
            guardInfo.troops?.count ?? 0,
            (guardInfo.troops?.count ?? 0) - troopAmount,
            "remaining",
            "sent",
            { tier: guardInfo.troops.tier, category: guardInfo.troops.category },
          );
        }
      }

      if (targetExplorerTroops) {
        pushCard("Explorer", targetExplorerCount, targetExplorerCount + troopAmount, "arriving", "remaining", {
          tier: targetExplorerTroops.troops.tier,
          category: targetExplorerTroops.troops.category,
        });
      }
    } else if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (selectedExplorerTroops) {
        pushCard("Explorer", selectedExplorerCount, selectedExplorerCount - troopAmount, "remaining", "sent", {
          tier: selectedExplorerTroops.troops.tier,
          category: selectedExplorerTroops.troops.category,
        });
      }

      if (typeof guardSlot === "number") {
        const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
        if (targetGuard) {
          pushCard(
            `Guard slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} (${GUARD_SLOT_NAMES[guardSlot as keyof typeof GUARD_SLOT_NAMES]})`,
            targetGuard.troops.count,
            targetGuard.troops.count + troopAmount,
            "arriving",
            "remaining",
            { tier: targetGuard.troops.tier, category: targetGuard.troops.category },
          );
        }
      }
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (selectedExplorerTroops) {
        pushCard("From explorer", selectedExplorerCount, selectedExplorerCount - troopAmount, "remaining", "sent", {
          tier: selectedExplorerTroops.troops.tier,
          category: selectedExplorerTroops.troops.category,
        });
      }

      if (targetExplorerTroops) {
        pushCard("To explorer", targetExplorerCount, targetExplorerCount + troopAmount, "arriving", "remaining", {
          tier: targetExplorerTroops.troops.tier,
          category: targetExplorerTroops.troops.category,
        });
      }
    }

    return cards;
  }, [
    transferDirection,
    troopAmount,
    structureTroopBalance,
    structureBalanceCount,
    guardSlot,
    selectedGuards,
    targetGuards,
    targetExplorerTroops,
    selectedExplorerTroops,
    selectedExplorerCount,
    targetExplorerCount,
  ]);

  const selectedTroopForSlots = useMemo(() => {
    const troop = selectedExplorerTroops?.troops;
    if (!troop) return undefined;
    return { tier: troop.tier as TroopTier, category: troop.category as TroopType };
  }, [selectedExplorerTroops?.troops]);

  const targetTroopForSlots = useMemo(() => {
    const troop = targetExplorerTroops?.troops;
    if (!troop) return undefined;
    const rawCount = troop.count;
    const count =
      typeof rawCount === "bigint"
        ? rawCount
        : typeof rawCount === "number"
          ? rawCount
          : typeof rawCount === "string"
            ? Number(rawCount)
            : undefined;
    return { tier: troop.tier as TroopTier, category: troop.category as TroopType, count };
  }, [targetExplorerTroops?.troops]);

  return (
    <div className="flex flex-col space-y-4">
      {isTargetLoading || isSelectedLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex items-start justify-center gap-4">
              <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4 max-w-3xl">
                {guardSelectionRequired && (
                  <div className="space-y-3">
                    <TransferSlotSelection
                      transferDirection={transferDirection}
                      slots={visualGuardSlots}
                      orderedSlots={orderedGuardSlots}
                      guards={
                        transferDirection === TransferDirection.StructureToExplorer ? selectedGuards : targetGuards
                      }
                      selectedSlot={guardSlot}
                      onSelect={(slot) => {
                        if (slot === BALANCE_SLOT || typeof slot === "number") {
                          setGuardSlot(slot as GuardSelection);
                        }
                      }}
                      balanceOption={{
                        key: BALANCE_SLOT,
                        visible: canShowStructureBalanceOption && !!structureBalanceTroopInfo,
                        troop: structureBalanceTroopInfo,
                        disabled: balanceOptionDisabled,
                        disabledReason: balanceOptionDisabledReason,
                      }}
                      selectedTroop={
                        transferDirection === TransferDirection.ExplorerToStructure ? selectedTroopForSlots : undefined
                      }
                      targetTroop={
                        transferDirection === TransferDirection.StructureToExplorer ? targetTroopForSlots : undefined
                      }
                      frontlineSlot={frontlineSlot}
                      lastGuardSlot={lastGuardSlot}
                      currentBlockTimestamp={currentBlockTimestamp}
                    />
                  </div>
                )}

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      id="troopAmountInput"
                      type="range"
                      min="0"
                      max={maxTroops}
                      value={troopAmount}
                      onChange={handleTroopAmountChange}
                      className="w-full accent-gold"
                    />
                    <input
                      type="number"
                      min="0"
                      max={maxTroops}
                      value={troopAmount}
                      onChange={handleTroopAmountChange}
                      className="w-24 rounded-md border border-gold/30 bg-dark-brown px-3 py-1 text-gold"
                    />
                  </div>
                  {capacityNotice && (
                    <div
                      className={`rounded-md border px-3 py-2 text-xs ${
                        capacityNotice.tone === "danger"
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-gold/30 text-gold/60"
                      }`}
                    >
                      {capacityNotice.message}
                    </div>
                  )}
                  {quickAmountOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gold/60">Quick set:</span>
                      {quickAmountOptions.map((option) => {
                        const isActive = troopAmount === option.value;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => handleQuickAmountSelect(option.value)}
                            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                              isActive
                                ? "border-gold bg-gold/20 text-gold"
                                : "border-gold/30 bg-dark-brown text-gold/70 hover:bg-gold/10"
                            }`}
                            aria-pressed={isActive}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4 w-full max-w-md">
                <div className="rounded-md border border-gold/40 bg-dark-brown/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-gold/60">Transfer direction</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-gold">{directionLabel}</span>
                    {onToggleDirection ? (
                      <Button
                        onClick={onToggleDirection}
                        variant="outline"
                        size="xs"
                        disabled={!canToggleDirection}
                        forceUppercase={false}
                        className="flex items-center gap-2"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        Swap
                      </Button>
                    ) : null}
                  </div>
                </div>
                <TransferBalanceCards cards={transferBalanceCards} />

                {troopMismatchMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger/80">
                    <AlertTriangle className="mt-[2px] h-4 w-4 flex-shrink-0" />
                    <span>{troopMismatchMessage}</span>
                  </div>
                )}

                {!transferReady && disabledMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger/80">
                    <AlertTriangle className="mt-[2px] h-4 w-4 flex-shrink-0" />
                    <span>{disabledMessage}</span>
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <Button
                    onClick={handleTransfer}
                    variant="primary"
                    disabled={loading || isTroopsTransferDisabled}
                    isLoading={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? "Processing..." : "Transfer Troops"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
