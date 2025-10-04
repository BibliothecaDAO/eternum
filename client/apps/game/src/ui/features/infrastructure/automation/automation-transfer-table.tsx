import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useUISound } from "@/audio";
import { ProductionType, TransferMode, useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Panel } from "@/ui/design-system/atoms";
import Button from "@/ui/design-system/atoms/button";
import { normalizeDiacriticalMarks } from "@/ui/utils/utils";
import {
  computeTravelTime,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getIsBlitz,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { EntityType, ResourcesIds, getResourceTiers } from "@bibliothecadao/types";

import { useAutomationTransferForm } from "./model/use-automation-transfer-form";
import { useTransferEntities } from "./lib/use-transfer-entities";
import { isTransferAllowed } from "./lib/transfer-utils";
import type { ResourceBalance, SelectedEntity, SelectedResource } from "./lib/transfer-types";
import { TransferEntityPicker } from "./ui/transfer-entity-picker";
import { TransferModeControls } from "./ui/transfer-mode-controls";
import { TransferResourceList } from "./ui/transfer-resource-list";
import { TransferSummary } from "./ui/transfer-summary";

const MIN_RECURRING_TRANSFER_INTERVAL_HOURS = 1;

export const AutomationTransferTable: React.FC = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { send_resources },
    },
  } = useDojo();

  const playDonkeyScreaming = useUISound("resource.burn_donkey");
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const addOrder = useAutomationStore((state) => state.addOrder);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const [transferType, setTransferType] = useState<"automation" | "oneoff">("automation");
  const [showAddForm, setShowAddForm] = useState(false);
  const [guildOnly, setGuildOnly] = useState(true);
  const [selectedSource, setSelectedSource] = useState<SelectedEntity | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SelectedEntity | null>(null);
  const [travelTime, setTravelTime] = useState<number | undefined>(undefined);

  const transferForm = useAutomationTransferForm({ source: selectedSource, destination: selectedDestination });
  const { setTransferInterval } = transferForm;
  const { transferInterval, transferMode } = transferForm.state;

  const {
    sourceEntityType,
    destinationEntityType,
    setSourceEntityType,
    setDestinationEntityType,
    sourceSearchTerm,
    setSourceSearchTerm,
    destinationSearchTerm,
    setDestinationSearchTerm,
    handleSourceSearchChange,
    handleDestinationSearchChange,
    debouncedSourceSearchTerm,
    debouncedDestinationSearchTerm,
    entityTypeOptions,
    sourceEntityTypeOptions,
    filteredSourceEntities,
    filteredDestinationEntities,
  } = useTransferEntities({
    accountAddress: account.address,
    components,
    playerStructures,
    guildOnly,
  });

  const [oneOffResources, setOneOffResources] = useState<SelectedResource[]>([]);
  const [oneOffNewResourceId, setOneOffNewResourceId] = useState<ResourcesIds | "">("");
  const [oneOffNewResourceAmount, setOneOffNewResourceAmount] = useState<number>(100);
  const [oneOffError, setOneOffError] = useState<string | null>(null);
  const [isOneOffLoading, setIsOneOffLoading] = useState(false);

  const ordersForSource = useMemo(() => {
    if (!selectedSource) return [];
    return ordersByRealm[selectedSource.entityId.toString()] || [];
  }, [ordersByRealm, selectedSource]);

  const transferOrders = useMemo(
    () => ordersForSource.filter((order) => order.productionType === ProductionType.Transfer),
    [ordersForSource],
  );

  const isSourcePaused = useMemo(() => {
    if (!selectedSource) return false;
    return useAutomationStore.getState().isRealmPaused(selectedSource.entityId.toString());
  }, [selectedSource]);

  const orderedResourcesWithBalances: ResourceBalance[] = useMemo(() => {
    if (!selectedSource) return [];

    return Object.values(getResourceTiers(getIsBlitz()))
      .flat()
      .map((resourceId) => {
        const balance = getBalance(selectedSource.entityId, resourceId, currentDefaultTick, components);
        return {
          id: resourceId,
          trait: ResourcesIds[resourceId],
          balance: divideByPrecision(balance?.balance || 0),
        } as ResourceBalance;
      })
      .filter((resource) => resource.id !== ResourcesIds.Labor);
  }, [components, currentDefaultTick, selectedSource]);

  const safeDestinationEntities = useMemo(
    () =>
      filteredDestinationEntities.filter((entity) =>
        selectedSource ? entity.entityId !== selectedSource.entityId : true,
      ),
    [filteredDestinationEntities, selectedSource],
  );

  const handleSourceSelected = useCallback(
    (entity: SelectedEntity) => {
      setSelectedSource(entity);
      setShowAddForm(false);
      setSelectedDestination(null);
      setDestinationEntityType("");
      setDestinationSearchTerm("");
      transferForm.reset();
      setOneOffResources([]);
      setOneOffNewResourceId("");
      setOneOffNewResourceAmount(100);
      setOneOffError(null);
    },
    [setDestinationEntityType, setDestinationSearchTerm, transferForm],
  );

  const handleDestinationSelected = useCallback((entity: SelectedEntity) => {
    setSelectedDestination(entity);
    setOneOffResources([]);
    setOneOffNewResourceId("");
    setOneOffNewResourceAmount(100);
    setOneOffError(null);
  }, []);

  const handleAddAutomationResource = useCallback(
    (resourceId: ResourcesIds, amount: number) => {
      transferForm.addResource(resourceId, amount);
    },
    [transferForm],
  );

  const handleAddTransferOrder = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const result = transferForm.submit();

      if (!result.success) {
        return;
      }

      addOrder(result.order);
      transferForm.reset();
      setShowAddForm(false);
      setSelectedDestination(null);
      setDestinationEntityType("");
      setDestinationSearchTerm("");
    },
    [addOrder, setDestinationEntityType, setDestinationSearchTerm, transferForm],
  );

  const handleAddOneOffResource = useCallback(
    (resourceId: ResourcesIds, amount: number) => {
      if (!selectedSource || !selectedDestination) {
        setOneOffError("Select source and destination before adding resources.");
        return;
      }

      if (!isTransferAllowed(selectedSource.category, selectedDestination.category, resourceId)) {
        setOneOffError("This resource cannot be transferred between the selected structures.");
        return;
      }

      setOneOffResources((prev) => {
        const exists = prev.some((resource) => resource.resourceId === resourceId);
        if (exists) {
          return prev.map((resource) => (resource.resourceId === resourceId ? { ...resource, amount } : resource));
        }
        return [...prev, { resourceId, amount }];
      });

      setOneOffNewResourceId("");
      setOneOffNewResourceAmount(100);
      setOneOffError(null);
    },
    [selectedDestination, selectedSource],
  );

  const handleRemoveOneOffResource = useCallback((resourceId: ResourcesIds) => {
    setOneOffResources((prev) => prev.filter((resource) => resource.resourceId !== resourceId));
  }, []);

  const handleOneOffTransfer = useCallback(() => {
    if (!selectedSource || !selectedDestination || oneOffResources.length === 0) {
      setOneOffError("Select source, destination, and at least one resource to transfer.");
      return;
    }

    setIsOneOffLoading(true);
    const resourcesList = oneOffResources.map((resource) => ({
      resource: Number(resource.resourceId),
      amount: Number(resource.amount) * 1_000_000_000,
    }));

    const systemCall = send_resources({
      signer: account,
      sender_entity_id: selectedSource.entityId,
      recipient_entity_id: selectedDestination.entityId,
      resources: resourcesList,
    });

    playDonkeyScreaming();

    systemCall
      .then(() => {
        setOneOffResources([]);
        setOneOffNewResourceId("");
        setOneOffNewResourceAmount(100);
        setOneOffError(null);
        alert("Transfer completed successfully!");
      })
      .finally(() => {
        setIsOneOffLoading(false);
      });
  }, [account, oneOffResources, playDonkeyScreaming, selectedDestination, selectedSource, send_resources]);

  useEffect(() => {
    if (selectedSource && selectedDestination) {
      setTravelTime(
        computeTravelTime(
          selectedSource.entityId,
          selectedDestination.entityId,
          configManager.getSpeedConfig(EntityType.DONKEY),
          components,
        ),
      );
    } else {
      setTravelTime(undefined);
    }
  }, [components, selectedDestination, selectedSource]);

  useEffect(() => {
    if (!sourceEntityType || !debouncedSourceSearchTerm || debouncedSourceSearchTerm.length < 2) {
      return;
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedSourceSearchTerm.toLowerCase());
    const exactMatch = filteredSourceEntities.find(
      (entity) => normalizeDiacriticalMarks(entity.name.toLowerCase()) === normalizedSearch,
    );

    if (exactMatch) {
      handleSourceSelected({
        name: exactMatch.name,
        entityId: exactMatch.entityId,
        category: exactMatch.category,
      });
      setSourceSearchTerm("");
    } else if (filteredSourceEntities.length === 1) {
      const [entity] = filteredSourceEntities;
      handleSourceSelected({ name: entity.name, entityId: entity.entityId, category: entity.category });
      setSourceSearchTerm("");
    }
  }, [debouncedSourceSearchTerm, filteredSourceEntities, handleSourceSelected, setSourceSearchTerm, sourceEntityType]);

  useEffect(() => {
    if (!destinationEntityType || !debouncedDestinationSearchTerm || debouncedDestinationSearchTerm.length < 2) {
      return;
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedDestinationSearchTerm.toLowerCase());
    const exactMatch = safeDestinationEntities.find(
      (entity) => normalizeDiacriticalMarks(entity.name.toLowerCase()) === normalizedSearch,
    );

    if (exactMatch) {
      handleDestinationSelected({
        name: exactMatch.name,
        entityId: exactMatch.entityId,
        category: exactMatch.category,
      });
      setDestinationSearchTerm("");
    } else if (safeDestinationEntities.length === 1) {
      const [entity] = safeDestinationEntities;
      handleDestinationSelected({ name: entity.name, entityId: entity.entityId, category: entity.category });
      setDestinationSearchTerm("");
    }
  }, [
    debouncedDestinationSearchTerm,
    destinationEntityType,
    handleDestinationSelected,
    safeDestinationEntities,
    setDestinationSearchTerm,
  ]);

  useEffect(() => {
    if (transferMode === TransferMode.Recurring && transferInterval < MIN_RECURRING_TRANSFER_INTERVAL_HOURS) {
      setTransferInterval(MIN_RECURRING_TRANSFER_INTERVAL_HOURS);
    }
  }, [setTransferInterval, transferInterval, transferMode]);

  return (
    <div className="container mx-auto xl:w-1/2">
      <div className="flex items-center justify-between my-4">
        <h2>Transfer Hub</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Guild Only</label>
          <input
            type="checkbox"
            checked={guildOnly}
            onChange={(event) => setGuildOnly(event.target.checked)}
            className="w-4 h-4"
          />
        </div>
      </div>

      <Panel tone="glass" radius="md" padding="sm" className="mb-4 bg-black/20">
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="transferType"
              value="automation"
              checked={transferType === "automation"}
              onChange={(event) => setTransferType(event.target.value as "automation" | "oneoff")}
              className="mr-2"
            />
            <span>Automation Transfer</span>
            <span className="text-xs text-gold/50 ml-2">(Recurring/Conditional)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="transferType"
              value="oneoff"
              checked={transferType === "oneoff"}
              onChange={(event) => setTransferType(event.target.value as "automation" | "oneoff")}
              className="mr-2"
            />
            <span>One-off Transfer</span>
            <span className="text-xs text-gold/50 ml-2">(Immediate)</span>
          </label>
        </div>
      </Panel>

      <Panel tone="neutral" radius="md" padding="sm" border="strong" className="mb-4 bg-gold/5">
        <div className="font-bold text-sm mb-2 text-gold">Transfer Rules:</div>
        <div className="text-xs space-y-1">
          <div className="flex items-start gap-1">
            <span className="text-green">✓</span>
            <span>Realms can transfer ALL materials (including troops) to other Realms</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-green">✓</span>
            <span>Camps, Essence Rifts, and Hyperstructures can transfer all materials EXCEPT troops</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-red">✗</span>
            <span>Troops cannot be transferred from/to non-Realm structures</span>
          </div>
        </div>
      </Panel>

      <TransferEntityPicker
        mode="source"
        title="Source"
        selectedEntity={selectedSource}
        description="You can only send resources from entities you own."
        entityTypeOptions={sourceEntityTypeOptions}
        selectedEntityType={sourceEntityType}
        onEntityTypeChange={setSourceEntityType}
        searchTerm={sourceSearchTerm}
        onSearchTermChange={handleSourceSearchChange}
        debouncedSearchTerm={debouncedSourceSearchTerm}
        filteredEntities={filteredSourceEntities}
        onSelectEntity={(entity) =>
          handleSourceSelected({ name: entity.name, entityId: entity.entityId, category: entity.category })
        }
        onResetSelection={() => {
          setSelectedSource(null);
          setSourceEntityType("");
          setSourceSearchTerm("");
          setSelectedDestination(null);
          setDestinationEntityType("");
          setDestinationSearchTerm("");
          transferForm.reset();
        }}
        isPaused={isSourcePaused}
      />

      {selectedSource && (
        <>
          <TransferEntityPicker
            mode="destination"
            title="Destination"
            selectedEntity={selectedDestination}
            description="Search realms, villages, or other structures to receive the transfer."
            entityTypeOptions={entityTypeOptions}
            selectedEntityType={destinationEntityType}
            onEntityTypeChange={setDestinationEntityType}
            searchTerm={destinationSearchTerm}
            onSearchTermChange={handleDestinationSearchChange}
            debouncedSearchTerm={debouncedDestinationSearchTerm}
            filteredEntities={safeDestinationEntities}
            onSelectEntity={(entity) =>
              handleDestinationSelected({ name: entity.name, entityId: entity.entityId, category: entity.category })
            }
            onResetSelection={() => {
              setSelectedDestination(null);
              setDestinationEntityType("");
              setDestinationSearchTerm("");
              transferForm.reset();
            }}
          />

          {selectedDestination && travelTime && transferType === "oneoff" && (
            <p className="text-sm text-gold/70 mb-4">Travel Time: ~{Math.round(travelTime / 60)} minutes</p>
          )}

          {transferType === "automation" && (
            <div className="my-4">
              {!showAddForm && (
                <Button onClick={() => setShowAddForm(true)} variant="default" disabled={isSourcePaused}>
                  Add New Transfer Automation {isSourcePaused && "(Paused)"}
                </Button>
              )}
            </div>
          )}

          {transferType === "automation" && selectedDestination && showAddForm && (
            <Panel
              as="form"
              onSubmit={handleAddTransferOrder}
              tone="glass"
              radius="md"
              padding="md"
              className="mb-6 space-y-4 bg-black/10"
            >
              <h3 className="text-lg font-semibold">Create New Transfer Automation</h3>

              <TransferModeControls
                mode={transferForm.state.transferMode}
                onModeChange={transferForm.setTransferMode}
                interval={transferForm.state.transferInterval}
                onIntervalChange={transferForm.setTransferInterval}
                threshold={transferForm.state.transferThreshold}
                onThresholdChange={transferForm.setTransferThreshold}
              />

              <TransferResourceList
                resources={transferForm.state.resources}
                onRemove={transferForm.removeResource}
                availableResources={orderedResourcesWithBalances}
                newResourceId={transferForm.state.newResourceId}
                onNewResourceChange={transferForm.setNewResourceId}
                newResourceAmount={transferForm.state.newResourceAmount}
                onNewResourceAmountChange={transferForm.setNewResourceAmount}
                onAddResource={handleAddAutomationResource}
                addButtonLabel="Add"
                title="Resources to Transfer"
                emptyMessage="No resources selected for this automation."
                disabled={isSourcePaused}
                error={transferForm.state.error}
              />

              <div className="flex justify-end gap-2">
                <Button type="submit" variant="gold" disabled={transferForm.state.resources.length === 0}>
                  Confirm Transfer Automation
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="default" size="xs" type="button">
                  Cancel
                </Button>
              </div>
            </Panel>
          )}

          {transferType === "oneoff" && selectedDestination && (
            <>
              <Panel tone="glass" radius="md" padding="md" className="mb-4 bg-blue/10 border border-gold/20">
                <h4 className="mb-2 h6">One-off Transfer</h4>
                <p className="text-sm text-gold/70">
                  Send resources immediately between entities. Transfer will take time based on distance.
                  {travelTime && (
                    <span className="block mt-1">
                      <strong>Travel Time:</strong> ~{Math.round(travelTime / 60)} minutes
                    </span>
                  )}
                </p>
              </Panel>

              <Panel tone="glass" radius="md" padding="md" className="mb-4 bg-black/20">
                <TransferResourceList
                  resources={oneOffResources}
                  onRemove={handleRemoveOneOffResource}
                  availableResources={orderedResourcesWithBalances}
                  newResourceId={oneOffNewResourceId}
                  onNewResourceChange={(value) => setOneOffNewResourceId(value)}
                  newResourceAmount={oneOffNewResourceAmount}
                  onNewResourceAmountChange={setOneOffNewResourceAmount}
                  onAddResource={handleAddOneOffResource}
                  addButtonLabel="Add"
                  title="Select Resources to Transfer"
                  emptyMessage="No resources selected for this transfer."
                  error={oneOffError}
                />

                <div className="mt-4">
                  <Button
                    onClick={handleOneOffTransfer}
                    variant="primary"
                    size="md"
                    disabled={!selectedDestination || oneOffResources.length === 0 || isOneOffLoading}
                    isLoading={isOneOffLoading}
                    className="w-full"
                  >
                    {isOneOffLoading ? "Transferring..." : "Send Resources Now"}
                  </Button>
                </div>
              </Panel>
            </>
          )}

          {transferType === "automation" && (
            <TransferSummary
              orders={transferOrders}
              sourceName={selectedSource?.name}
              isPaused={isSourcePaused}
              onRemove={(orderId) => removeOrder(selectedSource?.entityId.toString() || "", orderId)}
            />
          )}
        </>
      )}
    </div>
  );
};
