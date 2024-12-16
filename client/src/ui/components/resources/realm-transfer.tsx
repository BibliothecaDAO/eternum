import { useEntities } from "@/hooks/helpers/useEntities";
import { useResourceManager } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import { Switch } from "@headlessui/react";
import { Dispatch, SetStateAction, memo, useCallback, useState } from "react";
import { num } from "starknet";
import { OSWindow } from "../navigation/OSWindow";

type transferCall = {
  sender_entity_id: num.BigNumberish;
  recipient_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
};

export const RealmTransfer = memo(
  ({ resource, balance, tick }: { resource: ResourcesIds; balance: number; tick: number }) => {
    const togglePopup = useUIStore((state) => state.togglePopup);
    const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));

    const { playerRealms } = useEntities();

    const [calls, setCalls] = useState<transferCall[]>([]);

    const [type, setType] = useState<"send" | "receive">("send");

    const handleTransfer = useCallback(() => {
      // TODO:

      setCalls([]);
    }, [calls]);

    return (
      <OSWindow
        title={findResourceById(resource)?.trait ?? ""}
        onClick={() => togglePopup(resource.toString())}
        show={isOpen}
      >
        <div>
          <Switch
            checked={type === "send"}
            onChange={() => setType((prev) => (prev === "send" ? "receive" : "send"))}
          />
        </div>
        <div className="p-4">
          <div>
            <ResourceIcon
              isLabor={false}
              withTooltip={false}
              resource={findResourceById(resource)?.trait as string}
              size="lg"
              className="mr-3 self-center"
            />
            <div className="py-3">{currencyFormat(balance ? Number(balance) : 0, 0)}</div>
          </div>

          {playerRealms().map((realm) => (
            <RealmTransferBalance
              key={realm.entity_id}
              realm={realm}
              resource={resource}
              balance={balance}
              tick={tick}
              add={setCalls}
            />
          ))}

          <div className="flex flex-col gap-2">
            {calls.map((call, index) => (
              <div
                className="flex flex-row w-full justify-between p-2 gap-2 border-gold/20 bg-gold/10 border-2 rounded-md"
                key={index}
              >
                <div>{call.resources[1].toString()}</div>
                <Button onClick={() => setCalls((prev) => prev.filter((c) => c !== call))}>Remove</Button>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gold/20">
            <Button
              onClick={() => {
                // TODO:
              }}
            >
              {type === "send" ? "Receive All" : "Send All"}
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
    balance,
    realm,
    add,
    tick,
  }: {
    resource: ResourcesIds;
    balance: number;
    realm: any;
    add: Dispatch<SetStateAction<transferCall[]>>;
    tick: number;
  }) => {
    const [input, setInput] = useState(0);

    const resourceManager = useResourceManager(realm.entity_id, resource);

    const getBalance = useCallback(() => {
      return resourceManager.balance(tick);
    }, [resourceManager, tick]);

    const getProduction = useCallback(() => {
      return resourceManager.getProduction();
    }, [resourceManager]);

    return (
      <div className="flex flex-row gap-4">
        <div className="self-center">
          <div className="uppercase font-bold text-sm">{realm.name}</div>
          <div className="self-center">{currencyFormat(getBalance() ? Number(getBalance()) : 0, 0)}</div>
        </div>

        <NumberInput
          max={balance}
          min={0}
          step={100}
          value={input}
          onChange={(amount) => {
            setInput(amount);
            add((prev) => {
              // Remove any existing calls for this realm
              const filtered = prev.filter((call) => call.sender_entity_id !== realm.entity_id);

              // Only add new call if amount > 0
              if (amount > 0) {
                return [
                  ...filtered,
                  {
                    sender_entity_id: realm.entity_id,
                    recipient_entity_id: realm.entity_id,
                    resources: [resource, amount],
                  },
                ];
              }
              return filtered;
            });
          }}
        />
      </div>
    );
  },
);
