import { useState } from "react";
import { useDojo } from "../DojoContext";

export const useNotifications = () => {
  const {
    setup: { entityUpdates },
  } = useDojo();

  const [notifications, setNotifications] = useState<any[]>([]);

  entityUpdates.subscribe((update) => {
    // TODO: get component values so that we have full entity values
    // setNotifications
    console.log("update", update);
  });

  return {
    notifications,
  };
};
