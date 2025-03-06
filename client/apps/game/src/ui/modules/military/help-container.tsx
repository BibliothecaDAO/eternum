import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  ID,
  ResourceManager,
  ResourcesIds,
  getDirectionBetweenAdjacentHexes,
  getEntityIdFromKeys,
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

// Resource weight mapping (mockup values)
const RESOURCE_WEIGHTS: Record<number, number> = {
  1: 1, // Wood
  2: 1, // Stone
  3: 2, // Coal
  4: 2, // Copper
  5: 3, // Obsidian
  6: 3, // Silver
  7: 4, // Ironwood
  8: 4, // Cold Iron
  9: 5, // Gold
  10: 5, // Hartwood
  11: 6, // Diamonds
  12: 6, // Sapphire
  13: 7, // Ruby
  14: 7, // Deep Crystal
  15: 8, // Archlight
  16: 8, // Ethereal Silica
  17: 9, // True Ice
  18: 9, // Twilight Quartz
  19: 10, // Alchemical Silver
  20: 10, // Adamantine
  // Add more resources as needed
};

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

  // Get available troops for the selected entity
  const availableTroops = useMemo(() => {
    if (!selectedEntityId) return { count: 0 };

    if (selectedEntityType === "explorer") {
      const explorerTroops = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
      return explorerTroops?.troops ? { count: Number(explorerTroops.troops.count) } : { count: 0 };
    } else {
      // For structures, we would need to get the guards
      // This is simplified for now
      const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
      return structure?.base?.troop_guard_count ? { count: Number(structure.base.troop_guard_count) } : { count: 0 };
    }
  }, [selectedEntityId, selectedEntityType, ExplorerTroops, Structure]);

  // Explorer capacity information (mockup values)
  const explorerCapacity = useMemo(() => {
    // In a real implementation, this would come from the explorer's stats
    const MAX_CAPACITY = 1000;
    let currentLoad = 0;

    if (targetEntityType === "explorer" && transferDirection === TransferDirection.StructureToExplorer) {
      // Calculate current load of target explorer
      const targetResourceManager = new ResourceManager(components, targetEntityId);
      const targetResources = targetResourceManager.getResourceBalances();

      currentLoad = targetResources.reduce((total, resource) => {
        const weight = RESOURCE_WEIGHTS[resource.resourceId] || 1;
        return total + resource.amount * weight;
      }, 0);
    }

    // Calculate weight of selected resources
    const selectedResourcesWeight = Object.entries(resourceAmounts).reduce((total, [resourceId, amount]) => {
      const weight = RESOURCE_WEIGHTS[parseInt(resourceId)] || 1;
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
      let defaultAmount = resource.amount;

      // If transferring to explorer, limit by remaining capacity
      if (transferDirection === TransferDirection.StructureToExplorer) {
        const resourceWeight = RESOURCE_WEIGHTS[resource.resourceId] || 1;
        const maxPossibleAmount = Math.floor(explorerCapacity.remainingCapacity / resourceWeight);
        defaultAmount = Math.min(resource.amount, maxPossibleAmount);
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

    let maxAmount = resource.amount;

    // If transferring to explorer, limit by remaining capacity
    if (transferDirection === TransferDirection.StructureToExplorer) {
      const resourceWeight = RESOURCE_WEIGHTS[resourceId] || 1;

      // Calculate how much capacity is used by other selected resources
      const otherResourcesWeight = Object.entries(resourceAmounts)
        .filter(([id]) => parseInt(id) !== resourceId)
        .reduce((total, [id, amt]) => {
          const weight = RESOURCE_WEIGHTS[parseInt(id)] || 1;
          return total + amt * weight;
        }, 0);

      const availableForThisResource =
        explorerCapacity.maxCapacity - explorerCapacity.currentLoad - otherResourcesWeight;
      const maxPossibleAmount = Math.floor(availableForThisResource / resourceWeight);
      maxAmount = Math.min(resource.amount, maxPossibleAmount);
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

  // Handle troop amount change
  const handleTroopAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Ensure we don't exceed available troops
      const maxTroops = availableTroops?.count || 0;
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
        // Prepare resources with updated amounts
        const resourcesWithAmounts = selectedResources.map((resource) => ({
          resourceId: resource.resourceId,
          amount: resourceAmounts[resource.resourceId] || resource.amount,
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
        if (transferDirection === TransferDirection.ExplorerToExplorer) {
          await explorer_explorer_swap({
            signer: account,
            from_explorer_id: selectedEntityId,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmount,
          });
        } else if (transferDirection === TransferDirection.ExplorerToStructure) {
          await explorer_guard_swap({
            signer: account,
            from_explorer_id: selectedEntityId,
            to_structure_id: targetEntityId,
            to_structure_direction: direction,
            to_guard_slot: guardSlot,
            count: troopAmount,
          });
        } else if (transferDirection === TransferDirection.StructureToExplorer) {
          await guard_explorer_swap({
            signer: account,
            from_structure_id: selectedEntityId,
            from_guard_slot: guardSlot,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmount,
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
          <span>Current Load: {currencyFormat(explorerCapacity.currentLoad, 0)}</span>
          <span>Max Capacity: {currencyFormat(explorerCapacity.maxCapacity, 0)}</span>
        </div>

        <div className="w-full h-4 bg-dark-brown border border-gold/30 rounded-full overflow-hidden">
          <div className="h-full bg-gold/60" style={{ width: `${capacityPercentage}%` }} />
          <div
            className="h-full bg-gold/30 -mt-4"
            style={{ width: `${selectedPercentage}%`, marginLeft: `${capacityPercentage}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gold/80 mt-1">
          <span>Selected: {currencyFormat(explorerCapacity.selectedResourcesWeight, 0)}</span>
          <span>Remaining: {currencyFormat(explorerCapacity.availableCapacity, 0)}</span>
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
            const resourceWeight = RESOURCE_WEIGHTS[resource.resourceId] || 1;

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
                  <div className="text-sm text-gold/70">Weight: {resourceWeight} per unit</div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-gold/80">Available: {currencyFormat(resource.amount, 0)}</span>
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
                        {currencyFormat(resourceAmounts[resource.resourceId] || 0, 0)} /
                        {currencyFormat(resource.amount, 0)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="0"
                        max={resource.amount}
                        value={resourceAmounts[resource.resourceId] || 0}
                        onChange={(e) => handleResourceAmountChange(resource.resourceId, parseInt(e.target.value))}
                        className="w-full"
                      />
                      <input
                        type="number"
                        min="0"
                        max={resource.amount}
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
                        onClick={() => handleResourceAmountChange(resource.resourceId, Math.floor(resource.amount / 2))}
                      >
                        Half
                      </button>
                      <button
                        className="px-2 py-1 text-xs bg-gold/10 hover:bg-gold/20 rounded-md"
                        onClick={() => {
                          if (transferDirection === TransferDirection.StructureToExplorer) {
                            // Calculate max possible amount based on remaining capacity
                            const maxPossibleAmount = Math.floor(explorerCapacity.availableCapacity / resourceWeight);
                            handleResourceAmountChange(
                              resource.resourceId,
                              Math.min(resource.amount, maxPossibleAmount),
                            );
                          } else {
                            handleResourceAmountChange(resource.resourceId, resource.amount);
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
    if (!availableTroops || availableTroops.count === 0) {
      return <p className="text-gold/60">No troops available to transfer.</p>;
    }

    return (
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-2">
          <label className="text-gold font-semibold">Troop Amount:</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max={availableTroops.count}
              value={troopAmount}
              onChange={handleTroopAmountChange}
              className="w-full"
            />
            <input
              type="number"
              min="0"
              max={availableTroops.count}
              value={troopAmount}
              onChange={handleTroopAmountChange}
              className="w-20 px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
            />
          </div>
          <p className="text-gold/60 text-sm">Available: {currencyFormat(availableTroops.count, 0)} troops</p>
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
              <option value={0}>Alpha</option>
              <option value={1}>Beta</option>
              <option value={2}>Gamma</option>
              <option value={3}>Delta</option>
            </select>
          </div>
        )}
      </div>
    );
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
              (transferType === TransferType.Troops && troopAmount === 0)
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
