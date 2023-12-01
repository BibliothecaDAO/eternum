import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import TextInput from "../../../../../elements/TextInput";
import Button from "../../../../../elements/Button";
import { CreateOfferPopup } from "../CreateOffer";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourcesIds, findResourceById, orderNameDict, resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { MarketInterface, useGetMarket } from "../../../../../hooks/helpers/useTrade";
import { Tabs } from "../../../../../elements/tab";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import * as realmsData from "../../../../../geodata/realms.json";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { AcceptOfferPopup } from "../AcceptOffer";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { divideByPrecision } from "../../../../../utils/utils";

type MarketPopupProps = {
  onClose: () => void;
};

interface ResourceOffersSummary {
  resourceId: number;
  bestPrice: number;
  totalAmount: number;
  totalOffers: number;
}
export const MarketPopup = ({ onClose }: MarketPopupProps) => {
  const [selectedResource, setSelectedResource] = useState<number>(null);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [isBuy, setIsBuy] = useState(false);

  const tabs = [
    {
      key: "sell",
      label: (
        <div className="flex relative group flex-col items-center">
          <div>Sell Resources</div>
        </div>
      ),
    },
    {
      key: "Buy",
      label: (
        <div className="flex group relative flex-col items-center">
          <div>Buy Resources</div>
        </div>
      ),
    },
  ];

  const marketOffers = useGetMarket({
    selectedResources: [],
    selectedOrders: [],
    directOffers: false,
    filterOwnOffers: false,
  });

  const sellOffers = useMemo(() => {
    if (!marketOffers) return [];

    return marketOffers.filter(
      (offer) => offer.resourcesGet.length === 1 && offer.resourcesGet[0].resourceId === ResourcesIds["Shekels"],
    );
  }, [marketOffers]);

  const selectedResourceSellOffers = useMemo(() => {
    if (!sellOffers) return [];

    return sellOffers
      .filter((offer) => (selectedResource ? offer.resourcesGive[0].resourceId === selectedResource : true))
      .sort((a, b) => b.ratio - a.ratio);
  }, [sellOffers, selectedResource]);

  const sellOffersSummary = useMemo(() => {
    if (!sellOffers) return [];

    const summary: ResourceOffersSummary[] = [];

    resources.forEach((resource) => {
      if (resource.trait === "Shekels") return;

      summary.push({
        resourceId: resource.id,
        totalAmount: 0,
        totalOffers: 0,
        bestPrice: 0,
      });
    });

    sellOffers.forEach((offer) => {
      offer.resourcesGive.forEach((resource) => {
        const resourceIndex = summary.findIndex((summary) => summary.resourceId === resource.resourceId);

        if (resourceIndex >= 0) {
          summary[resourceIndex].totalAmount += resource.amount;
          summary[resourceIndex].totalOffers += 1;
          summary[resourceIndex].bestPrice = Math.max(
            summary[resourceIndex].bestPrice,
            offer.resourcesGet[0].amount / resource.amount,
          );
        } else {
          summary.push({
            resourceId: resource.resourceId,
            totalAmount: resource.amount,
            totalOffers: 1,
            bestPrice: resource.amount / offer.resourcesGet[0].amount,
          });
        }
      });
    });

    return summary;
  }, [sellOffers]);

  const buyOffers = useMemo(() => {
    if (!marketOffers) return [];

    return marketOffers.filter(
      (offer) => offer.resourcesGet.length === 1 && offer.resourcesGive[0].resourceId === ResourcesIds["Shekels"],
    );
  }, [marketOffers]);

  const selectedResourceBuyOffers = useMemo(() => {
    if (!buyOffers) return [];

    return buyOffers
      .filter((offer) => offer.resourcesGet[0].resourceId === selectedResource)
      .sort((a, b) => b.ratio - a.ratio);
  }, [buyOffers, selectedResource]);

  const buyOffersSummary = useMemo(() => {
    if (!buyOffers) return [];

    const summary: ResourceOffersSummary[] = [];

    resources.forEach((resource) => {
      if (resource.trait === "Shekels") return;

      summary.push({
        resourceId: resource.id,
        totalAmount: 0,
        totalOffers: 0,
        bestPrice: Infinity,
      });
    });

    buyOffers.forEach((offer) => {
      offer.resourcesGet.forEach((resource) => {
        const resourceIndex = summary.findIndex((summary) => summary.resourceId === resource.resourceId);

        if (resourceIndex >= 0) {
          summary[resourceIndex].totalAmount += resource.amount;
          summary[resourceIndex].totalOffers += 1;
          summary[resourceIndex].bestPrice = Math.min(
            summary[resourceIndex].bestPrice,
            offer.resourcesGive[0].amount / resource.amount,
          );
        } else {
          summary.push({
            resourceId: resource.resourceId,
            totalAmount: resource.amount,
            totalOffers: 1,
            bestPrice: resource.amount / offer.resourcesGive[0].amount,
          });
        }
      });
    });

    return summary;
  }, [buyOffers]);

  useEffect(() => {}, [buyOffers, buyOffersSummary, sellOffers, sellOffersSummary, marketOffers]);

  return (
    <>
      {showCreateOffer && <CreateOfferPopup onClose={() => setShowCreateOffer(false)} onCreate={() => {}} />}
      <SecondaryPopup name="marketplace">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Marketplace</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"520px"}>
          <Tabs
            selectedIndex={isBuy ? 1 : 0}
            onChange={(index: any) => setIsBuy(index === 1)}
            variant="default"
            className="h-full"
          >
            <Tabs.List className="!border-t-transparent">
              {tabs.map((tab, index) => (
                <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          {selectedResource ? (
            <MarketplaceResourceOffersPanel
              offers={isBuy ? selectedResourceBuyOffers : selectedResourceSellOffers}
              isBuy={isBuy}
              resourceId={selectedResource}
              onBack={() => setSelectedResource(null)}
              onCreate={() => setShowCreateOffer(true)}
            />
          ) : (
            <MarketplaceOverviewPanel
              offersSummary={isBuy ? buyOffersSummary : sellOffersSummary}
              onSelect={setSelectedResource}
              onCreate={() => setShowCreateOffer(true)}
            />
          )}
        </SecondaryPopup.Body>
      </SecondaryPopup>
    </>
  );
};

const MarketplaceOverviewPanel = ({
  onSelect,
  onCreate,
  offersSummary,
}: {
  onSelect: (resourceId: number) => void;
  onCreate: () => void;
  offersSummary: ResourceOffersSummary[];
}) => {
  const [search, setSearch] = useState<string>("");

  const sortingParams = useMemo(() => {
    return [
      { label: "Resource", sortKey: "resource", className: "w-[120px]" },
      { label: "Best price", sortKey: "price", className: "w-[100px] ml-4" },
      { label: "Available Resources", sortKey: "available", className: "ml-auto w-[150px]" },
      { label: "Offers", sortKey: "offers", className: "w-[100px]" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  // const sortedOffers = useMemo(() => sortTrades(offers, activeSort), [offers, activeSort]);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      return resource.trait.toLowerCase().includes(search.toLowerCase());
    });
  }, [search]);

  return (
    <div className="flex flex-col p-2">
      <div className="flex items-center justify-between">
        <TextInput
          className="border border-gold !w-auto !text-light-pink !w-34 !flex-grow-0"
          value={search}
          onChange={setSearch}
          placeholder="Search resource..."
        />
        <Button onClick={onCreate} variant="primary">
          + Create a new offer
        </Button>
      </div>
      <SortPanel className="mt-2 py-2 border-b-0">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>
      <div className="mt-2">
        {filteredResources.map((resource) => {
          if (resource.trait === "Shekels") return null;
          return (
            <OverviewResourceRow
              key={resource.id}
              summary={offersSummary.find((summary) => summary.resourceId === resource.id)}
              onClick={() => onSelect(resource.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const OverviewResourceRow = ({ summary, onClick }: { summary: ResourceOffersSummary; onClick: () => void }) => {
  const resource = findResourceById(summary.resourceId);

  return (
    <div className="grid rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-1 grid-cols-[120px,100px,1fr,100px,100px] gap-4 text-lightest text-xxs">
      <div className="flex items-center">
        <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={resource.trait} size="sm" />
        <div>{resource.trait}</div>
      </div>
      <div className="flex items-center text-gold">
        {summary.bestPrice !== Infinity ? summary.bestPrice.toFixed(2) : (0).toFixed(2)}
        <ResourceIcon containerClassName="ml-2 w-min" resource="Shekels" size="sm" />
      </div>
      <div></div>
      <div>
        {Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(summary.totalAmount)}
      </div>
      <Button onClick={onClick} size="xs" variant="success">
        {summary.totalOffers} offers
      </Button>
    </div>
  );
};

const MarketplaceResourceOffersPanel = ({
  offers,
  isBuy,
  onCreate,
  resourceId,
  onBack,
}: {
  offers: MarketInterface[];
  isBuy: boolean;
  onCreate: () => void;
  resourceId: number;
  onBack: () => void;
}) => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const [selectedTrade, setSelectedTrade] = useState<MarketInterface | undefined>(null);
  const sortingParams = useMemo(() => {
    return [
      { label: "Sell", sortKey: "sell", className: "" },
      { label: "Rate", sortKey: "rate", className: "ml-auto" },
      { label: "Buy", sortKey: "buy", className: "ml-auto" },
      { label: "Order", sortKey: "order", className: "ml-auto" },
      { label: "Travel time", sortKey: "travel", className: "ml-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <>
      {selectedTrade && (
        <AcceptOfferPopup
          onClose={() => {
            setSelectedTrade(undefined);
          }}
          selectedTrade={selectedTrade}
        />
      )}
      <div className="flex flex-col p-2">
        <div className="flex items-center justify-between">
          <FiltersPanel>
            <FilterButton active={true} onClick={onBack}>
              {findResourceById(resourceId)?.trait}
            </FilterButton>
          </FiltersPanel>
          <Button onClick={onCreate} variant="primary">
            + Create a new offer
          </Button>
        </div>
        <SortPanel className="mt-2 py-2 border-b-0">
          {sortingParams.map(({ label, sortKey, className }) => (
            <SortButton
              className={className}
              key={sortKey}
              label={label}
              sortKey={sortKey}
              activeSort={activeSort}
              onChange={(_sortKey, _sort) => {
                setActiveSort({
                  sortKey: _sortKey,
                  sort: _sort,
                });
              }}
            />
          ))}
        </SortPanel>
        <div className="mt-2">
          {offers.map((offer) => (
            <ResourceOfferRow
              key={offer.tradeId}
              realmEntityId={realmEntityId}
              isBuy={isBuy}
              offer={offer}
              onClick={() => setSelectedTrade(offer)}
            />
          ))}
        </div>
      </div>
    </>
  );
};

const ResourceOfferRow = ({
  realmEntityId,
  offer,
  isBuy,
  onClick,
}: {
  realmEntityId: number;
  offer: MarketInterface;
  isBuy: boolean;
  onClick: () => void;
}) => {
  const resource = findResourceById(isBuy ? offer.resourcesGet[0].resourceId : offer.resourcesGive[0].resourceId);
  const { realm: makerRealm } = useGetRealm(offer.makerId);

  return (
    <div className="grid rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-1 grid-cols-5 gap-4 text-lightest text-xxs">
      <div className="flex items-center">
        <ResourceIcon
          containerClassName="mr-2 w-min"
          withTooltip={false}
          resource={isBuy ? "Shekels" : resource.trait}
          size="sm"
        />
        {divideByPrecision(offer.resourcesGive[0].amount)}
      </div>
      <div>
        <div className="px-2 bg-black rounded-md w-min">
          {isBuy ? (1 / offer.ratio).toFixed(2) : offer.ratio.toFixed(2)}
        </div>
      </div>
      <div className="flex items-center text-gold">
        {divideByPrecision(offer.resourcesGet[0].amount)}
        <ResourceIcon containerClassName="ml-2 w-min" resource={!isBuy ? "Shekels" : resource.trait} size="sm" />
      </div>

      <div className="flex items-center">
        {makerRealm?.order && <OrderIcon order={orderNameDict[makerRealm.order]} size="xs" className="mr-1" />}
        {realmsData["features"][makerRealm?.realmId - 1]?.name}
      </div>
      {offer.makerId !== realmEntityId && (
        <div className="flex item-center justify-end">
          {`${offer.distance.toFixed(0)} km`}
          <Button className="ml-2" onClick={onClick} disabled={!offer.canAccept} size="xs" variant="success">
            Accept
          </Button>
        </div>
      )}
    </div>
  );
};
