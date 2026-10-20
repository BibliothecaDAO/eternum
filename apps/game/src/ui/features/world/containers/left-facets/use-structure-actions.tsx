import { PRODUCTION } from "@/ui/design-system/kit/words";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { configManager } from "@bibliothecadao/eternum";
import { LeftView } from "@/types";
import { MarketModal } from "@/ui/features/economy/trading";
import { ProductionModal } from "@/ui/features/settlement";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

export interface StructureActionBadge {
  count: number;
  tone: "ready" | "pending";
}

export interface StructureAction {
  id: "build" | "production" | "military" | "transfer" | "trade";
  label: string;
  active: boolean;
  badges?: StructureActionBadge[];
  /** Why the action cannot be taken now (before play opens), or null. */
  refusal: string | null;
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
 * allow, each with its open state and dispatch, and shut with the reason until play opens. Null for a spectator or while a foreign structure is selected, so the
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
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = useActNowRefusal();

  if (!ordersAllowed) return null;
  if (!isOwnStructure) return null;

  const toggleView = (target: LeftView) => () => {
    closePopover();
    setView(view === target ? LeftView.None : target);
  };
  // The one transfer window, from the selected holding; Arrivals, where the badges point, is a link in its header.
  const openTransferWindow = () => {
    if (openId === "transfer") closePopover();
    else openTransfer({ sourceId: safeInteger(structureEntityId), destinationIds: [] });
  };
  const openProduction = () => {
    setView(LeftView.None);
    if (openId === "production") closePopover();
    else
      openSurface({
        id: "production",
        content: <ProductionModal preSelectedRealmId={safeInteger(structureEntityId)} />,
      });
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
      active: view === LeftView.ConstructionView,
      onClick: toggleView(LeftView.ConstructionView),
      refusal,
    },
    {
      id: "production",
      label: PRODUCTION,
      active: openId === "production",
      onClick: openProduction,
      refusal,
    },
    {
      id: "military",
      label: "Military",
      active: view === LeftView.MilitaryView,
      onClick: toggleView(LeftView.MilitaryView),
      refusal,
    },
    {
      id: "transfer",
      label: "Transfer",
      active: openId === "transfer",
      onClick: openTransferWindow,
      refusal,
      badges: [
        { count: arrivedArrivalsNumber, tone: "ready" },
        { count: pendingArrivalsNumber, tone: "pending" },
      ],
    },
    {
      id: "trade",
      label: "Trade",
      active: openId === "market",
      onClick: openMarket,
      refusal,
    },
  ];
  return actions.filter((action) =>
    isStructureActionEnabled(action.id, (command) => configManager.isCommandEnabled(command)),
  );
}
