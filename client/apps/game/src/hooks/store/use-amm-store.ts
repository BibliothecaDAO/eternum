import { create } from "zustand";

interface AmmState {
  selectedPool: string | null;
  setSelectedPool: (pool: string | null) => void;
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
}

export const useAmmStore = create<AmmState>((set) => {
  return {
    selectedPool: null,
    setSelectedPool: (pool) => set({ selectedPool: pool }),
    slippageBps: 50,
    setSlippageBps: (bps) => set({ slippageBps: bps }),
  };
});
