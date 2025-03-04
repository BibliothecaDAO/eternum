import { useEffect } from "react";
import { toast } from "sonner";
import { IpcMethod, Notification } from "../../types";

export const NotificationsHandler = (): null => {
  useEffect(() => {
    const sub = window.electronAPI.onMessage(IpcMethod.Notification, (notification: Notification) => {
      console.log("Notification received: " + JSON.stringify(notification));
      toast(
        <div className="text-xs text-gold m-auto text-center">
          <span className="font-bold ">{notification.type} </span>
          <span className="">{notification.message}</span>
        </div>,
      );
    });

    return () => {
      sub.remove();
    };
  }, []);
  return null;
};
