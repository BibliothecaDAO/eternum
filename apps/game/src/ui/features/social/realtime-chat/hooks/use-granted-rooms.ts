import { useEffect } from "react";

import { useRealtimeChatSelector } from "./use-realtime-chat";

export const useGrantedRooms = (): readonly string[] => useRealtimeChatSelector((state) => state.grantedRooms);

export const useStandAt = (place: string) => {
  const standAt = useRealtimeChatSelector((state) => state.actions.standAt);
  useEffect(() => standAt(place), [place, standAt]);
};
