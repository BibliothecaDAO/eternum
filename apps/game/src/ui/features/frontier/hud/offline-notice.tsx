import "./offline-notice.css";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { Icon } from "@/ui/design-system/icon";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { OFFLINE_BANNER } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

export const OfflineBanner = ({ onRetry, reconnecting = true }: { onRetry: () => unknown; reconnecting?: boolean }) => (
  <div className="offline-pill" data-offline-banner="" data-state={reconnecting ? "reconnecting" : "lost"} role="alert">
    <span className="offline-pill__dot" aria-hidden="true" />
    <Icon name="network-off" size={18} className="offline-pill__icon" />
    <span className="offline-pill__line">
      {reconnecting ? OFFLINE_BANNER.reconnecting : OFFLINE_BANNER.connectionLost}
    </span>
    {!reconnecting && (
      <HudButton kind="secondary" size="sm" icon="refresh" onClick={onRetry}>
        {OFFLINE_BANNER.retry}
      </HudButton>
    )}
  </div>
);

export const OfflineNotice = () => {
  const globalStatus = useConnectionStore((state) => state.globalStatus);
  if (globalStatus === "connected") return null;
  return (
    <OfflineBanner
      reconnecting={globalStatus === "reconnecting"}
      onRetry={() => void triggerConnectionForceReconnect()}
    />
  );
};
