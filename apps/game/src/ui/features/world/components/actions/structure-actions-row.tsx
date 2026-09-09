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
import type { ID } from "@bibliothecadao/types";

/** Build · Production · Military · Transfer for one owned structure, rendered under its name in the tile details. */
export const StructureActionsRow = ({ structureEntityId }: { structureEntityId: ID }) => {
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const mode = useGameModeConfig();
  const showTradeAction = mode.ui.showTradeMenu && ordersAllowed;

  // Every action works on this structure, so it becomes the active one first.
  const activate = useCallback(() => setStructureEntityId(structureEntityId), [setStructureEntityId, structureEntityId]);
  const toggleView = useCallback(
    (target: LeftView) => () => {
      activate();
      setView(view === target ? LeftView.None : target);
    },
    [activate, setView, view],
  );
  const handleOpenLogistics = useCallback(() => {
    activate();
    // Anything in flight or ready lands the player on Arrivals, where the badge they clicked points.
    setLogisticsActiveTab(arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0 ? "arrivals" : "transfer");
    setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals);
  }, [activate, arrivedArrivalsNumber, pendingArrivalsNumber, setLogisticsActiveTab, setView, view]);
  const handleOpenProduction = useCallback(() => {
    activate();
    openSurface({ id: "production", content: <ProductionModal preSelectedRealmId={Number(structureEntityId)} /> });
  }, [activate, openSurface, structureEntityId]);

  if (!ordersAllowed) return null;

  return (
    <div className="flex items-center gap-2 pt-2" aria-label="Structure actions">
      <CircleButton
        variant="hud"
        size="sm"
        tooltipLocation="top"
        image={BuildingThumbs.construction}
        label="Build"
        active={view === LeftView.ConstructionView}
        onClick={toggleView(LeftView.ConstructionView)}
      />
      <CircleButton
        variant="hud"
        size="sm"
        tooltipLocation="top"
        image={BuildingThumbs.production}
        label="Production"
        onClick={handleOpenProduction}
      />
      <CircleButton
        variant="hud"
        size="sm"
        tooltipLocation="top"
        image={BuildingThumbs.military}
        label="Military"
        active={view === LeftView.MilitaryView}
        onClick={toggleView(LeftView.MilitaryView)}
      />
      <CircleButton
        variant="hud"
        size="sm"
        tooltipLocation="top"
        image={BuildingThumbs.transfer}
        label="Transfer"
        active={view === LeftView.ResourceArrivals}
        onClick={handleOpenLogistics}
        primaryNotification={
          arrivedArrivalsNumber > 0 ? { value: arrivedArrivalsNumber, color: "green", location: "topright" } : undefined
        }
        secondaryNotification={
          pendingArrivalsNumber > 0
            ? { value: pendingArrivalsNumber, color: "yellow", location: "bottomright" }
            : undefined
        }
      />
      {showTradeAction && (
        <CircleButton
          variant="hud"
          size="sm"
          tooltipLocation="top"
          image={BuildingThumbs.scale}
          label="Trade"
          onClick={() => openSurface({ id: "market", content: <MarketModal />, anchor: "right-edge" })}
        />
      )}
    </div>
  );
};
