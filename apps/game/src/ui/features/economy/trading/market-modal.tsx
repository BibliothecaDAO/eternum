import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { DROPDOWN_CONTENT, DROPDOWN_TRIGGER } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { HudTabStrip } from "@/ui/design-system/molecules/hud-tab-strip";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { REQUIREMENT_CHIP } from "@/ui/design-system/molecules/requirement-chips";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { useMarket, useResourceManager } from "@bibliothecadao/react";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import Store from "lucide-react/dist/esm/icons/store";
import { lazy, Suspense, useMemo, useState } from "react";
import { MarketResourceSidebar } from "./market-resource-sidebar";
import { TradeSummaryBar } from "./trade-summary-bar";

const MarketOrderPanel = lazy(() =>
  import("./market-order-panel").then((module) => ({ default: module.MarketOrderPanel })),
);
const BankPanel = lazy(() => import("@/ui/features/economy/banking").then((module) => ({ default: module.BankList })));
const MarketTradingHistory = lazy(() =>
  import("./market-trading-history").then((module) => ({ default: module.MarketTradingHistory })),
);

const MARKET_TABS = [
  { key: "orderbook", label: "Order Book" },
  { key: "amm", label: "AMM" },
  { key: "history", label: "History" },
] as const;
type MarketTab = (typeof MARKET_TABS)[number]["key"];

export const MarketModal = () => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);

  return (
    <SurfaceFrame
      title="Market"
      icon={Store}
      onClose={closeSurface}
      className={SURFACE_WORKSPACE_CLASS}
      bodyClassName="overflow-hidden"
    >
      <MarketContent />
    </SurfaceFrame>
  );
};

const MarketContent = () => {
  const [tab, setTab] = useState<MarketTab>("orderbook");
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);
  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);
  const { currentBlockTimestamp } = getBlockTimestamp();
  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  return (
    <div className="market-modal-selector grid h-full min-h-0 grid-cols-12">
      <div className="col-span-3 flex min-h-0 flex-col border-r border-gold/15">
        <TradingStructureHeader structureEntityId={structureEntityId} onSelect={setStructureEntityId} />
        <MarketResourceSidebar
          entityId={structureEntityId}
          onClick={setSelectedResource}
          selectedResource={selectedResource}
          resourceAskOffers={askOffers}
          resourceBidOffers={bidOffers}
        />
      </div>
      <div className="col-span-9 flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-gold/15 px-3 py-2">
          <HudTabStrip tabs={MARKET_TABS} selected={tab} onSelect={setTab} />
          <TradeSummaryBar bidOffers={bidOffers} askOffers={askOffers} entityId={structureEntityId} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Suspense fallback={<LoadingAnimation />}>
            {tab === "orderbook" && (
              <MarketOrderPanel
                resourceId={selectedResource}
                entityId={structureEntityId}
                resourceAskOffers={askOffers}
                resourceBidOffers={bidOffers}
              />
            )}
            {tab === "amm" && <BankPanel structureEntityId={structureEntityId} selectedResource={selectedResource} />}
            {tab === "history" && <MarketTradingHistory />}
          </Suspense>
        </div>
      </div>
    </div>
  );
};

/** Which structure trades, and what it can pay and carry with. */
const TradingStructureHeader = ({
  structureEntityId,
  onSelect,
}: {
  structureEntityId: ID;
  onSelect: (entityId: ID) => void;
}) => {
  const mode = useGameModeConfig();
  const playerStructures = useUIStore((state) => state.playerStructures);
  const { currentDefaultTick } = getBlockTimestamp();
  const resourceManager = useResourceManager(structureEntityId);
  const balances = useMemo(() => {
    const balanceOf = (resourceId: ResourcesIds) =>
      Number(resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance);
    return { lords: balanceOf(ResourcesIds.Lords), donkeys: balanceOf(ResourcesIds.Donkey) };
  }, [resourceManager, currentDefaultTick]);

  return (
    <div className="market-realm-selector flex flex-col gap-2 border-b border-gold/15 px-3 py-2">
      <Select value={structureEntityId.toString()} onValueChange={(value) => onSelect(ID(value))}>
        <SelectTrigger className={cn(DROPDOWN_TRIGGER, "h-8 w-full text-xs")}>
          <SelectValue placeholder="Select structure" />
        </SelectTrigger>
        <SelectContent className={DROPDOWN_CONTENT}>
          {playerStructures.map((structure) => (
            <SelectItem key={structure.entityId} value={structure.entityId.toString()}>
              {mode.structure.getName(structure.structure).name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <span className={cn(REQUIREMENT_CHIP, "text-gold")} title="Lords">
          <ResourceIcon resource="Lords" size="xs" withTooltip={false} />
          {currencyFormat(balances.lords, 0)}
        </span>
        <span className={cn(REQUIREMENT_CHIP, balances.donkeys > 0 ? "text-gold" : "text-red")} title="Donkeys">
          <ResourceIcon resource="Donkey" size="xs" withTooltip={false} />
          {currencyFormat(balances.donkeys, 0)}
        </span>
      </div>
    </div>
  );
};
