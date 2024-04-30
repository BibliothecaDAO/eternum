import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import TextInput from "../../elements/TextInput";
import Button from "../../elements/Button";
import { SortPanel } from "../../elements/SortPanel";
import { SortButton, SortInterface } from "../../elements/SortButton";
import { MarketInterface, ResourcesIds, findResourceById, orderNameDict, resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { useGetMyOffers, useTrade } from "../../../hooks/helpers/useTrade";
import { FiltersPanel } from "../../elements/FiltersPanel";
import { FilterButton } from "../../elements/FilterButton";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import * as realmsData from "../../../data/geodata/realms.json";
import { OrderIcon } from "../../elements/OrderIcon";
import { AcceptOfferPopup } from "../cityview/realm/trade/AcceptOffer";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { currencyFormat, divideByPrecision, getEntityIdFromKeys } from "../../utils/utils";
import clsx from "clsx";
import { FastCreateOfferPopup } from "../cityview/realm/trade/FastCreateOffer";
import useUIStore from "../../../hooks/store/useUIStore";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../hooks/context/DojoContext";
import useMarketStore from "../../../hooks/store/useMarketStore";
import { useCaravan } from "../../../hooks/helpers/useCaravans";

interface MarketplaceProps {
  onCreateOffer: (resourceId: number | null, isBuy: boolean) => void;
  setSelectedTrade: (trade: MarketInterface | null) => void;
}

interface DepthOfMarket {
  price: number;
  amount: number;
}

interface ResourceOffersSummary {
  resourceId: number;
  bestPrice: number;
  totalAmount: number;
  totalOffers: number;
  depthOfMarket: DepthOfMarket[];
}

export const Marketplace = ({ onCreateOffer, setSelectedTrade }: MarketplaceProps) => {
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [isBuy, setIsBuy] = useState(false);

  const marketOffers = useMarketStore((state) => state.lordsMarket);
  const myOffers = useGetMyOffers();

  // @note: in open market, the current player will always be the taker so
  // resourcesGet = takerGets
  // resourcesGive = makerGets

  const bidOffers = useMemo(() => {
    if (!marketOffers) return [];

    return [...marketOffers, ...myOffers].filter(
      (offer) => offer.takerGets.length === 1 && offer.takerGets[0]?.resourceId === ResourcesIds["Lords"],
    );
  }, [marketOffers, myOffers]);

  const selectedResourceBidOffers = useMemo(() => {
    if (!bidOffers) return [];

    return bidOffers
      .filter((offer) => (selectedResource ? offer.makerGets[0]?.resourceId === selectedResource : true))
      .sort((a, b) => b.ratio - a.ratio);
  }, [bidOffers, selectedResource]);

  const bidOffersSummary = useMemo(() => {
    if (!bidOffers) return [];

    const summary: ResourceOffersSummary[] = [];

    resources.forEach((resource) => {
      if (resource.trait === "Lords") return;

      summary.push({
        resourceId: resource.id,
        totalAmount: 0,
        totalOffers: 0,
        bestPrice: 0,
        depthOfMarket: [] as DepthOfMarket[],
      });
    });

    bidOffers.forEach((offer) => {
      offer.makerGets.forEach((resource) => {
        const resourceIndex = summary.findIndex((summary) => summary.resourceId === resource.resourceId);

        if (resourceIndex >= 0) {
          summary[resourceIndex].totalAmount += resource.amount;
          summary[resourceIndex].totalOffers += 1;
          summary[resourceIndex].bestPrice = Math.max(
            summary[resourceIndex].bestPrice,
            offer.takerGets[0].amount / resource.amount,
          );
          const depthOfMarketIndex = summary[resourceIndex].depthOfMarket.findIndex(
            (depth) => depth.price === offer.takerGets[0].amount / resource.amount,
          );
          if (depthOfMarketIndex >= 0) {
            summary[resourceIndex].depthOfMarket[depthOfMarketIndex].amount += resource.amount;
          } else {
            summary[resourceIndex].depthOfMarket.push({
              price: offer.takerGets[0].amount / resource.amount,
              amount: resource.amount,
            });
          }
        } else {
          summary.push({
            resourceId: resource.resourceId,
            totalAmount: resource.amount,
            totalOffers: 1,
            bestPrice: resource.amount / offer.takerGets[0].amount,
            depthOfMarket: [{ price: resource.amount / offer.takerGets[0].amount, amount: resource.amount }],
          });
        }
      });

      summary.forEach((summary) => {
        summary.depthOfMarket.sort((a, b) => b.price - a.price);
      });
    });

    return summary;
  }, [bidOffers]);

  const askOffers = useMemo(() => {
    if (!marketOffers) return [];

    return [...marketOffers, ...myOffers].filter(
      (offer) => offer.takerGets.length === 1 && offer.makerGets[0]?.resourceId === ResourcesIds["Lords"],
    );
  }, [marketOffers, myOffers]);

  const selectedResourceAskOffers = useMemo(() => {
    if (!askOffers) return [];

    return askOffers
      .filter((offer) => offer.takerGets[0].resourceId === selectedResource)
      .sort((a, b) => b.ratio - a.ratio);
  }, [askOffers, selectedResource]);

  const askOffersSummary = useMemo(() => {
    if (!askOffers) return [];

    const summary: ResourceOffersSummary[] = [];

    resources.forEach((resource) => {
      if (resource.trait === "Lords") return;

      summary.push({
        resourceId: resource.id,
        totalAmount: 0,
        totalOffers: 0,
        bestPrice: Infinity,
        depthOfMarket: [] as DepthOfMarket[],
      });
    });

    askOffers.forEach((offer) => {
      offer.takerGets.forEach((resource) => {
        const resourceIndex = summary.findIndex((summary) => summary.resourceId === resource.resourceId);

        if (resourceIndex >= 0) {
          summary[resourceIndex].totalAmount += resource.amount;
          summary[resourceIndex].totalOffers += 1;
          summary[resourceIndex].bestPrice = Math.min(
            summary[resourceIndex].bestPrice,
            offer.makerGets[0].amount / resource.amount,
          );

          const depthOfMarketIndex = summary[resourceIndex].depthOfMarket.findIndex(
            (depth) => depth.price === offer.makerGets[0].amount / resource.amount,
          );

          if (depthOfMarketIndex >= 0) {
            summary[resourceIndex].depthOfMarket[depthOfMarketIndex].amount += resource.amount;
          } else {
            summary[resourceIndex].depthOfMarket.push({
              price: offer.makerGets[0].amount / resource.amount,
              amount: resource.amount,
            });
          }
        } else {
          summary.push({
            resourceId: resource.resourceId,
            totalAmount: resource.amount,
            totalOffers: 1,
            bestPrice: resource.amount / offer.makerGets[0].amount,
            depthOfMarket: [{ price: resource.amount / offer.makerGets[0].amount, amount: resource.amount }],
          });
        }
      });

      summary.forEach((summary) => {
        summary.depthOfMarket.sort((a, b) => a.price - b.price);
      });
    });

    return summary;
  }, [askOffers]);

  return (
    <>
      {selectedResource ? (
        <MarketplaceResourceOffersPanel
          offers={isBuy ? selectedResourceAskOffers : selectedResourceBidOffers}
          isBuy={isBuy}
          resourceId={selectedResource}
          onBack={() => setSelectedResource(null)}
          onCreate={() => onCreateOffer(selectedResource, isBuy)}
          setSelectedTrade={setSelectedTrade}
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
          onCreate={() => onCreateOffer(selectedResource, isBuy)}
        />
      )}
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
      { label: "Balance", sortKey: "balance", className: "w-[30px]" },
      { label: "Best Ask price", sortKey: "ask-price", className: "w-[100px] ml-auto !justify-end" },
      { label: "Ask Total Vol.", sortKey: "ask-vol", className: "ml-4 w-[100px] !justify-end" },
      { label: "Best Bid price", sortKey: "bid-price", className: "ml-4 w-[100px] !justify-end" },
      { label: "Bid Total Vol.", sortKey: "bid-vol", className: "ml-4 w-[100px] !justify-end" },
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
          className="border border-gold !w-auto !w-34 !flex-grow-0 text-xs"
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
          if (resource.trait === "Lords") return null;
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
  askSummary: ResourceOffersSummary | undefined;
  bidSummary: ResourceOffersSummary | undefined;
  onBuy: () => void;
  onSell: () => void;
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const resource = findResourceById(bidSummary?.resourceId || 0);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const realmResource = getComponentValue(
    Resource,
    getEntityIdFromKeys([realmEntityId!, BigInt(askSummary?.resourceId || 0n)]),
  );

  const depthOfMarketBids = useMemo(() => {
    const lastFive = bidSummary?.depthOfMarket.slice(0, 5) || [];

    let accumulatedAmount = 0;

    return (
      lastFive.length && (
        <div className="flex flex-col w-[300px]">
          {resource && (
            <div className="flex items-center mb-2">
              <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={resource.trait} size="sm" />
              {resource.trait}
            </div>
          )}
          {bidSummary &&
            lastFive.map((depth) => {
              accumulatedAmount += depth.amount;
              const width = (accumulatedAmount / bidSummary.totalAmount) * 100;
              return (
                <div className="w-full relative h-5 border-b border-white/30">
                  <div className="flex mt-0.5 flex-1 w-full justify-between px-0.5 items-center">
                    <div className="relative z-10">
                      {Intl.NumberFormat("en-US", {
                        style: "decimal",
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }).format(divideByPrecision(depth.amount))}
                    </div>
                    <div className="relative z-10 flex items-center">
                      {depth.price.toFixed(2)}
                      <ResourceIcon containerClassName="ml-1 w-min" resource="Lords" size="xs" />
                    </div>
                  </div>
                  <div
                    className="absolute z-0 top-0 left-0 w-full h-full bg-danger/30"
                    style={{ width: `${width}%` }}
                  ></div>
                </div>
              );
            })}
        </div>
      )
    );
  }, [bidSummary?.depthOfMarket]);

  const depthOfMarketAsks = useMemo(() => {
    const lastFive = askSummary?.depthOfMarket.slice(0, 5) || [];

    let accumulatedAmount = 0;

    return (
      lastFive.length && (
        <div className="flex flex-col w-[300px]">
          {resource && (
            <div className="flex items-center mb-2">
              <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={resource.trait} size="sm" />
              {resource.trait}
            </div>
          )}
          {askSummary &&
            lastFive.map((depth, i) => {
              accumulatedAmount += depth.amount;
              const width = (accumulatedAmount / askSummary.totalAmount) * 100;
              return (
                <div key={i} className="w-full relative h-5 border-b border-white/30">
                  <div className="flex mt-0.5 flex-1 w-full justify-between px-0.5 items-center">
                    <div className="relative z-10">
                      {Intl.NumberFormat("en-US", {
                        style: "decimal",
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }).format(divideByPrecision(depth.amount))}
                    </div>
                    <div className="relative z-10 flex items-center">
                      {depth.price.toFixed(2)}
                      <ResourceIcon containerClassName="ml-1 w-min" resource="Lords" size="xs" />
                    </div>
                  </div>
                  <div
                    className="absolute z-0 top-0 left-0 w-full h-full bg-order-brilliance/30"
                    style={{ width: `${width}%` }}
                  ></div>
                </div>
              );
            })}
        </div>
      )
    );
  }, [askSummary?.depthOfMarket]);

  return (
    <div className="grid hover:bg-white/10 items-center border-b h-8 border-gold/30 px-1 grid-cols-[100px,50px,1fr,100px,100px,100px] gap-4 text-lightest text-xs">
      {resource && (
        <div className="flex items-center">
          <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={resource.trait} size="sm" />
          <div>{resource.trait}</div>
        </div>
      )}
      <div className="flex justify-end  items-center">
        <div>{currencyFormat(Number(realmResource?.balance || 0), 0)}</div>
      </div>
      <div
        className="flex justify-end  items-center text-gold"
        onMouseEnter={() =>
          setTooltip({
            position: "bottom",
            content: depthOfMarketAsks,
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {askSummary && askSummary.bestPrice !== Infinity ? askSummary.bestPrice.toFixed(2) : (0).toFixed(2)}
        <ResourceIcon containerClassName="ml-2 w-min" resource="Lords" size="sm" />
      </div>
      <div
        className="flex justify-end items-center"
        onMouseEnter={() =>
          setTooltip({
            position: "bottom",
            content: depthOfMarketAsks,
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(divideByPrecision(askSummary?.totalAmount || 0))}
        <Button
          className="ml-2"
          onClick={() => {
            onBuy();
            setTooltip(null);
          }}
          size="xs"
          variant="success"
        >
          Buy
        </Button>
      </div>
      <div
        className="flex justify-end  items-center text-gold"
        onMouseEnter={() =>
          setTooltip({
            position: "bottom",
            content: depthOfMarketBids,
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {bidSummary && bidSummary.bestPrice !== Infinity ? bidSummary.bestPrice.toFixed(2) : (0).toFixed(2)}
        <ResourceIcon containerClassName="ml-2 w-min" resource="Lords" size="sm" />
      </div>
      <div
        className="flex justify-end items-center"
        onMouseEnter={() =>
          setTooltip({
            position: "bottom",
            content: depthOfMarketBids,
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(divideByPrecision(bidSummary?.totalAmount || 0))}
        <Button
          className="ml-2"
          onClick={() => {
            onSell();
            setTooltip(null);
          }}
          size="xs"
          variant="red"
        >
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
  setSelectedTrade,
}: {
  offers: MarketInterface[];
  isBuy: boolean;
  onCreate: () => void;
  resourceId: number;
  onBack: () => void;
  setSelectedTrade: (trade: MarketInterface | null) => void;
}) => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

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
              realmEntityId={realmEntityId!}
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
  realmEntityId: bigint;
  offer: MarketInterface;
  isBuy: boolean;
  onClick: () => void;
}) => {
  const { makerGets: resourcesGive, makerId } = offer;
  const resource = findResourceById(isBuy ? offer.takerGets[0].resourceId : offer.makerGets[0].resourceId);
  const { realm: makerRealm } = useGetRealm(offer.makerId);

  const { canAcceptOffer } = useTrade();
  const { calculateDistance } = useCaravan();

  const canAccept = useMemo(() => {
    return canAcceptOffer({ realmEntityId, resourcesGive });
  }, [realmEntityId, resourcesGive]);

  const distance = useMemo(() => {
    return calculateDistance(makerId, realmEntityId) || 0;
  }, [makerId, realmEntityId]);

  return (
    <div className="grid rounded-md hover:bg-white/10 items-center border-b h-8 border-gold px-1 grid-cols-5 gap-4 text-gold text-xs">
      {resource && (
        <div className="flex items-center">
          <ResourceIcon
            containerClassName="mr-2 w-min"
            withTooltip={false}
            resource={isBuy ? "Lords" : resource.trait}
            size="sm"
          />
          {divideByPrecision(offer.makerGets[0].amount)}
        </div>
      )}
      <div>
        <div className="px-2 bg-black rounded-md w-min">
          {isBuy ? (1 / offer.ratio).toFixed(2) : offer.ratio.toFixed(2)}
        </div>
      </div>
      {resource && (
        <div className="flex items-center text-gold">
          {divideByPrecision(offer.takerGets[0].amount)}
          <ResourceIcon containerClassName="ml-2 w-min" resource={!isBuy ? "Lords" : resource.trait} size="sm" />
        </div>
      )}

      {makerRealm && (
        <div className="flex items-center justify-center">
          {<OrderIcon order={orderNameDict[makerRealm.order]} size="xs" className="mr-1" />}
          {realmsData["features"][Number(makerRealm.realmId - 1n)]?.name}
        </div>
      )}
      {offer.makerId !== realmEntityId && (
        <div className="flex item-center justify-end">
          {`${distance.toFixed(0)} km`}
          <Button className="ml-2" onClick={onClick} disabled={!canAccept} size="xs" variant="success">
            Accept
          </Button>
        </div>
      )}
    </div>
  );
};
