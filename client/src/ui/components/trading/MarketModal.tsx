import { ReactComponent as Coins } from "@/assets/icons/Coins.svg";
import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/Scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/Sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/Swap.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { useGetBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useStructureByPosition } from "@/hooks/helpers/useStructures";
import { useSetMarket } from "@/hooks/helpers/useTrade";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useWorldStore } from "@/hooks/store/useWorldLoading";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { LoadingAnimation } from "@/ui/elements/LoadingAnimation";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { formatTimeDifference } from "@/ui/modules/military/battle-view/BattleProgress";
import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { Suspense, lazy, useMemo, useState } from "react";
import { ModalContainer } from "../ModalContainer";
import { HintModal } from "../hints/HintModal";
import { TroopDisplay } from "../military/TroopChip";

const MarketResourceSidebar = lazy(() =>
  import("./MarketResourceSideBar").then((module) => ({ default: module.MarketResourceSidebar })),
);

const MarketOrderPanel = lazy(() =>
  import("./MarketOrderPanel").then((module) => ({ default: module.MarketOrderPanel })),
);

const BankPanel = lazy(() => import("../bank/BankList").then((module) => ({ default: module.BankPanel })));

const MarketTradingHistory = lazy(() =>
  import("./MarketTradingHistory").then((module) => ({ default: module.MarketTradingHistory })),
);

const RealmProduction = lazy(() => import("./RealmProduction").then((module) => ({ default: module.RealmProduction })));

const TransferView = lazy(() => import("./TransferView").then((module) => ({ default: module.TransferView })));

export const MarketModal = () => {
  const dojo = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerStructures } = useEntities();
  const { toggleModal } = useModalStore();
  const banks = useGetBanks();
  const { bidOffers, askOffers } = useSetMarket();

  const bank = banks.length === 1 ? banks[0] : null;
  const battles = useBattlesByPosition(bank?.position || { x: 0, y: 0 });

  const isMarketLoading = useWorldStore((state) => state.isMarketLoading);

  const currentBlockTimestamp = useUIStore.getState().nextBlockTimestamp || 0;

  const getStructure = useStructureByPosition();
  const bankStructure = getStructure(bank?.position || { x: 0, y: 0 });

  const battle = useMemo(() => {
    if (battles.length === 0) return null;
    return battles
      .filter((battle) => battle.isStructureBattle)
      .sort((a, b) => Number(a.last_updated || 0) - Number(b.last_updated || 0))[0];
  }, [battles]);

  const battleManager = useMemo(() => new BattleManager(battle?.entity_id || 0, dojo), [battle?.entity_id, dojo]);

  // initial entity id
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structures = playerStructures();

  const [isSiegeOngoing, isBattleOngoing] = useMemo(() => {
    const isSiegeOngoing = battleManager.isSiege(currentBlockTimestamp);
    const isBattleOngoing = battleManager.isBattleOngoing(currentBlockTimestamp);
    return [isSiegeOngoing, isBattleOngoing];
  }, [battleManager, currentBlockTimestamp]);

  const lordsBalance =
    useComponentValue(
      dojo.setup.components.Resource,
      getEntityIdFromKeys([BigInt(structureEntityId!), BigInt(ResourcesIds.Lords)]),
    )?.balance || 0n;

  const bankLordsBalance =
    useComponentValue(
      dojo.setup.components.Resource,
      getEntityIdFromKeys([BigInt(bank?.entityId!), BigInt(ResourcesIds.Lords)]),
    )?.balance || 0n;

  const bankArmy = useArmyByArmyEntityId(bankStructure?.protector?.entity_id || 0);

  // get updated army for when a battle starts: we need to have the updated component to have the correct battle_id
  const armyInfo = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(currentBlockTimestamp);
    return battleManager.getUpdatedArmy(bankArmy, updatedBattle);
  }, [currentBlockTimestamp, battleManager, bankArmy]);

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
                  {structures.map((structure, index) => (
                    <SelectItem key={index} value={structure.entity_id.toString()}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=" ml-2 bg-map align-middle flex gap-2">
              {currencyFormat(Number(lordsBalance), 0)}{" "}
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
                {!isBattleOngoing && !isSiegeOngoing && (
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center text-green mb-2 font-medium">
                      <span className="mr-2">✓</span> No combat on Bank, AMM available
                    </div>
                  </div>
                )}
                {isSiegeOngoing && (
                  <div className="flex items-center text-yellow mb-2">
                    <span className="mr-2">⚠</span> Bank siege has started,{" "}
                    {formatTimeDifference(battleManager.getSiegeTimeLeft(currentBlockTimestamp))} remaining to swap in
                    AMM
                  </div>
                )}
                {!isSiegeOngoing && isBattleOngoing && (
                  <div className="flex items-center text-red">
                    <span className="mr-2">⚠</span> Bank combat has started, AMM blocked for{" "}
                    {formatTimeDifference(battleManager.getTimeLeft(currentBlockTimestamp) || new Date(0))} remaining
                  </div>
                )}
              </div>
              {armyInfo && (
                <div>
                  <h3 className="text-xl font-bold mt-2">Bank Defence</h3>
                  <div className="flex-grow">
                    <div className="flex items-center text-green">
                      <TroopDisplay troops={armyInfo.troops} />
                    </div>
                  </div>
                </div>
              )}
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
      {isMarketLoading && (
        <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-brown/90 text-sm px-4 py-1 rounded-t-lg border border-gold/30 flex items-center gap-2">
            <div className="w-2 h-2 bg-gold/50 rounded-full animate-pulse" />
            <span>Syncing market data...</span>
          </div>
        </div>
      )}
    </ModalContainer>
  );
};
