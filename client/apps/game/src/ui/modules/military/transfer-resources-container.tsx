import Button from "@/ui/elements/button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  configManager,
  divideByPrecision,
  getArmyTotalCapacityInKg,
  gramToKg,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii-client";
import { ActorType, ID, resources, ResourcesIds } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getActorTypes, TransferDirection } from "./help-container";

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
    network: { toriiClient },
    setup: {
      systemCalls: {
        troop_structure_adjacent_transfer,
        structure_troop_adjacent_transfer,
        troop_troop_adjacent_transfer,
      },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<ResourceTransfer[]>([]);
  const [resourceAmounts, setResourceAmounts] = useState<Record<number, number>>({});
  const [selectedResourcesWeightKg, setSelectedResourcesWeightKg] = useState<number>(0);
  const [actorTypes, setActorTypes] = useState<{
    selected: ActorType;
    target: ActorType;
  } | null>(null);

  useEffect(() => {
    const { selected, target } = getActorTypes(transferDirection);
    setActorTypes({ selected, target });
  }, [transferDirection]);

  // Query for available resources
  const { data: availableResourcesData, isLoading: isResourcesLoading } = useQuery({
    queryKey: ["availableResources", String(selectedEntityId), String(actorTypes?.selected)],
    queryFn: async () => {
      if (!selectedEntityId || !actorTypes?.selected) return [];
      const { currentDefaultTick } = getBlockTimestamp();
      const { resources: resourcesData } =
        actorTypes.selected === ActorType.Explorer
          ? await getExplorerFromToriiClient(toriiClient, selectedEntityId)
          : await getStructureFromToriiClient(toriiClient, selectedEntityId);
      if (!resourcesData) return [];
      return resources
        .map(({ id }) => ({
          resourceId: id,
          amount: ResourceManager.balanceWithProduction(resourcesData, currentDefaultTick, id).balance,
        }))
        .filter(({ amount }) => amount > 0);
    },
    staleTime: 10000, // 10 seconds
  });

  // Query for explorer capacity
  const { data: explorerCapacity, isLoading: isExplorerCapacityLoading } = useQuery({
    queryKey: ["explorerCapacity", String(targetEntityId), String(actorTypes?.target)],
    queryFn: async () => {
      if (!targetEntityId || actorTypes?.target !== ActorType.Explorer) return null;
      const { resources: resourcesData } = await getExplorerFromToriiClient(toriiClient, targetEntityId);
      if (!resourcesData) return null;
      const maxCapacity = getArmyTotalCapacityInKg(resourcesData);
      const currentLoad = gramToKg(divideByPrecision(Number(resourcesData.weight.weight)));
      return {
        maxCapacityKg: maxCapacity,
        currentLoadKg: currentLoad,
        remainingCapacityKg: maxCapacity - currentLoad,
      };
    },
    staleTime: 10000, // 10 seconds
  });

  const availableResources = availableResourcesData || [];
  const availableCapacityKg = explorerCapacity ? explorerCapacity.remainingCapacityKg - selectedResourcesWeightKg : 0;

  console.log({ availableResourcesData, isResourcesLoading });
  console.log({ explorerCapacity, isExplorerCapacityLoading });

  useEffect(() => {
    // Calculate weight of selected resources
    const selectedResourcesWeight = selectedResources.reduce((total, { resourceId, amount }) => {
      const weight = configManager.resourceWeightsKg[resourceId] || 0;
      return total + amount * weight;
    }, 0);
    setSelectedResourcesWeightKg(selectedResourcesWeight);
  }, [selectedResources]);

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

      // If transferring to explorer, limit by available capacity
      if (actorTypes?.target === ActorType.Explorer && explorerCapacity) {
        const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
        if (resourceWeight > 0) {
          // Only limit if resource has weight
          // Use explorerCapacity.availableCapacity which accounts for other selected resources
          const maxPossibleAmountBasedOnCapacity = Math.floor(availableCapacityKg / resourceWeight);
          defaultAmount = Math.min(defaultAmount, maxPossibleAmountBasedOnCapacity);
        }
      }
      // Ensure default amount is not negative (e.g. if already over capacity)
      defaultAmount = Math.max(0, defaultAmount);

      setSelectedResources([...selectedResources, { ...resource, amount: defaultAmount }]);
      setResourceAmounts({ ...resourceAmounts, [resource.resourceId]: defaultAmount });
    }
  };

  // Handle resource amount change
  const handleResourceAmountChange = (resourceId: number, amount: number) => {
    // Ensure amount is within valid range
    const resource = availableResources.find((r) => r.resourceId === resourceId);
    if (!resource || !explorerCapacity) return;

    let maxAmount = divideByPrecision(resource.amount);

    // If transferring to explorer, limit by remaining capacity
    if (actorTypes?.target === ActorType.Explorer) {
      const resourceWeight = configManager.resourceWeightsKg[resourceId] || 0;

      // Calculate how much capacity is used by other selected resources
      const otherResourcesWeight = Object.entries(resourceAmounts)
        .filter(([id]) => parseInt(id) !== resourceId)
        .reduce((total, [id, amt]) => {
          const weight = configManager.resourceWeightsKg[parseInt(id)] || 0;
          return total + amt * weight;
        }, 0);

      const availableForThisResource =
        explorerCapacity.maxCapacityKg - explorerCapacity.currentLoadKg - otherResourcesWeight;
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
    if (actorTypes?.target === ActorType.Explorer && explorerCapacity) {
      let remainingCapacity = explorerCapacity.remainingCapacityKg;

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
    if (actorTypes?.target !== ActorType.Explorer || !explorerCapacity) {
      return null;
    }

    const currentLoadKg = explorerCapacity.currentLoadKg;
    const maxCapacityKg = explorerCapacity.maxCapacityKg;

    let capacityPercentageForBar = 0;
    if (maxCapacityKg > 0) {
      capacityPercentageForBar = (currentLoadKg / maxCapacityKg) * 100;
    } else if (currentLoadKg > 0) {
      // Max capacity is 0, but there's a load
      capacityPercentageForBar = 100; // Show as full/overloaded due to current load
    }
    // Clamp for bar width, current load could theoretically exceed max capacity
    capacityPercentageForBar = Math.min(100, Math.max(0, capacityPercentageForBar));

    let selectedPercentageForBar = 0;
    if (maxCapacityKg > 0) {
      const rawSelectedRatio = (selectedResourcesWeightKg / maxCapacityKg) * 100;
      // Selected part is capped by the remaining space in the bar after current load
      selectedPercentageForBar = Math.max(0, Math.min(rawSelectedRatio, 100 - capacityPercentageForBar));
    }
    // If maxCapacityKg is 0, selectedPercentageForBar remains 0.
    // This is intentional: selected items cannot visually fill a zero-capacity container's bar.
    // The text fields (Selected, Remaining) will convey the amounts and zero capacity state.

    const totalAfterSelectionPercentage = capacityPercentageForBar + selectedPercentageForBar;

    // Prevent available capacity from being negative in display
    const displayAvailableCapacityKg = Math.max(0, availableCapacityKg);

    return (
      <div className="p-3 border border-gold/30 rounded-md bg-dark-brown/50">
        <h4 className="text-lg text-gold font-bold mb-3 text-center">Explorer Capacity</h4>

        <div className="space-y-2">
          {/* Max Capacity Info */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gold/80">Max Capacity:</span>
            <span className="font-semibold text-gold">{maxCapacityKg.toLocaleString()} kg</span>
          </div>

          {/* Capacity Bar */}
          <div className="relative w-full h-6 bg-dark-brown border border-gold/20 rounded-md overflow-hidden my-1">
            {/* Current load */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-500/70 flex items-center justify-center"
              style={{ width: `${capacityPercentageForBar}%` }}
              title={`Current Load: ${currentLoadKg.toLocaleString()} kg`}
            >
              {capacityPercentageForBar > 15 && (
                <span className="text-xs text-white/90 truncate px-1">{currentLoadKg.toLocaleString()} kg</span>
              )}
            </div>
            {/* Weight that will be added with the current selection */}
            <div
              className="absolute top-0 h-full bg-orange-500/70 flex items-center justify-center bg-green/30"
              style={{ width: `${selectedPercentageForBar}%`, left: `${capacityPercentageForBar}%` }}
              title={`Selected: ${selectedResourcesWeightKg.toLocaleString()} kg`}
            >
              {selectedPercentageForBar > 15 && (
                <span className="text-xs text-white/90 truncate px-1">
                  {selectedResourcesWeightKg.toLocaleString()} kg
                </span>
              )}
            </div>
            {/* Empty space indicator if not full */}
            {100 - totalAfterSelectionPercentage > 5 && (
              <div
                className="absolute top-0 right-0 h-full flex items-center justify-end px-2 "
                style={{ width: `${100 - totalAfterSelectionPercentage}%`, left: `${totalAfterSelectionPercentage}%` }}
              >
                <span className="text-xs text-gold/70">Empty</span>
              </div>
            )}
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-blue-400/90">Current Load:</span>
              <span className="font-medium float-right text-white/90">{currentLoadKg.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-orange-400/90">Selected:</span>
              <span className="font-medium float-right text-white/90">
                {selectedResourcesWeightKg.toLocaleString()} kg
              </span>
            </div>
            <div>
              <span className="text-gold/80">After Transfer:</span>
              <span
                className={`font-medium float-right ${currentLoadKg + selectedResourcesWeightKg > maxCapacityKg ? "text-red-500" : "text-white/90"}`}
              >
                {(currentLoadKg + selectedResourcesWeightKg).toLocaleString()} kg
              </span>
            </div>
            <div>
              <span className="text-green-400/90">Remaining:</span>
              <span className="font-medium float-right text-white/90">
                {displayAvailableCapacityKg.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (availableResources.length === 0) {
    return <p className="text-gold/60">No resources available to transfer.</p>;
  }

  return (
    <div className="flex flex-col h-full relative pb-32">
      {isResourcesLoading || isExplorerCapacityLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          {/* Top section with capacity info */}

          {/* Add Select All / Unselect All buttons here */}
          <div className="flex justify-end space-x-2 mb-3">
            {actorTypes?.target === ActorType.Structure && (
              <Button
                onClick={handleSelectAllResources}
                variant="outline"
                size="xs"
                disabled={availableResources.length === 0}
              >
                Select All Available
              </Button>
            )}
            <Button
              onClick={handleUnselectAllResources}
              variant="outline"
              size="xs"
              disabled={selectedResources.length === 0}
            >
              Unselect All
            </Button>
          </div>

          {/* Scrollable resources section */}
          <div className=" h-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sticky top-0 z-10">
              {actorTypes?.target === ActorType.Explorer && explorerCapacity && renderExplorerCapacity()}
            </div>

            <div className="grid grid-cols-1 gap-3 overflow-y-auto">
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
                      <div className="text-sm text-gold/80">{resourceWeight} kg per unit</div>
                      <button
                        className={`px-3 py-1 rounded-md text-sm ${
                          isSelected
                            ? "bg-red/50 hover:bg-red/70 text-red-300"
                            : "bg-gold/10 hover:bg-gold/20 text-gold"
                        }`}
                        onClick={() => toggleResourceSelection(resource)}
                      >
                        {isSelected ? "Remove" : "Select"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gold/80">Available: {displayAmount.toLocaleString()}</span>
                    </div>

                    {isSelected && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-gold/80 mb-1">
                          <label>Amount to Transfer:</label>
                          <span>
                            {resourceAmounts[resource.resourceId]?.toLocaleString() || 0} /
                            {displayAmount.toLocaleString()}
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
                            onClick={() => {
                              // Let handleResourceAmountChange handle capacity limits
                              handleResourceAmountChange(resource.resourceId, displayAmount);
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
          <div className="mt-10 mx-auto">
            <Button
              onClick={handleTransfer}
              variant="gold"
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
        </>
      )}
    </div>
  );
};
