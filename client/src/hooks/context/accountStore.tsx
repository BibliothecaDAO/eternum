import { Account, AccountInterface } from "starknet";
import { create } from "zustand";

interface AccountState {
  account: Account | AccountInterface | null;
  setAccount: (account: Account | AccountInterface) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
}));
