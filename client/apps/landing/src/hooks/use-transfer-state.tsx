import { create } from "zustand";

interface TransferState {
  transferableTokenIds: Set<string>;
  addTransferableTokenId: (tokenId: string) => void;
  removeTransferableTokenId: (tokenId: string) => void;
  clearTransferableTokenIds: () => void;
}

export const useTransferState = create<TransferState>((set) => ({
  transferableTokenIds: new Set<string>(),
  addTransferableTokenId: (tokenId) =>
    set((state) => ({
      transferableTokenIds: new Set(state.transferableTokenIds).add(tokenId),
    })),
  removeTransferableTokenId: (tokenId) =>
    set((state) => {
      const newSet = new Set(state.transferableTokenIds);
      newSet.delete(tokenId);
      return { transferableTokenIds: newSet };
    }),
  clearTransferableTokenIds: () => set({ transferableTokenIds: new Set<string>() }),
}));
