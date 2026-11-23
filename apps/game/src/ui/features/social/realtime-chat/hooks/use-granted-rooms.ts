import { useRealtimeChatSelector } from "./use-realtime-chat";

export const useGrantedRooms = (): readonly string[] => useRealtimeChatSelector((state) => state.grantedRooms);
