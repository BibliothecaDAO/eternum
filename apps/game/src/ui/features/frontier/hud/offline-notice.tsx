import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { OFFLINE } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

/** Offline, above the foot rows: the last values stay on screen and Try again reconnects. */
export const OfflineNotice = () => {
  const offline = useConnectionStore((state) => state.status === "disconnected");
  if (!offline) return null;
  return <HudNotice tone="bad" line={OFFLINE} retry={() => void triggerConnectionForceReconnect()} />;
};
