import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { NumericInput } from "@/shared/ui/numeric-input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Loading } from "@/shared/ui/loading";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import {
  configManager,
  divideByPrecision,
  getArmyTotalCapacityInKg,
  gramToKg,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ActorType, ID, resources, ResourcesIds } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TransferDirection, ResourceTransfer, getActorTypes } from "../model/types";

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
    // when transfer direction changes, reset the selected resources
    setSelectedResources([]);
    setResourceAmounts({});
  }, [transferDirection]);

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
    staleTime: 10000,
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
    staleTime: 10000,
  });

  const availableResources = availableResourcesData || [];
  const availableCapacityKg = explorerCapacity ? explorerCapacity.remainingCapacityKg - selectedResourcesWeightKg : 0;

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
      setSelectedResources(selectedResources.filter((_, i) => i !== index));
      const newAmounts = { ...resourceAmounts };
      delete newAmounts[resource.resourceId];
      setResourceAmounts(newAmounts);
    } else {
      let defaultAmount = divideByPrecision(resource.amount);

      if (actorTypes?.target === ActorType.Explorer && explorerCapacity) {
        const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
        if (resourceWeight > 0) {
          const maxPossibleAmountBasedOnCapacity = Math.floor(availableCapacityKg / resourceWeight);
          defaultAmount = Math.min(defaultAmount, maxPossibleAmountBasedOnCapacity);
        }
      }
      defaultAmount = Math.max(0, defaultAmount);

      setSelectedResources([...selectedResources, { ...resource, amount: defaultAmount }]);
      setResourceAmounts({ ...resourceAmounts, [resource.resourceId]: defaultAmount });
    }
  };

  // Handle resource amount change
  const handleResourceAmountChange = (resourceId: number, amount: number) => {
    const resource = availableResources.find((r) => r.resourceId === resourceId);
    if (!resource) return;

    let maxAmount = divideByPrecision(resource.amount);

    if (actorTypes?.target === ActorType.Explorer) {
      if (!explorerCapacity) return;
      const resourceWeight = configManager.resourceWeightsKg[resourceId] || 0;

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

    const clampedAmount = Math.max(0, Math.min(amount, maxAmount));

    setResourceAmounts({ ...resourceAmounts, [resourceId]: clampedAmount });

    setSelectedResources(
      selectedResources.map((r) => (r.resourceId === resourceId ? { ...r, amount: clampedAmount } : r)),
    );
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!targetEntityId) return;

    try {
      setLoading(true);

      const resourcesWithAmounts = selectedResources.map((resource) => ({
        resourceId: resource.resourceId,
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
      capacityPercentageForBar = 100;
    }
    capacityPercentageForBar = Math.min(100, Math.max(0, capacityPercentageForBar));

    let selectedPercentageForBar = 0;
    if (maxCapacityKg > 0) {
      const rawSelectedRatio = (selectedResourcesWeightKg / maxCapacityKg) * 100;
      selectedPercentageForBar = Math.max(0, Math.min(rawSelectedRatio, 100 - capacityPercentageForBar));
    }

    const totalAfterSelectionPercentage = capacityPercentageForBar + selectedPercentageForBar;
    const displayAvailableCapacityKg = Math.max(0, availableCapacityKg);

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <h4 className="text-lg font-semibold mb-3 text-center">Explorer Capacity</h4>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Max Capacity:</span>
              <span className="font-semibold">{maxCapacityKg.toLocaleString()} kg</span>
            </div>

            <div className="relative w-full h-6 bg-muted rounded-md overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-blue-500/70 flex items-center justify-center"
                style={{ width: `${capacityPercentageForBar}%` }}
                title={`Current Load: ${currentLoadKg.toLocaleString()} kg`}
              >
                {capacityPercentageForBar > 15 && (
                  <span className="text-xs text-white truncate px-1">{currentLoadKg.toLocaleString()} kg</span>
                )}
              </div>
              <div
                className="absolute top-0 h-full bg-green-500/70 flex items-center justify-center"
                style={{ width: `${selectedPercentageForBar}%`, left: `${capacityPercentageForBar}%` }}
                title={`Selected: ${selectedResourcesWeightKg.toLocaleString()} kg`}
              >
                {selectedPercentageForBar > 15 && (
                  <span className="text-xs text-white truncate px-1">
                    {selectedResourcesWeightKg.toLocaleString()} kg
                  </span>
                )}
              </div>
              {100 - totalAfterSelectionPercentage > 5 && (
                <div
                  className="absolute top-0 right-0 h-full flex items-center justify-end px-2"
                  style={{
                    width: `${100 - totalAfterSelectionPercentage}%`,
                    left: `${totalAfterSelectionPercentage}%`,
                  }}
                >
                  <span className="text-xs text-muted-foreground">Empty</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-blue-400">Current Load:</span>
                <span className="font-medium float-right">{currentLoadKg.toLocaleString()} kg</span>
              </div>
              <div>
                <span className="text-green-400">Selected:</span>
                <span className="font-medium float-right">{selectedResourcesWeightKg.toLocaleString()} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">After Transfer:</span>
                <span
                  className={`font-medium float-right ${
                    currentLoadKg + selectedResourcesWeightKg > maxCapacityKg ? "text-destructive" : ""
                  }`}
                >
                  {(currentLoadKg + selectedResourcesWeightKg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-green-400">Remaining:</span>
                <span className="font-medium float-right">{displayAvailableCapacityKg.toLocaleString()} kg</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (availableResources.length === 0 && !isResourcesLoading) {
    return <p className="text-muted-foreground text-center">No resources available to transfer.</p>;
  }

  if (isResourcesLoading || isExplorerCapacityLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      {/* Explorer capacity info */}
      {renderExplorerCapacity()}

      {/* Select All / Unselect All buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Simple select all - just select all available resources with default amounts
            const newSelectedResources: ResourceTransfer[] = [];
            const newResourceAmounts: Record<number, number> = {};

            for (const resource of availableResources) {
              let amount = divideByPrecision(resource.amount);
              if (actorTypes?.target === ActorType.Explorer && explorerCapacity) {
                const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
                if (resourceWeight > 0) {
                  const maxPossible = Math.floor(
                    explorerCapacity.remainingCapacityKg / resourceWeight / availableResources.length,
                  );
                  amount = Math.min(amount, maxPossible);
                }
              }
              if (amount > 0) {
                newSelectedResources.push({ ...resource, amount });
                newResourceAmounts[resource.resourceId] = amount;
              }
            }

            setSelectedResources(newSelectedResources);
            setResourceAmounts(newResourceAmounts);
          }}
          disabled={availableResources.length === 0}
          className="flex-1"
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedResources([]);
            setResourceAmounts({});
          }}
          disabled={selectedResources.length === 0}
          className="flex-1"
        >
          Unselect All
        </Button>
      </div>

      {/* Resources list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {availableResources.map((resource) => {
          const isSelected = selectedResources.some((r) => r.resourceId === resource.resourceId);
          const resourceWeight = configManager.resourceWeightsKg[resource.resourceId] || 0;
          const displayAmount = divideByPrecision(resource.amount);

          return (
            <Card
              key={resource.resourceId}
              className={`transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={resource.resourceId} size={20} showTooltip />
                    <span className="font-medium">{ResourcesIds[resource.resourceId]}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{resourceWeight} kg/unit</div>
                  <Button
                    size="sm"
                    variant={isSelected ? "destructive" : "default"}
                    onClick={() => toggleResourceSelection(resource)}
                  >
                    {isSelected ? "Remove" : "Select"}
                  </Button>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm">Available: {displayAmount.toLocaleString()}</span>
                </div>

                {isSelected && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <label>Amount to Transfer:</label>
                      <span>
                        {resourceAmounts[resource.resourceId]?.toLocaleString() || 0} /{displayAmount.toLocaleString()}
                      </span>
                    </div>
                    <NumericInput
                      value={resourceAmounts[resource.resourceId] || 0}
                      onChange={(value) => handleResourceAmountChange(resource.resourceId, value)}
                      max={displayAmount}
                      label="Amount"
                      description={`Max: ${displayAmount.toLocaleString()}`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transfer button */}
      <Button
        onClick={handleTransfer}
        disabled={
          loading ||
          selectedResources.length === 0 ||
          selectedResources.every((r) => (resourceAmounts[r.resourceId] || 0) === 0)
        }
        className="w-full"
        size="lg"
      >
        {loading ? "Processing..." : "Transfer Resources"}
      </Button>
    </div>
  );
};
