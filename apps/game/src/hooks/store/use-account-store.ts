import { Account, AccountInterface } from "starknet";
import { create } from "zustand";

interface AccountState {
  account: Account | AccountInterface | null;
  owner: string | null;
  provisioningError: string | null;
  setGameplayAccount: (account: Account | AccountInterface | null, owner: string | null, error?: string | null) => void;
}

export const useAccountStore = create<AccountState>()((set) => ({
  account: null,
  owner: null,
  provisioningError: null,
  setGameplayAccount: (account, owner, provisioningError = null) => set({ account, owner, provisioningError }),
}));
