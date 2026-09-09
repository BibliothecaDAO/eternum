import { canIssueOrders } from "@/utils/can-issue-orders";
import { useCallback } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { MarketModal } from "@/ui/features/economy/trading";
import { ProductionModal } from "@/ui/features/settlement";
export const LeftActionsRow = () => {
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const mode = useGameModeConfig();
  const showTradeAction = mode.ui.showTradeMenu && ordersAllowed;
  const handleOpenLogistics = useCallback(() => {
    // If anything is in flight or ready, land the user on Arrivals so the
    // badge they just clicked actually points at the relevant tab.
    const hasArrivals = arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0;
    setLogisticsActiveTab(hasArrivals ? "arrivals" : "transfer");
    setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals);
  }, [arrivedArrivalsNumber, pendingArrivalsNumber, setLogisticsActiveTab, setView, view]);
  const handleOpenProduction = useCallback(() => {
    if (!structureEntityId) return;
    openSurface({ id: "production", content: <ProductionModal preSelectedRealmId={Number(structureEntityId)} /> });
  }, [structureEntityId, openSurface]);
  const toggleView = useCallback(
    (target: LeftView) => () => setView(view === target ? LeftView.None : target),
    [setView, view],
  );

  if (!ordersAllowed) return null;

  return (
    <div
      className="pointer-events-auto flex items-center justify-evenly gap-2 rounded-xl border border-gold/25 px-2 py-2"
      aria-label="Quick actions"
    >
      <>
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.construction}
          label="Build"
          active={view === LeftView.ConstructionView}
          onClick={toggleView(LeftView.ConstructionView)}
        />
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.production}
          label="Production"
          onClick={handleOpenProduction}
          disabled={!structureEntityId}
        />
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.military}
          label="Military"
          active={view === LeftView.MilitaryView}
          onClick={toggleView(LeftView.MilitaryView)}
          disabled={!structureEntityId}
        />
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.transfer}
          label="Transfer"
          active={view === LeftView.ResourceArrivals}
          onClick={handleOpenLogistics}
          primaryNotification={
            arrivedArrivalsNumber > 0
              ? { value: arrivedArrivalsNumber, color: "green", location: "topright" }
              : undefined
          }
          secondaryNotification={
            pendingArrivalsNumber > 0
              ? { value: pendingArrivalsNumber, color: "yellow", location: "bottomright" }
              : undefined
          }
        />
      </>

      {showTradeAction && (
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.scale}
          label="Trade"
          onClick={() => openSurface({ id: "market", content: <MarketModal />, anchor: "right-edge" })}
        />
      )}
      {/* Prediction Market button retired: the PM deployment is gone until
          W6 — the modal would initialize against a dead host. */}
    </div>
  );
};
