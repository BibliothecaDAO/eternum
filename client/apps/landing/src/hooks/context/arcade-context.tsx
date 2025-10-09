import { ArcadeProvider as ExternalProvider } from "@cartridge/arcade";
import {
  BookModel,
  CategoryType,
  ListingEvent,
  Marketplace,
  OrderModel,
  SaleEvent,
  StatusType,
  type MarketplaceModel,
  type MarketplaceOptions,
} from "@cartridge/marketplace";
import type { ToriiClient } from "@dojoengine/torii-wasm";
import type { Chain } from "@starknet-react/chains";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { constants, getChecksumAddress } from "starknet";

import { env } from "../../../env";
import { useDojo } from "./dojo-context";

const chainIdMap: Record<string, string> = {
  mainnet: constants.StarknetChainId.SN_MAIN,
  sepolia: constants.StarknetChainId.SN_SEPOLIA,
  slot: constants.StarknetChainId.SN_MAIN,
  local: constants.StarknetChainId.SN_SEPOLIA,
};

const resolveChainId = (network: string | undefined) => {
  return chainIdMap[network ?? "mainnet"] ?? constants.StarknetChainId.SN_MAIN;
};

export interface ArcadeProviderProps {
  children: ReactNode;
}

export interface ArcadeContextType {
  chainId: string;
  provider: ExternalProvider;
  pins: { [playerId: string]: string[] };
  follows: { [playerId: string]: string[] };
  accesses: [];
  games: [];
  editions: [];
  collectionEditions: { [collection: string]: number[] };
  chains: Chain[];
  clients: { [key: string]: ToriiClient };
  player: string | undefined;
  book: BookModel | null;
  orders: Record<string, Record<string, Record<string, OrderModel>>>;
  listings: Record<string, Record<string, Record<string, ListingEvent>>>;
  sales: Record<string, Record<string, Record<string, SaleEvent>>>;
  addOrder: (order: OrderModel) => void;
  removeOrder: (order: OrderModel) => void;
  setPlayer: (address: string | undefined) => void;
  isReady: boolean;
}

export const ArcadeContext = createContext<ArcadeContextType | null>(null);

export const ArcadeProvider = ({ children }: ArcadeProviderProps) => {
  const currentValue = useContext(ArcadeContext);
  if (currentValue) {
    throw new Error("ArcadeProvider can only be used once");
  }

  const { network } = useDojo();
  const chainId = useMemo(() => resolveChainId(env?.VITE_PUBLIC_CHAIN), [env?.VITE_PUBLIC_CHAIN]);

  const [book, setBook] = useState<BookModel | null>(null);
  const [orders, setOrders] = useState<Record<string, Record<string, Record<string, OrderModel>>>>({});
  const [listings, setListings] = useState<Record<string, Record<string, Record<string, ListingEvent>>>>({});
  const [sales, setSales] = useState<Record<string, Record<string, Record<string, SaleEvent>>>>({});
  const [player, setPlayer] = useState<string | undefined>();
  const [initialized, setInitialized] = useState(false);

  const provider = useMemo(() => new ExternalProvider(chainId as constants.StarknetChainId), [chainId]);

  const removeOrder = useCallback((order: OrderModel) => {
    const collection = getChecksumAddress(order.collection);
    const token = order.tokenId.toString();
    setOrders((prev) => {
      const next = { ...prev };
      if (next[collection]?.[token]?.[order.id]) {
        const tokenOrders = { ...next[collection][token] };
        delete tokenOrders[order.id];
        next[collection] = { ...next[collection], [token]: tokenOrders };
      }
      return next;
    });
  }, []);

  const addOrder = useCallback((order: OrderModel) => {
    const collection = getChecksumAddress(order.collection);
    const token = order.tokenId.toString();
    setOrders((prev) => ({
      ...prev,
      [collection]: {
        ...(prev[collection] ?? {}),
        [token]: {
          ...(prev[collection]?.[token] ?? {}),
          [order.id]: order,
        },
      },
    }));
  }, []);

  const handleMarketplaceEntities = useCallback(
    (entities: MarketplaceModel[]) => {
      const now = Date.now();
      entities.forEach((entity) => {
        if (BookModel.isType(entity as BookModel)) {
          const nextBook = entity as BookModel;
          if (nextBook.exists() && nextBook.version !== 0) {
            setBook(nextBook);
          }
          return;
        }

        if (OrderModel.isType(entity as OrderModel)) {
          const order = entity as OrderModel;
          if (order.expiration * 1000 < now) return;
          if (order.category.value !== CategoryType.Sell) return;
          if (order.status.value === StatusType.Placed) {
            addOrder(order);
          } else {
            removeOrder(order);
          }
          return;
        }

        if (ListingEvent.isType(entity as ListingEvent)) {
          const listing = entity as ListingEvent;
          const order = listing.order;
          const collection = getChecksumAddress(order.collection);
          const token = order.tokenId.toString();
          setListings((prev) => ({
            ...prev,
            [collection]: {
              ...(prev[collection] ?? {}),
              [token]: {
                ...(prev[collection]?.[token] ?? {}),
                [order.id]: listing,
              },
            },
          }));
          return;
        }

        if (SaleEvent.isType(entity as SaleEvent)) {
          const sale = entity as SaleEvent;
          const order = sale.order;
          const collection = getChecksumAddress(order.collection);
          const token = order.tokenId.toString();
          setSales((prev) => ({
            ...prev,
            [collection]: {
              ...(prev[collection] ?? {}),
              [token]: {
                ...(prev[collection]?.[token] ?? {}),
                [order.id]: sale,
              },
            },
          }));
        }
      });
    },
    [addOrder, removeOrder],
  );

  useEffect(() => {
    if (initialized) return;
    let cancelled = false;
    const initialize = async () => {
      await Marketplace.init(chainId as constants.StarknetChainId);
      if (cancelled) return;
      const options: MarketplaceOptions = {
        book: true,
        order: true,
        listing: true,
        sale: true,
      };
      await Marketplace.fetch(handleMarketplaceEntities, options);
      if (cancelled) return;
      await Marketplace.sub(handleMarketplaceEntities, options);
      setInitialized(true);
    };

    initialize();

    return () => {
      cancelled = true;
      Marketplace.unsub();
    };
  }, [chainId, handleMarketplaceEntities, initialized]);

  const clients = useMemo(() => {
    const map: { [key: string]: ToriiClient } = {};
    if (network?.toriiClient) {
      map.default = network.toriiClient as ToriiClient;
    }
    return map;
  }, [network?.toriiClient]);

  const value = useMemo<ArcadeContextType>(
    () => ({
      chainId,
      provider,
      pins: {},
      follows: {},
      accesses: [],
      games: [],
      editions: [],
      collectionEditions: {},
      chains: [],
      clients,
      player,
      book,
      orders,
      listings,
      sales,
      addOrder,
      removeOrder,
      setPlayer,
      isReady: initialized,
    }),
    [chainId, provider, clients, player, book, orders, listings, sales, addOrder, removeOrder, initialized],
  );

  return <ArcadeContext.Provider value={value}>{children}</ArcadeContext.Provider>;
};

export const useArcade = () => {
  const context = useContext(ArcadeContext);
  if (!context) {
    throw new Error("useArcade must be used within an ArcadeProvider");
  }
  return context;
};
