import { useMemo } from "react";
import { getChecksumAddress } from "starknet";

import { getCollectionByAddress } from "@/config";

import { useMarketplaceContext } from "./context/marketplace-context";

type OrderLookup = {
  contractAddress?: string | null;
  tokenId?: string | number | null;
};

export interface ActiveMarketplaceOrder {
  order_id: string;
  token_id: string;
  price: string;
  owner: string;
  expiration: number;
  collection_address: string;
  collection_id: number | null;
}

const normalizeAddress = (value?: string | null) => {
  if (!value) return undefined;
  try {
    return getChecksumAddress(value);
  } catch (error) {
    return value;
  }
};

const normalizeTokenId = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined;
  const stringValue = value.toString();
  if (stringValue.startsWith("0x")) {
    try {
      return BigInt(stringValue).toString();
    } catch (error) {
      return stringValue;
    }
  }
  return stringValue;
};

export const useActiveMarketplaceOrders = (lookups: OrderLookup[] | undefined) => {
  const { orders } = useMarketplaceContext();

  const lookupKey = useMemo(() => {
    if (!lookups || lookups.length === 0) return "ALL";
    return lookups
      .map((lookup) => `${lookup.contractAddress ?? ""}:${lookup.tokenId ?? ""}`)
      .sort()
      .join("|");
  }, [lookups]);

  return useMemo<ActiveMarketplaceOrder[]>(() => {
    if (!lookups || lookups.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const results: ActiveMarketplaceOrder[] = [];

    lookups.forEach((lookup) => {
      const address = normalizeAddress(lookup.contractAddress);
      const tokenId = normalizeTokenId(lookup.tokenId);

      if (!address) return;

      const collectionOrders = orders[address] ?? {};
      const tokens = tokenId ? { [tokenId]: collectionOrders[tokenId] ?? {} } : collectionOrders;
      const collection = getCollectionByAddress(address);

      Object.entries(tokens).forEach(([tokenKey, orderMap]) => {
        if (!orderMap) return;
        Object.values(orderMap).forEach((order) => {
          const dedupeKey = `${address}:${tokenKey}:${order.id}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          results.push({
            order_id: order.id.toString(),
            token_id: normalizeTokenId(tokenKey) ?? tokenKey,
            price: order.price.toString(),
            owner: order.owner,
            expiration: order.expiration,
            collection_address: address,
            collection_id: collection?.id ?? null,
          });
        });
      });
    });

    return results;
  }, [lookupKey, lookups, orders]);
};
