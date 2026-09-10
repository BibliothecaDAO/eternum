import { canIssueOrders } from "@/utils/can-issue-orders";
import { memo, useCallback } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import { BuildingThumbs } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_ACTIVE } from "@/ui/design-system/atoms/overlay-surface";
import { MarketModal } from "@/ui/features/economy/trading";
import { ProductionModal } from "@/ui/features/settlement";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import Zap from "lucide-react/dist/esm/icons/zap";

/** The actions bubble for the active owned structure: Build · Production · Military · Transfer, plus Trade
 *  where the mode has a market. Sits between the structure list and the token panel in the left column. */
export const StructureActionsPanel = memo(() => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isOwnStructure = useUIStore((state) =>
    state.playerStructures.some((structure) => structure.entityId === structureEntityId),
  );
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const mode = useGameModeConfig();

  const toggleView = useCallback(
    (target: LeftView) => () => setView(view === target ? LeftView.None : target),
    [setView, view],
  );
  const handleOpenLogistics = useCallback(() => {
    // Anything in flight or ready lands the player on Arrivals, where the badge they clicked points.
    setLogisticsActiveTab(arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0 ? "arrivals" : "transfer");
    setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals);
  }, [arrivedArrivalsNumber, pendingArrivalsNumber, setLogisticsActiveTab, setView, view]);
  const handleOpenProduction = useCallback(
    () => openSurface({ id: "production", content: <ProductionModal preSelectedRealmId={Number(structureEntityId)} /> }),
    [openSurface, structureEntityId],
  );
  const handleOpenMarket = useCallback(
    () => openSurface({ id: "market", content: <MarketModal />, anchor: "right-edge" }),
    [openSurface],
  );

  if (!ordersAllowed) return null;
  if (!isOwnStructure) return null;

  return (
    <InfoBubble title="Actions" icon={Zap} collapsible={false}>
      <div className="grid grid-cols-4 gap-2" aria-label="Structure actions">
        <ActionTile
          image={BuildingThumbs.construction}
          label="Build"
          active={view === LeftView.ConstructionView}
          onClick={toggleView(LeftView.ConstructionView)}
        />
        <ActionTile image={BuildingThumbs.production} label="Production" onClick={handleOpenProduction} />
        <ActionTile
          image={BuildingThumbs.military}
          label="Military"
          active={view === LeftView.MilitaryView}
          onClick={toggleView(LeftView.MilitaryView)}
        />
        <ActionTile
          image={BuildingThumbs.transfer}
          label="Transfer"
          active={view === LeftView.ResourceArrivals}
          onClick={handleOpenLogistics}
          badges={[
            { count: arrivedArrivalsNumber, tone: "ready" },
            { count: pendingArrivalsNumber, tone: "pending" },
          ]}
        />
        {mode.ui.showTradeMenu && <ActionTile image={BuildingThumbs.scale} label="Trade" onClick={handleOpenMarket} />}
      </div>
    </InfoBubble>
  );
});

StructureActionsPanel.displayName = "StructureActionsPanel";

interface ActionTileBadge {
  count: number;
  tone: "ready" | "pending";
}

const BADGE_TONE_CLASS: Record<ActionTileBadge["tone"], string> = {
  ready: "bg-green/90 text-black",
  pending: "bg-gold text-dark-brown",
};

/** One large tile: the icon with its word underneath, on the HUD surface in the HUD sans face. */
const ActionTile = ({
  image,
  label,
  active = false,
  badges = [],
  onClick,
}: {
  image: string;
  label: string;
  active?: boolean;
  badges?: ActionTileBadge[];
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "relative flex min-w-0 flex-col items-center gap-1 rounded-lg border border-gold/20 bg-black/25 px-1 py-2 font-sans normal-case tracking-normal transition hover:border-gold/50 hover:bg-gold/10",
      active && OVERLAY_SURFACE_ACTIVE,
    )}
  >
    <img src={image} alt="" className="h-9 w-9 object-contain" />
    <span className={cn(HUD_LABEL, "truncate", active && "text-gold")}>{label}</span>
    {badges
      .filter((badge) => badge.count > 0)
      .map((badge, index) => (
        <span
          key={badge.tone}
          aria-label={`${badge.count} ${badge.tone}`}
          className={cn(
            "absolute -top-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            index === 0 ? "-right-1" : "-left-1",
            BADGE_TONE_CLASS[badge.tone],
          )}
        >
          {badge.count}
        </span>
      ))}
  </button>
);
