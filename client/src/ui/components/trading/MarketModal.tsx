import { useGetBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useSetMarket } from "@/hooks/helpers/useTrade";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import CircleButton from "@/ui/elements/CircleButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import { currencyFormat } from "@/ui/utils/utils";
import { ID, MarketInterface, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { BankPanel } from "../bank/BankList";
import { HintModal } from "../hints/HintModal";
import { ModalContainer } from "../ModalContainer";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";
import { MarketTradingHistory } from "./MarketTradingHistory";
import { TransferBetweenEntities } from "./TransferBetweenEntities";

export const MarketModal = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerStructures } = useEntities();

  const { toggleModal } = useModalStore();

  const banks = useGetBanks();
  const bank = banks.length === 1 ? banks[0] : null;

  const { bidOffers, askOffers } = useSetMarket();
  const { useBalance } = getResourceBalance();

  // initial entity id
  const selectedEntityId = useUIStore((state) => state.structureEntityId);
  const [structureEntityId, setStructureEntityId] = useState<ID>(selectedEntityId);

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const structures = useMemo(() => playerStructures(), [playerStructures]);

  const lordsBalance = useBalance(structureEntityId, ResourcesIds.Lords).amount;

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
        component: <MarketTradingHistory structureEntityId={structureEntityId} />,
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
              {currencyFormat(lordsBalance, 0)} <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="lg" />
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
  search,
  onClick,
  selectedResource,
  resourceAskOffers,
  resourceBidOffers,
}: {
  entityId: ID;
  search: string;
  onClick: (value: number) => void;
  selectedResource: number;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
}) => {
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
          <div className="flex items-center justify-center">Sell</div>
          <div className="flex items-center justify-center">Buy</div>
          <div className="flex items-center justify-center">Qty</div>
        </div>
      </div>

      <div className="flex flex-col h-full gap-[0.1]">
        {filteredResources
          .filter((resource) => resource.id !== ResourcesIds.Lords)
          .map((resource) => {
            const askPrice = resourceBidOffers
              .filter((offer) => (resource.id ? offer.makerGets[0]?.resourceId === resource.id : true))
              .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

            const bidPrice = resourceAskOffers
              .filter((offer) => offer.takerGets[0].resourceId === resource.id)
              .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

            const depth =
              resourceBidOffers.filter((offer) => offer.makerGets[0].resourceId === resource.id).length +
              resourceAskOffers.filter((offer) => offer.takerGets[0].resourceId === resource.id).length;

            return (
              <MarketResource
                key={resource.id}
                entityId={entityId || 0}
                resource={resource}
                active={selectedResource == resource.id}
                onClick={onClick}
                askPrice={askPrice === Infinity ? "0" : askPrice.toFixed(2)}
                bidPrice={bidPrice === Infinity ? "0" : bidPrice.toFixed(2)}
                depth={depth}
              />
            );
          })}
      </div>
    </div>
  );
};

const TransferView = () => {
  const { playerRealms, playerStructures, otherRealms } = useEntities();

  return (
    <TransferBetweenEntities
      entitiesList={[
        { entities: playerRealms(), name: "Player Realms" },
        {
          entities: playerStructures().filter((structure) => structure.category === "Hyperstructure"),
          name: "Player Hyperstructures",
        },
        {
          entities: playerStructures().filter((structure) => structure.category === "FragmentMine"),
          name: "Player Fragment Mines",
        },
        { entities: otherRealms(), name: "Other Realms" },
      ]}
    />
  );
};
