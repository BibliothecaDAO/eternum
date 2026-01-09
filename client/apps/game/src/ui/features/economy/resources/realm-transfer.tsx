import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  calculateDistance,
  calculateDonkeysNeeded,
  getEntityIdFromKeys,
  getTotalResourceWeightKg,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import {
  findResourceById,
  ID,
  PlayerStructure,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { ChevronDown, Flame, Search, ShieldCheck, X } from "lucide-react";
import { Dispatch, memo, ReactNode, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { BigNumberish } from "starknet";

type transferCall = {
  structureId: ID;
  sender_entity_id: BigNumberish;
  recipient_entity_id: BigNumberish;
  resources: BigNumberish[];
  realmName: string;
};

export const RealmTransfer = memo(({ resource }: { resource: ResourcesIds }) => {
  const mode = useGameModeConfig();
  const {
    setup: {
      components,
      systemCalls: { send_resources_multiple, structure_burn },
    },
    account: { account },
  } = useDojo();

  const { currentDefaultTick: tick } = useBlockTimestamp();

  const selectedStructureEntityId = useUIStore((state) => state.structureEntityId);

  const resourceManager = useResourceManager(selectedStructureEntityId);

  const balance = useMemo(() => {
    return resourceManager.balanceWithProduction(tick, resource).balance;
  }, [resourceManager, tick, resource]);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const selectedStructure = useMemo(() => {
    return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(selectedStructureEntityId)]));
  }, [components.Structure, selectedStructureEntityId]);

  const playerStructuresFiltered = useMemo(() => {
    const playerStructuresWithName = playerStructures.map((structure) => ({
      ...structure,
      name: mode.structure.getName(structure.structure).name,
    }));

    // TRANSFER RULES:
    // 1. Realms can transfer ALL materials (including troops) to other Realms
    // 2. Other structures (Camp/Village, Essence Rift/FragmentMine, Hyperstructure)
    //    can transfer all materials EXCEPT troops

    if (isMilitaryResource(resource)) {
      // Military resources (troops) can ONLY be transferred between Realms

      if (selectedStructure?.category === StructureType.Realm) {
        // Source is a Realm: only show other Realms as valid destinations
        return playerStructuresWithName.filter((structure) => structure.category === StructureType.Realm);
      } else {
        // Source is NOT a Realm (Camp, Essence Rift, Hyperstructure, etc.)
        // These structures cannot transfer troops at all
        return [];
      }
    }

    // Non-military resources can be transferred between ALL structures
    return playerStructuresWithName;
  }, [mode.structure, playerStructures, resource, selectedStructure]);

  const structureDistances = useMemo(() => {
    const distances: Record<number, number> = {};
    if (!selectedStructure) return distances;
    playerStructuresFiltered.forEach((structure) => {
      distances[structure.structure.entity_id] = calculateDistance(
        { x: structure.structure.base.coord_x, y: structure.structure.base.coord_y },
        { x: selectedStructure.base.coord_x, y: selectedStructure.base.coord_y },
      );
    });
    return distances;
  }, [playerStructuresFiltered, selectedStructure]);

  const [isLoading, setIsLoading] = useState(false);
  const [burnAmount, setBurnAmount] = useState(0);
  const [calls, setCalls] = useState<transferCall[]>([]);
  const [type, setType] = useState<"send" | "receive">("send");
  const [totalTransferResourceWeightKg, setTotalTransferResourceWeightKg] = useState(0);
  const [showBurnSection, setShowBurnSection] = useState(false);
  const [showTransferRules, setShowTransferRules] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const totalNeededDonkeys = useMemo(
    () => calculateDonkeysNeeded(totalTransferResourceWeightKg),
    [totalTransferResourceWeightKg],
  );

  const resourceData = useMemo(() => findResourceById(resource), [resource]);
  const resourceLabel = (resourceData?.trait as string) || "";
  const donkeyTrait = useMemo(() => findResourceById(ResourcesIds.Donkey)?.trait as string, []);
  const availableBalance = balance ? Number(balance) : 0;
  const burnSliderMax = availableBalance / RESOURCE_PRECISION;
  const normalizedSearchTerm = useMemo(() => {
    if (!searchTerm) {
      return "";
    }
    return searchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/\u0300-\u036f/g, "")
      .replace(/[^a-z0-9]/g, "");
  }, [searchTerm]);
  const structuresForTransfer = useMemo(() => {
    return [...playerStructuresFiltered]
      .sort((a, b) => {
        if (!sortByDistance) {
          return a.name.localeCompare(b.name);
        }
        const distanceA = structureDistances[a.structure.entity_id] ?? 0;
        const distanceB = structureDistances[b.structure.entity_id] ?? 0;
        return distanceA - distanceB;
      })
      .filter((structure) => {
        if (structure.structure.entity_id === selectedStructureEntityId) {
          return false;
        }

        if (normalizedSearchTerm) {
          const structureNameNormalized = structure.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/\u0300-\u036f/g, "")
            .replace(/[^a-z0-9]/g, "");

          if (!structureNameNormalized.includes(normalizedSearchTerm)) {
            return false;
          }
        }

        let relevantBalanceValue: number | undefined;

        if (type === "send") {
          relevantBalanceValue = availableBalance;
        } else {
          const otherStructureManager = new ResourceManager(components, structure.structure.entity_id);
          const receivedBalance = otherStructureManager.balanceWithProduction(tick, resource).balance;
          relevantBalanceValue = receivedBalance ? Number(receivedBalance) : 0;
        }

        if (relevantBalanceValue === undefined || relevantBalanceValue === null) {
          return false;
        }

        const calculatedMaxAmountForFilter = relevantBalanceValue / RESOURCE_PRECISION;

        return calculatedMaxAmountForFilter > 0;
      });
  }, [
    playerStructuresFiltered,
    sortByDistance,
    structureDistances,
    selectedStructureEntityId,
    normalizedSearchTerm,
    type,
    availableBalance,
    components,
    tick,
    resource,
  ]);
  const noValidMilitaryDestinations =
    isMilitaryResource(resource) &&
    selectedStructure &&
    selectedStructure.category !== StructureType.Realm &&
    playerStructuresFiltered.length === 0;
  const hasQueue = calls.length > 0;

  useEffect(() => {
    const resourcesForWeightCalc = calls.map((call) => {
      return {
        resourceId: Number(call.resources[0]),
        amount: Number(call.resources[1]),
      };
    });
    const totalWeightKg = getTotalResourceWeightKg(resourcesForWeightCalc);

    setTotalTransferResourceWeightKg(totalWeightKg);
  }, [calls]);

  const handleBurn = useCallback(async () => {
    setIsLoading(true);

    try {
      await structure_burn({
        signer: account,
        structure_id: selectedStructureEntityId,
        resources: [{ resourceId: resource, amount: Math.round(burnAmount * RESOURCE_PRECISION) }],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [burnAmount, account, structure_burn, selectedStructureEntityId, resource]);

  const handleTransfer = useCallback(async () => {
    setIsLoading(true);
    const cleanedCalls = calls.map(({ sender_entity_id, recipient_entity_id, resources }) => ({
      sender_entity_id,
      recipient_entity_id,
      resources: [resources[0], BigInt(Number(resources[1]) * RESOURCE_PRECISION)],
    }));

    try {
      await send_resources_multiple({
        signer: account,
        calls: cleanedCalls,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }

    setCalls([]);
  }, [account, calls, send_resources_multiple]);

  const handleBurnAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBurnAmount(Number(event.target.value));
  };

  // Calculate summary data
  const totalResourceTransferred = useMemo(() => {
    return calls.reduce((acc, call) => acc + Number(call.resources[1]), 0);
  }, [calls]);

  const uniqueStructuresInvolved = useMemo(() => {
    const structureIds = new Set(calls.map((call) => call.structureId));
    return structureIds.size;
  }, [calls]);

  return (
    <div className="flex h-full min-h-[75vh] flex-col gap-3 p-3 md:p-5">
      <header className="rounded-lg border border-gold/30 bg-black/40 p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <ResourceIcon
              withTooltip={false}
              resource={resourceLabel || (findResourceById(resource)?.trait as string)}
              size="xl"
              className="shrink-0"
            />
            <div className="flex flex-col">
              <span className="text-xxs uppercase tracking-wide text-gold/60">Available</span>
              <span className="text-2xl font-semibold leading-tight text-gold">
                {currencyFormat(availableBalance, 2)}
              </span>
              <span className="text-xs uppercase text-gold/60">{resourceLabel}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-brown/40 px-2 py-1 text-xxs font-semibold uppercase tracking-widest">
              <button
                type="button"
                onClick={() => setType("send")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  type === "send" ? "bg-gold text-brown shadow" : "text-gold/70 hover:text-gold",
                )}
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => setType("receive")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  type === "receive" ? "bg-gold text-brown shadow" : "text-gold/70 hover:text-gold",
                )}
              >
                Receive
              </button>
            </div>
            {isMilitaryResource(resource) && (
              <span className="inline-flex items-center justify-center rounded-full border border-light-red/40 bg-light-red/10 px-2 py-1 text-xxs font-semibold uppercase tracking-widest text-light-red/80">
                Troop rules apply
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <InfoPanel
          icon={<Flame className="h-4 w-4 text-red/70" />}
          isOpen={showBurnSection}
          onToggle={() => setShowBurnSection(!showBurnSection)}
          title="Burn Resources"
          hint="irreversible"
        >
          <div className="space-y-3 text-sm text-gold/80">
            <p>Permanently destroy {resourceLabel} from this location. This action cannot be undone.</p>
            <input
              id="burnAmountInput"
              type="range"
              min="0"
              max={burnSliderMax}
              step="0.01"
              value={burnAmount}
              onChange={handleBurnAmountChange}
              className="w-full accent-gold"
            />
            <div className="flex items-center justify-between text-xs uppercase text-gold/60">
              <span>Burn amount</span>
              <span className="font-semibold text-gold">
                {burnAmount.toLocaleString()} {resourceLabel}
              </span>
            </div>
            <Button size="xs" variant="danger" onClick={handleBurn} disabled={burnAmount === 0 || isLoading}>
              Burn {resourceLabel}
            </Button>
          </div>
        </InfoPanel>
        {isMilitaryResource(resource) && (
          <InfoPanel
            icon={<ShieldCheck className="h-4 w-4 text-gold/70" />}
            isOpen={showTransferRules}
            onToggle={() => setShowTransferRules(!showTransferRules)}
            title="Transfer Rules"
            hint="troops only"
          >
            <div className="space-y-2 text-xs text-gold/80">
              <div className="flex items-start gap-2">
                <span className="text-green">✓</span>
                <span>Realm → Realm transfers allowed</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red">✗</span>
                <span>Camps, Essence Rifts, and Hyperstructures cannot transfer troops</span>
              </div>
            </div>
          </InfoPanel>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-3">
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-gold/20 bg-black/30">
          <div className="flex h-full flex-col">
            <div className="space-y-2 border-b border-gold/20 bg-black/40 px-3 py-3 md:px-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sortByDistance"
                  checked={sortByDistance}
                  onChange={(e) => setSortByDistance(e.target.checked)}
                  className="accent-gold"
                />
                <label htmlFor="sortByDistance" className="text-xs text-gold cursor-pointer">
                  Order structures by distance
                </label>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
                <input
                  type="text"
                  placeholder="Search structures..."
                  value={searchTerm}
                  onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded border border-gold/30 bg-brown/20 py-1 pl-8 pr-8 text-sm text-gold placeholder-gold/60 focus:outline-none focus:border-gold/60"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gold/60 transition hover:text-gold"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-xxs uppercase text-gold/50">
                {sortByDistance ? "Structures are sorted by proximity" : "Structures are sorted alphabetically"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 md:px-4">
              {noValidMilitaryDestinations ? (
                <div className="py-8 text-center text-sm text-gold/60">
                  <div className="mb-2 text-lg">No valid destinations</div>
                  <p>
                    {mode.structure.getName(selectedStructure).name} cannot transfer troops. Only Realms can transfer
                    military units.
                  </p>
                </div>
              ) : structuresForTransfer.length === 0 ? (
                <div className="py-8 text-center text-sm text-gold/60">No structures match the current filters.</div>
              ) : (
                structuresForTransfer.map((structure) => (
                  <RealmTransferBalance
                    key={structure.structure.entity_id}
                    structure={structure}
                    selectedStructureEntityId={selectedStructureEntityId}
                    resource={resource}
                    tick={tick}
                    add={setCalls}
                    type={type}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {hasQueue && (
          <div className="rounded-lg border border-gold/20 bg-black/30 p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold">
              Transfers Queue ({calls.length})
              <span className="inline-flex items-center gap-2 rounded-full bg-brown/40 px-2 py-1 text-xs font-normal normal-case text-gold/80">
                <ResourceIcon
                  resource={donkeyTrait || (findResourceById(ResourcesIds.Donkey)?.trait as string)}
                  size="sm"
                  withTooltip={false}
                />
                {totalNeededDonkeys.toString()} 🐴
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {calls.map((call, index) => (
                <div
                  className="flex flex-row items-center justify-between gap-2 rounded-md border-2 border-gold/20 bg-gold/10 p-2"
                  key={index}
                >
                  <div className="text-sm font-bold uppercase">{call.realmName}</div>
                  <div className="text-sm">{call.resources[1].toLocaleString()}</div>
                  <Button size="xs" onClick={() => setCalls((prev) => prev.filter((c) => c !== call))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-gold/70 md:text-sm">
              <span>Resource:</span>
              <span>{resourceLabel}</span>
              <span>Total to {type === "send" ? "Send" : "Receive"}:</span>
              <span>{currencyFormat(totalResourceTransferred, 2)}</span>
              <span>Locations involved:</span>
              <span>{uniqueStructuresInvolved}</span>
              <span>Donkeys needed:</span>
              <span>{totalNeededDonkeys}</span>
            </div>
            <p className="mt-3 text-xxs uppercase text-gold/50">
              {type === "send"
                ? "Resources will leave this location when you confirm."
                : "Resources will arrive at this location when you confirm."}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-gold/20 pt-2">
        <Button
          disabled={calls.length === 0}
          isLoading={isLoading}
          variant="primary"
          size="md"
          onClick={handleTransfer}
        >
          {type === "send" ? "Send All" : "Receive All"}
        </Button>
      </div>
    </div>
  );
});

const InfoPanel = ({
  title,
  icon,
  hint,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  hint?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  return (
    <div className="rounded-lg border border-gold/30 bg-black/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gold transition hover:bg-black/40"
      >
        <span className="flex items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <span>{title}</span>
          {hint && <span className="text-xxs uppercase text-gold/60">{hint}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="border-t border-gold/20 px-3 py-3">{children}</div>}
    </div>
  );
};

const RealmTransferBalance = memo(
  ({
    resource,
    structure,
    selectedStructureEntityId,
    add,
    tick,
    type,
  }: {
    resource: ResourcesIds;
    structure: PlayerStructure;
    selectedStructureEntityId: number;
    add: Dispatch<SetStateAction<transferCall[]>>;
    tick: number;
    type: "send" | "receive";
  }) => {
    const [input, setInput] = useState(0);
    const mode = useGameModeConfig();
    const {
      setup: { components },
    } = useDojo();

    const sourceResourceManager = useMemo(
      () =>
        new ResourceManager(components, type === "send" ? selectedStructureEntityId : structure.structure.entity_id),
      [components, structure.structure.entity_id, selectedStructureEntityId, type],
    );

    const getSourceBalance = useCallback(() => {
      return sourceResourceManager.balanceWithProduction(tick, resource).balance;
    }, [sourceResourceManager, tick, resource]);

    const getSourceDonkeyBalance = useCallback(() => {
      return sourceResourceManager.balanceWithProduction(tick, ResourcesIds.Donkey).balance;
    }, [sourceResourceManager, tick]);

    const currentResourceBalanceBigInt = getSourceBalance();

    const maxInputAmount = useMemo(() => {
      if (currentResourceBalanceBigInt === undefined || currentResourceBalanceBigInt === null) {
        return 0;
      }
      return Number(currentResourceBalanceBigInt.toString()) / RESOURCE_PRECISION;
    }, [currentResourceBalanceBigInt]);

    const [resourceWeightKg, setResourceWeightKg] = useState(0);

    useEffect(() => {
      const totalWeight = getTotalResourceWeightKg([{ resourceId: resource, amount: input }]);
      setResourceWeightKg(totalWeight);
    }, [input, resource]);

    const neededDonkeysForThisTransfer = useMemo(() => {
      return calculateDonkeysNeeded(resourceWeightKg);
    }, [resourceWeightKg]);

    const relevantDonkeyBalance = useMemo(() => {
      return getSourceDonkeyBalance();
    }, [getSourceDonkeyBalance]);

    const canCarry = useMemo(() => {
      return relevantDonkeyBalance >= neededDonkeysForThisTransfer;
    }, [relevantDonkeyBalance, neededDonkeysForThisTransfer]);

    const handleSetMax = () => {
      let maxAmount = maxInputAmount;
      const currentDonkeys = relevantDonkeyBalance;
      if (currentDonkeys > 0) {
        // Estimate max carriable amount. This is a simplification.
        // A more accurate way would be to iterate or use a formula for max resources per donkey.
        // For now, if donkeys are available, allow full balance. User will be warned by color.
      } else if (currentDonkeys === 0 && type === "send") {
        maxAmount = 0; // Cannot send if no donkeys at source
      }

      setInput(maxAmount);
      add((prev) => {
        const existingIndex = prev.findIndex((call) => call.structureId === structure.structure.entity_id);
        if (maxAmount === 0) {
          return prev.filter((_, i) => i !== existingIndex);
        }
        const newCall = {
          structureId: structure.structure.entity_id,
          sender_entity_id: type === "send" ? selectedStructureEntityId : structure.structure.entity_id,
          recipient_entity_id: type === "send" ? structure.structure.entity_id : selectedStructureEntityId,
          resources: [resource, maxAmount],
          realmName: mode.structure.getName(structure.structure).name,
        };
        return existingIndex === -1
          ? [...prev, newCall]
          : [...prev.slice(0, existingIndex), newCall, ...prev.slice(existingIndex + 1)];
      });
    };

    if (structure.structure.entity_id === selectedStructureEntityId) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2 border-b-2 mt-2 pb-2 border-gold/20">
        <div className="flex flex-row gap-4 items-start">
          <div className="self-center w-full">
            <div className="uppercase font-bold h4 truncate">{mode.structure.getName(structure.structure).name}</div>
          </div>
        </div>
        <div className="w-full">
          <div className="py-1 flex flex-row justify-between items-center">
            <div className="text-sm min-w-0 mr-2">
              {type === "send" ? "Avail. here:" : "Avail. there:"}{" "}
              {currencyFormat(getSourceBalance() ? Number(getSourceBalance()) : 0, 0)}
            </div>
            <div
              className={`whitespace-nowrap text-right text-xs flex-shrink-0 ${
                !canCarry || relevantDonkeyBalance === 0 ? "text-red" : "text-green"
              }`}
            >
              {type === "send" ? "Your Donkeys:" : `${mode.structure.getName(structure.structure).name}'s Donkeys:`}{" "}
              {currencyFormat(relevantDonkeyBalance, 0).toLocaleString()} / <br /> Needs:{" "}
              {neededDonkeysForThisTransfer.toLocaleString()} 🐴
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <NumberInput
              max={maxInputAmount}
              min={0}
              step={0.01}
              value={input}
              allowDecimals
              disabled={!canCarry || (relevantDonkeyBalance === 0 && type === "send")}
              onChange={(amount) => {
                let clampedValue = Math.max(0, amount);
                if (clampedValue > maxInputAmount) {
                  clampedValue = maxInputAmount;
                }

                setInput(clampedValue);
                add((prev) => {
                  const existingIndex = prev.findIndex((call) => call.structureId === structure.structure.entity_id);

                  if (clampedValue === 0 && existingIndex !== -1) {
                    return prev.filter((_, i) => i !== existingIndex);
                  }
                  if (clampedValue > 0) {
                    const newCall = {
                      structureId: structure.structure.entity_id,
                      sender_entity_id: type === "send" ? selectedStructureEntityId : structure.structure.entity_id,
                      recipient_entity_id: type === "send" ? structure.structure.entity_id : selectedStructureEntityId,
                      resources: [resource, clampedValue],
                      realmName: mode.structure.getName(structure.structure).name,
                    };

                    return existingIndex === -1
                      ? [...prev, newCall]
                      : [...prev.slice(0, existingIndex), newCall, ...prev.slice(existingIndex + 1)];
                  }
                  return prev;
                });
              }}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={handleSetMax}
              disabled={relevantDonkeyBalance === 0 && type === "send"}
            >
              Max
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
