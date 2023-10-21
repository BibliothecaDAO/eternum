import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { Badge } from "../../elements/Badge";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { getEntityIdFromKeys } from "../../utils/utils";
import { NotificationType } from "./useNotifications";
import { findResourceById } from "@bibliothecadao/eternum";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";

export const useHarvestNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const realmEntityId = notification.keys[0];

  const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));

  const realmName = realm ? getRealmNameById(realm.realm_id) : "";
  const realmOrderName = realm ? getRealmOrderNameById(realm?.realm_id) : "";

  const resource = findResourceById(parseInt(notification.keys[1]))?.trait || "";

  const harvestAmount = notification.data && "harvestAmount" in notification.data ? notification.data.harvestAmount : 0;

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
    content: (
      <div className="mt-2 items-center italic">
        <div className="flex items-center">
          <ResourceIcon containerClassName="mx-0.5" className="!w-[12px]" resource={resource} size="xs" />
          {`+${harvestAmount} `}
        </div>
      </div>
    ),
  };
};
