import Button from "@/ui/design-system/atoms/button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  configManager,
  divideByPrecision,
  getGuardsByStructure,
  getTroopResourceId,
  multiplyByPrecision,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import {
  DEFENSE_NAMES,
  getDirectionBetweenAdjacentHexes,
  ID,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TransferDirection } from "./help-container";
import { TransferBalanceCardData, TransferBalanceCards } from "./transfer-troops/transfer-balance-cards";
import { TroopBadge } from "./transfer-troops/transfer-troop-badge";

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
}

const BALANCE_SLOT = "balance" as const;

type GuardSelection = number | typeof BALANCE_SLOT | null;

export const TransferTroopsContainer = ({
  selectedEntityId,
  targetEntityId,
  selectedHex,
  targetHex,
  transferDirection,
  onTransferComplete,
}: TransferTroopsContainerProps) => {
  const {
    account: { account },
    network: { toriiClient },
    setup: {
      systemCalls: { explorer_explorer_swap, explorer_guard_swap, guard_explorer_swap, explorer_add },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<GuardSelection>(null);

  const troopMaxSizeRaw = configManager.getTroopConfig().troop_max_size;
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
  const targetStructure = targetEntityData?.structure;
  const targetExplorerTroops = targetEntityData?.explorer;

  const isBalanceSelected = guardSlot === BALANCE_SLOT;

  const getStructureDefenseSlots = useCallback(
    (structureType: StructureType, structureLevel: number) => {
      const config = configManager.getWorldStructureDefenseSlotsConfig();
      switch (structureType) {
        case StructureType.FragmentMine:
          return config[structureType];
        case StructureType.Hyperstructure:
          return config[structureType];
        case StructureType.Bank:
          return config[structureType];
        case StructureType.Village:
          return structureLevel + 1;
        case StructureType.Realm:
          return structureLevel + 1;
        default:
          return 0;
      }
    },
    [configManager],
  );

  const availableGuards = useMemo<number[]>(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      // Guards are on the target structure
      if (!targetStructure) return [];
      return Array.from(
        { length: getStructureDefenseSlots(targetStructure.category, targetStructure.base.level) },
        (_, i) => i,
      );
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      // Guards are on the selected structure
      if (!selectedStructure) return [];
      return Array.from(
        { length: getStructureDefenseSlots(selectedStructure.category, selectedStructure.base.level) },
        (_, i) => i,
      );
    } else {
      return [];
    }
  }, [selectedStructure, targetStructure, transferDirection]);

  const guardSelectionRequired = useMemo(() => {
    return (
      transferDirection === TransferDirection.StructureToExplorer ||
      transferDirection === TransferDirection.ExplorerToStructure
    );
  }, [transferDirection]);

  // list of guards
  const targetGuards = useMemo(() => {
    if (!targetStructure) return [];
    const guards = getGuardsByStructure(targetStructure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        tier: guard.troops.tier as TroopTier,
        category: guard.troops.category as TroopType,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [targetStructure]);

  // list of guards
  const selectedGuards = useMemo(() => {
    if (!selectedStructure) return [];
    const guards = getGuardsByStructure(selectedStructure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        tier: guard.troops.tier as TroopTier,
        category: guard.troops.category as TroopType,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [selectedStructure]);

  const selectedTroop = useMemo(() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (isBalanceSelected && structureTroopBalance) {
        return {
          category: structureTroopBalance.category as TroopType,
          tier: structureTroopBalance.tier as TroopTier,
          count: divideByPrecision(Number(structureTroopBalance.balance)),
        };
      }

      if (typeof guardSlot === "number" && selectedGuards[guardSlot]) {
        return selectedGuards[guardSlot].troops;
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
      return "Explorer is not owned by this structure. Claim control before sending from balance.";
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
              const availableValue = Number(selectedGuards[guardSlot]?.troops.count ?? 0);
              return Number.isFinite(availableValue) ? availableValue : 0;
            })()
          : 0;
      return { maxTroops: Math.min(sourceAvailable, targetCapacity), capacityBlocked: null };
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot !== "number") {
        return { maxTroops: 0, capacityBlocked: null };
      }
      const targetGuard = targetGuards[guardSlot];
      const targetGuardCountValue = Number(targetGuard?.troops.count ?? 0);
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
        const targetGuard = targetGuards[guardSlot];
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
      return `Guard slot ${capacityBlocked.slotIndex + 1} is at maximum capacity (${limitText} troops).`;
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
      const guardName = DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES] ?? `Guard slot ${guardSlot + 1}`;
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

      for (const slotIndex of availableGuards) {
        const guard = selectedGuards[slotIndex];
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

        return slotIndex;
      }
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      const explorerTroop = selectedExplorerTroops?.troops;
      if (!explorerTroop) {
        return null;
      }

      for (const slotIndex of availableGuards) {
        const guard = targetGuards[slotIndex];
        if (!guard?.troops) {
          continue;
        }

        const { tier, category, count } = guard.troops;
        if (count === 0) {
          return slotIndex;
        }

        if (explorerTroop.tier === tier && explorerTroop.category === category) {
          return slotIndex;
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
      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuards[guardSlot]?.troops;
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
      const targetTroop = targetGuards[guardSlot]?.troops;

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
      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuards[guardSlot]?.troops;
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
      } else if (typeof guardSlot === "number" && selectedGuards[guardSlot]) {
        const guardInfo = selectedGuards[guardSlot];
        pushCard(
          `Guard slot ${guardSlot + 1} (${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]})`,
          guardInfo.troops.count,
          guardInfo.troops.count - troopAmount,
          "remaining",
          "sent",
          { tier: guardInfo.troops.tier, category: guardInfo.troops.category },
        );
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

      if (typeof guardSlot === "number" && targetGuards[guardSlot]) {
        const targetGuard = targetGuards[guardSlot];
        pushCard(
          `Guard slot ${guardSlot + 1} (${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]})`,
          targetGuard.troops.count,
          targetGuard.troops.count + troopAmount,
          "arriving",
          "remaining",
          { tier: targetGuard.troops.tier, category: targetGuard.troops.category },
        );
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

  return (
    <div className="flex flex-col space-y-4">
      {isTargetLoading || isSelectedLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          <div className="space-y-4">
            <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-gold">Step 1: Select source & amount</h4>
                  <p className="text-xs text-gold/70">
                    {guardSelectionRequired
                      ? transferDirection === TransferDirection.StructureToExplorer
                        ? "Choose a troop source and set how many troops to send."
                        : "Choose the guard slot and set how many troops to send."
                      : "Troop source is fixed for this transfer. Set how many troops to send."}
                  </p>
                  {capacityNotice && (
                    <div
                      className={`mt-2 text-xs ${capacityNotice.tone === "danger" ? "text-danger" : "text-gold/60"}`}
                    >
                      {capacityNotice.message}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-medium ${stepOneReady ? "text-gold/60" : "text-danger/80"}`}>
                  {stepOneReady ? "Ready" : "Action required"}
                </span>
              </div>

              {guardSelectionRequired && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gold">
                    {transferDirection === TransferDirection.StructureToExplorer
                      ? "Select troop source"
                      : "Select guard slot"}
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {canShowStructureBalanceOption && structureBalanceTroopInfo && (
                      <button
                        key="structure-balance"
                        type="button"
                        onClick={() => {
                          if (!balanceOptionDisabled) {
                            setGuardSlot(BALANCE_SLOT);
                          }
                        }}
                        className={[
                          "flex flex-col rounded-md border p-3 text-left transition-all duration-150 ease-in-out",
                          balanceOptionDisabled
                            ? "cursor-not-allowed bg-dark-brown border-gold/20 opacity-70"
                            : "cursor-pointer bg-dark-brown border-gold/30 hover:bg-gold/10",
                          guardSlot === BALANCE_SLOT &&
                            !balanceOptionDisabled &&
                            "bg-gold/20 border-gold ring-2 ring-gold/50",
                          guardSlot === BALANCE_SLOT && balanceOptionDisabled && "bg-gold/10 border-gold/40",
                          balanceOptionMismatch && "border-danger/60 bg-danger/10",
                        ]
                          .filter((value): value is string => Boolean(value))
                          .join(" ")}
                        aria-pressed={guardSlot === BALANCE_SLOT}
                        disabled={balanceOptionDisabled}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gold">Structure balance</span>
                          {balanceOptionDisabledReason && <AlertTriangle className="h-4 w-4 text-danger" />}
                        </div>
                        <div className="text-sm text-gold/80">
                          <TroopBadge
                            category={structureBalanceTroopInfo.category}
                            tier={structureBalanceTroopInfo.tier}
                            label={structureBalanceTroopInfo.category}
                          />
                        </div>
                        <div className="text-sm text-gold/60">
                          Available: {formatNumber(structureBalanceTroopInfo.count, 0)}
                        </div>
                        {balanceOptionDisabledReason && (
                          <div className="mt-2 flex items-start gap-2 text-xs text-danger/80">
                            <AlertTriangle className="mt-[2px] h-4 w-4 flex-shrink-0" />
                            <span>{balanceOptionDisabledReason}</span>
                          </div>
                        )}
                      </button>
                    )}

                    {availableGuards.map((slotIndex) => {
                      const guards =
                        transferDirection === TransferDirection.StructureToExplorer ? selectedGuards : targetGuards;
                      const guardData = guards[slotIndex];
                      if (!guardData || !guardData.troops) {
                        return (
                          <div
                            key={slotIndex}
                            className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger/70"
                          >
                            Slot {slotIndex + 1} - Empty
                          </div>
                        );
                      }

                      const troopInfo = guardData.troops;
                      const isActive = guardSlot === slotIndex;
                      const isSourceGuardSelection = transferDirection === TransferDirection.StructureToExplorer;
                      const isOutOfTroops = isSourceGuardSelection && troopInfo.count <= 0;

                      const isMismatch =
                        transferDirection === TransferDirection.ExplorerToStructure
                          ? troopInfo.count !== 0 &&
                            selectedExplorerTroops?.troops &&
                            (selectedExplorerTroops.troops.tier !== troopInfo.tier ||
                              selectedExplorerTroops.troops.category !== troopInfo.category)
                          : transferDirection === TransferDirection.StructureToExplorer &&
                            targetExplorerTroops?.troops &&
                            targetExplorerTroops.troops.count !== 0n &&
                            (targetExplorerTroops.troops.tier !== troopInfo.tier ||
                              targetExplorerTroops.troops.category !== troopInfo.category);

                      const cardClasses = [
                        "flex flex-col rounded-md border p-3 text-left transition-all duration-150 ease-in-out",
                        isOutOfTroops ? "cursor-not-allowed bg-dark-brown border-gold/20 opacity-70" : "cursor-pointer",
                        isActive && !isMismatch && !isOutOfTroops && "bg-gold/20 border-gold ring-2 ring-gold/50",
                        isActive && isMismatch && !isOutOfTroops && "bg-danger/10 border-danger/60",
                        isActive && isOutOfTroops && "bg-dark-brown border-gold/20 opacity-70",
                        !isActive && !isMismatch && !isOutOfTroops && "bg-dark-brown border-gold/30 hover:bg-gold/10",
                        !isActive &&
                          isMismatch &&
                          !isOutOfTroops &&
                          "bg-danger/10 border-danger/50 hover:border-danger/60",
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" ");

                      return (
                        <button
                          key={slotIndex}
                          type="button"
                          onClick={() => {
                            if (isOutOfTroops) {
                              return;
                            }
                            setGuardSlot(slotIndex);
                          }}
                          className={cardClasses}
                          disabled={isOutOfTroops}
                          aria-disabled={isOutOfTroops}
                          aria-pressed={isActive}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gold">
                              {DEFENSE_NAMES[slotIndex as keyof typeof DEFENSE_NAMES]}
                            </span>
                            {isMismatch && <AlertTriangle className="h-4 w-4 text-danger" />}
                          </div>
                          <div className="text-sm text-gold/80">
                            <TroopBadge
                              category={troopInfo.category}
                              tier={troopInfo.tier}
                              label={troopInfo.category}
                            />
                          </div>
                          <div className="text-sm text-gold/60">Available: {formatNumber(troopInfo.count, 0)}</div>
                          {isMismatch && (
                            <div className="mt-2 flex items-start gap-2 text-xs text-danger/80">
                              <AlertTriangle className="mt-[2px] h-4 w-4 flex-shrink-0" />
                              <span>
                                {transferDirection === TransferDirection.ExplorerToStructure
                                  ? `Slot holds Tier ${troopInfo.tier} ${troopInfo.category}. Explorer has Tier ${selectedExplorerTroops?.troops.tier} ${selectedExplorerTroops?.troops.category}.`
                                  : `Explorer expects Tier ${targetExplorerTroops?.troops.tier} ${targetExplorerTroops?.troops.category}. Slot holds Tier ${troopInfo.tier} ${troopInfo.category}.`}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col space-y-2">
                <label htmlFor="troopAmountInput" className="text-sm font-semibold text-gold">
                  Set amount to transfer
                </label>
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

            <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-gold">Step 2: Review & confirm</h4>
                  <p className="text-xs text-gold/70">Double-check the summary before sending troops.</p>
                </div>
                <span className={`text-xs font-medium ${transferReady ? "text-gold/60" : "text-danger/80"}`}>
                  {transferReady ? "Ready to transfer" : "Complete previous steps"}
                </span>
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

              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <Button
                  onClick={handleTransfer}
                  variant="primary"
                  disabled={loading || isTroopsTransferDisabled}
                  isLoading={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? "Processing..." : "Transfer Troops"}
                </Button>
                {troopAmount > 0 && !loading && !isTroopsTransferDisabled && (
                  <div className="text-center text-sm text-gold/80 sm:text-left">
                    {transferDirection === TransferDirection.StructureToExplorer && (
                      <>
                        {guardSlot === BALANCE_SLOT ? (
                          <>Transferring {formatNumber(troopAmount, 0)} troops from structure balance to explorer</>
                        ) : (
                          typeof guardSlot === "number" && (
                            <>
                              Transferring {formatNumber(troopAmount, 0)} troops from guard slot {guardSlot + 1} (
                              {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}) to explorer
                            </>
                          )
                        )}
                      </>
                    )}
                    {transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot === "number" && (
                      <>
                        Transferring {formatNumber(troopAmount, 0)} troops from explorer to guard slot {guardSlot + 1} (
                        {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]})
                      </>
                    )}
                    {transferDirection === TransferDirection.ExplorerToExplorer && (
                      <>Transferring {formatNumber(troopAmount, 0)} troops from explorer to explorer</>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
