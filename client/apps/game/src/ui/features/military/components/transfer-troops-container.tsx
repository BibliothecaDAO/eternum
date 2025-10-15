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
import { TransferStep, TransferTroopsStepper } from "./transfer-troops/transfer-troops-stepper";

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
}

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
  const [guardSlot, setGuardSlot] = useState<number | null>(null);
  const [useStructureBalance, setUseStructureBalance] = useState(false);

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
    if (transferDirection === TransferDirection.StructureToExplorer) {
      return !useStructureBalance;
    }
    return transferDirection === TransferDirection.ExplorerToStructure;
  }, [transferDirection, useStructureBalance]);

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
      if (useStructureBalance && structureTroopBalance) {
        return {
          category: structureTroopBalance.category as TroopType,
          tier: structureTroopBalance.tier as TroopTier,
          count: divideByPrecision(Number(structureTroopBalance.balance)),
        };
      } else if (guardSlot !== null && selectedGuards[guardSlot]) {
        return selectedGuards[guardSlot].troops;
      }
    }
    return null;
  }, [transferDirection, useStructureBalance, structureTroopBalance, selectedGuards, guardSlot]);

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

  const findDefaultGuardSlot = useCallback((): number | null => {
    if (!guardSelectionRequired) {
      return null;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (useStructureBalance) {
        return null;
      }

      const targetTroop = targetExplorerTroops?.troops;
      const targetTroopCount = targetTroop?.count;
      const hasExistingTargetTroops =
        typeof targetTroopCount === "bigint"
          ? targetTroopCount !== 0n
          : typeof targetTroopCount === "number"
            ? targetTroopCount > 0
            : typeof targetTroopCount === "string" && Number(targetTroopCount) > 0;

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
    useStructureBalance,
    targetExplorerTroops,
    availableGuards,
    selectedGuards,
    selectedExplorerTroops,
    targetGuards,
  ]);

  const structureBalanceCount = useMemo(() => {
    if (!structureTroopBalance) return 0;
    return divideByPrecision(Number(structureTroopBalance.balance));
  }, [structureTroopBalance]);

  const maxTroops = (() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (useStructureBalance) {
        return structureBalanceCount;
      }
      return guardSlot !== null ? Number(selectedGuards[guardSlot]?.troops.count || 0) : 0;
    } else if (transferDirection === TransferDirection.ExplorerToStructure) {
      return Math.max(0, selectedExplorerCount - 1);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return selectedExplorerCount;
    }
    return 0;
  })();

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

    if (guardSlot !== null && !availableGuards.includes(guardSlot)) {
      setGuardSlot(null);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot]);

  useEffect(() => {
    if (!guardSelectionRequired) {
      return;
    }

    if (guardSlot !== null && availableGuards.includes(guardSlot)) {
      return;
    }

    const defaultSlot = findDefaultGuardSlot();
    if (defaultSlot !== null) {
      setGuardSlot(defaultSlot);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot, findDefaultGuardSlot]);

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
        if (useStructureBalance && structureTroopBalance) {
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
        } else {
          if (guardSlot === null) return;

          await guard_explorer_swap({
            signer: account,
            from_structure_id: selectedEntityId,
            from_guard_slot: guardSlot,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmountWithPrecision,
          });
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
        if (guardSlot === null) return;

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
      useStructureBalance &&
      !isStructureOwnerOfExplorer
    ) {
      return true;
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (guardSlot === null) return true;
      const selectedTroopData = selectedExplorerTroops?.troops;
      const targetTroop = targetGuards[guardSlot]?.troops;
      if (targetTroop?.count === 0) {
        return false;
      }
      return selectedTroopData?.tier !== targetTroop?.tier || selectedTroopData?.category !== targetTroop?.category;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;

      if (useStructureBalance) {
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

      if (guardSlot === null) {
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
      if (guardSlot === null) return null;
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

      if (useStructureBalance) {
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

      if (guardSlot === null) return null;
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
      useStructureBalance &&
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

    if (transferDirection === TransferDirection.ExplorerToStructure && guardSlot !== null) {
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

      if (useStructureBalance) {
        if (
          structureTroopBalance &&
          targetTroop?.count !== 0n &&
          (structureTroopBalance.tier !== targetTroop?.tier || structureTroopBalance.category !== targetTroop?.category)
        ) {
          return `Cannot transfer troops: Explorer requires Tier ${targetTroop?.tier ?? "?"} ${targetTroop?.category ?? "?"}`;
        }
      } else if (guardSlot !== null) {
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
  const transferReady = guardSelectionComplete && amountStepComplete && !isTroopsTransferDisabled;

  const steps = useMemo<TransferStep[]>(() => {
    return [
      {
        title: guardSelectionRequired ? "Select guard slot" : "Review targets",
        description: guardSelectionRequired
          ? "Choose the guard slot that will send or receive troops."
          : "Source and destination are pre-selected.",
        status: guardSelectionComplete ? "complete" : "current",
      },
      {
        title: "Set amount",
        description: "Pick how many troops to move.",
        status: guardSelectionComplete ? (amountStepComplete ? "complete" : "current") : "pending",
      },
      {
        title: "Confirm transfer",
        description: "Review summary and execute.",
        status: guardSelectionComplete && amountStepComplete ? (transferReady ? "complete" : "current") : "pending",
      },
    ];
  }, [guardSelectionRequired, guardSelectionComplete, amountStepComplete, transferReady]);

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
      if (useStructureBalance && structureTroopBalance) {
        pushCard("Structure balance", structureBalanceCount, structureBalanceCount - troopAmount, "remaining", "sent", {
          tier: structureTroopBalance?.tier ?? null,
          category: structureTroopBalance?.category,
        });
      } else if (guardSlot !== null && selectedGuards[guardSlot]) {
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

      if (guardSlot !== null && targetGuards[guardSlot]) {
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
    useStructureBalance,
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
          <TransferTroopsStepper steps={steps} />

          <div className="space-y-4">
            <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-gold">Step 1: Select source & destination</h4>
                  <p className="text-xs text-gold/70">
                    {guardSelectionRequired
                      ? "Choose the guard slot that will send or receive troops."
                      : "Explorer and structure pairing is pre-selected for this transfer."}
                  </p>
                </div>
                <span className={`text-xs font-medium ${guardSelectionComplete ? "text-gold/60" : "text-danger/80"}`}>
                  {guardSelectionComplete ? "Ready" : "Action required"}
                </span>
              </div>

              {transferDirection === TransferDirection.StructureToExplorer && structureTroopBalance && (
                <div className="space-y-2 rounded-md border border-gold/20 bg-dark-brown/50 p-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-gold">Structure troop balance</h5>
                    <div className="flex items-center gap-2">
                      <label
                        className={`inline-flex items-center ${
                          !isStructureOwnerOfExplorer ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <span className={`mr-2 text-xs ${useStructureBalance ? "text-gold/50" : "text-gold"}`}>
                          Guards
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={useStructureBalance}
                            onChange={() => isStructureOwnerOfExplorer && setUseStructureBalance(!useStructureBalance)}
                            disabled={!isStructureOwnerOfExplorer}
                          />
                          <div
                            className={`w-9 h-5 bg-gold/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30 ${
                              !isStructureOwnerOfExplorer ? "opacity-50" : ""
                            }`}
                          ></div>
                        </div>
                        <span className={`ml-2 text-xs ${useStructureBalance ? "text-gold" : "text-gold/50"}`}>
                          Balance
                        </span>
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gold/60">
                    Send troops directly from the structure reserve without selecting a guard slot.
                  </p>
                  {!isStructureOwnerOfExplorer && (
                    <div className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger/80">
                      Cannot use balance: Explorer not owned by this structure. Transfer to a guard slot first, then
                      send to the explorer.
                    </div>
                  )}
                  <p className="text-sm text-gold/80">Available: {formatNumber(structureBalanceCount, 0)} troops</p>
                  {targetExplorerTroops && (
                    <div className="flex items-center gap-2 text-xs text-gold/60">
                      <span>Matching explorer type:</span>
                      <TroopBadge
                        category={targetExplorerTroops.troops.category}
                        tier={targetExplorerTroops.troops.tier}
                        label={targetExplorerTroops.troops.category}
                      />
                    </div>
                  )}
                </div>
              )}

              {guardSelectionRequired && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gold">Guard slot</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                        "cursor-pointer",
                        isActive && !isMismatch && "bg-gold/20 border-gold ring-2 ring-gold/50",
                        isActive && isMismatch && "bg-danger/10 border-danger/60",
                        !isActive && !isMismatch && "bg-dark-brown border-gold/30 hover:bg-gold/10",
                        !isActive && isMismatch && "bg-danger/10 border-danger/50 hover:border-danger/60",
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" ");

                      return (
                        <button
                          key={slotIndex}
                          type="button"
                          onClick={() => setGuardSlot(slotIndex)}
                          className={cardClasses}
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
            </div>

            <div className="space-y-4 rounded-md border border-gold/30 bg-dark-brown/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-gold">Step 2: Set amount</h4>
                  <p className="text-xs text-gold/70">
                    Use the slider or number input to decide how many troops to transfer.
                  </p>
                </div>
                <span className={`text-xs font-medium ${amountStepComplete ? "text-gold/60" : "text-danger/80"}`}>
                  {amountStepComplete ? "Ready" : "Set amount"}
                </span>
              </div>

              <div className="space-y-1 rounded-md border border-gold/20 bg-dark-brown/50 p-3">
                <h5 className="text-sm font-semibold text-gold">Available for transfer</h5>
                <p className="text-sm text-gold/80">{formatNumber(maxTroops, 0)} troops</p>
                <div className="flex flex-col gap-1 text-xs text-gold/60">
                  {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>From explorer:</span>
                        <TroopBadge
                          category={selectedExplorerTroops.troops.category}
                          tier={selectedExplorerTroops.troops.tier}
                          label={selectedExplorerTroops.troops.category}
                        />
                        <span className="text-gold/40">•</span>
                        <span>Remaining: {formatNumber(Math.max(0, selectedExplorerCount - troopAmount), 0)}</span>
                      </div>
                      {guardSlot !== null && targetGuards[guardSlot] && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            To guard slot {guardSlot + 1} ({DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]})
                          </span>
                          <TroopBadge
                            category={targetGuards[guardSlot]?.troops.category}
                            tier={targetGuards[guardSlot]?.troops.tier}
                            label={targetGuards[guardSlot]?.troops.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>
                            After transfer:{" "}
                            {formatNumber(Math.max(0, (targetGuards[guardSlot]?.troops.count ?? 0) + troopAmount), 0)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {transferDirection === TransferDirection.StructureToExplorer && (
                    <>
                      {useStructureBalance && structureTroopBalance && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>From structure balance:</span>
                          <TroopBadge
                            category={structureTroopBalance.category}
                            tier={structureTroopBalance.tier}
                            label={structureTroopBalance.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>Remaining: {formatNumber(Math.max(0, structureBalanceCount - troopAmount), 0)}</span>
                        </div>
                      )}
                      {!useStructureBalance && guardSlot !== null && selectedGuards[guardSlot] && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            From structure (slot {guardSlot + 1} -{" "}
                            {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}):
                          </span>
                          <TroopBadge
                            category={selectedGuards[guardSlot].troops.category}
                            tier={selectedGuards[guardSlot].troops.tier}
                            label={selectedGuards[guardSlot].troops.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>
                            Remaining:{" "}
                            {formatNumber(Math.max(0, selectedGuards[guardSlot].troops.count - troopAmount), 0)}
                          </span>
                        </div>
                      )}
                      {targetExplorerTroops && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>To explorer:</span>
                          <TroopBadge
                            category={targetExplorerTroops.troops.category}
                            tier={targetExplorerTroops.troops.tier}
                            label={targetExplorerTroops.troops.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>After transfer: {formatNumber(Math.max(0, targetExplorerCount + troopAmount), 0)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {transferDirection === TransferDirection.ExplorerToExplorer &&
                    selectedExplorerTroops &&
                    targetExplorerTroops && (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>From explorer:</span>
                          <TroopBadge
                            category={selectedExplorerTroops.troops.category}
                            tier={selectedExplorerTroops.troops.tier}
                            label={selectedExplorerTroops.troops.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>Remaining: {formatNumber(Math.max(0, selectedExplorerCount - troopAmount), 0)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>To explorer:</span>
                          <TroopBadge
                            category={targetExplorerTroops.troops.category}
                            tier={targetExplorerTroops.troops.tier}
                            label={targetExplorerTroops.troops.category}
                          />
                          <span className="text-gold/40">•</span>
                          <span>After transfer: {formatNumber(Math.max(0, targetExplorerCount + troopAmount), 0)}</span>
                        </div>
                      </div>
                    )}
                </div>
              </div>

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
                  <h4 className="text-lg font-semibold text-gold">Step 3: Review & confirm</h4>
                  <p className="text-xs text-gold/70">Double-check the summary before sending troops.</p>
                </div>
                <span className={`text-xs font-medium ${transferReady ? "text-gold/60" : "text-danger/80"}`}>
                  {transferReady ? "Ready to transfer" : "Complete previous steps"}
                </span>
              </div>

              {troopAmount > 0 && (
                <div className="space-y-1 rounded-md border border-gold/30 bg-dark-brown/70 p-3">
                  <h5 className="text-sm font-semibold text-gold">You will transfer</h5>
                  <p className="text-sm text-gold/90">{formatNumber(troopAmount, 0)} troops</p>
                  {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
                    <div className="flex items-center gap-2 text-xs text-gold/80">
                      <span>From explorer:</span>
                      <TroopBadge
                        category={selectedExplorerTroops.troops.category}
                        tier={selectedExplorerTroops.troops.tier}
                        label={selectedExplorerTroops.troops.category}
                      />
                    </div>
                  )}
                  {transferDirection === TransferDirection.StructureToExplorer && selectedTroop && (
                    <div className="flex items-center gap-2 text-xs text-gold/80">
                      <span>To explorer:</span>
                      <TroopBadge
                        category={selectedTroop.category}
                        tier={selectedTroop.tier}
                        label={selectedTroop.category}
                      />
                    </div>
                  )}
                  {transferDirection === TransferDirection.StructureToExplorer &&
                    useStructureBalance &&
                    structureTroopBalance && (
                      <div className="flex items-center gap-2 text-xs text-gold/70">
                        <span>From structure balance:</span>
                        <TroopBadge
                          category={structureTroopBalance.category}
                          tier={structureTroopBalance.tier}
                          label={structureTroopBalance.category}
                        />
                      </div>
                    )}
                  {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
                    <div className="flex items-center gap-2 text-xs text-gold/80">
                      <span>Transfer type:</span>
                      <TroopBadge
                        category={selectedExplorerTroops.troops.category}
                        tier={selectedExplorerTroops.troops.tier}
                        label={selectedExplorerTroops.troops.category}
                      />
                    </div>
                  )}
                </div>
              )}

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
                        {useStructureBalance ? (
                          <>Transferring {formatNumber(troopAmount, 0)} troops from structure balance to explorer</>
                        ) : (
                          guardSlot !== null && (
                            <>
                              Transferring {formatNumber(troopAmount, 0)} troops from guard slot {guardSlot + 1} (
                              {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}) to explorer
                            </>
                          )
                        )}
                      </>
                    )}
                    {transferDirection === TransferDirection.ExplorerToStructure && guardSlot !== null && (
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
