import { OpenOrderByPrice } from '@/hooks/services';
import { formatUnits } from 'viem';
import { create } from 'zustand';

interface SelectedPassesStore {
  selectedPasses: OpenOrderByPrice[];
  togglePass: (pass: OpenOrderByPrice) => void;
  clearSelection: () => void;
  isSelected: (tokenId: string) => boolean;
  getTotalPrice: () => number;
}

export const useSelectedPassesStore = create<SelectedPassesStore>((set, get) => ({
  selectedPasses: [],
  
  togglePass: (pass: OpenOrderByPrice) => {
    set((state) => {
      const isSelected = state.selectedPasses.some(p => p.token_id === pass.token_id);
      if (isSelected) {
        return {
          selectedPasses: state.selectedPasses.filter(p => p.token_id !== pass.token_id)
        };
      } else {
        return {
          selectedPasses: [...state.selectedPasses, pass]
        };
      }
    });
  },

  clearSelection: () => set({ selectedPasses: [] }),

  isSelected: (tokenId: string) => {
    return get().selectedPasses.some(p => p.token_id.toString() === tokenId);
  },

  getTotalPrice: () => {
    return get().selectedPasses.reduce((sum, pass) => 
      sum + (pass.best_price_hex ? Number(formatUnits(BigInt(pass.best_price_hex), 18)) : 0), 
      0
    );
  }
})); 