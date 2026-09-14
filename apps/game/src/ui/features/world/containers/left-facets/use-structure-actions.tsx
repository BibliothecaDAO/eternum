import { canIssueOrders } from "@/utils/can-issue-orders";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import { BuildingThumbs } from "@/ui/config";
import { MarketModal } from "@/ui/features/economy/trading";
import { ProductionModal } from "@/ui/features/settlement";

export interface StructureActionBadge {
  count: number;
  tone: "ready" | "pending";
}

export interface StructureAction {
  id: "build" | "production" | "military" | "transfer" | "trade";
  label: string;
  image: string;
  active: boolean;
  badges?: StructureActionBadge[];
  onClick: () => void;
}

/**
 * The actions of the active owned structure — Build · Production · Military · Transfer, plus Trade where the mode
 * has a market — each with its open state and dispatch. Null for a spectator or while a foreign structure is
 * selected, so the desktop panel and the compact strip appear and disappear together.
 */
export function useStructureActions(): StructureAction[] | null {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isOwnStructure = useUIStore((state) =>
    state.playerStructures.some((structure) => structure.entityId === structureEntityId),
  );
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const openId = usePopoverStore((state) => state.openId);
  const closePopover = usePopoverStore((state) => state.close);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const mode = useGameModeConfig();

  if (!ordersAllowed) return null;
  if (!isOwnStructure) return null;

  const toggleView = (target: LeftView) => () => {
    closePopover();
    setView(view === target ? LeftView.None : target);
  };
  const openLogistics = () => {
    // Anything in flight or ready lands the player on Arrivals, where the badge they clicked points.
    setTransferPanelSourceId(Number(structureEntityId));
    setLogisticsActiveTab(arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0 ? "arrivals" : "transfer");
    toggleView(LeftView.ResourceArrivals)();
  };
  const openProduction = () => {
    setView(LeftView.None);
    if (openId === "production") closePopover();
    else openSurface({ id: "production", content: <ProductionModal preSelectedRealmId={Number(structureEntityId)} /> });
  };
  const openMarket = () => {
    setView(LeftView.None);
    if (openId === "market") closePopover();
    else openSurface({ id: "market", content: <MarketModal />, anchor: "right-edge" });
  };

  const actions: StructureAction[] = [
    {
      id: "build",
      label: "Build",
      image: BuildingThumbs.construction,
      active: view === LeftView.ConstructionView,
      onClick: toggleView(LeftView.ConstructionView),
    },
    {
      id: "production",
      label: "Production",
      image: BuildingThumbs.production,
      active: openId === "production",
      onClick: openProduction,
    },
    {
      id: "military",
      label: "Military",
      image: BuildingThumbs.military,
      active: view === LeftView.MilitaryView,
      onClick: toggleView(LeftView.MilitaryView),
    },
    {
      id: "transfer",
      label: "Transfer",
      image: BuildingThumbs.transfer,
      active: view === LeftView.ResourceArrivals,
      onClick: openLogistics,
      badges: [
        { count: arrivedArrivalsNumber, tone: "ready" },
        { count: pendingArrivalsNumber, tone: "pending" },
      ],
    },
  ];
  if (mode.ui.showTradeMenu) {
    actions.push({
      id: "trade",
      label: "Trade",
      image: BuildingThumbs.scale,
      active: openId === "market",
      onClick: openMarket,
    });
  }
  return actions;
}
