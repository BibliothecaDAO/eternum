import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { OFFLINE } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

import { RetryNotice } from "./retry-notice";

/** Offline, above the foot rows: the last values stay on screen and Try again reconnects. */
export const OfflineNotice = () => {
  const offline = useConnectionStore((state) => state.status === "disconnected");
  if (!offline) return null;
  return <RetryNotice line={OFFLINE} onRetry={() => void triggerConnectionForceReconnect()} />;
};
