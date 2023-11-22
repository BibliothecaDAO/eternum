import { useState } from "react";
import { Notification } from "../elements/Notification";
import clsx from "clsx";
import Button from "../elements/Button";
import { NotificationType, generateUniqueId, useNotifications } from "../hooks/notifications/useNotifications";

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({ className }: NotificationsComponentProps) => {
  const [showNotifications, setShowNotifications] = useState(true);

  const [closedNotifications, setClosedNotifications] = useState<Record<string, boolean>>({});

  const handleCloseNotification = (notificationId: string) => {
    setClosedNotifications((prev) => ({ ...prev, [notificationId]: true }));
  };

  // Helper function to filter unique notifications based on their keys.
  const getUniqueNotifications = (notifications: NotificationType[]): NotificationType[] => {
    const uniqueKeys = new Set<string>();
    return notifications.filter((notification) => {
      const id = generateUniqueId(notification);
      if (!uniqueKeys.has(id)) {
        uniqueKeys.add(id);
        return true;
      }
      return false;
    });
  };

  const { notifications } = useNotifications();

  return (
    // TODO: handle overflow of the notifications
    <div
      className={clsx(
        "flex flex-col space-y-2 fixed right-4 bottom-4 top-4 overflow-auto pointer-events-none",
        className,
      )}
    >
      <Button variant="primary" className="pointer-events-auto" onClick={() => setShowNotifications((prev) => !prev)}>
        {showNotifications ? "Hide notifications" : "Show notifications"}
      </Button>
      {showNotifications &&
        getUniqueNotifications(notifications).map((notification: NotificationType) => {
          const id = generateUniqueId(notification);
          return (
            <Notification
              closedNotifications={closedNotifications}
              notification={notification}
              key={id}
              id={id}
              onClose={() => handleCloseNotification(id)}
            ></Notification>
          );
        })}
    </div>
  );
};
