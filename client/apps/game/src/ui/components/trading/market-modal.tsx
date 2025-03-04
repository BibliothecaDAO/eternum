import { ReactComponent as Coins } from "@/assets/icons/coins.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/swap.svg";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { useModalStore } from "@/hooks/store/use-modal-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintModal } from "@/ui/components/hints/hint-modal";
import { ModalContainer } from "@/ui/components/modal-container";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/circle-button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Tabs } from "@/ui/elements/tab";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ID,
  ResourcesIds
} from "@bibliothecadao/eternum";
import { useDojo, useMarket, usePlayerStructures, useResourceManager } from "@bibliothecadao/react";
import { Suspense, lazy, useMemo, useState } from "react";

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
  const dojo = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);

  const playerStructures = usePlayerStructures();
  const { toggleModal } = useModalStore();

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  console.log({ bidOffers, askOffers });


  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structureResourceManager = useResourceManager(structureEntityId);

  const structureLordsBalance = useMemo(
    () => Number(structureResourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, ResourcesIds.Lords)),
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
            <BankPanel
              structureEntityId={structureEntityId}
              selectedResource={selectedResource}
            />
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
    <ModalContainer>
      <div className="market-modal-selector container border mx-auto grid grid-cols-12 bg-dark border-gold/30 h-full row-span-12 rounded-2xl relative">
        <div className="col-span-3 p-1 row-span-10 overflow-y-auto ">
          <div className="market-realm-selector self-center text-xl justify-between flex gap-2 items-center bg-brown p-4 rounded-xl w-full mb-4">
            <div className="">
              <Select
                value={structureEntityId.toString()}
                onValueChange={(trait) => {
                  setStructureEntityId(ID(trait));
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent>
                  {playerStructures.map((structure, index) => (
                    <SelectItem key={index} value={structure.entityId.toString()}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=" ml-2 bg-map align-middle flex gap-2">
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
          <div className="grid grid-cols-3 p-3 flex-wrap justify-between items-start gap-6 mb-8 rounded-xl shadow-lg border border-gold/20 relative">
            <div className="self-center flex-grow max-w-2xl mx-auto">
              <h3 className="text-5xl font-extrabold mb-1">The Lords Market</h3>
              <div className="flex flex-row">
                <p className="text-xs">
                  Engage in direct player-to-player trades through the orderbook, leverage the AMM for bank liquidity
                  trades, or boost your earnings by providing liquidity to the bank.
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4">
              <CircleButton
                onClick={() => {
                  toggleModal(null);
                  toggleModal(<HintModal initialActiveSection={"Trading"} />);
                }}
                size={"lg"}
                image={BuildingThumbs.question}
                className="hover:bg-gold/20 transition-colors duration-200"
              />
            </div>

            <div className="bank-combat-selector bg-brown border border-gold/30 p-3 rounded-xl text-sm shadow-lg h-full flex flex-col">
              <div>
                <h3 className="text-xl font-bold">AMM Status</h3>
                <div className="space-y-3 flex-grow">
                  <div className="flex items-center text-green mb-2 font-medium">
                    <span className="mr-2">✓</span> No combat on Bank, AMM available
                  </div>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-bold mt-2">Bank Defence</h3>
          </div>
          <Tabs size="large" selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)}>
            <Tabs.List className=" flex w-full">
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
    </ModalContainer>
  );
};
