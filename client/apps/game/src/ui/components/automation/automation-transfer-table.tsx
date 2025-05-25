import { OrderMode, ProductionType, TransferMode, useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { fetchOtherStructures } from "@/services/api";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import TextInput from "@/ui/elements/text-input";
import { normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { ETERNUM_CONFIG } from "@/utils/config";
import { getAddressName, getGuildMembersFromPlayerAddress, getRealmNameById } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, ID, ResourcesIds, Structure, StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { LucideArrowRight } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";

export type EntityIdFormat = {
  entityId: ID;
  realmId: ID;
  category: StructureType;
  owner: ContractAddress;
};

interface SelectedEntity {
  name: string;
  entityId: ID;
}

interface SelectedResource {
  resourceId: ResourcesIds;
  amount: number;
}

const eternumConfig = ETERNUM_CONFIG();

// Helper function to format minutes into a human-readable string
function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

// Helper function to get effective transfer interval (rounds up to next 10-minute mark)
function getEffectiveInterval(minutes: number): number {
  if (minutes <= 10) return 10;
  // For intervals that aren't multiples of 10, the actual behavior is complex
  // as it depends on when transfers align with the 10-minute automation cycle
  return minutes;
}

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const AutomationTransferTable: React.FC = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const [isPending, startTransition] = useTransition();

  const addOrder = useAutomationStore((state) => state.addOrder);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const toggleRealmPause = useAutomationStore((state) => state.toggleRealmPause);

  const [showAddForm, setShowAddForm] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode>(TransferMode.Recurring);
  const [transferInterval, setTransferInterval] = useState<number>(60); // Default 60 minutes
  const [transferThreshold, setTransferThreshold] = useState<number>(1000);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [newResourceId, setNewResourceId] = useState<ResourcesIds | "">("");
  const [newResourceAmount, setNewResourceAmount] = useState<number>(100);

  // Fetch structures
  const playerStructures = useUIStore((state) => state.playerStructures);
  const [guildOnly, setGuildOnly] = useState(false);

  // Entity selection state
  const [selectedSource, setSelectedSource] = useState<SelectedEntity | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SelectedEntity | null>(null);
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");
  const [destinationSearchTerm, setDestinationSearchTerm] = useState("");

  // Use startTransition for search updates
  const handleSourceSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSourceSearchTerm(value);
    });
  }, []);

  const handleDestinationSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setDestinationSearchTerm(value);
    });
  }, []);

  // Debounce search terms to reduce re-renders
  const debouncedSourceSearchTerm = useDebounce(sourceSearchTerm, 300);
  const debouncedDestinationSearchTerm = useDebounce(destinationSearchTerm, 300);

  // Use React Query to fetch other structures with caching
  const { data: otherStructures = [] } = useQuery<EntityIdFormat[]>({
    queryKey: ["otherStructures", account.address],
    queryFn: () => fetchOtherStructures(account.address),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  });

  // Process fetched structures
  const otherVillages = useMemo(
    () => otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.Village),
    [otherStructures],
  );
  const otherRealms = useMemo(
    () => otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.Realm),
    [otherStructures],
  );
  const otherHyperstructures = useMemo(
    () => otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.Hyperstructure),
    [otherStructures],
  );
  const otherFragmentMines = useMemo(
    () => otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.FragmentMine),
    [otherStructures],
  );
  const otherBanks = useMemo(
    () => otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.Bank),
    [otherStructures],
  );

  // Get orders for selected source
  const ordersForRealm = useMemo(() => {
    if (!selectedSource) return [];
    return useAutomationStore.getState().getOrdersForRealm(selectedSource.entityId.toString());
  }, [selectedSource]);

  const transferOrders = useMemo(() => {
    return ordersForRealm.filter((order) => order.productionType === ProductionType.Transfer);
  }, [ordersForRealm]);

  const isRealmPaused = useMemo(() => {
    if (!selectedSource) return false;
    return useAutomationStore.getState().isRealmPaused(selectedSource.entityId.toString());
  }, [selectedSource]);

  const playersInPlayersGuildAddress = useMemo(() => {
    return (
      getGuildMembersFromPlayerAddress(ContractAddress(account.address), components)?.map((a) => BigInt(a.address)) ||
      []
    );
  }, [account.address, components]);

  const mapToEntityIdFormat = (structure: Structure): EntityIdFormat => {
    return {
      entityId: structure.entityId,
      realmId: structure.structure.metadata.realm_id,
      category: structure.structure.base.category,
      owner: structure.structure.owner,
    };
  };

  // Create entity lists
  const entitiesList = useMemo(
    () => [
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Realm)
          .map(mapToEntityIdFormat),
        name: "Your Realms",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Village)
          .map(mapToEntityIdFormat),
        name: "Your Villages",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Hyperstructure)
          .map(mapToEntityIdFormat),
        name: "Your Hyperstructures",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.FragmentMine)
          .map(mapToEntityIdFormat),
        name: "Your Fragment Mines",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Bank)
          .map(mapToEntityIdFormat),
        name: "Your Banks",
      },
      {
        entities: otherRealms.filter((a: EntityIdFormat) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Realms",
      },
      {
        entities: otherVillages.filter((a: EntityIdFormat) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Villages",
      },
      {
        entities: otherHyperstructures.filter((a: EntityIdFormat) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Hyperstructures",
      },
      {
        entities: otherFragmentMines.filter((a: EntityIdFormat) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Fragment Mines",
      },
      {
        entities: otherBanks.filter((a: EntityIdFormat) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Banks",
      },
    ],
    [
      playerStructures,
      otherRealms,
      otherVillages,
      otherHyperstructures,
      otherFragmentMines,
      otherBanks,
      guildOnly,
      playersInPlayersGuildAddress,
    ],
  );

  const entitiesListWithAccountNames = useMemo(() => {
    return entitiesList.map(({ entities, name }) => ({
      entities: entities.slice(0, 100).map((entity) => ({
        // Limit to first 100 entities per category
        ...entity,
        accountName: getAddressName(ContractAddress(entity.owner), components),
        name: entity.realmId
          ? getRealmNameById(entity.realmId)
          : `${StructureType[entity.category]} ${entity.entityId}`,
      })),
      name,
      totalCount: entities.length, // Keep track of total count
    }));
  }, [entitiesList, components]);

  // Lazy name resolution for better performance
  const getEntityDisplayName = useCallback((entity: EntityIdFormat & { name?: string; accountName?: string }) => {
    if (entity.name) return entity.name;
    return entity.realmId ? getRealmNameById(entity.realmId) : `${StructureType[entity.category]} ${entity.entityId}`;
  }, []);

  // Flatten entities for easier search
  const allEntities = useMemo(() => {
    const flatEntities: Array<EntityIdFormat & { name: string; accountName?: string }> = [];
    entitiesListWithAccountNames.forEach(({ entities }) => {
      flatEntities.push(...entities);
    });
    return flatEntities;
  }, [entitiesListWithAccountNames]);

  // Optimized filtering with debounced search
  const filteredSourceEntities = useMemo(() => {
    if (!debouncedSourceSearchTerm || debouncedSourceSearchTerm.length < 2) return allEntities.slice(0, 50); // Show first 50 when no search

    const normalizedSearch = normalizeDiacriticalMarks(debouncedSourceSearchTerm.toLowerCase());
    return allEntities
      .filter(
        (entity) =>
          normalizeDiacriticalMarks(entity.name.toLowerCase()).includes(normalizedSearch) ||
          (entity.accountName &&
            normalizeDiacriticalMarks(entity.accountName.toLowerCase()).includes(normalizedSearch)),
      )
      .slice(0, 50); // Limit results to 50
  }, [allEntities, debouncedSourceSearchTerm]);

  const filteredEntities = useMemo(() => {
    if (!debouncedDestinationSearchTerm || debouncedDestinationSearchTerm.length < 2) return allEntities.slice(0, 50);

    const normalizedSearch = normalizeDiacriticalMarks(debouncedDestinationSearchTerm.toLowerCase());
    return allEntities
      .filter(
        (entity) =>
          normalizeDiacriticalMarks(entity.name.toLowerCase()).includes(normalizedSearch) ||
          (entity.accountName &&
            normalizeDiacriticalMarks(entity.accountName.toLowerCase()).includes(normalizedSearch)),
      )
      .slice(0, 50); // Limit results to 50
  }, [allEntities, debouncedDestinationSearchTerm]);

  const handleAddResource = () => {
    if (newResourceId !== "" && newResourceAmount > 0) {
      const existing = selectedResources.find((r) => r.resourceId === newResourceId);
      if (!existing) {
        setSelectedResources([
          ...selectedResources,
          { resourceId: newResourceId as ResourcesIds, amount: newResourceAmount },
        ]);
        setNewResourceId("");
        setNewResourceAmount(100);
      }
    }
  };

  const handleRemoveResource = (resourceId: ResourcesIds) => {
    setSelectedResources(selectedResources.filter((r) => r.resourceId !== resourceId));
  };

  const handleAddTransferOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSource || !selectedDestination || selectedResources.length === 0) {
      alert("Please select source and destination entities and at least one resource to transfer.");
      return;
    }

    addOrder({
      priority: 5,
      resourceToUse: selectedResources[0].resourceId, // Use first resource as identifier
      mode: OrderMode.ProduceOnce, // Not used for transfers
      maxAmount: 0, // Not used for transfers
      realmEntityId: selectedSource.entityId.toString(),
      productionType: ProductionType.Transfer,
      realmName: selectedSource.name,
      targetEntityId: selectedDestination.entityId.toString(),
      targetEntityName: selectedDestination.name,
      transferMode,
      transferInterval: transferMode === TransferMode.Recurring ? transferInterval : undefined,
      transferThreshold: transferMode !== TransferMode.Recurring ? transferThreshold : undefined,
      transferResources: selectedResources,
    });

    // Reset form
    setShowAddForm(false);
    setSelectedDestination(null);
    setTransferMode(TransferMode.Recurring);
    setTransferInterval(60);
    setTransferThreshold(1000);
    setSelectedResources([]);
  };

  return (
    <div className="p-2 border rounded-lg shadow-md panel-wood">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transfer Automation</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm">Guild Only</label>
          <input
            type="checkbox"
            checked={guildOnly}
            onChange={(e) => setGuildOnly(e.target.checked)}
            className="w-4 h-4"
          />
        </div>
      </div>

      <div className="text-red/90 bg-red/10 rounded-md px-2 mb-2 text-xs border border-red/20">
        IMPORTANT: Your browser must stay open for automation. Automation runs every 10 minutes.
        <br />
      </div>
      {!selectedSource ? (
        <div className="mb-4">
          <h4 className="mb-2">Select Source Entity</h4>
          <TextInput
            placeholder="Search entities..."
            value={sourceSearchTerm}
            onChange={handleSourceSearchChange}
            className="mb-2"
          />
          <div className="max-h-64 overflow-y-auto">
            <Select
              onValueChange={(value) => {
                const entity = allEntities.find((e) => e.entityId.toString() === value);
                if (entity) {
                  setSelectedSource({ name: entity.name, entityId: entity.entityId });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source entity" />
              </SelectTrigger>
              <SelectContent>
                {sourceSearchTerm.length > 0 && sourceSearchTerm.length < 2 && (
                  <div className="px-2 py-1 text-xs text-gold/50">Type at least 2 characters to search...</div>
                )}
                {debouncedSourceSearchTerm !== sourceSearchTerm && (
                  <div className="px-2 py-1 text-xs text-gold/50">Searching...</div>
                )}
                {filteredSourceEntities.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-gold/50">No entities found</div>
                ) : debouncedSourceSearchTerm.length >= 2 ? (
                  // Show filtered results
                  filteredSourceEntities.map((entity) => (
                    <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                      {entity.name} {entity.accountName && `(${entity.accountName})`}
                    </SelectItem>
                  ))
                ) : (
                  // Show grouped results when not searching
                  entitiesListWithAccountNames.map(
                    ({ name: groupName, entities, totalCount }) =>
                      entities.length > 0 && (
                        <div key={groupName}>
                          <div className="px-2 py-1 text-xs font-semibold text-gold/50">
                            {groupName}{" "}
                            {totalCount > entities.length && `(showing ${entities.length} of ${totalCount})`}
                          </div>
                          {entities.map((entity) => (
                            <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                              {entity.name} {entity.accountName && `(${entity.accountName})`}
                            </SelectItem>
                          ))}
                        </div>
                      ),
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4>
                Source: {selectedSource.name} ({selectedSource.entityId})
              </h4>
              {isRealmPaused && <span className="text-red text-xs">(PAUSED)</span>}
            </div>
            <Button onClick={() => setSelectedSource(null)} variant="outline" size="xs">
              Change Source
            </Button>
          </div>

          {/* Pause checkbox */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-black/20 rounded">
            <input
              type="checkbox"
              id={`pause-realm-transfers-${selectedSource.entityId}`}
              checked={isRealmPaused}
              onChange={() => toggleRealmPause(selectedSource.entityId.toString())}
              className="w-4 h-4"
            />
            <label htmlFor={`pause-realm-transfers-${selectedSource.entityId}`} className="text-sm font-medium">
              Pause all automation for this entity (includes production & transfers)
            </label>
            {isRealmPaused && <span className="text-red ml-2 text-xs">(PAUSED - No automations will run)</span>}
          </div>

          <ul className="list-disc pl-4 mb-4">
            <li>
              <span className="font-bold">Recurring:</span> Transfer resources at regular intervals (minimum 10 minutes
              due to automation cycle).
            </li>
            <li>
              <span className="font-bold">Maintain Stock:</span> Transfer when destination entity falls below threshold.
            </li>
            <li>
              <span className="font-bold">Depletion Transfer:</span> Transfer when source entity exceeds threshold.
            </li>
          </ul>

          <div className="my-4">
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="default" size="xs" disabled={isRealmPaused}>
                Add New Transfer Automation {isRealmPaused && "(Paused)"}
              </Button>
            )}
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddTransferOrder}
              className="p-4 mb-6 space-y-4 border border-gold/20 rounded-md bg-black/10"
            >
              <h3 className="text-lg font-semibold">Create New Transfer Order</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Destination Selection */}
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium">Destination Entity:</label>
                  <TextInput
                    placeholder="Search entities..."
                    value={destinationSearchTerm}
                    onChange={handleDestinationSearchChange}
                    className="mb-2"
                  />
                  <Select
                    value={selectedDestination?.entityId.toString()}
                    onValueChange={(value) => {
                      const entity = allEntities.find((e) => e.entityId.toString() === value);
                      if (entity) {
                        setSelectedDestination({ name: entity.name, entityId: entity.entityId });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select destination">
                        {selectedDestination?.name || "Select destination"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {destinationSearchTerm.length > 0 && destinationSearchTerm.length < 2 && (
                        <div className="px-2 py-1 text-xs text-gold/50">Type at least 2 characters to search...</div>
                      )}
                      {debouncedDestinationSearchTerm !== destinationSearchTerm && (
                        <div className="px-2 py-1 text-xs text-gold/50">Searching...</div>
                      )}
                      {filteredEntities.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-gold/50">No entities found</div>
                      ) : debouncedDestinationSearchTerm.length >= 2 ? (
                        // Show filtered results
                        filteredEntities
                          .filter((entity) => entity.entityId !== selectedSource?.entityId)
                          .map((entity) => (
                            <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                              {entity.name} {entity.accountName && `(${entity.accountName})`}
                            </SelectItem>
                          ))
                      ) : (
                        // Show grouped results when not searching
                        entitiesListWithAccountNames.map(
                          ({ name: groupName, entities, totalCount }) =>
                            entities.length > 0 && (
                              <div key={groupName}>
                                <div className="px-2 py-1 text-xs font-semibold text-gold/50">
                                  {groupName}{" "}
                                  {totalCount > entities.length && `(showing ${entities.length} of ${totalCount})`}
                                </div>
                                {entities
                                  .filter((entity) => entity.entityId !== selectedSource.entityId)
                                  .map((entity) => (
                                    <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                                      {entity.name} {entity.accountName && `(${entity.accountName})`}
                                    </SelectItem>
                                  ))}
                              </div>
                            ),
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transfer Mode */}
                <div>
                  <label className="block mb-1 text-sm font-medium">Transfer Mode:</label>
                  <Select value={transferMode} onValueChange={(value: TransferMode) => setTransferMode(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TransferMode.Recurring}>Recurring</SelectItem>
                      <SelectItem value={TransferMode.MaintainStock}>Maintain Stock</SelectItem>
                      <SelectItem value={TransferMode.DepletionTransfer}>Depletion Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mode-specific inputs */}
                <div>
                  {transferMode === TransferMode.Recurring && (
                    <>
                      <label className="block mb-1 text-sm font-medium">Transfer Interval (minutes):</label>
                      <NumberInput
                        value={transferInterval}
                        onChange={setTransferInterval}
                        min={10}
                        max={10080}
                        className="w-full"
                      />
                      {transferInterval < 10 && (
                        <div className="text-xs text-red/90 bg-red/10 rounded p-1 mt-1">
                          ⚠️ Automation runs every 10 minutes. Intervals less than 10 minutes will transfer every 10
                          minutes.
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setTransferInterval(10)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          10m
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferInterval(30)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          30m
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferInterval(60)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          1h
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferInterval(120)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          2h
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferInterval(360)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          6h
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferInterval(1440)}
                          className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                        >
                          24h
                        </button>
                      </div>
                      <p className="text-xs text-gold/50 mt-1">
                        Transfer will occur every {formatMinutes(transferInterval)}
                        {transferInterval === 10 && " (minimum interval due to automation cycle)"}
                      </p>
                    </>
                  )}

                  {(transferMode === TransferMode.MaintainStock || transferMode === TransferMode.DepletionTransfer) && (
                    <>
                      <label className="block mb-1 text-sm font-medium">Threshold Amount:</label>
                      <NumberInput
                        value={transferThreshold}
                        onChange={setTransferThreshold}
                        min={1}
                        className="w-full"
                      />
                      <p className="text-xs text-gold/50 mt-1">
                        {transferMode === TransferMode.MaintainStock
                          ? "Transfer when destination has less than this amount."
                          : "Transfer when source has more than this amount."}
                      </p>
                    </>
                  )}
                </div>

                {/* Resource Selection */}
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium">Resources to Transfer:</label>

                  {/* Add new resource */}
                  <div className="flex gap-2 mb-2">
                    <Select
                      value={newResourceId.toString()}
                      onValueChange={(value) => setNewResourceId(Number(value) as ResourcesIds)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select resource" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ResourcesIds)
                          .filter(([key, value]) => typeof value === "number" && value !== ResourcesIds.Labor)
                          .map(([key, value]) => (
                            <SelectItem key={value} value={value.toString()}>
                              <div className="flex items-center">
                                <ResourceIcon resource={key} size="xs" className="mr-2" />
                                {key}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <NumberInput value={newResourceAmount} onChange={setNewResourceAmount} min={1} className="w-32" />
                    <Button type="button" onClick={handleAddResource} variant="outline" size="xs">
                      Add
                    </Button>
                  </div>

                  {/* Selected resources list */}
                  <div className="space-y-1">
                    {selectedResources.map((resource) => (
                      <div
                        key={resource.resourceId}
                        className="flex items-center justify-between bg-gold/10 p-2 rounded"
                      >
                        <div className="flex items-center">
                          <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="sm" className="mr-2" />
                          <span>
                            {ResourcesIds[resource.resourceId]}: {resource.amount.toLocaleString()}
                          </span>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleRemoveResource(resource.resourceId)}
                          variant="danger"
                          size="xs"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" variant="gold" disabled={!selectedDestination || selectedResources.length === 0}>
                  Add Transfer Automation
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="default" size="md">
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Transfer Orders Table */}
          {transferOrders.length === 0 ? (
            <p>No transfer automation orders set up for this entity yet.</p>
          ) : (
            <div className={`relative ${isRealmPaused ? "opacity-50" : ""}`}>
              {isRealmPaused && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
                  <div className="bg-red/90 text-white px-4 py-2 rounded font-bold">AUTOMATION PAUSED</div>
                </div>
              )}
              <table className="w-full text-sm text-left table-auto">
                <thead className="text-xs uppercase bg-gray-700/50 text-gold">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      Destination
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Mode
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Resources
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Schedule
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transferOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gold/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="mr-2">{selectedSource?.name}</span>
                          <LucideArrowRight className="w-4 h-4" />
                          <span className="ml-2">{order.targetEntityName || order.targetEntityId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize">
                        {order.transferMode === TransferMode.Recurring && "Recurring"}
                        {order.transferMode === TransferMode.MaintainStock && "Maintain Stock"}
                        {order.transferMode === TransferMode.DepletionTransfer && "Depletion"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {order.transferResources?.map((resource, idx) => (
                            <div key={idx} className="flex items-center bg-gold/10 px-2 py-1 rounded">
                              <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="xs" className="mr-1" />
                              <span className="text-xs">{resource.amount}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {order.transferMode === TransferMode.Recurring &&
                          `Every ${formatMinutes(order.transferInterval || 60)}`}
                        {order.transferMode === TransferMode.MaintainStock &&
                          `When < ${order.transferThreshold?.toLocaleString()}`}
                        {order.transferMode === TransferMode.DepletionTransfer &&
                          `When > ${order.transferThreshold?.toLocaleString()}`}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          onClick={() => removeOrder(selectedSource?.entityId.toString() || "", order.id)}
                          variant="danger"
                          size="xs"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
