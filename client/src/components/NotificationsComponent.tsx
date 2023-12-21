import { useMemo, useState } from "react";
import { Notification } from "../elements/Notification";
import clsx from "clsx";
import Button from "../elements/Button";
import { useNotifications } from "../hooks/notifications/useNotifications";
import { useDojo } from "../DojoContext";
import {
  EmptyChestData,
  EventType,
  NotificationType,
  generateUniqueId,
  useNotificationsStore,
} from "../hooks/store/useNotificationsStore";

// dev:max number of notifications before reach step limit
const MAX_HARVEST_NOTIFICATIONS = 11;
const MAX_CLAIM_NOTIFICATIONS = 7;

type sender = {
  sender_id: bigint;
  receiver_id: bigint;
  indices: number[];
};

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({ className }: NotificationsComponentProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { harvest_all_labor, transfer_items_from_multiple },
    },
  } = useDojo();

  const [showNotifications, setShowNotifications] = useState(true);
  const [isHarvestLoading, setIsHarvestLoading] = useState(false);
  const [isClaimLoading, setIsClaimLoading] = useState(false);

  const { closedNotifications, handleCloseNotification } = useNotifications();

  const { notifications, deleteNotification, deleteAllNotifications } = useNotificationsStore();

  const onHarvestAll = async () => {
    setIsHarvestLoading(true);
    const harvestKeys: string[][] = notifications
      .map((notification: NotificationType) => {
        if (notification.eventType === EventType.Harvest) {
          return notification.keys as string[];
        }
      })
      .filter(Boolean)
      .slice(0, MAX_HARVEST_NOTIFICATIONS) as string[][];
    await harvest_all_labor({
      signer: account,
      entity_ids: harvestKeys,
    });
    for (let notification of notifications
      .filter((notification) => notification.eventType === EventType.Harvest)
      .slice(0, MAX_HARVEST_NOTIFICATIONS)) {
      deleteNotification(notification.keys, notification.eventType);
    }
    setIsHarvestLoading(false);
  };

  const onClaimAll = async () => {
    setIsClaimLoading(true);
    const senders: sender[] = notifications
      .map((notification: NotificationType) => {
        if (notification.eventType === EventType.EmptyChest) {
          let data = notification.data as EmptyChestData;
          if (notification?.keys) {
            return {
              sender_id: BigInt(notification.keys[0]),
              receiver_id: data.realmEntityId,
              indices: data.indices,
            };
          }
        }
      })
      .filter(Boolean)
      .slice(0, MAX_CLAIM_NOTIFICATIONS) as sender[];

    await transfer_items_from_multiple({
      signer: account,
      senders,
    });

    for (let notification of notifications
      .filter((notification) => notification.eventType === EventType.EmptyChest)
      .slice(0, MAX_CLAIM_NOTIFICATIONS)) {
      deleteNotification(notification.keys, notification.eventType);
    }
    setIsClaimLoading(false);
  };

  const hasHarvestNotification = useMemo(() => {
    return (
      notifications.filter((notification: NotificationType) => {
        return notification.eventType === EventType.Harvest;
      }).length > 0
    );
  }, [notifications]);

  const hasClaimNotifications = useMemo(() => {
    return (
      notifications.filter((notification: NotificationType) => {
        return notification.eventType === EventType.EmptyChest;
      }).length > 0
    );
  }, [notifications]);

  // Helper function to filter unique notifications based on their keys.
  const getUniqueNotifications = (notifications: NotificationType[]): NotificationType[] => {
    const uniqueKeys = new Set<string>();
    return notifications.filter((notification) => {
      const id = generateUniqueId(notification.keys, notification.eventType);
      if (!uniqueKeys.has(id)) {
        uniqueKeys.add(id);
        return true;
      }
      return false;
    });
  };

  return (
    <div className={clsx("flex flex-col space-y-2 fixed right-4 bottom-4 top-4 pointer-events-none", className)}>
      <div className="w-full flex flex-cols justify-between">
        {
          <Button
            variant="primary"
            className="pointer-events-auto mr-2"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            {showNotifications ? "Hide notifications" : "Show notifications"}
          </Button>
        }
        <div>
          {notifications.length > 0 && (
            <Button variant="danger" className="pointer-events-auto mr-2" onClick={deleteAllNotifications}>
              {"Close All"}
            </Button>
          )}
          {hasHarvestNotification && (
            <Button
              variant="success"
              className="pointer-events-auto mr-2"
              isLoading={isHarvestLoading}
              onClick={onHarvestAll}
            >
              {"Harvest All"}
            </Button>
          )}
          {hasClaimNotifications && (
            <Button
              variant="success"
              className="pointer-events-auto mr-2"
              isLoading={isClaimLoading}
              onClick={onClaimAll}
            >
              {"Claim All"}
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-auto">
        {showNotifications &&
          getUniqueNotifications(notifications).map((notification: NotificationType, i) => {
            let id = generateUniqueId(notification.keys, notification.eventType);
            return (
              <Notification
                closedNotifications={closedNotifications}
                notification={notification}
                key={id}
                id={id}
                onClose={() => {
                  handleCloseNotification(id);
                  // deleteNotification(notification.keys, notification.eventType);
                }}
              ></Notification>
            );
          })}
      </div>
    </div>
  );
};
