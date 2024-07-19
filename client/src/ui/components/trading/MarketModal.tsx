import { useEntities } from "@/hooks/helpers/useEntities";
import { useSetMarket } from "@/hooks/helpers/useTrade";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useModal } from "@/hooks/store/useModal";
import useRealmStore from "@/hooks/store/useRealmStore";
import CircleButton from "@/ui/elements/CircleButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import { MarketInterface, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { BankPanel } from "../bank/BankList";
import { HintModal } from "../hints/HintModal";
import { ModalContainer } from "../ModalContainer";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";
import { MarketTradingHistory } from "./MarketTradingHistory";
import { useGetBanks } from "@/hooks/helpers/useBanks";
import { TransferBetweenEntities } from "./TransferBetweenEntities";

export const MarketModal = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerRealms } = useEntities();

  const { toggleModal } = useModal();

  const banks = useGetBanks();
  const bank = banks.length === 1 ? banks[0] : null;

  const { bidOffers, askOffers } = useSetMarket();

  //   TODO: This changes the realm, but if they are on hexception it doesn't change the location, so it's a bit confusing
  const { realmEntityId, setRealmEntityId } = useRealmStore();

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

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
            entityId={realmEntityId}
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
        component: bank && <BankPanel entity={{ id: bank.entityId }} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>History</div>
          </div>
        ),
        component: <MarketTradingHistory realmEntityId={realmEntityId} />,
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
    [selectedResource, realmEntityId, askOffers, bidOffers],
  );

  return (
    <ModalContainer>
      <div className="container border mx-auto  grid grid-cols-12 bg-brown border-gold/30 clip-angled h-full row-span-12 ">
        <div className="col-span-12  p-2 flex justify-between row-span-2">
          <div className="self-center text-xl">
            <Select value={realmEntityId.toString()} onValueChange={(trait) => setRealmEntityId(BigInt(trait))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Realm" />
              </SelectTrigger>
              <SelectContent className="bg-brown ">
                {playerRealms().map((realm, index) => (
                  <SelectItem key={index} value={realm.entity_id?.toString() || ""}>
                    {realm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            entityId={realmEntityId}
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
  entityId: bigint;
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
                entityId={entityId || BigInt("0")}
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
