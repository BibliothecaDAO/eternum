import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useSetMarket } from "@/hooks/helpers/useTrade";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ID, MarketInterface, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";
import { ModalContainer } from "../ModalContainer";
import { BankPanel } from "../bank/BankList";
import { HintModal } from "../hints/HintModal";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";
import { MarketTradingHistory } from "./MarketTradingHistory";
import { RealmProduction } from "./RealmProduction";
import { TransferView } from "./TransferView";

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
          <MarketOrderPanel
            resourceId={selectedResource}
            entityId={structureEntityId}
            resourceAskOffers={askOffers}
            resourceBidOffers={bidOffers}
          />
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>AMM</div>
          </div>
        ),
        component: bank && <BankPanel bankEntityId={bank.entityId} structureEntityId={structureEntityId} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>History</div>
          </div>
        ),
        component: <MarketTradingHistory />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Transfer</div>
          </div>
        ),
        component: <TransferView />,
      },
      {
        key: "resourceProd",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Realm Production</div>
          </div>
        ),
        component: <RealmProduction />,
      },
    ],
    [selectedResource, structureEntityId, askOffers, bidOffers],
  );

  return (
    <ModalContainer>
      <div className="container border mx-auto  grid grid-cols-12 bg-black/90 bg-hex-bg border-gold/30  h-full row-span-12 ">
        <div className="col-span-12  p-2 flex justify-between row-span-2">
          <div className="self-center text-xl flex gap-2 items-center">
            <div className="bg-black">
              <Select
                value={structureEntityId.toString()}
                onValueChange={(trait) => {
                  setStructureEntityId(ID(trait));
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent className="bg-black bg-hex-bg">
                  {structures.map((structure, index) => (
                    <SelectItem key={index} value={structure.entity_id.toString()}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=" ml-2 bg-map align-middle flex">
              {currencyFormat(Number(lordsBalance), 0)}{" "}
              <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="lg" />
            </div>
          </div>
          <div className="self-center text-3xl">
            <h2 className="text-center">The Lords Market</h2>
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

        <div className="col-span-3 p-1 row-span-10 overflow-y-auto ">
          <MarketResourceSidebar
            entityId={structureEntityId}
            bankEntityId={bank?.entityId}
            search={""}
            onClick={(value) => setSelectedResource(value)}
            selectedResource={selectedResource}
            resourceAskOffers={askOffers}
            resourceBidOffers={bidOffers}
          />
        </div>
        <div className="col-span-9 h-full row-span-10 overflow-y-auto text-xl">
          <Tabs
            size="large"
            selectedIndex={selectedTab}
            onChange={(index: any) => setSelectedTab(index)}
            className="h-full"
          >
            <div className="">
              <Tabs.List>
                {tabs.map((tab, index) => (
                  <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                ))}
              </Tabs.List>
            </div>

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

const MarketResourceSidebar = ({
  entityId,
  bankEntityId,
  search,
  onClick,
  selectedResource,
  resourceAskOffers,
  resourceBidOffers,
}: {
  entityId: ID;
  bankEntityId: ID | undefined;
  search: string;
  onClick: (value: number) => void;
  selectedResource: number;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
}) => {
  const { setup } = useDojo();

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      return resource.trait.toLowerCase().includes(search.toLowerCase());
    });
  }, []);

  return (
    <div className=" px-1 ">
      <div className="w-full mb-1">
        <div className="grid grid-cols-5 text-xs font-bold uppercase">
          <div className="col-span-2"></div>
          <div className="flex items-center justify-center">Buy</div>
          <div className="flex items-center justify-center">Sell</div>
          <div className="flex items-center justify-center">AMM</div>
        </div>
      </div>

      <div className="flex flex-col h-full gap-[0.1]">
        {filteredResources
          .filter((resource) => resource.id !== ResourcesIds.Lords)
          .map((resource) => {
            const marketManager = bankEntityId ? new MarketManager(setup, bankEntityId, 0n, resource.id) : undefined;

            const askPrice = resourceBidOffers
              .filter((offer) => (resource.id ? offer.makerGets[0]?.resourceId === resource.id : true))
              .reduce((acc, offer) => (offer.perLords > acc ? offer.perLords : acc), 0);

            const bidPrice = resourceAskOffers
              .filter((offer) => offer.takerGets[0].resourceId === resource.id)
              .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

            const ammPrice = marketManager?.getMarketPrice() || 0;

            return (
              <MarketResource
                key={resource.id}
                entityId={entityId || 0}
                resource={resource}
                active={selectedResource == resource.id}
                onClick={onClick}
                askPrice={askPrice === Infinity ? "0" : askPrice.toFixed(2)}
                bidPrice={bidPrice === Infinity ? "0" : bidPrice.toFixed(2)}
                ammPrice={ammPrice}
              />
            );
          })}
      </div>
    </div>
  );
};
