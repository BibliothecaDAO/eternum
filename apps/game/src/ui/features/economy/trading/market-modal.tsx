import { StructureSelect } from "@/ui/design-system/molecules/structure-select";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCompactLane, type CompactLane } from "@/hooks/helpers/use-compact-hud";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HUD_CUE, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudTabStrip } from "@/ui/design-system/molecules/hud-tab-strip";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { REQUIREMENT_CHIP } from "@/ui/design-system/molecules/requirement-chips";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat, formatNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { useMarket } from "@/hooks/helpers/use-trade";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { findResourceById, ID, MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import { Store } from "@/ui/design-system/atoms/game-icons";
import { lazy, Suspense, useMemo, useState } from "react";
import { resolveBestPrices } from "./best-prices";
import { MarketResourceSidebar } from "./market-resource-sidebar";
import { TradeSummaryBar } from "./trade-summary-bar";

const MarketOrderPanel = lazy(() =>
  import("./market-order-panel").then((module) => ({ default: module.MarketOrderPanel })),
);
const CompactOrderBook = lazy(() =>
  import("./compact-order-book").then((module) => ({ default: module.CompactOrderBook })),
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

/** Everything the market's views render from, resolved once so desktop and compact share one data path. */
interface MarketDesk {
  lane: CompactLane | null;
  tab: MarketTab;
  onTabChange: (tab: MarketTab) => void;
  structureEntityId: ID;
  onStructureChange: (entityId: ID) => void;
  selectedResource: number;
  onResourceSelect: (resourceId: number) => void;
  bidOffers: MarketInterface[];
  askOffers: MarketInterface[];
}

/** On a phone the market shows one column at a time: pick a resource, then trade it. */
type CompactMarketView = "picker" | "trade";

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
  const desk = useMarketDesk();

  return desk.lane === null ? <DesktopMarketContent desk={desk} /> : <CompactMarketContent desk={desk} />;
};

const useMarketDesk = (): MarketDesk => {
  const lane = useCompactLane();
  const [tab, setTab] = useState<MarketTab>("orderbook");
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);
  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);
  const { currentBlockTimestamp } = getBlockTimestamp();
  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  return {
    lane,
    tab,
    onTabChange: setTab,
    structureEntityId,
    onStructureChange: setStructureEntityId,
    selectedResource,
    onResourceSelect: setSelectedResource,
    bidOffers,
    askOffers,
  };
};

/** The resource list beside the trade view. */
const DesktopMarketContent = ({ desk }: { desk: MarketDesk }) => (
  <div className="market-modal-selector grid h-full min-h-0 grid-cols-12">
    <MarketResourcePicker
      desk={desk}
      onResourceSelect={desk.onResourceSelect}
      className="col-span-3 border-r border-gold/15"
    />
    <MarketTradeView desk={desk} className="col-span-9" />
  </div>
);

/** The trade view for the selected resource, with the resource list one tap away. */
const CompactMarketContent = ({ desk }: { desk: MarketDesk }) => {
  const [view, setView] = useState<CompactMarketView>("trade");

  const pickResource = (resourceId: number) => {
    desk.onResourceSelect(resourceId);
    setView("trade");
  };

  return (
    <>
      {view === "picker" && (
        <MarketResourcePicker desk={desk} onResourceSelect={pickResource} className="market-modal-selector h-full" />
      )}
      {/* Keep trading state mounted while the picker is open, including the AMM subtab and unfinished forms. */}
      <div
        hidden={view === "picker"}
        className={cn("market-modal-selector h-full min-h-0 flex-col", view === "trade" && "flex")}
      >
        <div className="shrink-0 max-lg:landscape:grid max-lg:landscape:grid-cols-2">
          <TradingStructureHeader structureEntityId={desk.structureEntityId} onSelect={desk.onStructureChange} />
          <SelectedResourceHeader desk={desk} onChange={() => setView("picker")} />
        </div>
        <MarketTradeView desk={desk} className="min-h-0 flex-1" />
      </div>
    </>
  );
};

const MarketResourcePicker = ({
  desk,
  onResourceSelect,
  className,
}: {
  desk: MarketDesk;
  onResourceSelect: (resourceId: number) => void;
  className?: string;
}) => (
  <div className={cn("flex min-h-0 flex-col", className)}>
    <TradingStructureHeader structureEntityId={desk.structureEntityId} onSelect={desk.onStructureChange} />
    <MarketResourceSidebar
      entityId={desk.structureEntityId}
      onClick={onResourceSelect}
      selectedResource={desk.selectedResource}
      resourceAskOffers={desk.askOffers}
      resourceBidOffers={desk.bidOffers}
    />
  </div>
);

