import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { Notice } from "@/ui/design-system/kit/notice";
import { OFFLINE, TRY_AGAIN } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

/** Offline, above the foot rows: the last values stay on screen and Try again reconnects. */
export const OfflineNotice = () => {
  const offline = useConnectionStore((state) => state.status === "disconnected");
  if (!offline) return null;
  return (
    <Notice icon="Of" line={OFFLINE} verb={TRY_AGAIN} onVerb={() => void triggerConnectionForceReconnect()} ember />
  );
};
