import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import TextInput from "../../../../../elements/TextInput";
import Button from "../../../../../elements/Button";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourcesIds, findResourceById, orderNameDict, resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { MarketInterface, useGetMarket } from "../../../../../hooks/helpers/useTrade";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import * as realmsData from "../../../../../geodata/realms.json";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { AcceptOfferPopup } from "../AcceptOffer";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { divideByPrecision } from "../../../../../utils/utils";
import clsx from "clsx";
import { FastCreateOfferPopup } from "../FastCreateOffer";

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

  const marketOffers = useGetMarket({
    selectedResources: [],
    selectedOrders: [],
    directOffers: false,
    filterOwnOffers: false,
  });

  const bidOffers = useMemo(() => {
    if (!marketOffers) return [];

    return marketOffers.filter(
      (offer) => offer.resourcesGet.length === 1 && offer.resourcesGet[0].resourceId === ResourcesIds["Shekels"],
    );
  }, [marketOffers]);

  const selectedResourceBidOffers = useMemo(() => {
    if (!bidOffers) return [];

    return bidOffers
      .filter((offer) => (selectedResource ? offer.resourcesGive[0].resourceId === selectedResource : true))
      .sort((a, b) => b.ratio - a.ratio);
  }, [bidOffers, selectedResource]);

  const bidOffersSummary = useMemo(() => {
    if (!bidOffers) return [];

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

    bidOffers.forEach((offer) => {
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
  }, [bidOffers]);

  const askOffers = useMemo(() => {
    if (!marketOffers) return [];

    return marketOffers.filter(
      (offer) => offer.resourcesGet.length === 1 && offer.resourcesGive[0].resourceId === ResourcesIds["Shekels"],
    );
  }, [marketOffers]);

  const selectedResourceAskOffers = useMemo(() => {
    if (!askOffers) return [];

    return askOffers
      .filter((offer) => offer.resourcesGet[0].resourceId === selectedResource)
      .sort((a, b) => b.ratio - a.ratio);
  }, [askOffers, selectedResource]);

  const askOffersSummary = useMemo(() => {
    if (!askOffers) return [];

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

    askOffers.forEach((offer) => {
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
  }, [askOffers]);

  return (
    <>
      {showCreateOffer && (
        <FastCreateOfferPopup
          resourceId={selectedResource || 1}
          isBuy={isBuy}
          onClose={() => setShowCreateOffer(false)}
          onCreate={() => {}}
        />
      )}
      <SecondaryPopup name="marketplace">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Marketplace</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"600px"}>
          {selectedResource ? (
            <MarketplaceResourceOffersPanel
              offers={isBuy ? selectedResourceAskOffers : selectedResourceBidOffers}
              isBuy={isBuy}
              resourceId={selectedResource}
              onBack={() => setSelectedResource(null)}
              onCreate={() => setShowCreateOffer(true)}
            />
          ) : (
            <MarketplaceOverviewPanel
              askOffersSummary={askOffersSummary}
              bidOffersSummary={bidOffersSummary}
              onBuy={(resourceId: number) => {
                setIsBuy(true);
                setSelectedResource(resourceId);
              }}
              onSell={(resourceId: number) => {
                setIsBuy(false);
                setSelectedResource(resourceId);
              }}
              onCreate={() => setShowCreateOffer(true)}
            />
          )}
        </SecondaryPopup.Body>
      </SecondaryPopup>
    </>
  );
};

const MarketplaceOverviewPanel = ({
  onBuy,
  onSell,
  onCreate,
  askOffersSummary,
  bidOffersSummary,
}: {
  onBuy: (resourceId: number) => void;
  onSell: (resourceId: number) => void;
  onCreate: () => void;
  askOffersSummary: ResourceOffersSummary[];
  bidOffersSummary: ResourceOffersSummary[];
}) => {
  const [search, setSearch] = useState<string>("");

  const sortingParams = useMemo(() => {
    return [
      { label: "Resource", sortKey: "resource", className: "w-[120px]" },
      { label: "Best price", sortKey: "price", className: "w-[100px] ml-4" },
      { label: "Ask", sortKey: "ask", className: "ml-auto w-[120px] !justify-end mr-4" },
      { label: "Bid", sortKey: "bid", className: " w-[120px] !justify-end" },
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
    <div className="flex flex-col p-3">
      <div className="flex items-center justify-between">
        <TextInput
          className="border border-gold !w-auto !text-light-pink !w-34 !flex-grow-0 text-xs"
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
              askSummary={askOffersSummary.find((summary) => summary.resourceId === resource.id)}
              bidSummary={bidOffersSummary.find((summary) => summary.resourceId === resource.id)}
              onBuy={() => onBuy(resource.id)}
              onSell={() => onSell(resource.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const OverviewResourceRow = ({
  askSummary,
  bidSummary,
  onBuy,
  onSell,
}: {
  askSummary: ResourceOffersSummary;
  bidSummary: ResourceOffersSummary;
  onBuy: () => void;
  onSell: () => void;
}) => {
  const resource = findResourceById(bidSummary.resourceId);

  return (
    <div className="grid rounded-md hover:bg-white/10 items-center border-b h-8 border-black px-1 grid-cols-[120px,100px,1fr,120px] gap-4 text-lightest text-xxs">
      <div className="flex items-center">
        <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={resource.trait} size="sm" />
        <div>{resource.trait}</div>
      </div>
      <div className="flex items-center text-gold">
        {bidSummary.bestPrice !== Infinity ? bidSummary.bestPrice.toFixed(2) : (0).toFixed(2)}
        <ResourceIcon containerClassName="ml-2 w-min" resource="Shekels" size="sm" />
      </div>
      <div className="flex justify-end items-center">
        {Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(askSummary.totalAmount)}
        <Button className="ml-2" onClick={onBuy} size="xs" variant="success">
          Buy
        </Button>
      </div>
      <div className="flex justify-end items-center">
        {Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(bidSummary.totalAmount)}
        <Button className="ml-2" onClick={onSell} size="xs" variant="red">
          Sell
        </Button>
      </div>
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
      { label: "Price", sortKey: "Price", className: "ml-auto" },
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
              Resource: {findResourceById(resourceId)?.trait}
            </FilterButton>
            <FilterButton active={true} onClick={onBack}>
              Type:
              <div
                className={clsx(
                  "text-xxs ml-1 rounded-[5px] px-1 w-min ",
                  isBuy ? "text-order-vitriol bg-dark-green" : "text-danger bg-brown",
                )}
              >
                {isBuy ? "Buy" : "Sell"}
              </div>
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
