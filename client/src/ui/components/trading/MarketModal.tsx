import { useDojo } from "@/hooks/context/DojoContext";
import { useGetBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useSetMarket } from "@/hooks/helpers/useTrade";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { LoadingAnimation } from "@/ui/elements/LoadingAnimation";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { Suspense, lazy, useMemo, useState } from "react";
import { ModalContainer } from "../ModalContainer";
import { HintModal } from "../hints/HintModal";

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
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerStructures } = useEntities();

  const { toggleModal } = useModalStore();

  const banks = useGetBanks();

  const bank = banks.length === 1 ? banks[0] : null;

  const { bidOffers, askOffers } = useSetMarket();

  // initial entity id
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structures = playerStructures();

  const lordsBalance =
    useComponentValue(Resource, getEntityIdFromKeys([BigInt(structureEntityId!), BigInt(ResourcesIds.Lords)]))
      ?.balance || 0n;

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Order Book</div>
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
          <div className="flex relative group flex-col items-center">
            <div>AMM</div>
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
          <div className="flex relative group flex-col items-center">
            <div>History</div>
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
          <div className="flex relative group flex-col items-center">
            <div>Transfer</div>
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
          <div className="flex relative group flex-col items-center">
            <div>Realm Production</div>
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
      <div className="container border mx-auto  grid grid-cols-12 bg-dark border-gold/30  h-full row-span-12 rounded-2xl ">
        <div className="col-span-3 p-1 row-span-10 overflow-y-auto ">
          <div className="self-center text-xl justify-between flex gap-2 items-center bg-brown p-4 rounded-xl w-full mb-4">
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
          <div className="col-span-12  p-2 flex justify-between row-span-2 gap-4 my-4 px-8">
            <div className="self-center text-3xl ">
              <h1 className="text-center">The Lords Market</h1>
            </div>
            <div className="self-center flex gap-4">
              <CircleButton
                onClick={() => {
                  toggleModal(null);
                  toggleModal(<HintModal initialActiveSection={"Trading"} />);
                }}
                size={"sm"}
                image={BuildingThumbs.question}
              />
            </div>
          </div>
          <Tabs
            size="large"
            selectedIndex={selectedTab}
            onChange={(index: any) => setSelectedTab(index)}
            className="h-full"
          >
            <Tabs.List className=" flex w-full">
              {tabs.map((tab, index) => (
                <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
              ))}
            </Tabs.List>

            <Tabs.Panels className="overflow-hidden">
              {tabs.map((tab, index) => (
                <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
              ))}
            </Tabs.Panels>
          </Tabs>
        </div>
      </div>
    </ModalContainer>
  );
};
