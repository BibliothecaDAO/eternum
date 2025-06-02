import Button from "@/ui/elements/button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  configManager,
  divideByPrecision,
  getGuardsByStructure,
  getTroopResourceId,
  multiplyByPrecision,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii-client";
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
import { TransferDirection } from "./help-container";

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

  // list of guards
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

  // list of guards
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

      // For StructureToExplorer, if using balance but not owner, disable
      if (
        transferDirection === TransferDirection.StructureToExplorer &&
        useStructureBalance &&
        !isStructureOwnerOfExplorer
      ) {
        return true;
      }

      // Check if troop tier and category match between selected and target
      if (transferDirection === TransferDirection.ExplorerToStructure) {
        const selectedTroop = selectedExplorerTroops?.troops;
        const targetTroop = targetGuards[guardSlot]?.troops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      } else {
        const selectedTroop = selectedGuards[guardSlot]?.troops;
        const targetTroop = targetExplorerTroops?.troops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0n) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      }
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      // check if selected troops is same category and tier as target troops
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
    if (
      (transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) &&
      guardSlot !== undefined
    ) {
      let selectedTroop, targetTroop;

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        selectedTroop = selectedExplorerTroops?.troops;
        targetTroop = targetGuards[guardSlot]?.troops;
      } else {
        selectedTroop = selectedGuards[guardSlot]?.troops;
        targetTroop = targetExplorerTroops?.troops;
      }

      // If target troop count is 0, no mismatch message needed
      if (targetTroop?.count === 0) {
        return null;
      }

      if (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category) {
        return `Troop mismatch: You can only transfer troops of the same tier and type (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }

    return null;
  };

  const getDisabledMessage = () => {
    if (loading) return "Processing transfer...";
    if (troopAmount === 0) return "Please select an amount of troops to transfer";
    if (
      guardSlot === undefined &&
      (transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer)
    ) {
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
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      const selectedTroop = selectedExplorerTroops?.troops;
      const targetTroop = targetGuards[guardSlot]?.troops;
      if (
        targetTroop?.count !== 0 &&
        (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category)
      ) {
        return `Cannot transfer troops: Type mismatch (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }
    if (transferDirection === TransferDirection.StructureToExplorer) {
      const selectedTroop = selectedGuards[guardSlot]?.troops;
      const targetTroop = targetExplorerTroops?.troops;
      if (
        targetTroop?.count !== 0n &&
        (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category)
      ) {
        return `Cannot transfer troops: Type mismatch (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col space-y-4 ">
      {isTargetLoading || isSelectedLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          {/* Structure Troop Balance Section - Only show for StructureToExplorer */}
          {transferDirection === TransferDirection.StructureToExplorer && structureTroopBalance && (
            <div className="flex flex-col space-y-2 p-3 border border-gold/30 rounded-md bg-dark-brown/50">
              <div className="flex items-center justify-between">
                <h4 className="text-gold font-semibold text-lg">Structure Troop Balance</h4>
                <div className="flex items-center gap-2">
                  <label
                    className={`inline-flex items-center ${!isStructureOwnerOfExplorer ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`mr-2 text-xs ${useStructureBalance ? "text-gold/50" : "text-gold"}`}>Guards</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={useStructureBalance}
                        onChange={() => isStructureOwnerOfExplorer && setUseStructureBalance(!useStructureBalance)}
                        disabled={!isStructureOwnerOfExplorer}
                      />
                      <div
                        className={`w-9 h-5 bg-gold/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30 ${!isStructureOwnerOfExplorer ? "opacity-50" : ""}`}
                      ></div>
                    </div>
                    <span className={`ml-2 text-xs ${useStructureBalance ? "text-gold" : "text-gold/50"}`}>
                      Balance
                    </span>
                  </label>
                </div>
              </div>
              {!isStructureOwnerOfExplorer && (
                <div className="text-red text-sm mt-1">
                  Cannot use balance: Explorer not owned by this structure. You can circumvent this by first
                  transferring the troops to a guard slot and then transferring them to the explorer.
                </div>
              )}
              <p className="text-gold/80 text-md">
                Available: {formatNumber(divideByPrecision(Number(structureTroopBalance.balance)), 0)} troops
              </p>
              {targetExplorerTroops && (
                <p className="text-gold/70 text-sm">
                  Matching Explorer Type: Tier {targetExplorerTroops.troops.tier} {targetExplorerTroops.troops.category}
                </p>
              )}
            </div>
          )}

          {/* Available Troops Section */}
          <div className="flex flex-col space-y-1 p-3 border border-gold/30 rounded-md bg-dark-brown/50">
            <h4 className="text-gold font-semibold text-lg">Available for Transfer</h4>
            <p className="text-gold/80 text-md">{formatNumber(maxTroops, 0)} troops</p>
            {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
              <p className="text-gold/70 text-sm">
                From Explorer: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
              </p>
            )}
            {transferDirection === TransferDirection.StructureToExplorer &&
              !useStructureBalance &&
              selectedGuards.length > 0 &&
              guardSlot !== undefined &&
              selectedGuards[guardSlot] && (
                <p className="text-gold/70 text-sm">
                  From Structure (Slot {guardSlot + 1} - {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}): Tier{" "}
                  {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
                </p>
              )}
            {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
              <p className="text-gold/70 text-sm">
                From Explorer: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
              </p>
            )}
          </div>

          {/* Guard Slot Selection - Show for both StructureToExplorer and ExplorerToStructure */}
          {(transferDirection === TransferDirection.StructureToExplorer && !useStructureBalance) ||
          transferDirection === TransferDirection.ExplorerToStructure ? (
            <div className="flex flex-col space-y-2 mt-4">
              <label className="text-gold font-semibold h6">Guard Slot</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableGuards.map((slotIndex) => {
                  const guards =
                    transferDirection === TransferDirection.StructureToExplorer ? selectedGuards : targetGuards;
                  if (!guards[slotIndex] || !guards[slotIndex].troops) {
                    return (
                      <div
                        key={slotIndex}
                        className={`p-2 border rounded-md cursor-not-allowed bg-dark-brown border-danger- Glimmer text-light-pink/70`}
                      >
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
                      className={`p-3 border rounded-md cursor-pointer transition-all duration-150 ease-in-out \
                                                ${isActive ? "bg-gold/20 border-gold ring-2 ring-gold/50" : "bg-dark-brown border-gold/30 hover:bg-gold/10"}`}
                    >
                      <div className="font-semibold text-gold">
                        {DEFENSE_NAMES[slotIndex as keyof typeof DEFENSE_NAMES]}
                      </div>
                      <div className="text-sm text-gold/80">
                        Tier {troopInfo.tier} {troopInfo.category}
                      </div>
                      <div className="text-sm text-gold/60">Available: {formatNumber(troopInfo.count, 0)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Troop Amount Input Section */}
          <div className="flex flex-col space-y-2">
            <label htmlFor="troopAmountInput" className="text-gold font-semibold h6">
              Set Amount to Transfer
            </label>
            <div className="flex items-center space-x-2">
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
                className="w-20 px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
              />
            </div>
          </div>

          {/* Transferring Details Section */}
          {troopAmount > 0 && (
            <div className="flex flex-col space-y-1 p-3 border border-blue-500/50 rounded-md bg-blue-900/30 mt-4">
              <h4 className="text-blue-300 font-semibold text-lg">You will transfer:</h4>
              <p className="text-blue-200/80 text-md">{formatNumber(troopAmount, 0)} troops</p>
              {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
                <p className="text-blue-200/70 text-sm">
                  Type: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
                </p>
              )}
              {transferDirection === TransferDirection.StructureToExplorer &&
                selectedGuards.length > 0 &&
                guardSlot !== undefined &&
                selectedGuards[guardSlot] && (
                  <p className="text-blue-200/70 text-sm">
                    Type: Tier {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
                  </p>
                )}
              {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
                <p className="text-blue-200/70 text-sm">
                  Type: Tier {selectedExplorerTroops.troops.tier} {selectedExplorerTroops.troops.category}
                </p>
              )}
            </div>
          )}

          {getTroopMismatchMessage() && <div className="text-red text-sm mt-2">{getTroopMismatchMessage()}</div>}
          {isTroopsTransferDisabled && <div className="text-red text-sm mt-2">{getDisabledMessage()}</div>}

          <div className="flex flex-col items-center mt-6 space-y-2">
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
              <div className="text-gold/80 text-sm text-center">
                {transferDirection === TransferDirection.StructureToExplorer && (
                  <>
                    {useStructureBalance ? (
                      <>Transferring {formatNumber(troopAmount, 0)} troops from structure balance to explorer</>
                    ) : (
                      <>
                        Transferring {formatNumber(troopAmount, 0)} troops from guard slot {guardSlot + 1} (
                        {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}) to explorer
                      </>
                    )}
                  </>
                )}
                {transferDirection === TransferDirection.ExplorerToStructure && (
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
        </>
      )}
    </div>
  );
};
