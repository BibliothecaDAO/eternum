import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudTransfer, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";

import { configManager, divideByPrecision, getArmyTotalCapacityInKg, gramToKg } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ActorType, ID, RelicRecipientType, RELICS, resources, formatExact, resourceName } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getActorTypes, TransferDirection } from "./transfer-troops/transfer-direction";
import { toast } from "@/ui/features/event-feed/notify";

const STRUCTURE_RELIC_IDS = new Set<number>(
  RELICS.filter(({ recipientType }) => recipientType === RelicRecipientType.Structure).map(({ id }) => id),
);

const EXPLORER_RELIC_IDS = new Set<number>(
  RELICS.filter(({ recipientType }) => recipientType === RelicRecipientType.Explorer).map(({ id }) => id),
);

const ALL_RELIC_IDS = new Set<number>([...STRUCTURE_RELIC_IDS, ...EXPLORER_RELIC_IDS]);

// Define the Resource type to match what the system calls expect
interface ResourceTransfer {
  resourceId: number;
  amount: number;
  weightKg: number;
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
    },
  } = useGame();
  const mode = useGameModeConfig();
  const currentDefaultTick = useCurrentDefaultTick();
  const actorTypes = useMemo(() => getActorTypes(transferDirection), [transferDirection]);
  const selectedResourceState = useResourceManager(selectedEntityId);
  const targetResourceState = useNativeRow("ResourceWeight", {
    game_id: configManager.getActiveGameId(),
    entity_id: targetEntityId,
  });
  const selectedStructure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: selectedEntityId,
  });
  const targetStructure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: targetEntityId,
  });

  const [loading, setLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<ResourceTransfer[]>([]);
  const [resourceAmounts, setResourceAmounts] = useState<Record<number, number>>({});
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  useEffect(() => {
    // when transfer context changes, reset the selected resources
    setSelectedResources([]);
    setResourceAmounts({});
    setHasAutoSelected(false);
  }, [transferDirection, selectedEntityId, targetEntityId]);

  const availableResources = useMemo(() => {
    if (!selectedResourceState.hasResources()) return [];
    const allowedRelicIds = actorTypes.target === ActorType.Structure ? STRUCTURE_RELIC_IDS : ALL_RELIC_IDS;
    // A relic is offered when it is held and can be checked against capacity: its state and its weight rule known.
    return resources
      .filter(({ id }) => allowedRelicIds.has(id))
      .flatMap(({ id }) => {
        const held = selectedResourceState.balanceWithProduction(currentDefaultTick, id);
        const weightKg = configManager.getResourceWeightKg(id);
        return held && held.balance > 0 && weightKg !== undefined
          ? [{ resourceId: id, amount: held.balance, weightKg }]
          : [];
      });
  }, [actorTypes.target, currentDefaultTick, selectedResourceState]);
  // A selection no longer available takes no capacity: it is dropped when the transfer is submitted.
  const weightOf = useCallback(
    (resourceId: number) => availableResources.find((resource) => resource.resourceId === resourceId)?.weightKg ?? 0,
    [availableResources],
  );
  const selectedResourcesWeightKg = useMemo(
    () => selectedResources.reduce((total, { resourceId, amount }) => total + amount * weightOf(resourceId), 0),
    [selectedResources, weightOf],
  );

  const explorerCapacity = useMemo(() => {
    if (actorTypes.target !== ActorType.Explorer || !mode.ui.showExplorerCapacity || !targetResourceState) return null;
    const maxCapacity = getArmyTotalCapacityInKg(targetResourceState);
    const currentLoad = gramToKg(divideByPrecision(Number(targetResourceState.weight)));
    return {
      maxCapacityKg: maxCapacity,
      currentLoadKg: currentLoad,
      remainingCapacityKg: maxCapacity - currentLoad,
    };
  }, [actorTypes.target, mode.ui.showExplorerCapacity, targetResourceState]);

  const availableCapacityKg = explorerCapacity ? explorerCapacity.remainingCapacityKg - selectedResourcesWeightKg : 0;
  const hasSelectedResources = selectedResources.length > 0;
  const showExplorerCapacity = actorTypes.target === ActorType.Explorer && Boolean(explorerCapacity);
  const resourcesMidpoint = Math.ceil(availableResources.length / 2);
  const leftResources = availableResources.slice(0, resourcesMidpoint);
  const rightResources = availableResources.slice(resourcesMidpoint);

  useEffect(() => {
    if (
      transferDirection !== TransferDirection.ExplorerToStructure ||
      actorTypes.selected !== ActorType.Explorer ||
      actorTypes.target !== ActorType.Structure ||
      hasAutoSelected ||
      availableResources.length === 0 ||
      hasSelectedResources
    ) {
      return;
    }

    const newSelectedResources = availableResources.map((resource) => {
      const amount = divideByPrecision(resource.amount);
      return { ...resource, amount };
    });

    const newResourceAmounts = newSelectedResources.reduce(
      (acc, { resourceId, amount }) => {
        acc[resourceId] = amount;
        return acc;
      },
      {} as Record<number, number>,
    );

    setSelectedResources(newSelectedResources);
    setResourceAmounts(newResourceAmounts);
    setHasAutoSelected(true);
  }, [
    actorTypes.selected,
    actorTypes.target,
    availableResources,
    hasAutoSelected,
    hasSelectedResources,
    transferDirection,
  ]);

  useEffect(() => {
    const liveAmounts = new Map(
      availableResources.map(({ resourceId, amount }) => [resourceId, divideByPrecision(amount)]),
    );
    setSelectedResources((current) =>
      current.flatMap((resource) => {
        const liveAmount = liveAmounts.get(resource.resourceId);
        return liveAmount === undefined ? [] : [{ ...resource, amount: Math.min(resource.amount, liveAmount) }];
      }),
    );
    setResourceAmounts((current) =>
      Object.fromEntries(
        Object.entries(current).flatMap(([resourceId, amount]) => {
          const liveAmount = liveAmounts.get(Number(resourceId));
          return liveAmount === undefined ? [] : [[resourceId, Math.min(amount, liveAmount)]];
        }),
      ),
    );
  }, [availableResources]);

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
      if (actorTypes.target === ActorType.Explorer && explorerCapacity) {
        const resourceWeight = resource.weightKg;
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
    if (!resource) return;

    let maxAmount = divideByPrecision(resource.amount);

    // If transferring to explorer, limit by remaining capacity when available
    if (actorTypes.target === ActorType.Explorer && explorerCapacity) {
      const resourceWeight = resource.weightKg;

      // Calculate how much capacity is used by other selected resources
      const otherResourcesWeight = Object.entries(resourceAmounts)
        .filter(([id]) => parseInt(id) !== resourceId)
        .reduce((total, [id, amt]) => {
          return total + amt * weightOf(parseInt(id));
        }, 0);

      const availableForThisResource =
        explorerCapacity.maxCapacityKg - explorerCapacity.currentLoadKg - otherResourcesWeight;
      const maxPossibleAmount =
        resourceWeight > 0 ? Math.floor(availableForThisResource / resourceWeight) : divideByPrecision(resource.amount);
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
    if (actorTypes.target === ActorType.Explorer && explorerCapacity) {
      let remainingCapacity = explorerCapacity.remainingCapacityKg;

      // Sort resources by weight (lightest first) to maximize the number of resources we can transfer
      const sortedResources = availableResources.toSorted((a, b) => {
        return a.weightKg - b.weightKg;
      });

      for (const resource of sortedResources) {
        const resourceWeight = resource.weightKg;
        const displayAmount = divideByPrecision(resource.amount);
        // Weightless resources should always transfer in full
        if (resourceWeight <= 0) {
          if (displayAmount > 0) {
            newSelectedResources.push({ ...resource, amount: displayAmount });
            newResourceAmounts[resource.resourceId] = displayAmount;
          }
          continue;
        }

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

      // Re-check every requested amount against the latest native store balance at
      // submit time. A source spend received while this panel is open must not
      // leave stale calldata behind in local selection state.
      let remainingCapacityKg = explorerCapacity
        ? Math.max(0, explorerCapacity.remainingCapacityKg)
        : Number.POSITIVE_INFINITY;
      const resourcesWithAmounts = selectedResources.flatMap((resource) => {
        const current = availableResources.find(({ resourceId }) => resourceId === resource.resourceId);
        if (!current) return [];
        const requestedAmount = resourceAmounts[resource.resourceId] ?? resource.amount;
        const resourceWeightKg = current.weightKg;
        const capacityLimit =
          resourceWeightKg > 0 ? Math.floor(remainingCapacityKg / resourceWeightKg) : Number.POSITIVE_INFINITY;
        const amount = Math.min(requestedAmount, divideByPrecision(current.amount), capacityLimit);
        remainingCapacityKg -= amount * resourceWeightKg;
        return amount > 0 ? [{ resourceId: resource.resourceId, amount: amount * 10 ** 9 }] : [];
      });

      if (resourcesWithAmounts.length === 0) return;

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
      toast.failed(error, "The transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  // Render explorer capacity information
  const renderExplorerCapacity = () => {
    if (actorTypes.target !== ActorType.Explorer || !explorerCapacity) {
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
    // If maxCapacityKg is 0, selectedPercentageForBar remains 0: selected items cannot fill a zero-capacity bar.

    const totalAfterSelectionPercentage = capacityPercentageForBar + selectedPercentageForBar;

    return (
      <div className="p-3 border border-hud-line rounded-md bg-hud-well">
        <h4 className="text-hud-title text-hud-accent mb-3 text-center">Explorer Capacity</h4>

        <div className="space-y-2">
          {/* Max Capacity Info */}
          <div className="flex justify-between items-center text-hud-body">
            <span className="text-hud-accent">Max Capacity:</span>
            <span className="text-hud-strong text-hud-accent">{formatExact(maxCapacityKg)} kg</span>
          </div>

          {/* Capacity Bar */}
          <div className="relative w-full h-6 bg-hud-well border border-hud-line rounded-md overflow-hidden my-1">
            {/* Current load */}
            <div
              className="absolute top-0 left-0 h-full bg-hud-accent flex items-center justify-center"
              style={{ width: `${capacityPercentageForBar}%` }}
              title={`Current Load: ${formatExact(currentLoadKg)} kg`}
            >
              {capacityPercentageForBar > 15 && (
                <span className="text-hud-label text-hud-dark truncate px-1">{formatExact(currentLoadKg)} kg</span>
              )}
            </div>
            {/* Weight that will be added with the current selection */}
            <div
              className="absolute top-0 h-full bg-hud-warn flex items-center justify-center"
              style={{ width: `${selectedPercentageForBar}%`, left: `${capacityPercentageForBar}%` }}
              title={`Selected: ${formatExact(selectedResourcesWeightKg)} kg`}
            >
              {selectedPercentageForBar > 15 && (
                <span className="text-hud-label text-hud-dark truncate px-1">
                  {formatExact(selectedResourcesWeightKg)} kg
                </span>
              )}
            </div>
            {/* Empty space indicator if not full */}
            {100 - totalAfterSelectionPercentage > 5 && (
              <div
                className="absolute top-0 right-0 h-full flex items-center justify-end px-2 "
                style={{ width: `${100 - totalAfterSelectionPercentage}%`, left: `${totalAfterSelectionPercentage}%` }}
              >
                <span className="text-hud-label text-hud-muted">Empty</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResourceCard = (resource: (typeof availableResources)[number]) => {
    const isSelected = selectedResources.some((r) => r.resourceId === resource.resourceId);
    const displayAmount = divideByPrecision(resource.amount);

    return (
      <div
        key={resource.resourceId}
        className={`p-3 rounded-md border ${isSelected ? "bg-hud-chosen border-hud-line-strong" : "bg-hud-well border-hud-line"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <ResourceIcon resource={resource.resourceId} size="sm" withTooltip={false} />
            <span className="ml-2">{resourceName(resource.resourceId)}</span>
          </div>
          <HudButton kind="secondary" size="sm" onClick={() => toggleResourceSelection(resource)}>
            {isSelected ? "Remove" : "Select"}
          </HudButton>
        </div>

        <div className="flex items-center text-hud-body text-hud-accent mb-2 gap-2">
          <span>{formatExact(displayAmount)} available</span>
        </div>

        {isSelected && (
          <div className="mt-3">
            <HudTransfer
              rows={[
                {
                  icon: resourceMeaning(resource.resourceId),
                  name: resourceName(resource.resourceId),
                  held: displayAmount,
                  value: resourceAmounts[resource.resourceId] || 0,
                },
              ]}
              onChange={(_, amount) => handleResourceAmountChange(resource.resourceId, amount)}
            />
          </div>
        )}
      </div>
    );
  };

  const formatActorLabel = (actorType?: ActorType, entityId?: ID, entityName?: string | null) => {
    if (actorType === undefined || !entityId) return "Unknown";
    if (actorType === ActorType.Structure) return entityName || "Structure";
    return actorType === ActorType.Explorer ? "Army" : "Unknown";
  };

  const selectedStructureName = useMemo(() => {
    if (actorTypes.selected !== ActorType.Structure || !selectedStructure) return null;
    return mode.structure.getName(selectedStructure).name;
  }, [actorTypes.selected, selectedStructure, mode]);

  const targetStructureName = useMemo(() => {
    if (actorTypes.target !== ActorType.Structure || !targetStructure) return null;
    return mode.structure.getName(targetStructure).name;
  }, [actorTypes.target, targetStructure, mode]);

  const fromLabel = formatActorLabel(actorTypes.selected, selectedEntityId, selectedStructureName ?? undefined);
  const toLabel = formatActorLabel(actorTypes.target, targetEntityId, targetStructureName ?? undefined);

  return (
    <div className="flex flex-col h-full relative pb-32">
      {/* Top section with capacity info */}

      {/* Add Select All / Unselect All buttons here */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <HudButton
            kind="secondary"
            size="sm"
            onClick={handleSelectAllResources}
            disabled={availableResources.length === 0}
          >
            Select All Available
          </HudButton>
          <HudButton
            kind="quiet"
            size="sm"
            onClick={handleUnselectAllResources}
            disabled={selectedResources.length === 0}
          >
            Unselect All
          </HudButton>
        </div>
        <div className="text-hud-label text-hud-muted whitespace-nowrap">
          {fromLabel} → {toLabel}
        </div>
      </div>

      {availableResources.length === 0 ? (
        <p className="text-hud-muted">No relics available to transfer.</p>
      ) : showExplorerCapacity ? (
        <div className="h-full grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sticky top-0 z-10 sm:col-span-1">{renderExplorerCapacity()}</div>
          <div className="overflow-y-auto sm:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-3 space-y-3 sm:space-y-0">
              {availableResources.map(renderResourceCard)}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-3">{leftResources.map(renderResourceCard)}</div>
            <div className="space-y-3">{rightResources.map(renderResourceCard)}</div>
          </div>
        </div>
      )}

      <HudWindowFoot>
        <HudButton
          kind="primary"
          onClick={handleTransfer}
          busy={loading ? "Processing..." : undefined}
          disabled={
            selectedResources.length === 0 || selectedResources.every((r) => (resourceAmounts[r.resourceId] || 0) === 0)
          }
        >
          Transfer Relics
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};