/** The compact trade view's header: the resource on the desk, its balance and best prices, and the way back. */
const SelectedResourceHeader = ({ desk, onChange }: { desk: MarketDesk; onChange: () => void }) => {
  const trait = findResourceById(desk.selectedResource)?.trait ?? "";
  const balance = useStructureResourceBalance(desk.structureEntityId, desk.selectedResource);
  const bestPrices = useMemo(() => resolveBestPrices(desk.bidOffers, desk.askOffers), [desk.bidOffers, desk.askOffers]);

  return (
    <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-gold/15 px-3 py-1">
      <span className="flex min-w-0 items-center gap-2">
        <ResourceIcon resource={trait} size="sm" withTooltip={false} />
        <span className="flex min-w-0 flex-col">
          <span className={cn(HUD_VALUE, "truncate")}>{trait}</span>
          <span className={cn(HUD_CUE, "flex flex-wrap gap-x-2")}>
            <span title="Balance">{currencyFormat(balance, 0)} owned</span>
            <span className="text-green" title="Best ask">
              Buy {formatPrice(bestPrices.lowestAsk.get(desk.selectedResource))}
            </span>
            <span className="text-red" title="Best bid">
              Sell {formatPrice(bestPrices.highestBid.get(desk.selectedResource))}
            </span>
          </span>
        </span>
      </span>
      <button type="button" onClick={onChange} className={cn(HUD_PILL_BUTTON, "shrink-0 min-h-11 py-2")}>
        Change
      </button>
    </div>
  );
};

const formatPrice = (price: number | undefined) => (price === undefined ? "—" : formatNumber(price, 4));

const useStructureResourceBalance = (structureEntityId: ID, resourceId: number) => {
  const { currentDefaultTick } = getBlockTimestamp();
  const resourceManager = useResourceManager(structureEntityId);
  return useMemo(
    () => resourceManager.balanceWithProduction(currentDefaultTick, resourceId)?.balance,
    [resourceManager, currentDefaultTick, resourceId],
  );
};

const MarketTradeView = ({ desk, className }: { desk: MarketDesk; className?: string }) => (
  <div className={cn("flex min-h-0 flex-col", className)}>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gold/15 px-3 py-2 max-lg:flex-wrap max-lg:landscape:py-0">
      <HudTabStrip
        className="max-lg:[&_button]:min-h-11"
        tabs={MARKET_TABS}
        selected={desk.tab}
        onSelect={desk.onTabChange}
      />
      <div className="max-lg:landscape:hidden">
        <TradeSummaryBar bidOffers={desk.bidOffers} askOffers={desk.askOffers} entityId={desk.structureEntityId} />
      </div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Suspense fallback={<LoadingAnimation />}>
        <MarketTabContent desk={desk} />
      </Suspense>
    </div>
  </div>
);

const MarketTabContent = ({ desk }: { desk: MarketDesk }) => {
  switch (desk.tab) {
    case "orderbook":
      return <OrderBookTab desk={desk} />;
    case "amm":
      return <BankPanel structureEntityId={desk.structureEntityId} selectedResource={desk.selectedResource} />;
    case "history":
      return <MarketTradingHistory />;
  }
};

/** The two-column book on the desk; on a phone, one side at a time led by the order form. */
const OrderBookTab = ({ desk }: { desk: MarketDesk }) => {
  const book = {
    resourceId: desk.selectedResource,
    entityId: desk.structureEntityId,
    resourceAskOffers: desk.askOffers,
    resourceBidOffers: desk.bidOffers,
  };
  return desk.lane === null ? <MarketOrderPanel {...book} /> : <CompactOrderBook {...book} lane={desk.lane} />;
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
  const playerStructures = useFactView(playerStructuresView);
  const { currentDefaultTick } = getBlockTimestamp();
  const resourceManager = useResourceManager(structureEntityId);
  const balances = useMemo(() => {
    const balanceOf = (resourceId: ResourcesIds) =>
      resourceManager.balanceWithProduction(currentDefaultTick, resourceId)?.balance;
    return { lords: balanceOf(ResourcesIds.Lords), donkeys: balanceOf(ResourcesIds.Donkey) };
  }, [resourceManager, currentDefaultTick]);

  return (
    <div className="market-realm-selector min-w-0 flex shrink-0 flex-col gap-1 border-b border-gold/15 px-3 py-1 max-lg:landscape:[&>div:last-child]:hidden">
      <StructureSelect
        value={structureEntityId}
        onChange={onSelect}
        options={playerStructures.map((structure) => ({
          entityId: structure.entityId,
          name: mode.structure.getName(structure.structure).name,
        }))}
      />
      <div className="flex items-center gap-1.5">
        <span className={cn(REQUIREMENT_CHIP, "text-gold")} title="Lords">
          <ResourceIcon resource="Lords" size="xs" withTooltip={false} />
          {currencyFormat(balances.lords, 0)}
        </span>
        <span
          className={cn(
            REQUIREMENT_CHIP,
            balances.donkeys !== undefined && balances.donkeys > 0 ? "text-gold" : "text-red",
          )}
          title="Donkeys"
        >
          <ResourceIcon resource="Donkey" size="xs" withTooltip={false} />
          {currencyFormat(balances.donkeys, 0)}
        </span>
      </div>
    </div>
  );
};
