import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/swap.svg";
import { useSyncMarket } from "@/hooks/helpers/use-sync";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import { Select, Tabs } from "@/ui/design-system/atoms";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { LoadingAnimation, ResourceIcon } from "@/ui/design-system/molecules";
import { ModalContainer } from "@/ui/shared";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { useMarket, useResourceManager } from "@bibliothecadao/react";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import { lazy, Suspense, useMemo, useState } from "react";

const UnifiedTradePanel = lazy(() =>
  import("@/ui/features/economy/trading/unified-trade-panel").then((module) => ({
    default: module.UnifiedTradePanel,
  })),
);

const MarketResourceSidebar = lazy(() =>
  import("@/ui/features/economy/trading").then((module) => ({
    default: module.MarketResourceSidebar,
  })),
);

const MarketOrderPanel = lazy(() =>
  import("@/ui/features/economy/trading").then((module) => ({ default: module.MarketOrderPanel })),
);

const BankPanel = lazy(() => import("@/ui/features/economy/banking").then((module) => ({ default: module.BankList })));

const MarketTradingHistory = lazy(() =>
  import("@/ui/features/economy/trading").then((module) => ({
    default: module.MarketTradingHistory,
  })),
);

const RealmProduction = lazy(() =>
  import("@/ui/features/economy/trading").then((module) => ({ default: module.RealmProduction })),
);

const TransportCapacityBar = lazy(() =>
  import("@/ui/features/economy/trading/transport-capacity-bar").then((module) => ({
    default: module.TransportCapacityBar,
  })),
);

const TradeSummaryBar = lazy(() =>
  import("@/ui/features/economy/trading/trade-summary-bar").then((module) => ({
    default: module.TradeSummaryBar,
  })),
);

export const MarketModal = () => {
  const { isSyncing } = useSyncMarket();

  return <ModalContainer>{isSyncing ? <LoadingAnimation /> : <MarketContent />}</ModalContainer>;
};

const MarketContent = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const mode = useGameModeConfig();
  const useUnifiedTrade = useMarketStore((state) => state.useUnifiedTrade);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();

  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const [resourceSearch, setResourceSearch] = useState("");

  const structureResourceManager = useResourceManager(structureEntityId);

  const structureLordsBalance = useMemo(
    () =>
      structureResourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords)
        .balance,
    [structureResourceManager, currentDefaultTick],
  );

  // Unified trade: 3 tabs (Trade, History, Realm Production)
  const unifiedTabLabels = useMemo(
    () => [
      {
        key: "trade",
        label: (
          <div className="flex relative group items-center gap-2">
            <Swap className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">Trade</div>
          </div>
        ),
      },
      {
        key: "history",
        label: (
          <div className="flex relative group items-center gap-2">
            <Sparkles className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">History</div>
          </div>
        ),
      },
      {
        key: "realmProduction",
        label: (
          <div className="realm-production-tab-selector flex relative group items-center gap-2">
            <Crown className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">Realm Production</div>
          </div>
        ),
      },
    ],
    [],
  );

  // Legacy: 4 tabs (Order Book, AMM, History, Realm Production)
  const legacyTabLabels = useMemo(
    () => [
      {
        key: "orderbook",
        label: (
          <div className="flex relative group items-center gap-2">
            <Scroll className="w-5 fill-current" />
            <div className="orderbook-tab-selector self-center text-sm font-medium">Order Book</div>
          </div>
        ),
      },
      {
        key: "amm",
        label: (
          <div className="amm-tab-selector flex relative group items-center gap-2">
            <Swap className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">AMM</div>
          </div>
        ),
      },
      {
        key: "history",
        label: (
          <div className="flex relative group items-center gap-2">
            <Sparkles className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">History</div>
          </div>
        ),
      },
      {
        key: "realmProduction",
        label: (
          <div className="realm-production-tab-selector flex relative group items-center gap-2">
            <Crown className="w-5 fill-current" />
            <div className="self-center text-sm font-medium">Realm Production</div>
          </div>
        ),
      },
    ],
    [],
  );

  const tabLabels = useUnifiedTrade ? unifiedTabLabels : legacyTabLabels;

  return (
    <div className="market-modal-selector container border mx-auto grid grid-cols-12  border-gold/30 h-full row-span-12 rounded-2xl relative panel-wood">
      <div className="col-span-3 row-span-10 overflow-y-auto border-r border-gold/10">
        <div className="market-realm-selector p-3 border-b border-gold/10">
          <Select
            value={structureEntityId.toString()}
            onValueChange={(trait) => {
              setStructureEntityId(ID(trait));
            }}
          >
            <SelectTrigger className="w-full panel-wood-right">
              <SelectValue placeholder="Select Structure" />
            </SelectTrigger>
            <SelectContent>
              {playerStructures.map((structure, index) => (
                <SelectItem key={index} value={structure.entityId.toString()}>
                  {mode.structure.getName(structure.structure).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 mt-2 text-sm text-gold/70">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="sm" />
            <span>{currencyFormat(Number(structureLordsBalance), 2)} Lords</span>
          </div>
        </div>
        <Suspense fallback={<LoadingAnimation />}>
          <MarketResourceSidebar
            entityId={structureEntityId}
            search={resourceSearch}
            onClick={(value) => setSelectedResource(value)}
            selectedResource={selectedResource}
            resourceAskOffers={askOffers}
            resourceBidOffers={bidOffers}
          />
        </Suspense>
      </div>
      <div className="col-span-9 h-full row-span-10 overflow-y-auto text-xl px-2">
        <Suspense fallback={null}>
          <TransportCapacityBar entityId={structureEntityId} resourceId={selectedResource} />
        </Suspense>
        <Tabs size="large" selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)}>
          <Tabs.List className="flex w-full mt-4">
            {tabLabels.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panels className="overflow-hidden h-full">
            {useUnifiedTrade ? (
              <>
                <Tabs.Panel className="h-full">
                  {selectedTab === 0 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <UnifiedTradePanel
                        resourceId={selectedResource}
                        entityId={structureEntityId}
                        askOffers={askOffers}
                        bidOffers={bidOffers}
                      />
                    </Suspense>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className="h-full">
                  {selectedTab === 1 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <MarketTradingHistory />
                    </Suspense>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className="h-full">
                  {selectedTab === 2 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <RealmProduction />
                    </Suspense>
                  )}
                </Tabs.Panel>
              </>
            ) : (
              <>
                <Tabs.Panel className="h-full">
                  {selectedTab === 0 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <MarketOrderPanel
                        resourceId={selectedResource}
                        entityId={structureEntityId}
                        resourceAskOffers={askOffers}
                        resourceBidOffers={bidOffers}
                      />
                    </Suspense>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className="h-full">
                  {selectedTab === 1 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <BankPanel structureEntityId={structureEntityId} selectedResource={selectedResource} />
                    </Suspense>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className="h-full">
                  {selectedTab === 2 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <MarketTradingHistory />
                    </Suspense>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className="h-full">
                  {selectedTab === 3 && (
                    <Suspense fallback={<LoadingAnimation />}>
                      <RealmProduction />
                    </Suspense>
                  )}
                </Tabs.Panel>
              </>
            )}
          </Tabs.Panels>
        </Tabs>
      <Suspense fallback={null}>
        <TradeSummaryBar bidOffers={bidOffers} askOffers={askOffers} entityId={structureEntityId} />
      </Suspense>
      </div>
    </div>
  );
};
