import { useEffect, useSyncExternalStore } from "react";

import { useRealtimeChatSelector } from "./use-realtime-chat";

const onVisibility = (change: () => void) => {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
};

/**
 * Tells the room the player sees now, visibly, on this device (`device`, its push id): chat open on a room it has
 * joined, the page in front. A mention there skips this device alone; chat closed, another view, or the page hidden,
 * and the room hears it sees nothing here. Without a push device there is nothing to skip, and nothing is told.
 */
export const useSeenRoom = (device: string | null) => {
  const client = useRealtimeChatSelector((state) => state.client);
  const shown = useRealtimeChatSelector((state) =>
    state.isShellOpen && state.view.kind === "room" && state.joinedZoneIds.includes(state.view.zoneId)
      ? state.view.zoneId
      : null,
  );
  const visible = useSyncExternalStore(
    onVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  useEffect(() => {
    client?.setSeenRoom(shown && visible && device ? { zoneId: shown, device } : null);
  }, [client, device, shown, visible]);
};
