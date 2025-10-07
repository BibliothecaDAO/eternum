import { useMemo } from "react";
import { getChecksumAddress } from "starknet";

import { useMarketplaceContext } from "./context/marketplace-context";

import type { RealmMetadata } from "@/types";

export type MarketplaceActivityFilter = "all" | "sales" | "listings";

export interface MarketplaceActivityEvent {
  event_id: string;
  state: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  name: string | null;
  symbol: string | null;
  metadata: RealmMetadata | null;
  executed_at: string | null;
}

const normalizeAddress = (value?: string | null) => {
  if (!value) return undefined;
  try {
    return getChecksumAddress(value);
  } catch (error) {
    return value;
  }
};

const toHexTokenId = (tokenId: number | string) => {
  const numericValue = typeof tokenId === "number" ? tokenId : Number(tokenId);
  if (Number.isNaN(numericValue)) {
    return tokenId.toString();
  }
  return `0x${numericValue.toString(16)}`;
};

const toTimestamp = (time?: number) => {
  if (!time || Number.isNaN(time)) return { timestamp: 0, iso: null };
  const milliseconds = time > 1e12 ? time : time * 1000;
  const date = new Date(milliseconds);
  return { timestamp: date.getTime(), iso: date.toISOString() };
};

export const useMarketplaceActivity = (
  filter: MarketplaceActivityFilter,
  collectionAddress?: string,
) => {
  const { listings, sales, isReady } = useMarketplaceContext();

  const normalizedCollection = useMemo(() => normalizeAddress(collectionAddress), [collectionAddress]);

  const events = useMemo<MarketplaceActivityEvent[]>(() => {
    const shouldIncludeListings = filter === "all" || filter === "listings";
    const shouldIncludeSales = filter === "all" || filter === "sales";

    const entries: { event: MarketplaceActivityEvent; timestamp: number }[] = [];

    if (shouldIncludeListings) {
      Object.entries(listings).forEach(([collection, tokens]) => {
        if (normalizedCollection && collection !== normalizedCollection) return;
        Object.values(tokens).forEach((ordersById) => {
          Object.values(ordersById).forEach((listing) => {
            const order = listing.order;
            const { timestamp, iso } = toTimestamp(listing.time);
            entries.push({
              timestamp,
              event: {
                event_id: listing.identifier ?? listing.id.toString(),
                state: listing.type ?? "Created",
                token_id: toHexTokenId(order.tokenId),
                price: order.price.toString(),
                owner: order.owner,
                expiration: order.expiration,
                name: null,
                symbol: null,
                metadata: null,
                executed_at: iso,
              },
            });
          });
        });
      });
    }

    if (shouldIncludeSales) {
      Object.entries(sales).forEach(([collection, tokens]) => {
        if (normalizedCollection && collection !== normalizedCollection) return;
        Object.values(tokens).forEach((ordersById) => {
          Object.values(ordersById).forEach((sale) => {
            const order = sale.order;
            const { timestamp, iso } = toTimestamp(sale.time);
            entries.push({
              timestamp,
              event: {
                event_id: sale.identifier ?? sale.id.toString(),
                state: sale.type ?? "Accepted",
                token_id: toHexTokenId(order.tokenId),
                price: order.price.toString(),
                owner: sale.to ?? order.owner,
                expiration: order.expiration,
                name: null,
                symbol: null,
                metadata: null,
                executed_at: iso,
              },
            });
          });
        });
      });
    }

    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((entry) => entry.event);
  }, [filter, listings, normalizedCollection, sales]);

  return { events, isLoading: !isReady };
};
