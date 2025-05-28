import { ReactComponent as Coins } from "@/assets/icons/coins.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/swap.svg";
import { useSyncMarket } from "@/hooks/helpers/use-sync";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Tabs } from "@/ui/elements/tab";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getStructureName } from "@bibliothecadao/eternum";
import { useMarket, useResourceManager } from "@bibliothecadao/react";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import { lazy, Suspense, useMemo, useState } from "react";
import { MarketHeader } from "./market-header";

const MarketResourceSidebar = lazy(() =>
  import("@/ui/components/trading/market-resource-sidebar").then((module) => ({
    default: module.MarketResourceSidebar,
  })),
);

const MarketOrderPanel = lazy(() =>
  import("./market-order-panel").then((module) => ({ default: module.MarketOrderPanel })),
);

const BankPanel = lazy(() =>
  import("@/ui/components/bank/bank-list").then((module) => ({ default: module.BankPanel })),
);

const MarketTradingHistory = lazy(() =>
  import("@/ui/components/trading/market-trading-history").then((module) => ({ default: module.MarketTradingHistory })),
);

const RealmProduction = lazy(() =>
  import("@/ui/components/trading/realm-production").then((module) => ({ default: module.RealmProduction })),
);

const TransferView = lazy(() =>
  import("@/ui/components/trading/transfer-view").then((module) => ({ default: module.TransferView })),
);

export const MarketModal = () => {
  const { isSyncing } = useSyncMarket();

  return <ModalContainer>{isSyncing ? <LoadingAnimation /> : <MarketContent />}</ModalContainer>;
};

export const MarketContent = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structureResourceManager = useResourceManager(structureEntityId);

  const structureLordsBalance = useMemo(
    () =>
      structureResourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, ResourcesIds.Lords)
        .balance,
    [structureResourceManager],
  );

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group items-center gap-2">
            <Scroll className="w-6 fill-current" />
            <div className="orderbook-tab-selector self-center">Order Book</div>
          </div>
        ),
        component: (
          <Suspense fallback={<LoadingAnimation />}>
            <MarketOrderPanel
              resourceId={selectedResource}
              entityId={structureEntityId}
              resourceAskOffers={askOffers}
              resourceBidOffers={bidOffers}
            />
          </Suspense>
        ),
      },
      {
        key: "all",
        label: (
          <div className="amm-tab-selector flex relative group items-center gap-2">
            <Swap className="w-6 fill-current" />
            <div className="self-center">AMM</div>
          </div>
        ),
        component: (
          <Suspense fallback={<LoadingAnimation />}>
            <BankPanel structureEntityId={structureEntityId} selectedResource={selectedResource} />
          </Suspense>
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group items-center gap-2">
            <Sparkles className="w-6 fill-current" />
            <div className="self-center">History</div>
          </div>
        ),
        component: (
          <Suspense fallback={<LoadingAnimation />}>
            <MarketTradingHistory />
          </Suspense>
        ),
      },
      {
        key: "all",
        label: (
          <div className="transfer-tab-selector flex relative group items-center gap-2">
            <Coins className="w-6 fill-current" />
            <div className="self-center">Transfer</div>
          </div>
        ),
        component: (
          <Suspense fallback={<LoadingAnimation />}>
            <TransferView />
          </Suspense>
        ),
      },
      {
        key: "resourceProd",
        label: (
          <div className="realm-production-tab-selector flex relative group items-center gap-2">
            <Crown className="w-6 fill-current" />
            <div className="self-center">Realm Production</div>
          </div>
        ),
        component: (
          <Suspense fallback={<LoadingAnimation />}>
            <RealmProduction />
          </Suspense>
        ),
      },
    ],
    [selectedResource, structureEntityId, askOffers, bidOffers],
  );

  return (
    <div className="market-modal-selector container border mx-auto grid grid-cols-12  border-gold/30 h-full row-span-12 rounded-2xl relative panel-wood">
      <div className="col-span-3 row-span-10 overflow-y-auto ">
        <div className="market-realm-selector self-center text-xl justify-between flex gap-2 items-center   rounded-xl w-full ">
          <div className="">
            <Select
              value={structureEntityId.toString()}
              onValueChange={(trait) => {
                setStructureEntityId(ID(trait));
              }}
            >
              <SelectTrigger className="w-[180px] panel-wood-right">
                <SelectValue placeholder="Select Structure" />
              </SelectTrigger>
              <SelectContent>
                {playerStructures.map((structure, index) => (
                  <SelectItem key={index} value={structure.entityId.toString()}>
                    {getStructureName(structure.structure).name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-2 bg-map align-middle flex gap-2">
            {currencyFormat(Number(structureLordsBalance), 2)}{" "}
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="lg" />
          </div>
        </div>
        <Suspense fallback={<LoadingAnimation />}>
          <MarketResourceSidebar
            entityId={structureEntityId}
            search={""}
            onClick={(value) => setSelectedResource(value)}
            selectedResource={selectedResource}
            resourceAskOffers={askOffers}
            resourceBidOffers={bidOffers}
          />
        </Suspense>
      </div>
      <div className="col-span-9 h-full row-span-10 overflow-y-auto text-xl">
        <MarketHeader />
        <Tabs size="large" selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)}>
          <Tabs.List className="flex w-full mt-4">
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panels className="overflow-hidden h-full">
            {tabs.map((tab, index) => (
              <Tabs.Panel className="h-full" key={index}>
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </div>
    </div>
  );
};
