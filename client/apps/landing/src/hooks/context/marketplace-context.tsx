import {
  BookModel,
  MarketplaceProvider as CartridgeMarketplaceProvider,
  CategoryType,
  ListingEvent,
  Marketplace,
  OrderModel,
  SaleEvent,
  StatusType,
  type MarketplaceModel,
  type MarketplaceOptions,
  type MarketplaceContextType as CartridgeMarketplaceContextType,
  MarketplaceContext as CartridgeMarketplaceContext,
  type ToriiClient,
} from "@cartridge/marketplace";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { constants, getChecksumAddress } from "starknet";

import { env } from "../../../env";
import { useDojo } from "./dojo-context";

const chainIdMap: Record<string, constants.StarknetChainId> = {
  mainnet: constants.StarknetChainId.SN_MAIN,
  sepolia: constants.StarknetChainId.SN_SEPOLIA,
  slot: constants.StarknetChainId.SN_MAIN,
  local: constants.StarknetChainId.SN_SEPOLIA,
};

export interface MarketplaceContextValue {
  chainId: constants.StarknetChainId;
  provider: CartridgeMarketplaceProvider;
  toriiClient: ToriiClient | undefined;
  book: BookModel | null;
  orders: Record<string, Record<string, Record<string, OrderModel>>>;
  listings: Record<string, Record<string, Record<string, ListingEvent>>>;
  sales: Record<string, Record<string, Record<string, SaleEvent>>>;
  addOrder: (order: OrderModel) => void;
  removeOrder: (order: OrderModel) => void;
  isReady: boolean;
}

const EternumMarketplaceContext = createContext<MarketplaceContextValue | null>(null);

const DEFAULT_MARKETPLACE_OPTIONS: MarketplaceOptions = {
  book: true,
  order: true,
  listing: true,
  sale: true,
  offer: false,
  access: false,
};

const resolveChainId = (network: string | undefined) => {
  return chainIdMap[network ?? "mainnet"] ?? constants.StarknetChainId.SN_MAIN;
};

export const MarketplaceProvider = ({ children }: { children: ReactNode }) => {
  const currentValue = useContext(EternumMarketplaceContext);
  if (currentValue) {
    throw new Error("MarketplaceProvider can only be used once in the component tree");
  }
  const { network } = useDojo();
  const [book, setBook] = useState<BookModel | null>(null);
  const [orders, setOrders] = useState<MarketplaceContextValue["orders"]>({});
  const [listings, setListings] = useState<MarketplaceContextValue["listings"]>({});
  const [sales, setSales] = useState<MarketplaceContextValue["sales"]>({});
  const [initialized, setInitialized] = useState(false);

  const chainId = useMemo(() => resolveChainId(env.VITE_PUBLIC_CHAIN), []);
  const provider = useMemo(() => new CartridgeMarketplaceProvider(chainId), [chainId]);

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
      try {
        await Marketplace.init(chainId);
        if (cancelled) return;
        await Marketplace.fetch(handleMarketplaceEntities, DEFAULT_MARKETPLACE_OPTIONS);
        if (cancelled) return;
        await Marketplace.sub(handleMarketplaceEntities, DEFAULT_MARKETPLACE_OPTIONS);
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize marketplace context", error);
      }
    };

    initialize();
    return () => {
      cancelled = true;
      Marketplace.unsub();
    };
  }, [chainId, handleMarketplaceEntities, initialized]);

  const toriiClient = useMemo(() => {
    const client = network?.toriiClient;
    if (!client) return undefined;
    return client as unknown as ToriiClient;
  }, [network]);

  const bookArray = useMemo(() => (book ? [book] : []), [book]);
  const ordersArray = useMemo(() => {
    const entries: OrderModel[] = [];
    Object.values(orders).forEach((tokens) => {
      Object.values(tokens).forEach((orderMap) => {
        Object.values(orderMap).forEach((order) => {
          entries.push(order);
        });
      });
    });
    return entries;
  }, [orders]);

  const listingsArray = useMemo(() => {
    const entries: ListingEvent[] = [];
    Object.values(listings).forEach((tokens) => {
      Object.values(tokens).forEach((listingMap) => {
        Object.values(listingMap).forEach((listing) => {
          entries.push(listing);
        });
      });
    });
    return entries;
  }, [listings]);

  const salesArray = useMemo(() => {
    const entries: SaleEvent[] = [];
    Object.values(sales).forEach((tokens) => {
      Object.values(tokens).forEach((saleMap) => {
        Object.values(saleMap).forEach((sale) => {
          entries.push(sale);
        });
      });
    });
    return entries;
  }, [sales]);

  const cartridgeContextValue = useMemo<CartridgeMarketplaceContextType>(() => ({
    chainId,
    provider,
    accesses: [],
    books: bookArray,
    orders: ordersArray,
    listings: listingsArray,
    offers: [],
    sales: salesArray,
  }), [chainId, provider, bookArray, ordersArray, listingsArray, salesArray]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      chainId,
      provider,
      toriiClient,
      book,
      orders,
      listings,
      sales,
      addOrder,
      removeOrder,
      isReady: initialized,
    }),
    [addOrder, book, chainId, initialized, listings, orders, provider, removeOrder, sales, toriiClient],
  );

  return (
    <CartridgeMarketplaceContext.Provider value={cartridgeContextValue}>
      <EternumMarketplaceContext.Provider value={value}>
        {children}
      </EternumMarketplaceContext.Provider>
    </CartridgeMarketplaceContext.Provider>
  );
};

export const useMarketplaceContext = () => {
  const context = useContext(EternumMarketplaceContext);
  if (!context) {
    throw new Error("useMarketplaceContext must be used within a MarketplaceProvider");
  }
  return context;
};
