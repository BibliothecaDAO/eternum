import { ID, MarketInterface } from "@bibliothecadao/eternum";
import { create } from "zustand";

interface MarketStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  lordsMarket: MarketInterface[];
  generalMarket: MarketInterface[];
  directOffers: MarketInterface[];
  refresh: boolean;
  setRefresh: (refresh: boolean) => void;
  refreshMarket: () => void;
  deleteTrade: (tradeId: ID) => void;
  setMarkets: (lordsMarket: MarketInterface[], nonLordsMarket: MarketInterface[]) => void;
  setDirectOffers: (directOffers: MarketInterface[]) => void;
  selectedResource: number;
  setSelectedResource: (resource: number) => void;
}

const useMarketStore = create<MarketStore>((set, get) => {
  return {
    loading: false,
    lordsMarket: [],
    generalMarket: [],
    directOffers: [],
    refresh: false,
    setRefresh: (refresh: boolean) => set({ refresh }),
    refreshMarket: () => {
      set({ refresh: true });
    },
    setMarkets: (lordsMarket: MarketInterface[], generalMarket: MarketInterface[]) =>
      set({ lordsMarket, generalMarket }),
    setDirectOffers: (directOffers: MarketInterface[]) => set({ directOffers }),
    setLoading: (loading) => set({ loading }),
    deleteTrade: (tradeId: ID) => {
      const lordsMarket = get().lordsMarket.filter((trade) => trade.tradeId !== tradeId);
      const generalMarket = get().generalMarket.filter((trade) => trade.tradeId !== tradeId);
      const directOffers = get().directOffers.filter((trade) => trade.tradeId !== tradeId);

      set({ lordsMarket: [...lordsMarket], generalMarket: [...generalMarket], directOffers: [...directOffers] });
    },
    selectedResource: 1,
    setSelectedResource: (resource) => {
      set({ selectedResource: resource });
    },
  };
});

export default useMarketStore;
