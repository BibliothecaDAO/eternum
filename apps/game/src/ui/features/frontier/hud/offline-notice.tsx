import "./offline-notice.css";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { Icon } from "@/ui/design-system/icon";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { OFFLINE, OFFLINE_BANNER } from "@/ui/design-system/kit/words";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";

export const OfflineBanner = ({ onRetry, reconnecting = true }: { onRetry: () => unknown; reconnecting?: boolean }) => {
  const compact = useHudLayout() !== "desktop";
  const line = reconnecting
    ? compact
      ? OFFLINE_BANNER.reconnecting
      : OFFLINE_BANNER.connectionLostReconnecting
    : compact
      ? OFFLINE
      : OFFLINE_BANNER.connectionLost;
  return (
    <div className="offline-banner" data-offline-banner="" role="alert">
      <Icon name="network-off" size={20} className="offline-banner__icon" />
      <span className="offline-banner__line">{line}</span>
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
  const globalStatus = useConnectionStore((state) => state.globalStatus);
  if (globalStatus === "connected") return null;
  return (
    <OfflineBanner
      reconnecting={globalStatus === "reconnecting"}
      onRetry={() => void triggerConnectionForceReconnect()}
    />
  );
};
