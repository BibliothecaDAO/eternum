import { useEffect, useMemo, useState } from "react";
import { Notification } from "../../elements/Notification";
import clsx from "clsx";
import Button from "../../elements/Button";
import { useNotifications } from "../../../hooks/notifications/useNotifications";
import { useDojo } from "../../../hooks/context/DojoContext";
import {
  EmptyChestData,
  EventType,
  NotificationType,
  generateUniqueId,
  setLastLoginTimestamp,
  useNotificationsStore,
} from "../../../hooks/store/useNotificationsStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";

// dev:max number of notifications before reach step limit
const MAX_HARVEST_NOTIFICATIONS = 5;
const MAX_CLAIM_NOTIFICATIONS = 5;

type sender = {
  sender_id: bigint;
  receiver_id: bigint;
  indices: number[];
};

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({ className }: NotificationsComponentProps) => {
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp) || 0;

  const [showNotifications, setShowNotifications] = useState(false);
  const [isHarvestLoading, setIsHarvestLoading] = useState(false);
  const [isClaimLoading, setIsClaimLoading] = useState(false);

  const { closedNotifications } = useNotifications();

  const { notifications, deleteNotification, deleteAllNotifications } = useNotificationsStore();

  const onHarvestAll = async () => {
    setIsHarvestLoading(true);

    while (notifications.some((notification) => notification.eventType === EventType.Harvest)) {
      // Process a batch of notifications
      const batchNotifications = notifications
        .filter((notification) => notification.eventType === EventType.Harvest)
        .slice(0, MAX_HARVEST_NOTIFICATIONS);

      const harvestKeys: string[][] = batchNotifications
        .map((notification) => notification.keys as string[])
        .filter(Boolean);

      if (harvestKeys.length > 0) {
      }

      // Remove processed notifications
      for (let notification of batchNotifications) {
        deleteNotification(notification.keys, notification.eventType);
        // Remove notification from the notifications array
        const index = notifications.indexOf(notification);
        if (index > -1) {
          notifications.splice(index, 1);
        }
      }
    }

    setIsHarvestLoading(false);
  };

  const onClaimAll = async () => {
    setIsClaimLoading(true);

    while (notifications.some((notification) => notification.eventType === EventType.EmptyChest)) {
      // Create a batch of claim notifications to process
      const batchNotifications = notifications
        .filter((notification) => notification.eventType === EventType.EmptyChest)
        .slice(0, MAX_CLAIM_NOTIFICATIONS);

      const senders: sender[] = batchNotifications
        .map((notification) => {
          let data = notification.data as EmptyChestData;
          if (notification?.keys) {
            return {
              sender_id: BigInt(notification.keys[0]),
              receiver_id: data.realmEntityId,
              indices: data.indices,
            };
          }
        })
        .filter(Boolean) as sender[];

      if (senders.length > 0) {
        // await transfer_items_from_multiple({
        //   signer: account,
        //   senders,
        // });
      }

      // Delete the processed notifications and update the notifications array
      for (let notification of batchNotifications) {
        deleteNotification(notification.keys, notification.eventType);
        // Remove the notification from the notifications array
        const index = notifications.indexOf(notification);
        if (index > -1) {
          notifications.splice(index, 1);
        }
      }
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

  useEffect(() => {
    if (notifications.length === 0) {
      setShowNotifications(false);
    }
  }, [notifications]);

  return (
    <div
      className={clsx(
        `w-full flex flex-col items-end space-y-2 fixed right-4 bottom-4 top-4 pointer-events-none`,
        className,
      )}
    >
      <div
        className={`${
          showNotifications ? "w-[330px]" : "w-[130px]"
        } transition-all duration-300 flex flex-cols justify-between`}
      >
        <div className={`flex w-full`}>
          <Button
            variant="primary"
            isPulsing={notifications.length > 0 && !showNotifications}
            disabled={notifications.length === 0}
            className="pointer-events-auto w-32 h-8 mr-2"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            {showNotifications ? "Hide notifications" : `${notifications.length} Notifications`}
          </Button>
          {notifications.length > 0 && showNotifications && (
            <Button
              variant="danger"
              className="pointer-events-auto mr-2"
              onClick={() => {
                deleteAllNotifications();
                setLastLoginTimestamp(nextBlockTimestamp);
                setShowNotifications(false);
              }}
            >
              {"Clear"}
            </Button>
          )}
        </div>
        {showNotifications && (
          <div className="flex flex-cols">
            {hasHarvestNotification && (
              <Button
                variant="success"
                className="pointer-events-auto mr-2"
                isLoading={isHarvestLoading}
                onClick={onHarvestAll}
              >
                {"Harvest"}
              </Button>
            )}
            {hasClaimNotifications && (
              <Button
                variant="success"
                className="pointer-events-auto mr-2"
                isLoading={isClaimLoading}
                onClick={onClaimAll}
              >
                {"Claim"}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="overflow-auto">
        {showNotifications &&
          getUniqueNotifications(notifications).map((notification: NotificationType) => {
            let id = generateUniqueId(notification.keys, notification.eventType);
            return (
              <Notification
                closedNotifications={closedNotifications}
                notification={notification}
                key={id}
                id={id}
                onClose={() => {
                  // todo: find a better way to handle closing notifications
                  // handleCloseNotification(id);
                  // deleteNotification(notification.keys, notification.eventType);
                }}
              ></Notification>
            );
          })}
      </div>
    </div>
  );
};
