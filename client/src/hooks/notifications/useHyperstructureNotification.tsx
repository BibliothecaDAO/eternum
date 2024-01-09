import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { divideByPrecision, getEntityIdFromKeys } from "../../utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import {
  ArrivedAtHyperstructureData,
  EventType,
  NotificationType,
  useNotificationsStore,
} from "../store/useNotificationsStore";
import { ResourceCost } from "../../elements/ResourceCost";
import Button from "../../elements/Button";
import { useState } from "react";
import useUIStore from "../store/useUIStore";
import { useHyperstructure } from "../helpers/useHyperstructure";

export const useCaravanHasArrivedAtHyperstructureNotification = (
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
      systemCalls: { feed_hyperstructure_and_travel_back },
      components: { Realm },
    },
  } = useDojo();

  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const setHyperstructures = useUIStore((state) => state.setHyperstructures);
  const { getHyperstructure } = useHyperstructure();

  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  const data = notification.data as ArrivedAtHyperstructureData;

  const [isLoading, setIsLoading] = useState(false);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const time = nextBlockTimestamp?.toString() || "";

  const { realm_id, order } = getComponentValue(Realm, getEntityIdFromKeys([BigInt(data.realmEntityId)])) || {};
  const realmOrderName = realm_id ? getRealmOrderNameById(realm_id) : "";
  const realmName = realm_id ? getRealmNameById(realm_id) : "";

  const transferAndReturn = async () => {
    await feed_hyperstructure_and_travel_back({
      signer: account,
      entity_id: data.caravanId,
      hyperstructure_id: data.hyperstructureId,
      inventoryIndex: 0,
      resources: data.resources.flatMap((resource) => Object.values(resource)),
      destination_coord_x: data.homePosition.x,
      destination_coord_y: data.homePosition.y,
    });
    deleteNotification([data.caravanId.toString()], EventType.ArrivedAtHyperstructure);
  };

  const hyperstructure = order ? hyperstructures[order - 1] : undefined;

  const updateHyperStructure = () => {
    if (hyperstructure) {
      const newHyperstructure = getHyperstructure(hyperstructure.uiPosition);
      hyperstructures[hyperstructure.orderId - 1] = newHyperstructure;
      setHyperstructures([...hyperstructures]);
    }
  };

  const onTransfer = async () => {
    setIsLoading(true);
    await transferAndReturn();
    updateHyperStructure();
    setIsLoading(false);
  };

  return {
    type: "success",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Arrived At Hyperstructure`}
        </Badge>

        <div className="flex items-center">
          on
          <OrderIcon size="xs" className="mx-1" order={realmOrderName} />{" "}
          <div className="inline-block text-gold">{`Hyperstructure`}</div>
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
        </div>
        <Button
          isLoading={isLoading}
          onClick={async () => {
            await onTransfer();
            onClose();
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Feed Hyperstructure
        </Button>
      </div>
    ),
  };
};
