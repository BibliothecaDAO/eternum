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
  type ToriiClient,
} from "@cartridge/arcade";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import {
  MarketplaceClientProvider,
  createMarketplaceClient,
  type MarketplaceClient,
} from "@cartridge/arcade/marketplace";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { constants, getChecksumAddress } from "starknet";

import { env } from "../../../env";
import { useDojo } from "./dojo-context";



export interface MarketplaceContextValue {
  chainId: constants.StarknetChainId;
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

export const DEFAULT_MARKETPLACE_OPTIONS: MarketplaceOptions = {
  book: true,
  order: true,
  listing: true,
  sale: true,
  offer: false,
  access: false,
};


export const MarketplaceProvider = ({ children }: { children: ReactNode }) => {
  const currentValue = useContext(EternumMarketplaceContext);
  if (currentValue) {
    throw new Error("MarketplaceProvider can only be used once in the component tree");
  }
  const { network } = useDojo();
  const [marketplaceClient, setMarketplaceClient] = useState<MarketplaceClient | null>(null);

  useEffect(() => {
    const initializeClient = async () => {
      try {
        const client = await createMarketplaceClient({ chainId: constants.StarknetChainId.SN_MAIN, defaultProject: env.VITE_PUBLIC_ARCADE_SLOT });
        setMarketplaceClient(client);
      } catch (error) {
        setMarketplaceClient(null);
        console.error("Failed to create marketplace client", error);
      }
    };

    void initializeClient();

  }, []);


  const toriiClient = useMemo(() => {
    const client = network?.toriiClient;
    if (!client) return undefined;
    return client as unknown as ToriiClient;
  }, [network]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      chainId: constants.StarknetChainId.SN_MAIN,
      toriiClient,
      book: null,
      orders: {},
      listings: {},
      sales: {},
      // addOrder,
      // removeOrder,
      isReady: null !== marketplaceClient,
    }),
    [],
  );

  if (!marketplaceClient) {
    return <FullPageLoader />;
  }

  return (
    <MarketplaceClientProvider client={marketplaceClient} config={{ chainId: constants.StarknetChainId.SN_MAIN, defaultProject: env.VITE_PUBLIC_ARCADE_SLOT }}>
      <EternumMarketplaceContext.Provider value={value}>
        {children}
      </EternumMarketplaceContext.Provider>
    </MarketplaceClientProvider>
  );
};

export const useMarketplaceContext = () => {
  const context = useContext(EternumMarketplaceContext);
  if (!context) {
    throw new Error("useMarketplaceContext must be used within a MarketplaceProvider");
  }
  return context;
};
