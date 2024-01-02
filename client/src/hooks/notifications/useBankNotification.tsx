import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { divideByPrecision, getEntityIdFromKeys } from "../../utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import { ArrivedAtBankData, NotificationType } from "../store/useNotificationsStore";
import { useState } from "react";
import { ResourceCost } from "../../elements/ResourceCost";
import Button from "../../elements/Button";

export const useCaravanHasArrivedAtBankNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    account: { account },
    setup: {
      systemCalls: { swap_bank_and_travel_back },
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as ArrivedAtBankData;

  const [isLoading, setIsLoading] = useState(false);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const time = nextBlockTimestamp?.toString() || "";

  const { realm_id } = getComponentValue(Realm, getEntityIdFromKeys([BigInt(data.realmEntityId)])) || {};
  const realmOrderName = realm_id ? getRealmOrderNameById(realm_id) : "";
  const realmName = realm_id ? getRealmNameById(realm_id) : "";

  const transferAndReturn = async () => {
    setIsLoading(true);
    await swap_bank_and_travel_back({
      signer: account,
      sender_id: data.caravanId,
      bank_id: data.bank.bankId,
      inventoryIndex: 0,
      resource_types: data.resources.map(() => 253),
      indices: data.indices,
      // lords amount
      resource_amounts: data.lordsAmounts.map((amount) => Math.floor(amount * 1000)),
      destination_coord_x: data.homePosition.x,
      destination_coord_y: data.homePosition.y,
    });
  };

  return {
    type: "success",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Arrived At Bank`}
        </Badge>

        <div className="flex items-center">
          <div className="inline-block text-gold">{data.bank.name}</div>
        </div>
      </div>
    ),
    content: (onClose: () => void) => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={realmOrderName} />{" "}
          <span className="text-white"> {`Caravan from ${realmName} has arrived`}</span>
        </div>
        <div className="flex mt-2 w-full items-center justify-start flex-wrap space-x-2 space-y-1">
          {data.resources.map(({ resourceId, amount }) => (
            <ResourceCost
              // type="vertical"
              withTooltip
              key={resourceId}
              resourceId={resourceId}
              color="text-order-giants"
              amount={divideByPrecision(Number(-amount))}
            />
          ))}
          {data.lordsAmounts.map((amount) => (
            <ResourceCost
              // type="vertical"
              withTooltip
              key={253}
              resourceId={253}
              color="text-order-brilliance"
              amount={Number(amount)}
            />
          ))}
        </div>
        <Button
          isLoading={isLoading}
          onClick={async () => {
            await transferAndReturn();
            onClose();
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Swap
        </Button>
      </div>
    ),
  };
};
