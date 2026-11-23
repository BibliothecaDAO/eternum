import "./offline-notice.css";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLayout } from "@/shell/frame/layout";
import { Icon } from "@/ui/design-system/icon";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { OFFLINE_BANNER } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

export const OfflineBanner = ({ onRetry }: { onRetry: () => unknown }) => {
  const compact = useLayout() !== "desktop";
  return (
    <div className="offline-banner" data-offline-banner="" role="alert">
      <Icon name="network-off" size={20} className="offline-banner__icon" />
      <span className="offline-banner__line">
        {compact ? OFFLINE_BANNER.reconnecting : OFFLINE_BANNER.connectionLost}
      </span>
      <span className="offline-banner__action">
        <HudButton kind="secondary" size="sm" onClick={onRetry}>
          {OFFLINE_BANNER.retry}
        </HudButton>
      </span>
    </div>
  );
};

/** Offline, above the foot rows: the last values stay on screen and Try again reconnects. */
export const OfflineNotice = () => {
  const offline = useConnectionStore((state) => state.status === "disconnected");
  if (!offline) return null;
  return <OfflineBanner onRetry={() => void triggerConnectionForceReconnect()} />;
};
