import { ReactComponent as Coins } from "@/assets/icons/coins.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/swap.svg";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { useModalStore } from "@/hooks/store/use-modal-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintModal } from "@/ui/components/hints/hint-modal";
import { TroopChip } from "@/ui/components/military/troop-chip";
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
  ContractAddress,
  ID,
  ResourcesIds,
  configManager,
  getArmy,
  getStructureAtPosition,
} from "@bibliothecadao/eternum";
import { useBank, useDojo, useMarket, usePlayerStructures, useResourceManager } from "@bibliothecadao/react";
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
  const bank = useBank();

  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const { bidOffers, askOffers } = useMarket(currentBlockTimestamp);

  console.log({ bidOffers, askOffers });


  const bankStructure = useMemo(
    () =>
      getStructureAtPosition(
        bank?.position || { x: 0, y: 0 },
        ContractAddress(dojo.account.account.address),
        dojo.setup.components,
      ),
    [bank?.position, dojo.account.account.address, dojo.setup.components],
  );

  // initial entity id
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structureResourceManager = useResourceManager(structureEntityId);
  const bankResourceManager = useResourceManager(bank?.entityId || 0);

  const structureLordsBalance = useMemo(
    () => Number(structureResourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, ResourcesIds.Lords)),
    [structureResourceManager],
  );
  const bankLordsBalance = useMemo(
    () => Number(bankResourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, ResourcesIds.Lords)),
    [bankResourceManager],
  );

  const bankArmy = useMemo(
    () =>
      getArmy(
        bankStructure?.protectors[0]?.entityId || 0,
        ContractAddress(dojo.account.account.address),
        dojo.setup.components,
      ),
    [bankStructure, dojo.account.account.address, dojo.setup.components],
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
        component: bank && (
          <Suspense fallback={<LoadingAnimation />}>
            <BankPanel
              bankEntityId={bank.entityId}
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
              bankEntityId={bank?.entityId}
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
            <div className="trade-bank-selector bg-brown p-3 rounded-xl text-sm shadow-lg border border-gold/30 h-full flex flex-col">
              <h3 className="text-xl font-bold mb-4">Bank Information</h3>
              <div className="space-y-1 flex-grow">
                <div className="flex justify-between items-center">
                  <span className="">Current Bank Owner:</span>
                  <span className="font-bold px-4 py-1 ">{bank?.owner}</span>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="">Bank Owner Fees:</span>
                    <span className="font-bold px-4">{(bank?.ownerFee || 0) * 100}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="">Bank LP Fees:</span>
                    <span className="font-bold px-4">{configManager.getBankConfig().lpFeesNumerator}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Bank Reserves:</span>
                  <span className="font-bold px-4 py-1">
                    <div className="flex items-center">
                      <ResourceIcon className={"mt-0.5"} resource={ResourcesIds[ResourcesIds.Lords]} size="sm" />
                      {currencyFormat(Number(bankLordsBalance), 0)}
                    </div>
                  </span>
                </div>
              </div>
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
            <div className="flex-grow">
              <div className="flex items-center text-green">{bankArmy && <TroopChip troops={bankArmy.troops} />}</div>
            </div>
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
