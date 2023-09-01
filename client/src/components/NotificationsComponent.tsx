import { useState } from "react";
import { Notification } from "../elements/Notification";
import clsx from "clsx";
import Button from "../elements/Button";
import {
  NotificationType,
  useNotifications,
} from "../hooks/notifications/useNotifications";

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({
  className,
}: NotificationsComponentProps) => {
  const [showNotifications, setShowNotifications] = useState(true);

  const [closedNotifications, setClosedNotifications] = useState<
    Record<string, boolean>
  >({});

  const handleCloseNotification = (notificationId: string) => {
    setClosedNotifications((prev) => ({ ...prev, [notificationId]: true }));
  };

  const generateUniqueId = (notification: NotificationType): string => {
    return `${notification.eventType}_${notification.keys.join("_")}`;
  };

  const { notifications } = useNotifications();

  return (
    <div
      className={clsx("flex flex-col space-y-2 absolute right-0", className)}
    >
      <Button
        variant="primary"
        onClick={() => setShowNotifications((prev) => !prev)}
      >
        {showNotifications ? "Hide notifications" : "Show notifications"}
      </Button>
      {showNotifications &&
        notifications.map((notification: NotificationType) => {
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
