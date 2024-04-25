import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../ui/elements/OrderIcon";
import { useDojo } from "../context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { Badge } from "../../ui/elements/Badge";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { getRealmNameById, getRealmOrderNameById } from "../../ui/utils/realms";
import Button from "../../ui/elements/Button";
import { ResourceCost } from "../../ui/elements/ResourceCost";
import useBlockchainStore from "../store/useBlockchainStore";
import { soundSelector, useUiSounds } from "../useUISound";
import { useMemo, useState } from "react";
import { LevelIndex, useLevel } from "../helpers/useLevel";
import { NotificationType, useNotificationsStore } from "../store/useNotificationsStore";

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
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const realmEntityId = notification.keys ? BigInt(notification.keys[0]) : undefined;
  const resourceType = notification.keys ? parseInt(notification.keys[1]) : undefined;
  const { play: playHarvest } = useUiSounds(soundSelector.harvest);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);
  const realm = realmEntityId ? getComponentValue(Realm, getEntityIdFromKeys([realmEntityId])) : undefined;

  const realmName = realm ? getRealmNameById(realm.realm_id) : "";
  const realmOrderName = realm ? getRealmOrderNameById(realm?.realm_id) : "";

  const harvestAmount = notification.data && "harvestAmount" in notification.data ? notification.data.harvestAmount : 0;

  const { getEntityLevel, getRealmLevelBonus } = useLevel();

  // get harvest bonuses
  const [levelBonus, hyperstructureLevelBonus] = useMemo(() => {
    if (!realm || !realmEntityId || !resourceType) return [undefined, undefined];
    const isFood = [254, 255].includes(resourceType);
    const level = getEntityLevel(realmEntityId)?.level || 0;
    const levelBonus = getRealmLevelBonus(level, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
    return [levelBonus, 0];
  }, [realmEntityId]);

  const onHarvest = async () => {
    setIsLoading(true);
    if (!realmEntityId || !resourceType) return;
    if (levelBonus && resourceType) {
      deleteNotification(notification.keys, notification.eventType);
      playHarvest();
      setIsLoading(false);
    }
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
          {resourceType && (
            <ResourceCost resourceId={resourceType} amount={harvestAmount} color="text-order-brilliance" />
          )}
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
