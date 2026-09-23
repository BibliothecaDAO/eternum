import { canIssueOrders } from "@/utils/can-issue-orders";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { configManager } from "@bibliothecadao/eternum";
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

type NativeCommand = Parameters<typeof configManager.isCommandEnabled>[0];

/**
 * The commands each realm action issues. An action is offered only where the game's command mask enables one of
 * them, so a mode that leaves a command out (Frontier has no transfers, production burns or market) loses the
 * action with it, whatever the mode.
 */
const ACTION_COMMANDS: Record<StructureAction["id"], NativeCommand[]> = {
  build: ["CreateBuilding"],
  production: ["BurnResourceForResourceProduction", "BurnLaborForResourceProduction"],
  military: ["CreateExplorer", "ManageTroops"],
  transfer: ["SendResources", "OffloadArrival"],
  trade: ["CreateTradeOrder", "AcceptTradeOrder", "BuyFromBank", "SellToBank"],
};

export const isStructureActionEnabled = (
  id: StructureAction["id"],
  isCommandEnabled: (command: NativeCommand) => boolean,
): boolean => ACTION_COMMANDS[id].some(isCommandEnabled);

/**
 * The actions of the active owned structure (Build, Production, Military, Transfer, Trade) that the game's commands
 * allow, each with its open state and dispatch. Null for a spectator or while a foreign structure is selected, so the
 * desktop panel and the compact strip appear and disappear together.
 */
export function useStructureActions(): StructureAction[] | null {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isOwnStructure = useFactView(playerStructuresView).some(
    (structure) => structure.entityId === structureEntityId,
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
    {
      id: "trade",
      label: "Trade",
      image: BuildingThumbs.scale,
      active: openId === "market",
      onClick: openMarket,
    },
  ];
  return actions.filter((action) =>
    isStructureActionEnabled(action.id, (command) => configManager.isCommandEnabled(command)),
  );
}
