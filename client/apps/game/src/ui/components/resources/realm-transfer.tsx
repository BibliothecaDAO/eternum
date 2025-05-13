import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  calculateDonkeysNeeded,
  getEntityIdFromKeys,
  getTotalResourceWeightKg,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures, useResourceManager } from "@bibliothecadao/react";
import {
  findResourceById,
  ID,
  PlayerStructure,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { Dispatch, memo, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { num } from "starknet";

type transferCall = {
  structureId: ID;
  sender_entity_id: num.BigNumberish;
  recipient_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
  realmName: string;
};

export const RealmTransfer = memo(({ resource }: { resource: ResourcesIds }) => {
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

  console.log(balance);

  const playerStructures = usePlayerStructures();

  const playerStructuresFiltered = useMemo(() => {
    // For military resources, we need special handling
    if (isMilitaryResource(resource)) {
      const selectedStructure = getComponentValue(
        components.Structure,
        getEntityIdFromKeys([BigInt(selectedStructureEntityId)]),
      );

      // If the selected structure is a village, only show the connected realm
      if (selectedStructure?.category === StructureType.Village) {
        const realmEntityId = selectedStructure.metadata.village_realm;
        return playerStructures.filter((structure) => structure.structure.entity_id === realmEntityId);
      } else {
        return playerStructures.filter(
          (structure) =>
            structure.category !== StructureType.Village ||
            structure.structure.metadata.village_realm === selectedStructureEntityId,
        );
      }
    }

    // Default case: return all player structures
    return playerStructures;
  }, [components.Structure, playerStructures, selectedStructureEntityId, resource]);

  const [isLoading, setIsLoading] = useState(false);
  const [burnAmount, setBurnAmount] = useState(0);
  const [calls, setCalls] = useState<transferCall[]>([]);
  const [type, setType] = useState<"send" | "receive">("send");
  const [totalTransferResourceWeightKg, setTotalTransferResourceWeightKg] = useState(0);

  const totalNeededDonkeys = useMemo(
    () => calculateDonkeysNeeded(totalTransferResourceWeightKg),
    [totalTransferResourceWeightKg],
  );

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
  }, [calls]);

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
    <>
      <div className="p-1">
        <Button
          size="xs"
          variant={type === "receive" ? "outline" : "secondary"}
          onClick={() => setType((prev) => (prev === "send" ? "receive" : "send"))}
        >
          Switch Direction
        </Button>
      </div>

      <div className="p-4">
        <div className="flex flex-row gap-2">
          <ResourceIcon
            withTooltip={false}
            resource={findResourceById(resource)?.trait as string}
            size="xxl"
            className="mr-3 self-center"
          />
          <div className="py-3 text-center text-3xl">{currencyFormat(balance ? Number(balance) : 0, 2)}</div>
        </div>

        {/* Dedicated Burn Section */}
        <div className="p-3 my-4 border border-red-500/30 rounded-md bg-red-500/10">
          <div className="font-bold text-lg mb-2 text-red-300">Burn Resources</div>
          <div className="text-sm mb-2">
            Permanently destroy {findResourceById(resource)?.trait as string} from this location. This action is
            irreversible.
          </div>
          <div className="flex flex-col gap-2 py-2">
            <input
              id="burnAmountInput"
              type="range"
              min="0"
              max={balance ? Number(balance) / RESOURCE_PRECISION : 0}
              step="0.01"
              value={burnAmount}
              onChange={handleBurnAmountChange}
              className="w-full accent-red-500"
            />
            <div className="text-xs text-center">
              Selected to burn: {burnAmount.toLocaleString()} {findResourceById(resource)?.trait}
            </div>
            <Button size="xs" variant="danger" onClick={handleBurn} disabled={burnAmount === 0 || isLoading}>
              Burn {findResourceById(resource)?.trait as string}{" "}
            </Button>
          </div>
        </div>
        {/* End Dedicated Burn Section */}

        {playerStructuresFiltered.map((structure) => (
          <RealmTransferBalance
            key={structure.structure.entity_id}
            structure={structure}
            selectedStructureEntityId={selectedStructureEntityId}
            resource={resource}
            tick={tick}
            add={setCalls}
            type={type}
          />
        ))}

        <div className="py-4 border-t border-gold/20">
          <div className="uppercase font-bold text h6 flex gap-3 items-center">
            Transfers Queue ({calls.length}) |
            <ResourceIcon resource={findResourceById(ResourcesIds.Donkey)?.trait as string} size="sm" />{" "}
            {totalNeededDonkeys.toString()}
          </div>

          <div className="flex flex-col gap-2">
            {calls.map((call, index) => (
              <div
                className="flex flex-row w-full justify-between p-2 gap-2 border-gold/20 bg-gold/10 border-2 rounded-md"
                key={index}
              >
                <div className="uppercase font-bold text-sm self-center">{call.realmName}</div>
                <div className="self-center" self-center>
                  {call.resources[1].toLocaleString()}
                </div>
                <Button size="xs" onClick={() => setCalls((prev) => prev.filter((c) => c !== call))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Pre-Transfer Summary */}
        {calls.length > 0 && (
          <div className="py-3 my-3 border-t border-b border-gold/20 bg-black/20 p-3 rounded-md">
            <div className="font-bold text-lg mb-2">Transfer Summary</div>
            <div className="text-sm grid grid-cols-2 gap-1">
              <div>Resource:</div>
              <div>{findResourceById(resource)?.trait}</div>
              <div>Total to {type === "send" ? "Send" : "Receive"}:</div>
              <div>{currencyFormat(totalResourceTransferred, 2)}</div>
              <div>Locations Involved:</div>
              <div>{uniqueStructuresInvolved}</div>
              <div>Total Donkeys Needed:</div>
              <div>{totalNeededDonkeys}</div>
            </div>
            <div className="mt-2 text-xs">
              You will be{" "}
              {type === "send"
                ? "sending these resources to their locations."
                : "receiving all these resources into this location."}{" "}
            </div>
          </div>
        )}
        {/* End Enhanced Pre-Transfer Summary */}

        <div className="pt-2 border-t border-gold/20 flex flex-row justify-end">
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
    </>
  );
});

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
    const {
      setup: { components },
    } = useDojo();

    const sourceResourceManager = useMemo(
      () =>
        new ResourceManager(components, type === "send" ? selectedStructureEntityId : structure.structure.entity_id),
      [components, structure.structure.entity_id, selectedStructureEntityId, type],
    );

    const destinationResourceManager = useMemo(
      () =>
        new ResourceManager(components, type === "receive" ? selectedStructureEntityId : structure.structure.entity_id),
      [components, structure.structure.entity_id, selectedStructureEntityId, type],
    );

    const getSourceBalance = useCallback(() => {
      return sourceResourceManager.balanceWithProduction(tick, resource).balance;
    }, [sourceResourceManager, tick, resource]);

    const getSourceDonkeyBalance = useCallback(() => {
      return sourceResourceManager.balanceWithProduction(tick, ResourcesIds.Donkey).balance;
    }, [sourceResourceManager, tick]);

    const getDestinationDonkeyBalance = useCallback(() => {
      return destinationResourceManager.balanceWithProduction(tick, ResourcesIds.Donkey).balance;
    }, [destinationResourceManager, tick]);

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
      return type === "send" ? getSourceDonkeyBalance() : getDestinationDonkeyBalance();
    }, [type, getSourceDonkeyBalance, getDestinationDonkeyBalance]);

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
          realmName: structure.name,
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
            <div className="uppercase font-bold h4 truncate">{structure.name}</div>
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
              {type === "send" ? "Your Donkeys:" : `${structure.name}'s Donkeys:`}{" "}
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
                      realmName: structure.name,
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
