import { create } from "zustand";

interface MarketStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  selectedResource: number;
  setSelectedResource: (resource: number) => void;

  // Unified Trade Panel state
  tradeDirection: "buy" | "sell";
  setTradeDirection: (dir: "buy" | "sell") => void;
  tradeAmount: number;
  setTradeAmount: (amount: number) => void;
  selectedVenue: "best" | "orderbook" | "amm";
  setSelectedVenue: (venue: "best" | "orderbook" | "amm") => void;
  showDepthView: boolean;
  setShowDepthView: (show: boolean) => void;
  useUnifiedTrade: boolean;
  setUseUnifiedTrade: (use: boolean) => void;
}

export const useMarketStore = create<MarketStore>((set, _get) => {
  return {
    loading: false,
    setLoading: (loading) => set({ loading }),
    selectedResource: 1,
    setSelectedResource: (resource) => {
      set({ selectedResource: resource });
    },

    // Unified Trade Panel state
    tradeDirection: "buy",
    setTradeDirection: (dir) => set({ tradeDirection: dir }),
    tradeAmount: 0,
    setTradeAmount: (amount) => set({ tradeAmount: amount }),
    selectedVenue: "best",
    setSelectedVenue: (venue) => set({ selectedVenue: venue }),
    showDepthView: false,
    setShowDepthView: (show) => set({ showDepthView: show }),
    useUnifiedTrade: false,
    setUseUnifiedTrade: (use) => set({ useUnifiedTrade: use }),
  };
});
