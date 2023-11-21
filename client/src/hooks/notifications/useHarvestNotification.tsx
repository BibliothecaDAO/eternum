import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { Badge } from "../../elements/Badge";
import { getEntityIdFromKeys } from "../../utils/utils";
import { NotificationType } from "./useNotifications";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import Button from "../../elements/Button";
import { ResourceCost } from "../../elements/ResourceCost";
import useBlockchainStore from "../store/useBlockchainStore";
import { soundSelector, useUiSounds } from "../useUISound";
import { useState } from "react";
import { useRealm } from "../helpers/useRealm";

export const useHarvestNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
      systemCalls: { harvest_labor },
      optimisticSystemCalls: { optimisticHarvestLabor },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const realmEntityId = notification.keys[0];
  const { play: playHarvest } = useUiSounds(soundSelector.harvest);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));

  const realmName = realm ? getRealmNameById(realm.realm_id) : "";
  const realmOrderName = realm ? getRealmOrderNameById(realm?.realm_id) : "";

  const harvestAmount = notification.data && "harvestAmount" in notification.data ? notification.data.harvestAmount : 0;

  const { getRealmLevel } = useRealm();
  const level = getRealmLevel(parseInt(realmEntityId))?.level || 0;

  const onHarvest = async () => {
    setIsLoading(true);
    await optimisticHarvestLabor(
      nextBlockTimestamp || 0,
      level,
      harvest_labor,
    )({
      signer: account,
      realm_id: realmEntityId,
      resource_type: parseInt(notification.keys[1]),
    });
    playHarvest();
    setIsLoading(false);
  };

  return {
    type: "success",
    time: "13:37",
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="success" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Ready for Harvest`}
        </Badge>

        <div className="flex items-center">
          in <OrderIcon size="xs" className="mx-2" order={realmOrderName} />{" "}
          <div className="inline-block text-gold">{realmName}</div>
        </div>
      </div>
    ),
    content: (onClose: () => void) => (
      <div className="flex flex-col">
        <div className="mt-2 flex items-center">
          <ResourceCost
            resourceId={parseInt(notification.keys[1])}
            amount={harvestAmount}
            color="text-order-brilliance"
          />
        </div>
        <Button
          isLoading={isLoading}
          onClick={async () => {
            await onHarvest();
            onClose();
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Harvest
        </Button>
      </div>
    ),
  };
};
