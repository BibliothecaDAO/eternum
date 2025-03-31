import { useEffect } from "react";
import { toast } from "sonner";
import { Notification } from "../../types";

export const NotificationsHandler = (): null => {
  useEffect(() => {
    const removeListener = window.electronAPI.onNotification((notification: Notification) => {
      console.log("Notification received: " + JSON.stringify(notification));
      toast(
        <div className="text-xs text-gold m-auto text-center w-full p-4">
          <span className="font-bold ">{notification.type} </span>
          <span className="">{notification.message}</span>
        </div>,
      );
    });

    return () => {
      removeListener();
    };
  }, []);
  return null;
};
