import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { OrderMode, ProductionType, TransferMode, useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { fetchOtherStructures } from "@/services/api";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { ETERNUM_CONFIG } from "@/utils/config";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  computeTravelTime,
  configManager,
  divideByPrecision,
  getAddressName,
  getBalance,
  getGuildFromPlayerAddress,
  getRealmNameById,
} from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers } from "@bibliothecadao/react";
import {
  ContractAddress,
  EntityType,
  ID,
  RESOURCE_TIERS,
  ResourcesIds,
  Structure,
  StructureType,
} from "@bibliothecadao/types";
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
    setup: {
      components,
      systemCalls: { send_resources },
    },
  } = useDojo();

  const [isPending, startTransition] = useTransition();
  const { play: playDonkeyScreaming } = useUiSounds(soundSelector.burnDonkey);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const addOrder = useAutomationStore((state) => state.addOrder);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const updateTransferTimestamp = useAutomationStore((state) => state.updateTransferTimestamp);
  const toggleRealmPause = useAutomationStore((state) => state.toggleRealmPause);

  // Transfer type selection
  const [transferType, setTransferType] = useState<"automation" | "oneoff">("automation");

  // Automation transfer state
  const [showAddForm, setShowAddForm] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode>(TransferMode.Recurring);
  const [transferInterval, setTransferInterval] = useState<number>(60); // Default 60 minutes
  const [transferThreshold, setTransferThreshold] = useState<number>(1000);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [newResourceId, setNewResourceId] = useState<ResourcesIds | "">("");
  const [newResourceAmount, setNewResourceAmount] = useState<number>(100);

  // One-off transfer state
  const [oneOffSelectedResourceIds, setOneOffSelectedResourceIds] = useState<number[]>([]);
  const [oneOffSelectedResourceAmounts, setOneOffSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const [isOneOffLoading, setIsOneOffLoading] = useState(false);
  const [travelTime, setTravelTime] = useState<number | undefined>(undefined);

  // Fetch structures
  const playerStructures = useUIStore((state) => state.playerStructures);
  const [guildOnly, setGuildOnly] = useState(true);

  // Entity selection state
  const [selectedSource, setSelectedSource] = useState<SelectedEntity | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SelectedEntity | null>(null);
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");
  const [destinationSearchTerm, setDestinationSearchTerm] = useState("");

  // Entity type selection state
  const [sourceEntityType, setSourceEntityType] = useState<string>("");
  const [destinationEntityType, setDestinationEntityType] = useState<string>("");

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
  const otherRealms = useMemo(() => {
    const realms = otherStructures.filter((a: EntityIdFormat) => a.category === StructureType.Realm);

    // Debug logging
    if (realms.length > 0) {
      console.log("📦 Other Realms Sample:", realms.slice(0, 2));
      console.log(
        "📦 Owner types:",
        realms.slice(0, 2).map((s) => ({
          entityId: s.entityId,
          owner: s.owner,
          ownerType: typeof s.owner,
          ownerString: s.owner.toString(),
        })),
      );
    }

    return realms;
  }, [otherStructures]);
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
  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const ordersForRealm = useMemo(() => {
    if (!selectedSource) return [];
    return ordersByRealm[selectedSource.entityId.toString()] || [];
  }, [selectedSource, ordersByRealm]);

  const transferOrders = useMemo(() => {
    return ordersForRealm.filter((order) => order.productionType === ProductionType.Transfer);
  }, [ordersForRealm]);

  const isRealmPaused = useMemo(() => {
    if (!selectedSource) return false;
    return useAutomationStore.getState().isRealmPaused(selectedSource.entityId.toString());
  }, [selectedSource]);

  const guild = useMemo(() => {
    const guildMembers = getGuildFromPlayerAddress(BigInt(account.address), components);

    return guildMembers;
  }, [account.address, components]);

  const guildMembers = useGuildMembers(guild?.entityId || BigInt(0));

  const playersInPlayersGuildAddress = useMemo(() => {
    return guildMembers.map((member) => member.address);
  }, [guildMembers]);

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
        entities: otherRealms.filter((a: EntityIdFormat) => {
          const isGuildMember = playersInPlayersGuildAddress.includes(BigInt(a.owner));
          const shouldInclude = guildOnly ? isGuildMember : !isGuildMember;

          return shouldInclude;
        }),
        name: "Other Realms",
      },
      {
        entities: otherVillages.filter((a: EntityIdFormat) =>
          guildOnly
            ? playersInPlayersGuildAddress.includes(BigInt(a.owner))
            : !playersInPlayersGuildAddress.includes(BigInt(a.owner)),
        ),
        name: "Other Villages",
      },
      {
        entities: otherHyperstructures.filter((a: EntityIdFormat) =>
          guildOnly
            ? playersInPlayersGuildAddress.includes(BigInt(a.owner))
            : !playersInPlayersGuildAddress.includes(BigInt(a.owner)),
        ),
        name: "Other Hyperstructures",
      },
      {
        entities: otherFragmentMines.filter((a: EntityIdFormat) =>
          guildOnly
            ? playersInPlayersGuildAddress.includes(BigInt(a.owner))
            : !playersInPlayersGuildAddress.includes(BigInt(a.owner)),
        ),
        name: "Other Fragment Mines",
      },
      {
        entities: otherBanks.filter((a: EntityIdFormat) =>
          guildOnly
            ? playersInPlayersGuildAddress.includes(BigInt(a.owner))
            : !playersInPlayersGuildAddress.includes(BigInt(a.owner)),
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

  // Create source entity list (only player-owned entities)
  const sourceEntitiesList = useMemo(
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
    ],
    [playerStructures],
  );

  const entitiesListWithAccountNames = useMemo(() => {
    return entitiesList.map(({ entities, name }) => ({
      entities: entities.map((entity) => ({
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

  // Create source entities list with account names (only player-owned)
  const sourceEntitiesListWithAccountNames = useMemo(() => {
    return sourceEntitiesList.map(({ entities, name }) => ({
      entities: entities.map((entity) => ({
        ...entity,
        accountName: getAddressName(ContractAddress(entity.owner), components),
        name: entity.realmId
          ? getRealmNameById(entity.realmId)
          : `${StructureType[entity.category]} ${entity.entityId}`,
      })),
      name,
      totalCount: entities.length,
    }));
  }, [sourceEntitiesList, components]);

  // Create entity type options
  const entityTypeOptions = useMemo(() => {
    return entitiesListWithAccountNames
      .filter(({ entities }) => entities.length > 0)
      .map(({ name, totalCount }) => ({
        value: name,
        label: `${name} (${totalCount})`,
      }));
  }, [entitiesListWithAccountNames]);

  // Create source entity type options (only player-owned)
  const sourceEntityTypeOptions = useMemo(() => {
    return sourceEntitiesListWithAccountNames
      .filter(({ entities }) => entities.length > 0)
      .map(({ name, totalCount }) => ({
        value: name,
        label: `${name} (${totalCount})`,
      }));
  }, [sourceEntitiesListWithAccountNames]);

  // Optimized filtering with debounced search
  const filteredSourceEntities = useMemo(() => {
    if (!sourceEntityType) return [];

    const categoryEntities =
      sourceEntitiesListWithAccountNames.find(({ name }) => name === sourceEntityType)?.entities || [];

    if (!debouncedSourceSearchTerm || debouncedSourceSearchTerm.length < 2) {
      return categoryEntities.slice(0, 50); // Show first 50 when no search
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedSourceSearchTerm.toLowerCase());
    return categoryEntities
      .filter(
        (entity) =>
          normalizeDiacriticalMarks(entity.name.toLowerCase()).includes(normalizedSearch) ||
          (entity.accountName &&
            normalizeDiacriticalMarks(entity.accountName.toLowerCase()).includes(normalizedSearch)),
      )
      .slice(0, 50); // Limit results to 50
  }, [sourceEntitiesListWithAccountNames, sourceEntityType, debouncedSourceSearchTerm]);

  const filteredDestinationEntities = useMemo(() => {
    if (!destinationEntityType) return [];

    const categoryEntities =
      entitiesListWithAccountNames.find(({ name }) => name === destinationEntityType)?.entities || [];

    if (!debouncedDestinationSearchTerm || debouncedDestinationSearchTerm.length < 2) {
      return categoryEntities.slice(0, 50);
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedDestinationSearchTerm.toLowerCase());
    return categoryEntities
      .filter(
        (entity) =>
          normalizeDiacriticalMarks(entity.name.toLowerCase()).includes(normalizedSearch) ||
          (entity.accountName &&
            normalizeDiacriticalMarks(entity.accountName.toLowerCase()).includes(normalizedSearch)),
      )
      .slice(0, 50); // Limit results to 50
  }, [entitiesListWithAccountNames, destinationEntityType, debouncedDestinationSearchTerm]);

  const handleRemoveResource = (resourceId: ResourcesIds) => {
    setSelectedResources(selectedResources.filter((r) => r.resourceId !== resourceId));
  };

  const handleAddAutomationResource = (resourceId: ResourcesIds, amount: number) => {
    // Check if resource is already added
    if (selectedResources.some((r) => r.resourceId === resourceId)) {
      alert("This resource is already added to the automation transfer.");
      return;
    }

    // Add the resource to selectedResources
    setSelectedResources([...selectedResources, { resourceId, amount }]);
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
    setDestinationEntityType("");
    setDestinationSearchTerm("");
    setTransferMode(TransferMode.Recurring);
    setTransferInterval(60);
    setTransferThreshold(1000);
    setSelectedResources([]);
  };

  // Calculate travel time when both entities are selected
  useEffect(() => {
    if (selectedSource && selectedDestination) {
      // Travel time calculation temporarily disabled due to import issues
      setTravelTime(
        computeTravelTime(
          selectedSource.entityId,
          selectedDestination.entityId,
          configManager.getSpeedConfig(EntityType.DONKEY),
          components,
        ),
      );
    }
  }, [selectedSource, selectedDestination, components]);

  // One-off transfer handlers
  const handleOneOffTransfer = () => {
    if (!selectedSource || !selectedDestination || oneOffSelectedResourceIds.length === 0) {
      alert("Please select source, destination, and resources to transfer.");
      return;
    }

    setIsOneOffLoading(true);
    const resourcesList = oneOffSelectedResourceIds.map((id: number) => ({
      resource: Number(id),
      amount: Number(oneOffSelectedResourceAmounts[Number(id)]) * 1000000000, // Manual precision multiplication
    }));

    const systemCall = send_resources({
      signer: account,
      sender_entity_id: selectedSource.entityId,
      recipient_entity_id: selectedDestination.entityId,
      resources: resourcesList || [],
    });

    playDonkeyScreaming();

    systemCall.finally(() => {
      setIsOneOffLoading(false);
      // Reset one-off transfer state
      setOneOffSelectedResourceIds([]);
      setOneOffSelectedResourceAmounts({});
      alert("Transfer completed successfully!");
    });
  };

  const handleAddOneOffResource = (resourceId: ResourcesIds, amount: number) => {
    if (!oneOffSelectedResourceIds.includes(resourceId)) {
      setOneOffSelectedResourceIds([...oneOffSelectedResourceIds, resourceId]);
    }
    setOneOffSelectedResourceAmounts({
      ...oneOffSelectedResourceAmounts,
      [resourceId]: amount,
    });
  };

  const handleRemoveOneOffResource = (resourceId: ResourcesIds) => {
    setOneOffSelectedResourceIds(oneOffSelectedResourceIds.filter((id) => id !== resourceId));
    const newAmounts = { ...oneOffSelectedResourceAmounts };
    delete newAmounts[resourceId];
    setOneOffSelectedResourceAmounts(newAmounts);
  };

  // Create ordered resources with balances for the selected source
  const orderedResourcesWithBalances = useMemo(() => {
    if (!selectedSource) return [];

    return Object.values(RESOURCE_TIERS)
      .flat()
      .map((resourceId) => {
        const balance = getBalance(selectedSource.entityId, resourceId, currentDefaultTick, components);
        return {
          id: resourceId,
          trait: ResourcesIds[resourceId],
          balance: divideByPrecision(balance?.balance || 0),
        };
      })
      .filter((res) => res.id !== ResourcesIds.Labor); // Exclude Labor from transfers
  }, [selectedSource, currentDefaultTick, components]);

  // Auto-select source entity when there's an exact match or only one result
  useEffect(() => {
    if (!sourceEntityType || !debouncedSourceSearchTerm || debouncedSourceSearchTerm.length < 2) return;

    // Check for exact match (case-insensitive)
    const normalizedSearch = normalizeDiacriticalMarks(debouncedSourceSearchTerm.toLowerCase());
    const exactMatch = filteredSourceEntities.find(
      (entity) => normalizeDiacriticalMarks(entity.name.toLowerCase()) === normalizedSearch,
    );

    if (exactMatch) {
      setSelectedSource({ name: exactMatch.name, entityId: exactMatch.entityId });
      setSourceSearchTerm("");
    } else if (filteredSourceEntities.length === 1) {
      // Auto-select if there's only one result
      const entity = filteredSourceEntities[0];
      setSelectedSource({ name: entity.name, entityId: entity.entityId });
      setSourceSearchTerm("");
    }
  }, [filteredSourceEntities, debouncedSourceSearchTerm, sourceEntityType]);

  // Auto-select destination entity when there's an exact match or only one result
  useEffect(() => {
    if (!destinationEntityType || !debouncedDestinationSearchTerm || debouncedDestinationSearchTerm.length < 2) return;

    // Check for exact match (case-insensitive)
    const normalizedSearch = normalizeDiacriticalMarks(debouncedDestinationSearchTerm.toLowerCase());
    const exactMatch = filteredDestinationEntities.find(
      (entity) => normalizeDiacriticalMarks(entity.name.toLowerCase()) === normalizedSearch,
    );

    if (exactMatch) {
      setSelectedDestination({ name: exactMatch.name, entityId: exactMatch.entityId });
      setDestinationSearchTerm("");
    } else if (filteredDestinationEntities.length === 1) {
      // Auto-select if there's only one result
      const entity = filteredDestinationEntities[0];
      setSelectedDestination({ name: entity.name, entityId: entity.entityId });
      setDestinationSearchTerm("");
    }
  }, [filteredDestinationEntities, debouncedDestinationSearchTerm, destinationEntityType]);

  return (
    <div className=" container mx-auto xl:w-1/2">
      <div className="flex items-center justify-between my-4">
        <h2>Transfer Hub</h2>
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

      {/* Transfer Type Selection */}
      <div className="mb-4 p-3 bg-black/20 rounded-md border border-gold/20">
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="transferType"
              value="automation"
              checked={transferType === "automation"}
              onChange={(e) => setTransferType(e.target.value as "automation" | "oneoff")}
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
              onChange={(e) => setTransferType(e.target.value as "automation" | "oneoff")}
              className="mr-2"
            />
            <span>One-off Transfer</span>
            <span className="text-xs text-gold/50 ml-2">(Immediate)</span>
          </label>
        </div>
      </div>

      {/* <div className="text-red/90 bg-red/10 rounded-md px-2 mb-2 text-xs border border-red/20">
        {transferType === "automation"
          ? "IMPORTANT: Your browser must stay open for automation. Automation runs every 10 minutes."
          : "IMPORTANT: One-off transfers happen immediately and require donkey travel time."}
        <br />
      </div> */}
      {!selectedSource ? (
        <div className="mb-4 border border-gold/20 rounded-md p-3">
          <h4 className="mb-2">Select Source</h4>
          <p className="text-xs text-gold/70 mb-3">You can only send resources from entities you own.</p>

          <Select value={sourceEntityType} onValueChange={setSourceEntityType}>
            <SelectTrigger className="w-full mb-2">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {sourceEntityTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Entity Selection */}
          {sourceEntityType && (
            <>
              <input
                type="text"
                placeholder={`Search ${sourceEntityType.toLowerCase()}...`}
                value={sourceSearchTerm}
                onChange={(e) => handleSourceSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredSourceEntities.length > 0) {
                    e.preventDefault();
                    const firstEntity = filteredSourceEntities[0];
                    setSelectedSource({ name: firstEntity.name, entityId: firstEntity.entityId });
                    setSourceSearchTerm("");
                  }
                }}
                className="w-full p-2 mb-2 transition-all duration-300 focus:outline-none border border-gold/20 rounded-lg bg-black/20 placeholder:text-gold/50"
              />
              <div className="max-h-64 overflow-y-auto border border-gold/20 rounded-md p-1">
                <Select
                  onValueChange={(value) => {
                    const entity = sourceEntitiesListWithAccountNames
                      .find(({ name }) => name === sourceEntityType)
                      ?.entities.find((e) => e.entityId.toString() === value);
                    if (entity) {
                      setSelectedSource({ name: entity.name, entityId: entity.entityId });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Select a ${sourceEntityType.toLowerCase().slice(0, -1)}`} />
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
                    ) : (
                      <>
                        {filteredSourceEntities.map((entity) => (
                          <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                            {entity.name} {entity.accountName && `(${entity.accountName})`}
                          </SelectItem>
                        ))}
                        {filteredSourceEntities.length === 50 && (
                          <div className="px-2 py-1 text-xs text-gold/50 italic">
                            Showing first 50 results. Search to find specific entities.
                          </div>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between border border-gold/20 rounded-md p-3">
            <div>
              <h4>
                Source: {selectedSource.name} ({selectedSource.entityId})
              </h4>
              {isRealmPaused && <span className="text-red text-xs">(PAUSED)</span>}
            </div>
            <Button
              onClick={() => {
                setSelectedSource(null);
                setSourceEntityType("");
                setSourceSearchTerm("");
              }}
              variant="outline"
              size="xs"
            >
              Change Source
            </Button>
          </div>

          {/* Pause checkbox
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
          </div> */}

          {/* Destination Selection - shown for both types */}
          {!selectedDestination ? (
            <div className="mb-4 border border-gold/20 rounded-md p-3">
              <h4 className="mb-2">Select Destination</h4>

              {/* Entity Type Selection */}
              <Select value={destinationEntityType} onValueChange={setDestinationEntityType}>
                <SelectTrigger className="w-full mb-2">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {entityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Entity Selection */}
              {destinationEntityType && (
                <>
                  <label className="block mb-1 text-sm font-medium mt-3">Search {destinationEntityType}:</label>
                  <input
                    type="text"
                    placeholder={`Search ${destinationEntityType.toLowerCase()}...`}
                    value={destinationSearchTerm}
                    onChange={(e) => handleDestinationSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredDestinationEntities.length > 0) {
                        e.preventDefault();
                        const firstEntity = filteredDestinationEntities[0];
                        setSelectedDestination({ name: firstEntity.name, entityId: firstEntity.entityId });
                        setDestinationSearchTerm("");
                      }
                    }}
                    className="w-full p-2 mb-2 transition-all duration-300 focus:outline-none border border-gold/20 rounded-lg bg-black/20 placeholder:text-gold/50"
                  />
                  <div className="max-h-64 overflow-y-auto border border-gold/20 rounded-md p-1">
                    <Select
                      onValueChange={(value) => {
                        const entity = entitiesListWithAccountNames
                          .find(({ name }) => name === destinationEntityType)
                          ?.entities.find((e) => e.entityId.toString() === value);
                        if (entity) {
                          setSelectedDestination({ name: entity.name, entityId: entity.entityId });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select a ${destinationEntityType.toLowerCase().slice(0, -1)}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationSearchTerm.length > 0 && destinationSearchTerm.length < 2 && (
                          <div className="px-2 py-1 text-xs text-gold/50">Type at least 2 characters to search...</div>
                        )}
                        {debouncedDestinationSearchTerm !== destinationSearchTerm && (
                          <div className="px-2 py-1 text-xs text-gold/50">Searching...</div>
                        )}
                        {filteredDestinationEntities.length === 0 ? (
                          <div className="px-2 py-1 text-xs text-gold/50">No entities found</div>
                        ) : (
                          <>
                            {filteredDestinationEntities
                              .filter((entity) => entity.entityId !== selectedSource?.entityId)
                              .map((entity) => (
                                <SelectItem key={entity.entityId} value={entity.entityId.toString()}>
                                  {entity.name} {entity.accountName && `(${entity.accountName})`}
                                </SelectItem>
                              ))}
                            {filteredDestinationEntities.length === 50 && (
                              <div className="px-2 py-1 text-xs text-gold/50 italic">
                                Showing first 50 results. Search to find specific entities.
                              </div>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mb-4 flex items-center justify-between border border-gold/20 rounded-md p-3">
              <div>
                <h4>
                  Destination: {selectedDestination.name} ({selectedDestination.entityId})
                </h4>
                {travelTime && transferType === "oneoff" && (
                  <p className="text-sm text-gold/70">Travel Time: ~{Math.round(travelTime / 60)} minutes</p>
                )}
              </div>
              <Button
                onClick={() => {
                  setSelectedDestination(null);
                  setDestinationEntityType("");
                  setDestinationSearchTerm("");
                }}
                variant="outline"
                size="xs"
              >
                Change Destination
              </Button>
            </div>
          )}

          {transferType === "automation" ? (
            <>
              <div className="my-4">
                {!showAddForm && (
                  <Button onClick={() => setShowAddForm(true)} variant="default" disabled={isRealmPaused}>
                    Add New Transfer Automation {isRealmPaused && "(Paused)"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue/10 rounded-md border border-gold/20">
                <h4 className=" mb-2 h6">One-off Transfer</h4>
                <p className="text-sm text-gold/70">
                  Send resources immediately between entities. Transfer will take time based on distance.
                  {travelTime && (
                    <span className="block mt-1">
                      <strong>Travel Time:</strong> ~{Math.round(travelTime / 60)} minutes
                    </span>
                  )}
                </p>
              </div>

              {/* One-off Resource Selection */}
              <div className="mb-4 border border-gold/20 rounded-md p-3">
                <label className="block mb-2 text-sm font-medium">Select Resources to Transfer:</label>

                {/* Add Resource Form */}
                <div className=" gap-2 mb-3 flex">
                  <Select
                    value={newResourceId.toString()}
                    onValueChange={(value) => setNewResourceId(Number(value) as ResourcesIds)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select resource" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedResourcesWithBalances.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-gold/50">
                          No resources available or source not selected
                        </div>
                      ) : (
                        orderedResourcesWithBalances.map((resource) => (
                          <SelectItem key={resource.id} value={resource.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <ResourceIcon resource={resource.trait} size="xs" className="mr-2" />
                                {resource.trait}
                              </div>
                              <span className="text-xs text-gold/70 ml-2">{resource.balance.toLocaleString()}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <NumberInput
                    value={newResourceAmount}
                    onChange={setNewResourceAmount}
                    min={1}
                    max={orderedResourcesWithBalances.find((r) => r.id === newResourceId)?.balance || 1}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newResourceId !== "") {
                        const selectedResource = orderedResourcesWithBalances.find((r) => r.id === newResourceId);
                        if (selectedResource && selectedResource.balance > 0) {
                          handleAddOneOffResource(
                            newResourceId as ResourcesIds,
                            Math.min(newResourceAmount, selectedResource.balance),
                          );
                          setNewResourceId("");
                          setNewResourceAmount(100);
                        } else {
                          alert("Selected resource has no available balance.");
                        }
                      }
                    }}
                    variant="outline"
                    size="xs"
                    disabled={
                      !newResourceId || orderedResourcesWithBalances.find((r) => r.id === newResourceId)?.balance === 0
                    }
                  >
                    Add
                  </Button>
                </div>

                {/* Selected Resources Display */}
                <div className="space-y-2">
                  {oneOffSelectedResourceIds.map((resourceId) => (
                    <div key={resourceId} className="flex items-center justify-between bg-gold/10 p-2 rounded">
                      <div className="flex items-center">
                        <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" className="mr-2" />
                        <span>
                          {ResourcesIds[resourceId]}: {oneOffSelectedResourceAmounts[resourceId]?.toLocaleString()}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleRemoveOneOffResource(resourceId as ResourcesIds)}
                        variant="danger"
                        size="xs"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Transfer Button */}
                <div className="mt-4">
                  <Button
                    onClick={handleOneOffTransfer}
                    variant="primary"
                    size="md"
                    disabled={!selectedDestination || oneOffSelectedResourceIds.length === 0 || isOneOffLoading}
                    isLoading={isOneOffLoading}
                    className="w-full"
                  >
                    {isOneOffLoading ? "Transferring..." : "Send Resources Now"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Automation Form - only shown when automation type is selected and destination is chosen */}
          {transferType === "automation" && selectedDestination && showAddForm && (
            <form
              onSubmit={handleAddTransferOrder}
              className="p-4 mb-6 space-y-4 border border-gold/20 rounded-md bg-black/10"
            >
              <h3 className="text-lg font-semibold">Create New Transfer Automation</h3>

              <div className="grid grid-cols-2 gap-4">
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
                  <ul className="list-disc pl-4 mb-4 text-xs text-gold/70">
                    <li>
                      <span className="font-bold">Recurring:</span> Transfer resources at regular intervals (minimum 10
                      minutes).
                    </li>
                    <li>
                      <span className="font-bold">Maintain Stock:</span> Transfer when destination balance falls below
                      threshold.
                    </li>
                    <li>
                      <span className="font-bold">Depletion Transfer:</span> Transfer when source balance exceeds
                      threshold.
                    </li>
                  </ul>
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
                  <label className="block mb-1 text-sm font-medium">Resources to Transfer</label>

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
                        {orderedResourcesWithBalances.length === 0 ? (
                          <div className="px-2 py-1 text-xs text-gold/50">
                            No resources available or source not selected
                          </div>
                        ) : (
                          orderedResourcesWithBalances.map((resource) => (
                            <SelectItem key={resource.id} value={resource.id.toString()}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center">
                                  <ResourceIcon resource={resource.trait} size="xs" className="mr-2" />
                                  {resource.trait}
                                </div>
                                <span className="text-xs text-gold/70 ml-2">{resource.balance.toLocaleString()}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <NumberInput
                      value={newResourceAmount}
                      onChange={setNewResourceAmount}
                      min={1}
                      max={orderedResourcesWithBalances.find((r) => r.id === newResourceId)?.balance || 1}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newResourceId !== "") {
                          const selectedResource = orderedResourcesWithBalances.find((r) => r.id === newResourceId);
                          if (selectedResource && selectedResource.balance > 0) {
                            handleAddAutomationResource(
                              newResourceId as ResourcesIds,
                              Math.min(newResourceAmount, selectedResource.balance),
                            );
                            setNewResourceId("");
                            setNewResourceAmount(100);
                          } else {
                            alert("Selected resource has no available balance.");
                          }
                        }
                      }}
                      variant="outline"
                      size="xs"
                      disabled={
                        !newResourceId ||
                        orderedResourcesWithBalances.find((r) => r.id === newResourceId)?.balance === 0
                      }
                    >
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
                <Button type="submit" variant="gold" disabled={selectedResources.length === 0}>
                  Confirm Transfer Automation
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="default" size="xs">
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Transfer Orders Table - only show for automation type */}
          {transferType === "automation" && (
            <>
              {transferOrders.length === 0 ? (
                <p>No transfer automation orders set up for this entity yet.</p>
              ) : (
                <div className={`relative border border-gold/20 rounded-md p-3 ${isRealmPaused ? "opacity-50" : ""}`}>
                  {isRealmPaused && (
                    <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
                      <div className="bg-red/90 text-white px-4 py-2 rounded font-bold">AUTOMATION PAUSED</div>
                    </div>
                  )}
                  <table className="w-full text-sm text-left table-auto">
                    <thead className="text-xs uppercase bg-gray-700/50 text-gold">
                      <tr>
                        <th scope="col" className="px-6 py-1">
                          Destination
                        </th>
                        <th scope="col" className="px-6 py-1">
                          Mode
                        </th>
                        <th scope="col" className="px-6 py-1">
                          Resources
                        </th>
                        <th scope="col" className="px-6 py-1">
                          Schedule
                        </th>
                        <th scope="col" className="px-6 py-1">
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
                                  <ResourceIcon
                                    resource={ResourcesIds[resource.resourceId]}
                                    size="xs"
                                    className="mr-1"
                                  />
                                  <span className="text-xs">{resource.amount.toLocaleString()}</span>
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
        </>
      )}
    </div>
  );
};
