import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RealtimeChatShell, type InitializeRealtimeClientParams } from "@/ui/features/social";
import {
  BOTTOM_PANEL_MARGIN,
  BOTTOM_PANEL_RESERVED_SPACE,
} from "@/ui/features/world/components/selected-tile-panel/constants";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@bibliothecadao/react";

export const RealtimeChatPortal = () => {
  const ConnectedAccount = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const isModalOpen = useUIStore((state) => state.showModal);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const activeBottomPanelTab = useUIStore((state) => state.activeBottomPanelTab);
  const { isMapView } = useQuery();

  const [chatPortalTarget, setChatPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setChatPortalTarget(document.body);
  }, []);

  const defaultZoneId = "global";
  const zoneIds = useMemo(() => [defaultZoneId], [defaultZoneId]);
  const realtimeBaseUrl = (import.meta.env.VITE_PUBLIC_REALTIME_URL as string | undefined) ?? "";

  const realtimeInitializer = useMemo<InitializeRealtimeClientParams | null>(() => {
    if (!realtimeBaseUrl) return null;

    const walletAddress = ConnectedAccount?.address ?? undefined;
    const normalizedAccountName = accountName?.trim() ?? "";
    const hasUsername = normalizedAccountName.length > 0;
    const playerId = hasUsername ? normalizedAccountName : (walletAddress ?? "demo-player");
    const displayName = hasUsername ? normalizedAccountName : undefined;

    return {
      baseUrl: realtimeBaseUrl,
      identity: {
        playerId,
        walletAddress,
        displayName,
      },
      queryParams: {
        walletAddress,
        playerName: displayName,
      },
      joinZones: zoneIds,
    };
  }, [ConnectedAccount, accountName, realtimeBaseUrl, zoneIds]);

  if (!chatPortalTarget || !realtimeInitializer) {
    return null;
  }

  const isOverlayActive = isModalOpen || showBlankOverlay;
  const shouldOffsetForPanels = isMapView && !showBlankOverlay && activeBottomPanelTab !== null;
  const bottomOffset = shouldOffsetForPanels ? BOTTOM_PANEL_RESERVED_SPACE : BOTTOM_PANEL_MARGIN;

  return createPortal(
    <div
      className={clsx(
        "flex justify-end fixed right-0 transition-opacity duration-200",
        isOverlayActive ? "pointer-events-none z-[10] opacity-0" : "pointer-events-auto z-[45] opacity-100",
      )}
      style={{ bottom: bottomOffset }}
    >
      <RealtimeChatShell
        initializer={realtimeInitializer}
        zoneIds={zoneIds}
        defaultZoneId={defaultZoneId}
        className="w-full"
        showInlineToggle={false}
      />
    </div>,
    chatPortalTarget,
  );
};
