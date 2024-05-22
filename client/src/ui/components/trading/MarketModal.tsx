import { MarketInterface, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { ModalContainer } from "../ModalContainer";
import { useMemo, useState } from "react";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { useEntities } from "@/hooks/helpers/useEntities";
import useRealmStore from "@/hooks/store/useRealmStore";
import useMarketStore from "@/hooks/store/useMarketStore";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import Button from "@/ui/elements/Button";
import { TransferBetweenEntities } from "./TransferBetweenEntities";

export const MarketModal = () => {
  const { playerRealms } = useEntities();

  //   TODO: This changes the realm, but if they are on hexception it doesn't change the location, so it's a bit confusing
  const { realmEntityId, setRealmEntityId } = useRealmStore();

  const selectedResource = useMarketStore((state) => state.selectedResource);
  const setSelectedResource = useMarketStore((state) => state.setSelectedResource);

  const marketOffers = useMarketStore((state) => state.lordsMarket);
  const myOffers = useGetMyOffers();

  const bidOffers = useMemo(() => {
    if (!marketOffers) return [];

    return [...marketOffers, ...myOffers].filter(
      (offer) => offer.takerGets.length === 1 && offer.takerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [marketOffers, myOffers]);

  const askOffers = useMemo(() => {
    if (!marketOffers) return [];

    return [...marketOffers, ...myOffers].filter(
      (offer) => offer.takerGets.length === 1 && offer.makerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [marketOffers, myOffers]);

  const [panel, setPanel] = useState<"market" | "transfer">("market");

  return (
    <ModalContainer>
      <div className="container border mx-auto  grid grid-cols-12 my-8 bg-brown/90 border-gold/30 clip-angled overflow-y-scroll">
        <div className="col-span-12 border-b p-2 flex justify-between">
          <div className="self-center">
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
          <div className="self-center flex gap-4">
            <Button onClick={() => setPanel("market")} variant={panel == "market" ? "primary" : "default"}>
              Market
            </Button>
            <Button onClick={() => setPanel("transfer")} variant={panel == "transfer" ? "primary" : "default"}>
              Transfers
            </Button>
          </div>
        </div>

        <div className="col-span-3 p-1">
          {/* <TextInput value="Search Resource" onChange={() => console.log("s")} /> */}
          <MarketResourceSidebar
            entityId={realmEntityId}
            search={""}
            onClick={(value) => setSelectedResource(value)}
            selectedResource={selectedResource}
            resourceAskOffers={askOffers}
            resourceBidOffers={bidOffers}
          />
        </div>
        <div className="col-span-9">
          {panel === "market" ? (
            <MarketOrderPanel
              resourceId={selectedResource}
              entityId={realmEntityId}
              resourceAskOffers={askOffers}
              resourceBidOffers={bidOffers}
            />
          ) : (
            <TransferView />
          )}
        </div>
      </div>
    </ModalContainer>
  );
};

export const MarketResourceSidebar = ({
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
    <div className="flex flex-col">
      {filteredResources.map((resource) => {
        const askPrice = resourceBidOffers
          .filter((offer) => (resource.id ? offer.makerGets[0]?.resourceId === resource.id : true))
          .reduce((acc, offer) => (offer.ratio < acc ? offer.ratio : acc), Infinity);

        const bidPrice = resourceAskOffers
          .filter((offer) => offer.takerGets[0].resourceId === resource.id)
          .reduce((acc, offer) => (offer.ratio < acc ? offer.ratio : acc), Infinity);

        return (
          <MarketResource
            key={resource.id}
            entityId={entityId || BigInt("0")}
            resource={resource}
            active={selectedResource == resource.id}
            onClick={onClick}
            askPrice={askPrice === Infinity ? "0" : askPrice.toFixed(2)}
            bidPrice={bidPrice === Infinity ? "0" : bidPrice.toFixed(2)}
          />
        );
      })}
    </div>
  );
};

export const TransferView = () => {
  const { playerRealms, playerAccounts, playerStructures, otherRealms } = useEntities();
  return (
    <TransferBetweenEntities
      entitiesList={[
        { entities: playerRealms(), name: "Player Realms" },
        { entities: playerAccounts(), name: "Player Bank Accounts" },
        {
          entities: playerStructures().filter((structure) => structure.category === "ShardsMine"),
          name: "Player Shards Mines",
        },
        { entities: otherRealms(), name: "Other Realms" },
      ]}
    />
  );
};
