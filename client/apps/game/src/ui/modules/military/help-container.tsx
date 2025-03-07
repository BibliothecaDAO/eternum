import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { formatNumber } from "@/ui/utils/utils";
import {
  ContractAddress,
  DEFENSE_NAMES,
  ID,
  ResourceManager,
  ResourcesIds,
  configManager,
  divideByPrecision,
  getArmy,
  getDirectionBetweenAdjacentHexes,
  getEntityIdFromKeys,
  getGuardsByStructure,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

enum TransferType {
  Resources,
  Troops,
}

enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

// Define the Resource type to match what the system calls expect
interface ResourceTransfer {
  resourceId: number;
  amount: number;
}

export const HelpContainer = ({
  selectedEntityId,
  targetHex,
}: {
  selectedEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: {
        troop_structure_adjacent_transfer,
        structure_troop_adjacent_transfer,
        explorer_explorer_swap,
        explorer_guard_swap,
        guard_explorer_swap,
      },
      components,
      components: { Structure, ExplorerTroops, Tile },
    },
  } = useDojo();

  const [transferType, setTransferType] = useState<TransferType>(TransferType.Resources);
  const [transferDirection, setTransferDirection] = useState<TransferDirection>(TransferDirection.ExplorerToStructure);
  const [loading, setLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<ResourceTransfer[]>([]);
  const [resourceAmounts, setResourceAmounts] = useState<Record<number, number>>({});
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<number>(0); // Default to first guard slot

  const selectedHex = useUIStore((state) => state.selectedHex);
  const updateSelectedEntityId = useUIStore((state) => state.updateSelectedEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // Determine if the selected entity is a structure or an explorer
  const selectedEntityType = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    return structure ? "structure" : "explorer";
  }, [selectedEntityId, Structure]);

  // Determine if the target entity is a structure or an explorer
  const targetEntityType = useMemo(() => {
    const targetTile = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
    if (!targetTile || !targetTile.occupier_id) return null;

    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetTile.occupier_id)]));
    return structure ? "structure" : "explorer";
  }, [targetHex, Tile, Structure]);

  // Get the target entity ID
  const targetEntityId = useMemo(() => {
    const targetTile = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
    return targetTile?.occupier_id || 0;
  }, [targetHex, Tile]);

  // Get available resources for the selected entity
  const availableResources = useMemo(() => {
    if (!selectedEntityId) return [];
    const resourceManager = new ResourceManager(components, selectedEntityId);
    return resourceManager.getResourceBalances();
  }, [selectedEntityId, components]);

  // Explorer capacity information
  const explorerCapacity = useMemo(() => {
    const armyInfo = getArmy(targetEntityId, ContractAddress(account.address), components);
    const MAX_CAPACITY = armyInfo?.totalCapacity || 0;
    const currentLoad = armyInfo?.weight || 0;

    // Calculate weight of selected resources
    const selectedResourcesWeight = Object.entries(resourceAmounts).reduce((total, [resourceId, amount]) => {
      const weight = configManager.resourceWeightsKg[parseInt(resourceId)] || 0;
      return total + amount * weight;
    }, 0);

    return {
      maxCapacity: MAX_CAPACITY,
      currentLoad,
      remainingCapacity: MAX_CAPACITY - currentLoad,
      selectedResourcesWeight,
      availableCapacity: MAX_CAPACITY - currentLoad - selectedResourcesWeight,
    };
  }, [targetEntityType, transferDirection, targetEntityId, components, resourceAmounts]);

  // Reset resource amounts when transfer direction changes
  useEffect(() => {
    setResourceAmounts({});
    setSelectedResources([]);
  }, [transferDirection, transferType]);

  // Handle resource selection
  const toggleResourceSelection = (resource: ResourceTransfer) => {
    const index = selectedResources.findIndex((r) => r.resourceId === resource.resourceId);

    if (index >= 0) {
      // Remove resource from selection
      setSelectedResources(selectedResources.filter((_, i) => i !== index));

      // Reset amount for this resource
      const newAmounts = { ...resourceAmounts };
      delete newAmounts[resource.resourceId];
      setResourceAmounts(newAmounts);
    } else {
      // Add resource to selection with default amount
      let defaultAmount = divideByPrecision(resource.amount);

      // If transferring to explorer, limit by remaining capacity
      if (transferDirection === TransferDirection.StructureToExplorer) {
        const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
        const maxPossibleAmount = Math.floor(explorerCapacity.remainingCapacity / resourceWeight);
        defaultAmount = Math.min(defaultAmount, maxPossibleAmount);
      }

      setSelectedResources([...selectedResources, { ...resource, amount: defaultAmount }]);
      setResourceAmounts({ ...resourceAmounts, [resource.resourceId]: defaultAmount });
    }
  };

  // Handle resource amount change
  const handleResourceAmountChange = (resourceId: number, amount: number) => {
    // Ensure amount is within valid range
    const resource = availableResources.find((r) => r.resourceId === resourceId);
    if (!resource) return;

    let maxAmount = divideByPrecision(resource.amount);

    // If transferring to explorer, limit by remaining capacity
    if (transferDirection === TransferDirection.StructureToExplorer) {
      const resourceWeight = configManager.resourceWeightsKg[resourceId] || 0;

      // Calculate how much capacity is used by other selected resources
      const otherResourcesWeight = Object.entries(resourceAmounts)
        .filter(([id]) => parseInt(id) !== resourceId)
        .reduce((total, [id, amt]) => {
          const weight = configManager.resourceWeightsKg[parseInt(id)] || 0;
          return total + amt * weight;
        }, 0);

      const availableForThisResource =
        explorerCapacity.maxCapacity - explorerCapacity.currentLoad - otherResourcesWeight;
      const maxPossibleAmount = Math.floor(availableForThisResource / resourceWeight);
      maxAmount = Math.min(divideByPrecision(resource.amount), maxPossibleAmount);
    }

    // Clamp amount between 0 and maxAmount
    const clampedAmount = Math.max(0, Math.min(amount, maxAmount));

    // Update resource amounts
    setResourceAmounts({ ...resourceAmounts, [resourceId]: clampedAmount });

    // Update selected resources
    setSelectedResources(
      selectedResources.map((r) => (r.resourceId === resourceId ? { ...r, amount: clampedAmount } : r)),
    );
  };

  // need all 4 because you can transfer troops from one of the guard structure slot to explorer
  // and you can transfer troops from explorer to one of the guard structure slot
  // and you can transfer troops from explorer to explorer

  // list of guards
  const targetGuards = useMemo(() => {
    if (!targetEntityId) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [targetEntityId, Structure]);

  // one explorer troop
  const targetExplorerTroops = useMemo(() => {
    if (!targetEntityId) return undefined;
    const explorers = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: divideByPrecision(Number(explorers.troops.count)),
    };
  }, [targetEntityId, ExplorerTroops]);

  // list of guards
  const selectedGuards = useMemo(() => {
    if (!selectedEntityId) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: divideByPrecision(Number(guard.troops.count)),
      },
    }));
  }, [selectedEntityId, Structure]);

  // one explorer troop
  const selectedExplorerTroops = useMemo(() => {
    if (!selectedEntityId) return undefined;
    const explorers = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: divideByPrecision(Number(explorers.troops.count)),
    };
  }, [selectedEntityId, ExplorerTroops]);

  const maxTroops = useMemo(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return Number(selectedExplorerTroops?.count || 0);
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      return Number(selectedGuards[guardSlot].troops.count);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return Number(selectedExplorerTroops?.count || 0);
    }
    return 0;
  }, [selectedEntityId, selectedExplorerTroops, selectedGuards, guardSlot, transferDirection]);

  // Handle troop amount change
  const handleTroopAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Ensure we don't exceed available troops
      setTroopAmount(Math.min(value, maxTroops));
    }
  };

  // Handle guard slot change
  const handleGuardSlotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGuardSlot(parseInt(e.target.value));
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedHex || !targetEntityId) return;

    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    try {
      setLoading(true);

      if (transferType === TransferType.Resources) {
        // Prepare resources with updated amounts and apply precision
        const resourcesWithAmounts = selectedResources.map((resource) => ({
          resourceId: resource.resourceId,
          // Multiply by 10^9 to add precision for the transaction
          amount: (resourceAmounts[resource.resourceId] || resource.amount) * 10 ** 9,
        }));

        if (transferDirection === TransferDirection.ExplorerToStructure) {
          await troop_structure_adjacent_transfer({
            signer: account,
            from_explorer_id: selectedEntityId,
            to_structure_id: targetEntityId,
            resources: resourcesWithAmounts,
          });
        } else if (transferDirection === TransferDirection.StructureToExplorer) {
          await structure_troop_adjacent_transfer({
            signer: account,
            from_structure_id: selectedEntityId,
            to_troop_id: targetEntityId,
            resources: resourcesWithAmounts,
          });
        }
      } else if (transferType === TransferType.Troops) {
        // Apply precision to troop amount for the transaction
        const troopAmountWithPrecision = troopAmount * 10 ** 9;

        if (transferDirection === TransferDirection.ExplorerToExplorer) {
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
        } else if (transferDirection === TransferDirection.StructureToExplorer) {
          await guard_explorer_swap({
            signer: account,
            from_structure_id: selectedEntityId,
            from_guard_slot: guardSlot,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmountWithPrecision,
          });
        }
      }

      // Close modal after transfer
      updateSelectedEntityId(null);
      toggleModal(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Determine available transfer directions based on entity types
  const availableTransferDirections = useMemo(() => {
    if (!selectedEntityType || !targetEntityType) return [];

    const directions = [];

    if (selectedEntityType === "explorer" && targetEntityType === "structure") {
      directions.push(TransferDirection.ExplorerToStructure);
    }

    if (selectedEntityType === "structure" && targetEntityType === "explorer") {
      directions.push(TransferDirection.StructureToExplorer);
    }

    if (selectedEntityType === "explorer" && targetEntityType === "explorer") {
      directions.push(TransferDirection.ExplorerToExplorer);
    }

    return directions;
  }, [selectedEntityType, targetEntityType]);

  // Set default transfer direction when available directions change
  useMemo(() => {
    if (availableTransferDirections.length > 0) {
      setTransferDirection(availableTransferDirections[0]);
    }
  }, [availableTransferDirections]);

  // Render transfer direction options
  const renderTransferDirectionOptions = () => {
    return (
      <div className="flex flex-col space-y-2 mb-4">
        <label className="text-gold font-semibold">Transfer Direction:</label>
        <div className="flex flex-wrap gap-2">
          {availableTransferDirections.map((direction) => (
            <button
              key={direction}
              className={`px-4 py-2 rounded-md border ${
                transferDirection === direction
                  ? "bg-gold/20 border-gold"
                  : "bg-dark-brown border-gold/30 hover:border-gold/50"
              }`}
              onClick={() => setTransferDirection(direction)}
            >
              {direction === TransferDirection.ExplorerToStructure && "Explorer → Structure"}
              {direction === TransferDirection.StructureToExplorer && "Structure → Explorer"}
              {direction === TransferDirection.ExplorerToExplorer && "Explorer → Explorer"}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render explorer capacity information
  const renderExplorerCapacity = () => {
    if (transferDirection !== TransferDirection.StructureToExplorer || transferType !== TransferType.Resources) {
      return null;
    }

    const capacityPercentage = Math.min(
      100,
      Math.max(0, (explorerCapacity.currentLoad / explorerCapacity.maxCapacity) * 100),
    );
    const selectedPercentage = Math.min(
      100 - capacityPercentage,
      Math.max(0, (explorerCapacity.selectedResourcesWeight / explorerCapacity.maxCapacity) * 100),
    );

    return (
      <div className="mb-4 p-3 border border-gold/30 rounded-md bg-dark-brown/50">
        <h4 className="text-gold font-semibold mb-2">Explorer Capacity</h4>

        <div className="flex justify-between text-sm text-gold/80 mb-1">
          <span>Current Load: {explorerCapacity.currentLoad} kg</span>
          <span>Max Capacity: {explorerCapacity.maxCapacity} kg</span>
        </div>

        <div className="w-full h-4 bg-dark-brown border border-gold/30 rounded-full overflow-hidden">
          <div className="h-full bg-gold/60" style={{ width: `${capacityPercentage}%` }} />
          <div
            className="h-full bg-gold/30 -mt-4"
            style={{ width: `${selectedPercentage}%`, marginLeft: `${capacityPercentage}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gold/80 mt-1">
          <span>Selected: {explorerCapacity.selectedResourcesWeight} kg</span>
          <span>Remaining: {explorerCapacity.availableCapacity} kg</span>
        </div>
      </div>
    );
  };

  // Render resource selection
  const renderResourceSelection = () => {
    if (availableResources.length === 0) {
      return <p className="text-gold/60">No resources available to transfer.</p>;
    }

    return (
      <div className="flex flex-col space-y-4">
        {renderExplorerCapacity()}

        <label className="text-gold font-semibold">Select Resources to Transfer:</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableResources.map((resource) => {
            const isSelected = selectedResources.some((r) => r.resourceId === resource.resourceId);
            const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
            const displayAmount = divideByPrecision(resource.amount);

            return (
              <div
                key={resource.resourceId}
                className={`p-3 rounded-md border ${
                  isSelected ? "bg-gold/20 border-gold" : "bg-dark-brown border-gold/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="sm" withTooltip={false} />
                    <span className="ml-2 font-medium">{ResourcesIds[resource.resourceId]}</span>
                  </div>
                  <div className="text-sm text-gold/70">Weight: {resourceWeight} kg per unit</div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-gold/80">Available: {formatNumber(displayAmount, 0)}</span>
                  <button
                    className={`px-3 py-1 rounded-md text-sm ${
                      isSelected
                        ? "bg-red-900/30 hover:bg-red-900/50 text-red-300"
                        : "bg-gold/10 hover:bg-gold/20 text-gold"
                    }`}
                    onClick={() => toggleResourceSelection(resource)}
                  >
                    {isSelected ? "Remove" : "Select"}
                  </button>
                </div>

                {isSelected && (
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gold/80 mb-1">
                      <label>Amount to Transfer:</label>
                      <span>
                        {formatNumber(resourceAmounts[resource.resourceId] || 0, 0)} /{formatNumber(displayAmount, 0)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="0"
                        max={displayAmount}
                        value={resourceAmounts[resource.resourceId] || 0}
                        onChange={(e) => handleResourceAmountChange(resource.resourceId, parseInt(e.target.value))}
                        className="w-full"
                      />
                      <input
                        type="number"
                        min="0"
                        max={displayAmount}
                        value={resourceAmounts[resource.resourceId] || 0}
                        onChange={(e) => handleResourceAmountChange(resource.resourceId, parseInt(e.target.value))}
                        className="w-20 px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
                      />
                    </div>

                    <div className="flex justify-between mt-2">
                      <button
                        className="px-2 py-1 text-xs bg-gold/10 hover:bg-gold/20 rounded-md"
                        onClick={() => handleResourceAmountChange(resource.resourceId, 0)}
                      >
                        None
                      </button>
                      <button
                        className="px-2 py-1 text-xs bg-gold/10 hover:bg-gold/20 rounded-md"
                        onClick={() => handleResourceAmountChange(resource.resourceId, Math.floor(displayAmount / 2))}
                      >
                        Half
                      </button>
                      <button
                        className="px-2 py-1 text-xs bg-gold/10 hover:bg-gold/20 rounded-md"
                        onClick={() => {
                          if (transferDirection === TransferDirection.StructureToExplorer) {
                            // Calculate max possible amount based on remaining capacity
                            const maxPossibleAmount = Math.floor(explorerCapacity.availableCapacity / resourceWeight);
                            handleResourceAmountChange(resource.resourceId, Math.min(displayAmount, maxPossibleAmount));
                          } else {
                            handleResourceAmountChange(resource.resourceId, displayAmount);
                          }
                        }}
                      >
                        Max
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render troop transfer
  const renderTroopTransfer = () => {
    return (
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-2">
          <label className="text-gold font-semibold">Troop Amount:</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max={maxTroops}
              value={troopAmount}
              onChange={handleTroopAmountChange}
              className="w-full"
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
          <p className="text-gold/60 text-sm">Available: {formatNumber(maxTroops, 0)} troops</p>

          {/* Display selected troop type and category */}
          {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
            <p className="text-gold/80 text-sm">
              Selected Troop: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
            </p>
          )}
          {transferDirection === TransferDirection.StructureToExplorer && selectedGuards.length > 0 && (
            <p className="text-gold/80 text-sm">
              Selected Troop: Tier {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
            </p>
          )}
          {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
            <p className="text-gold/80 text-sm">
              Selected Troop: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
            </p>
          )}
        </div>

        {(transferDirection === TransferDirection.ExplorerToStructure ||
          transferDirection === TransferDirection.StructureToExplorer) && (
          <div className="flex flex-col space-y-2">
            <label className="text-gold font-semibold">Guard Slot:</label>
            <select
              value={guardSlot}
              onChange={handleGuardSlotChange}
              className="px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
            >
              {transferDirection === TransferDirection.ExplorerToStructure ? (
                <>
                  <option
                    value={0}
                  >{`${DEFENSE_NAMES[0]} - Tier ${targetGuards[0].troops.tier} ${targetGuards[0].troops.category} (available: ${targetGuards[0].troops.count})`}</option>
                  <option
                    value={1}
                  >{`${DEFENSE_NAMES[1]} - Tier ${targetGuards[1].troops.tier} ${targetGuards[1].troops.category} (available: ${targetGuards[1].troops.count})`}</option>
                  <option
                    value={2}
                  >{`${DEFENSE_NAMES[2]} - Tier ${targetGuards[2].troops.tier} ${targetGuards[2].troops.category} (available: ${targetGuards[2].troops.count})`}</option>
                  <option
                    value={3}
                  >{`${DEFENSE_NAMES[3]} - Tier ${targetGuards[3].troops.tier} ${targetGuards[3].troops.category} (available: ${targetGuards[3].troops.count})`}</option>
                </>
              ) : (
                <>
                  <option
                    value={0}
                  >{`${DEFENSE_NAMES[0]} - Tier ${selectedGuards[0].troops.tier} ${selectedGuards[0].troops.category} (available: ${selectedGuards[0].troops.count})`}</option>
                  <option
                    value={1}
                  >{`${DEFENSE_NAMES[1]} - Tier ${selectedGuards[1].troops.tier} ${selectedGuards[1].troops.category} (available: ${selectedGuards[1].troops.count})`}</option>
                  <option
                    value={2}
                  >{`${DEFENSE_NAMES[2]} - Tier ${selectedGuards[2].troops.tier} ${selectedGuards[2].troops.category} (available: ${selectedGuards[2].troops.count})`}</option>
                  <option
                    value={3}
                  >{`${DEFENSE_NAMES[3]} - Tier ${selectedGuards[3].troops.tier} ${selectedGuards[3].troops.category} (available: ${selectedGuards[3].troops.count})`}</option>
                </>
              )}
            </select>
          </div>
        )}
      </div>
    );
  };

  const isTroopsTransferDisabled = useMemo(() => {
    if (transferType === TransferType.Troops) {
      if (
        transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer
      ) {
        if (guardSlot === undefined) return true;

        // Check if troop tier and category match between selected and target
        if (transferDirection === TransferDirection.ExplorerToStructure) {
          const selectedTroop = selectedExplorerTroops;
          const targetTroop = targetGuards[guardSlot].troops;
          // If target troop count is 0, tier and category don't matter
          if (targetTroop?.count === 0) {
            return false;
          }
          return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
        } else {
          const selectedTroop = selectedGuards[guardSlot].troops;
          const targetTroop = targetExplorerTroops;
          // If target troop count is 0, tier and category don't matter
          if (targetTroop?.count === 0) {
            return false;
          }
          return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
        }
      }
      return troopAmount === 0;
    }
    return false;
  }, [
    transferType,
    transferDirection,
    guardSlot,
    troopAmount,
    selectedExplorerTroops,
    targetGuards,
    selectedGuards,
    targetExplorerTroops,
  ]);

  const getTroopMismatchMessage = () => {
    if (transferType !== TransferType.Troops) return null;

    if (
      (transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) &&
      guardSlot !== undefined
    ) {
      let selectedTroop, targetTroop;

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        selectedTroop = selectedExplorerTroops;
        targetTroop = targetGuards[guardSlot].troops;
      } else {
        selectedTroop = selectedGuards[guardSlot].troops;
        targetTroop = targetExplorerTroops;
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

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 max-w-4xl mx-auto">
      <div className="p-6 border h-full border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm w-full">
        <h3 className="text-2xl font-bold text-gold mb-4 text-center">Help Allies</h3>

        {/* Transfer Type Selection */}
        <div className="flex justify-center mb-6">
          <div className="flex rounded-md overflow-hidden border border-gold/30">
            <button
              className={`px-4 py-2 ${
                transferType === TransferType.Resources
                  ? "bg-gold/20 text-gold"
                  : "bg-dark-brown text-gold/70 hover:text-gold"
              }`}
              onClick={() => setTransferType(TransferType.Resources)}
            >
              Transfer Resources
            </button>
            <button
              className={`px-4 py-2 ${
                transferType === TransferType.Troops
                  ? "bg-gold/20 text-gold"
                  : "bg-dark-brown text-gold/70 hover:text-gold"
              }`}
              onClick={() => setTransferType(TransferType.Troops)}
            >
              Transfer Troops
            </button>
          </div>
        </div>

        {/* Transfer Direction Selection */}
        {renderTransferDirectionOptions()}

        {/* Transfer Content */}
        <div className="mt-4 mb-6 overflow-y-auto max-h-[50vh]">
          {transferType === TransferType.Resources ? renderResourceSelection() : renderTroopTransfer()}
          {getTroopMismatchMessage() && <div className="mt-2 text-red-500 text-sm">{getTroopMismatchMessage()}</div>}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center mt-6">
          <Button
            onClick={handleTransfer}
            variant="primary"
            disabled={
              loading ||
              (transferType === TransferType.Resources &&
                (selectedResources.length === 0 ||
                  selectedResources.every((r) => (resourceAmounts[r.resourceId] || 0) === 0))) ||
              (transferType === TransferType.Troops && isTroopsTransferDisabled)
            }
            isLoading={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Processing..." : "Transfer"}
          </Button>
        </div>
      </div>
    </div>
  );
};
