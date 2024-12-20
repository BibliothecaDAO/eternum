import { useDojo } from "@/hooks/context/DojoContext";
import { PlayerStructure, useEntities } from "@/hooks/helpers/useEntities";
import { useResourceManager } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { calculateDonkeysNeeded, currencyFormat, getTotalResourceWeight, multiplyByPrecision } from "@/ui/utils/utils";
import { ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import { Dispatch, SetStateAction, memo, useCallback, useEffect, useMemo, useState } from "react";

import { ID } from "@bibliothecadao/eternum";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { num } from "starknet";
import { OSWindow } from "../navigation/OSWindow";

type transferCall = {
  structureId: ID;
  sender_entity_id: num.BigNumberish;
  recipient_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
  realmName: string;
};

export const RealmTransfer = memo(
  ({ resource, balance, tick }: { resource: ResourcesIds; balance: number; tick: number }) => {
    const {
      setup: {
        systemCalls: { send_resources_multiple },
      },
      account: { account },
    } = useDojo();
    const togglePopup = useUIStore((state) => state.togglePopup);

    const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));
    const selectedStructureEntityId = useUIStore((state) => state.structureEntityId);

    const { playerStructures } = useEntities();

    const [isLoading, setIsLoading] = useState(false);
    const [calls, setCalls] = useState<transferCall[]>([]);

    const [type, setType] = useState<"send" | "receive">("send");

    const [resourceWeight, setResourceWeight] = useState(0);

    const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeight), [resourceWeight]);

    useEffect(() => {
      const resources = calls.map((call) => {
        return {
          resourceId: Number(call.resources[0]),
          amount: Number(call.resources[1]),
        };
      });
      const totalWeight = getTotalResourceWeight(resources);
      const multipliedWeight = multiplyByPrecision(totalWeight);

      setResourceWeight(multipliedWeight);
    }, [calls]);

    const handleTransfer = useCallback(() => {
      setIsLoading(true);
      const cleanedCalls = calls.map(({ sender_entity_id, recipient_entity_id, resources }) => ({
        sender_entity_id,
        recipient_entity_id,
        resources: [resources[0], BigInt(resources[1]) * BigInt(1000)],
      }));

      send_resources_multiple({
        signer: account,
        calls: cleanedCalls,
      }).finally(() => {
        setIsLoading(false);
      });

      setCalls([]);
    }, [calls]);

    return (
      <OSWindow
        title={findResourceById(resource)?.trait ?? ""}
        onClick={() => togglePopup(resource.toString())}
        show={isOpen}
      >
        <div className="p-1">
          <Button
            variant={type === "send" ? "outline" : "secondary"}
            onClick={() => setType((prev) => (prev === "send" ? "receive" : "send"))}
          >
            {type === "receive" && <ArrowLeftIcon className="w-4 h-4" />}
            {type === "send" ? "Send Resources" : "Receive Resources"}
            {type === "send" && <ArrowRightIcon className="w-4 h-4" />}
          </Button>
        </div>
        <div className="p-4">
          <div>
            <ResourceIcon
              isLabor={false}
              withTooltip={false}
              resource={findResourceById(resource)?.trait as string}
              size="xxl"
              className="mr-3 self-center"
            />
            <div className="py-3 text-center text-xl">{currencyFormat(balance ? Number(balance) : 0, 0)}</div>
          </div>

          {playerStructures().map((structure) => (
            <RealmTransferBalance
              key={structure.entity_id}
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
      </OSWindow>
    );
  },
);

export const RealmTransferBalance = memo(
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

    const resourceManager = useResourceManager(structure.entity_id, resource);
    const donkeyManager = useResourceManager(structure.entity_id, ResourcesIds.Donkey);

    const getBalance = useCallback(() => {
      return resourceManager.balance(tick);
    }, [resourceManager, tick]);

    const getDonkeyBalance = useCallback(() => {
      return donkeyManager.balance(tick);
    }, [donkeyManager, tick]);

    const [resourceWeight, setResourceWeight] = useState(0);

    useEffect(() => {
      const totalWeight = getTotalResourceWeight([{ resourceId: resource, amount: input }]);
      const multipliedWeight = multiplyByPrecision(totalWeight);

      setResourceWeight(multipliedWeight);
    }, [input]);

    const neededDonkeys = useMemo(() => {
      if (type === "receive") {
        return calculateDonkeysNeeded(resourceWeight);
      }
      return 0;
    }, [resourceWeight]);

    const canCarry = useMemo(() => {
      return getDonkeyBalance() >= neededDonkeys;
    }, [getDonkeyBalance, neededDonkeys]);

    if (structure.entity_id === selectedStructureEntityId) {
      return;
    }

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
            disabled={!canCarry || (type === "receive" && getDonkeyBalance() === 0)}
            onChange={(amount) => {
              setInput(amount);
              add((prev) => {
                const existingIndex = prev.findIndex((call) => call.structureId === structure.entity_id);

                if (amount === 0) {
                  return prev.filter((_, i) => i !== existingIndex);
                }

                const newCall = {
                  structureId: structure.entity_id,
                  sender_entity_id: type === "send" ? selectedStructureEntityId : structure.entity_id,
                  recipient_entity_id: type === "send" ? structure.entity_id : selectedStructureEntityId,
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
              {neededDonkeys.toLocaleString()} 🔥🫏 [{getDonkeyBalance().toLocaleString()}]
            </div>
          </div>
        </div>
      </div>
    );
  },
);
