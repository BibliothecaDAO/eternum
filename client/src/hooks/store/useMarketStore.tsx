import { MarketInterface, ResourcesIds } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { useSetDirectOffers, useSetMarket } from "../helpers/useTrade";

interface MarketStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  lordsMarket: MarketInterface[];
  generalMarket: MarketInterface[];
  directOffers: MarketInterface[];
  refresh: boolean;
  setRefresh: (refresh: boolean) => void;
  refreshMarket: () => void;
  deleteTrade: (tradeId: bigint) => void;
  setMarkets: (lordsMarket: MarketInterface[], nonLordsMarket: MarketInterface[]) => void;
  setDirectOffers: (directOffers: MarketInterface[]) => void;
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
    deleteTrade: (tradeId: bigint) => {
      const lordsMarket = get().lordsMarket.filter((trade) => trade.tradeId !== tradeId);
      const generalMarket = get().generalMarket.filter((trade) => trade.tradeId !== tradeId);
      const directOffers = get().directOffers.filter((trade) => trade.tradeId !== tradeId);

      set({ lordsMarket: [...lordsMarket], generalMarket: [...generalMarket], directOffers: [...directOffers] });
    },
  };
});

export const useComputeMarket = () => {
  // todo: work on the filtering and sorting
  useSetMarket();
  useSetDirectOffers();
};

export const isLordsMarket = (order: MarketInterface) => {
  return (
    order.takerGets.length !== 1 ||
    order.makerGets.length !== 1 ||
    (order.takerGets[0]?.resourceId !== ResourcesIds["Lords"] &&
      order.makerGets[0]?.resourceId !== ResourcesIds["Lords"])
  );
};

export default useMarketStore;
