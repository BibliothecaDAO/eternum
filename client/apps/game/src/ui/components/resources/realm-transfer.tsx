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
  }, [resourceManager, tick]);

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
  const [resourceAmount, setResourceAmount] = useState(0);
  const [calls, setCalls] = useState<transferCall[]>([]);
  const [type, setType] = useState<"send" | "receive">("send");
  const [resourceWeightKg, setResourceWeightKg] = useState(0);

  const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeightKg), [resourceWeightKg]);

  useEffect(() => {
    const resources = calls.map((call) => {
      return {
        resourceId: Number(call.resources[0]),
        amount: Number(call.resources[1]),
      };
    });
    const totalWeightKg = getTotalResourceWeightKg(resources);

    setResourceWeightKg(totalWeightKg);
  }, [calls]);

  const handleBurn = useCallback(async () => {
    setIsLoading(true);

    try {
      await structure_burn({
        signer: account,
        structure_id: selectedStructureEntityId,
        resources: [{ resourceId: resource, amount: resourceAmount }],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const handleResourceAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setResourceAmount(Number(event.target.value));
  };

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

        <div className="flex flex-col gap-2 py-2">
          <Button size="xs" variant="secondary" onClick={handleBurn}>
            Burn {findResourceById(resource)?.trait as string}{" "}
            {currencyFormat(resourceAmount ? Number(resourceAmount) : 0, 2)}
          </Button>
          <input
            id="troopAmountInput"
            type="range"
            min="0"
            max={balance}
            value={resourceAmount}
            onChange={handleResourceAmountChange}
            className="w-full accent-gold"
          />
        </div>

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
          <div className="uppercase font-bold text h6 flex gap-3">
            Transfers {calls.length} |
            <ResourceIcon resource={findResourceById(ResourcesIds.Donkey)?.trait as string} size="sm" />{" "}
            {neededDonkeys.toString()}
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
        <div>
          You will be{" "}
          {type === "send"
            ? "sending these resources to their locations"
            : "receiving all these resources into this location."}{" "}
        </div>
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

    const resourceManager = useMemo(
      () =>
        new ResourceManager(components, type === "receive" ? structure.structure.entity_id : selectedStructureEntityId),
      [components, structure.structure.entity_id, selectedStructureEntityId, type],
    );

    const getBalance = useCallback(() => {
      return resourceManager.balanceWithProduction(tick, resource).balance;
    }, [resourceManager, tick, resource]);

    const getDonkeyBalance = useCallback(() => {
      return resourceManager.balanceWithProduction(tick, ResourcesIds.Donkey).balance;
    }, [resourceManager, tick]);

    const currentResourceBalanceBigInt = getBalance();

    const maxInputAmount = useMemo(() => {
      if (currentResourceBalanceBigInt === undefined || currentResourceBalanceBigInt === null) {
        return 0;
      }
      // Convert bigint balance to human-readable units for the input field's max value
      return Number(currentResourceBalanceBigInt.toString()) / RESOURCE_PRECISION;
    }, [currentResourceBalanceBigInt]);

    const [resourceWeightKg, setResourceWeightKg] = useState(0);

    useEffect(() => {
      const totalWeight = getTotalResourceWeightKg([{ resourceId: resource, amount: input }]);
      setResourceWeightKg(totalWeight);
    }, [input]);

    const neededDonkeys = useMemo(() => {
      return calculateDonkeysNeeded(resourceWeightKg);
    }, [resourceWeightKg]);

    const canCarry = useMemo(() => {
      return getDonkeyBalance() >= neededDonkeys;
    }, [getDonkeyBalance, neededDonkeys]);

    if (structure.structure.entity_id === selectedStructureEntityId) {
      return;
    }

    return (
      <div className="flex flex-col gap-2 border-b-2 mt-2 border-gold/20">
        <div className="flex flex-row gap-4">
          <div className="self-center w-full">
            <div className="uppercase font-bold h4">{structure.name}</div>

            <div className="self-end gap-2 py-1 flex flex-row justify-between">
              <div className="self-center ">{currencyFormat(getBalance() ? Number(getBalance()) : 0, 0)}</div>

              <div
                className={`whitespace-nowrap text-left ${
                  neededDonkeys > getDonkeyBalance() || getDonkeyBalance() === 0 ? "text-red" : "text-green"
                }`}
              >
                {neededDonkeys.toLocaleString()} 🔥🫏 [{currencyFormat(getDonkeyBalance(), 0).toLocaleString()}]
              </div>
            </div>
          </div>

          <NumberInput
            max={maxInputAmount}
            min={0}
            step={0.01}
            value={input}
            allowDecimals
            disabled={!canCarry || (type === "receive" && getDonkeyBalance() === 0)}
            onChange={(amount) => {
              // Clamp the amount to be within [0, maxInputAmount]
              let clampedValue = Math.max(0, amount); // Ensure non-negative
              if (clampedValue > maxInputAmount) {
                clampedValue = maxInputAmount; // Ensure not exceeding max
              }

              setInput(clampedValue);
              add((prev) => {
                const existingIndex = prev.findIndex((call) => call.structureId === structure.structure.entity_id);

                if (clampedValue === 0) {
                  return prev.filter((_, i) => i !== existingIndex);
                }

                const newCall = {
                  structureId: structure.structure.entity_id,
                  sender_entity_id: type === "send" ? selectedStructureEntityId : structure.structure.entity_id,
                  recipient_entity_id: type === "send" ? structure.structure.entity_id : selectedStructureEntityId,
                  resources: [resource, clampedValue], // Use the clamped human-readable value
                  realmName: structure.name,
                };

                return existingIndex === -1
                  ? [...prev, newCall]
                  : [...prev.slice(0, existingIndex), newCall, ...prev.slice(existingIndex + 1)];
              });
            }}
          />
        </div>
      </div>
    );
  },
);
