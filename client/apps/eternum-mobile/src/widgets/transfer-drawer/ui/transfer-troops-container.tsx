import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { NumericInput } from "@/shared/ui/numeric-input";
import { Loading } from "@/shared/ui/loading";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { TransferDirection } from "../model/types";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

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
  const [guardSlot, setGuardSlot] = useState<number>(0);
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
    staleTime: 10000,
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
    staleTime: 10000,
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
      if (!targetStructure) return [];
      return Array.from(
        { length: getStructureDefenseSlots(targetStructure.category, targetStructure.base.level) },
        (_, i) => i,
      );
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      if (!selectedStructure) return [];
      return Array.from(
        { length: getStructureDefenseSlots(selectedStructure.category, selectedStructure.base.level) },
        (_, i) => i,
      );
    } else {
      return [];
    }
  }, [selectedStructure, targetStructure, transferDirection]);

  const targetGuards = useMemo(() => {
    if (!targetStructure) return [];
    const guards = getGuardsByStructure(targetStructure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [targetStructure]);

  const selectedGuards = useMemo(() => {
    if (!selectedStructure) return [];
    const guards = getGuardsByStructure(selectedStructure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [selectedStructure]);

  const selectedTroop = useMemo(() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (useStructureBalance && structureTroopBalance) {
        return {
          category: structureTroopBalance.category,
          tier: structureTroopBalance.tier,
          count: divideByPrecision(Number(structureTroopBalance.balance)),
        };
      } else if (selectedGuards[guardSlot]) {
        return selectedGuards[guardSlot].troops;
      }
    }
    return null;
  }, [transferDirection, useStructureBalance, structureTroopBalance, selectedGuards, guardSlot]);

  const maxTroops = (() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (useStructureBalance && structureTroopBalance) {
        return divideByPrecision(Number(structureTroopBalance.balance));
      }
      return Number(selectedGuards[guardSlot]?.troops.count || 0);
    } else if (transferDirection === TransferDirection.ExplorerToStructure) {
      return Math.max(0, divideByPrecision(Number(selectedExplorerTroops?.troops.count || 0)) - 1);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return divideByPrecision(Number(selectedExplorerTroops?.troops.count || 0));
    }
    return 0;
  })();

  useEffect(() => {
    setTroopAmount(0);
  }, [transferDirection, guardSlot]);

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

      const troopAmountWithPrecision = multiplyByPrecision(troopAmount);

      if (transferDirection === TransferDirection.StructureToExplorer) {
        if (useStructureBalance && structureTroopBalance) {
          const homeDirection = getDirectionBetweenAdjacentHexes(
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
    if (
      transferDirection === TransferDirection.ExplorerToStructure ||
      transferDirection === TransferDirection.StructureToExplorer
    ) {
      if (guardSlot === undefined) return true;

      if (
        transferDirection === TransferDirection.StructureToExplorer &&
        useStructureBalance &&
        !isStructureOwnerOfExplorer
      ) {
        return true;
      }

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        const selectedTroopData = selectedExplorerTroops?.troops;
        const targetTroop = targetGuards[guardSlot]?.troops;
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroopData?.tier !== targetTroop?.tier || selectedTroopData?.category !== targetTroop?.category;
      } else {
        const targetTroop = targetExplorerTroops?.troops;
        if (targetTroop?.count === 0n) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      }
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
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

  if (isTargetLoading || isSelectedLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      {/* Structure Troop Balance Section - Only show for StructureToExplorer */}
      {transferDirection === TransferDirection.StructureToExplorer && structureTroopBalance && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Structure Troop Balance</h4>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${useStructureBalance ? "text-muted-foreground" : ""}`}>Guards</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={useStructureBalance}
                    onChange={() => isStructureOwnerOfExplorer && setUseStructureBalance(!useStructureBalance)}
                    disabled={!isStructureOwnerOfExplorer}
                  />
                  <div
                    className={`w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-primary after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary/30 ${!isStructureOwnerOfExplorer ? "opacity-50" : ""}`}
                  />
                </div>
                <span className={`text-xs ${useStructureBalance ? "" : "text-muted-foreground"}`}>Balance</span>
              </div>
            </div>
            {!isStructureOwnerOfExplorer && (
              <div className="text-destructive text-sm mb-2">
                Cannot use balance: Explorer not owned by this structure.
              </div>
            )}
            <p className="text-muted-foreground text-sm">
              Available: {divideByPrecision(Number(structureTroopBalance.balance)).toLocaleString()} troops
            </p>
            {targetExplorerTroops && (
              <p className="text-muted-foreground text-xs">
                Matching Explorer Type: Tier {targetExplorerTroops.troops.tier} {targetExplorerTroops.troops.category}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Troops Section */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2">Available for Transfer</h4>
          <p className="text-lg font-medium">{maxTroops.toLocaleString()} troops</p>
          {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
            <p className="text-muted-foreground text-xs">
              From Explorer: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
            </p>
          )}
          {transferDirection === TransferDirection.StructureToExplorer &&
            !useStructureBalance &&
            selectedGuards.length > 0 &&
            guardSlot !== undefined &&
            selectedGuards[guardSlot] && (
              <p className="text-muted-foreground text-xs">
                From Structure (Slot {guardSlot + 1} - {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}): Tier{" "}
                {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
              </p>
            )}
          {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
            <p className="text-muted-foreground text-xs">
              From Explorer: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Guard Slot Selection */}
      {((transferDirection === TransferDirection.StructureToExplorer && !useStructureBalance) ||
        transferDirection === TransferDirection.ExplorerToStructure) && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3">Guard Slot</h4>
            <div className="grid grid-cols-1 gap-2">
              {availableGuards.map((slotIndex) => {
                const guards =
                  transferDirection === TransferDirection.StructureToExplorer ? selectedGuards : targetGuards;
                if (!guards[slotIndex] || !guards[slotIndex].troops) {
                  return (
                    <div key={slotIndex} className="p-2 border rounded-md bg-muted text-muted-foreground">
                      Slot {slotIndex + 1} - Empty/Error
                    </div>
                  );
                }
                const troopInfo = guards[slotIndex].troops;
                const isActive = guardSlot === slotIndex;
                return (
                  <div
                    key={slotIndex}
                    onClick={() => setGuardSlot(slotIndex)}
                    className={`p-3 border rounded-md cursor-pointer transition-all ${
                      isActive ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold">{DEFENSE_NAMES[slotIndex as keyof typeof DEFENSE_NAMES]}</div>
                    <div className="text-sm text-muted-foreground">
                      Tier {troopInfo.tier} {troopInfo.category}
                    </div>
                    <div className="text-sm">Available: {troopInfo.count.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Troop Amount Input */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3">Set Amount to Transfer</h4>
          <NumericInput
            value={troopAmount}
            onChange={setTroopAmount}
            max={maxTroops}
            label="Troop amount"
            description={`Max: ${maxTroops.toLocaleString()}`}
          />
        </CardContent>
      </Card>

      {/* Transfer Button */}
      <Button
        onClick={handleTransfer}
        disabled={loading || isTroopsTransferDisabled}
        className="w-full"
        size="lg"
      >
        {loading ? "Processing..." : "Transfer Troops"}
      </Button>

      {/* Error messages */}
      {isTroopsTransferDisabled && troopAmount > 0 && (
        <div className="text-destructive text-sm text-center">
          {transferDirection === TransferDirection.StructureToExplorer &&
            useStructureBalance &&
            !isStructureOwnerOfExplorer && "Cannot use structure balance: Explorer is not owned by this structure"}
          {transferDirection === TransferDirection.ExplorerToExplorer &&
            selectedExplorerTroops?.troops.category !== targetExplorerTroops?.troops.category &&
            `Cannot transfer troops: Category mismatch (${selectedExplorerTroops?.troops.category} ≠ ${targetExplorerTroops?.troops.category})`}
          {transferDirection === TransferDirection.ExplorerToExplorer &&
            selectedExplorerTroops?.troops.tier !== targetExplorerTroops?.troops.tier &&
            `Cannot transfer troops: Tier mismatch (Tier ${selectedExplorerTroops?.troops.tier} ≠ Tier ${targetExplorerTroops?.troops.tier})`}
        </div>
      )}
    </div>
  );
};