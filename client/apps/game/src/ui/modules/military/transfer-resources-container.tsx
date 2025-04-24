import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ResourceManager, configManager, divideByPrecision, getArmy } from "@bibliothecadao/eternum";
import { ContractAddress, ID, ResourcesIds, resources } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { useState } from "react";
import { TransferDirection } from "./transfer-troops-container";

// Define the Resource type to match what the system calls expect
interface ResourceTransfer {
  resourceId: number;
  amount: number;
}

interface TransferResourcesContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
}

export const TransferResourcesContainer = ({
  selectedEntityId,
  targetEntityId,
  transferDirection,
  onTransferComplete,
}: TransferResourcesContainerProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: {
        troop_structure_adjacent_transfer,
        structure_troop_adjacent_transfer,
        troop_troop_adjacent_transfer,
      },
      components,
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<ResourceTransfer[]>([]);
  const [resourceAmounts, setResourceAmounts] = useState<Record<number, number>>({});

  // Get available resources for the selected entity
  const availableResources = (() => {
    const { currentDefaultTick } = getBlockTimestamp();
    if (!selectedEntityId) return [];
    const resourceManager = new ResourceManager(components, selectedEntityId);
    return resources
      .map(({ id }) => ({
        resourceId: id,
        amount: resourceManager.balanceWithProduction(currentDefaultTick, id),
      }))
      .filter(({ amount }) => amount > 0);
  })();

  // Explorer capacity information
  const explorerCapacity = (() => {
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
  })();

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

  // Handle selecting all resources
  const handleSelectAllResources = () => {
    if (availableResources.length === 0) return;

    const newSelectedResources: ResourceTransfer[] = [];
    const newResourceAmounts: Record<number, number> = {};

    // If transferring to explorer, we need to calculate how much of each resource we can add
    // based on weight constraints
    if (transferDirection === TransferDirection.StructureToExplorer) {
      let remainingCapacity = explorerCapacity.remainingCapacity;

      // Sort resources by weight (lightest first) to maximize the number of resources we can transfer
      const sortedResources = [...availableResources].sort((a, b) => {
        const weightA = configManager.resourceWeightsKg[a.resourceId] || 0;
        const weightB = configManager.resourceWeightsKg[b.resourceId] || 0;
        return weightA - weightB;
      });

      for (const resource of sortedResources) {
        const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
        if (resourceWeight <= 0) continue; // Skip resources with no weight

        const displayAmount = divideByPrecision(resource.amount);
        const maxPossibleAmount = Math.floor(remainingCapacity / resourceWeight);
        const amountToAdd = Math.min(displayAmount, maxPossibleAmount);

        if (amountToAdd > 0) {
          newSelectedResources.push({ ...resource, amount: amountToAdd });
          newResourceAmounts[resource.resourceId] = amountToAdd;
          remainingCapacity -= amountToAdd * resourceWeight;
        }
      }
    } else {
      // For structure transfers, we can add all resources at max amount
      for (const resource of availableResources) {
        const displayAmount = divideByPrecision(resource.amount);
        newSelectedResources.push({ ...resource, amount: displayAmount });
        newResourceAmounts[resource.resourceId] = displayAmount;
      }
    }

    setSelectedResources(newSelectedResources);
    setResourceAmounts(newResourceAmounts);
  };

  // Handle unselecting all resources
  const handleUnselectAllResources = () => {
    setSelectedResources([]);
    setResourceAmounts({});
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!targetEntityId) return;

    try {
      setLoading(true);

      // Prepare resources with updated amounts and apply precision
      const resourcesWithAmounts = selectedResources.map((resource) => ({
        resourceId: resource.resourceId,
        // Multiply by 10^9 to add precision for the transaction
        amount: (resourceAmounts[resource.resourceId] || resource.amount) * 10 ** 9,
      }));

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        const calldata = {
          from_explorer_id: selectedEntityId,
          to_structure_id: targetEntityId,
          resources: resourcesWithAmounts,
        };
        await troop_structure_adjacent_transfer({
          signer: account,
          ...calldata,
        });
      } else if (transferDirection === TransferDirection.StructureToExplorer) {
        await structure_troop_adjacent_transfer({
          signer: account,
          from_structure_id: selectedEntityId,
          to_troop_id: targetEntityId,
          resources: resourcesWithAmounts,
        });
      } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
        await troop_troop_adjacent_transfer({
          signer: account,
          from_troop_id: selectedEntityId,
          to_troop_id: targetEntityId,
          resources: resourcesWithAmounts,
        });
      }
      onTransferComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Render explorer capacity information
  const renderExplorerCapacity = () => {
    if (transferDirection !== TransferDirection.StructureToExplorer) {
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

  if (availableResources.length === 0) {
    return <p className="text-gold/60">No resources available to transfer.</p>;
  }

  return (
    <div className="flex flex-col h-full relative pb-16">
      {/* Top section with capacity info */}
      <div className="bg-dark-brown/95 pt-2 pb-3">
        {transferDirection === TransferDirection.StructureToExplorer && renderExplorerCapacity()}
      </div>

      <div className="flex justify-between items-center mb-4">
        <label className="text-gold font-semibold">Select Resources to Transfer:</label>
        <div className="flex space-x-2">
          <Button onClick={handleUnselectAllResources} variant="secondary" className="text-sm px-3 py-1">
            Unselect All
          </Button>
          <Button onClick={handleSelectAllResources} variant="secondary" className="text-sm px-3 py-1">
            Select All Resources
          </Button>
        </div>
      </div>

      {/* Scrollable resources section */}
      <div className="overflow-y-auto h-full">
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
                        className="w-full accent-gold"
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

      {/* Fixed position transfer button at the bottom */}
      <div className="fixed-bottom-button">
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-dark-brown border-t border-gold/30 flex justify-center">
          <Button
            onClick={handleTransfer}
            variant="primary"
            disabled={
              loading ||
              selectedResources.length === 0 ||
              selectedResources.every((r) => (resourceAmounts[r.resourceId] || 0) === 0)
            }
            isLoading={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Processing..." : "Transfer Resources"}
          </Button>
        </div>
      </div>
    </div>
  );
};
