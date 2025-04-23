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
import {
  findResourceById,
  ID,
  PlayerStructure,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useDojo, usePlayerStructures, useResourceManager } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
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
      systemCalls: { send_resources_multiple },
    },
    account: { account },
  } = useDojo();

  const { currentDefaultTick: tick } = useBlockTimestamp();

  const selectedStructureEntityId = useUIStore((state) => state.structureEntityId);

  const resourceManager = useResourceManager(selectedStructureEntityId);

  const balance = useMemo(() => {
    return resourceManager.balanceWithProduction(tick, resource);
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

  return (
    <>
      <div className="p-1">
        <Button
          variant={type === "receive" ? "outline" : "secondary"}
          onClick={() => setType((prev) => (prev === "send" ? "receive" : "send"))}
        >
          {type === "send" && <ArrowLeftIcon className="w-4 h-4" />}
          {type === "receive" ? "Send Resources" : "Receive Resources"}
          {type === "receive" && <ArrowRightIcon className="w-4 h-4" />}
        </Button>
      </div>
      <div className="p-4">
        <div>
          <ResourceIcon
            withTooltip={false}
            resource={findResourceById(resource)?.trait as string}
            size="xxl"
            className="mr-3 self-center"
          />
          <div className="py-3 text-center text-xl">{currencyFormat(balance ? Number(balance) : 0, 2)}</div>
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

        <div className="pt-2 border-t border-gold/20">
          <div className="uppercase font-bold text-sm flex gap-3">
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
      return resourceManager.balanceWithProduction(tick, resource);
    }, [resourceManager, tick]);

    const getDonkeyBalance = useCallback(() => {
      return resourceManager.balanceWithProduction(tick, ResourcesIds.Donkey);
    }, [resourceManager, tick]);

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

    const balance = useMemo(() => getBalance(), [getBalance]);

    return (
      <div className="flex flex-col gap-2 border-b-2 mt-2 border-gold/20">
        <div className="flex flex-row gap-4">
          <div className="self-center w-1/2">
            <div className="uppercase font-bold text-sm">{structure.name}</div>
            <div className="self-center">{currencyFormat(getBalance() ? Number(getBalance()) : 0, 0)}</div>
          </div>

          <NumberInput
            max={getBalance()}
            min={0}
            step={100}
            value={input}
            allowDecimals
            disabled={!canCarry || (type === "receive" && getDonkeyBalance() === 0)}
            onChange={(amount) => {
              setInput(amount);
              add((prev) => {
                const existingIndex = prev.findIndex((call) => call.structureId === structure.structure.entity_id);

                if (amount === 0) {
                  return prev.filter((_, i) => i !== existingIndex);
                }

                const newCall = {
                  structureId: structure.structure.entity_id,
                  sender_entity_id: type === "send" ? selectedStructureEntityId : structure.structure.entity_id,
                  recipient_entity_id: type === "send" ? structure.structure.entity_id : selectedStructureEntityId,
                  resources: [resource, amount],
                  realmName: structure.name,
                };

                return existingIndex === -1
                  ? [...prev, newCall]
                  : [...prev.slice(0, existingIndex), newCall, ...prev.slice(existingIndex + 1)];
              });
            }}
          />
        </div>
        <div className="self-end gap-2">
          <div className="hover:bg-gold/5 transition-colors">
            <div
              className={`px-4 py-1 whitespace-nowrap text-left ${
                neededDonkeys > getDonkeyBalance() || getDonkeyBalance() === 0 ? "text-red" : "text-green"
              }`}
            >
              {neededDonkeys.toLocaleString()} 🔥🫏 [{currencyFormat(getDonkeyBalance(), 0).toLocaleString()}]
            </div>
          </div>
        </div>
      </div>
    );
  },
);
