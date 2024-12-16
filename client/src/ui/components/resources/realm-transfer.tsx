import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useState } from "react";
import { Call } from "starknet";
import { OSWindow } from "../navigation/OSWindow";

export const RealmTransfer = ({
  resource,
  balance,
  icon,
}: {
  resource: ResourcesIds;
  balance: number;
  icon: React.ReactNode;
}) => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));

  const { playerRealms } = useEntities();

  const {
    setup: {
      network: {
        contractComponents: { Resource },
      },
    },
  } = useDojo();

  return (
    <OSWindow
      title={findResourceById(resource)?.trait ?? ""}
      onClick={() => togglePopup(resource.toString())}
      show={isOpen}
    >
      <div>
        {icon}
        {resource}
        <div>{balance}</div>
      </div>

      {playerRealms().map((realm) => (
        <RealmTransferBalance
          key={realm.entity_id}
          resourceComponent={Resource as ClientComponents["Resource"]}
          realm={realm}
          resource={resource}
          balance={balance}
          icon={icon}
          add={() => {}}
        />
      ))}
    </OSWindow>
  );
};

export const RealmTransferBalance = ({
  resource,
  balance,
  resourceComponent,
  realm,
  icon,
  add,
}: {
  resource: ResourcesIds;
  balance: number;
  realm: any;
  resourceComponent: ClientComponents["Resource"];
  icon: React.ReactNode;
  add: (amount: Call) => void;
}) => {
  const [input, setInput] = useState(balance);

  const resourceBalance = useComponentValue(resourceComponent, getEntityIdFromKeys(realm.entity_id));

  return (
    <div className="flex flex-row gap-3">
      {resourceBalance?.balance.toString()}
      <NumberInput
        max={balance}
        min={0}
        step={100}
        value={input}
        onChange={(amount) => {
          setInput(amount);
        }}
      />
      <Button
        onClick={() => {
          // TODO:
          add({
            contractAddress: resource.toString(),
            entrypoint: "transfer",
            calldata: [input],
          });
        }}
      >
        Add
      </Button>
    </div>
  );
};
