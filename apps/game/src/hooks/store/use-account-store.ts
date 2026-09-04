import { Account, AccountInterface } from "starknet";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AccountState {
  account: Account | AccountInterface | null;
  owner: string | null;
  provisioningError: string | null;
  setGameplayAccount: (account: Account | AccountInterface | null, owner: string | null, error?: string | null) => void;
  accountName: string | null;
  setAccountName: (accountName: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      account: null,
      owner: null,
      provisioningError: null,
      setGameplayAccount: (account, owner, provisioningError = null) => set({ account, owner, provisioningError }),
      accountName: null,
      setAccountName: (accountName) => set({ accountName }),
    }),
    {
      name: "eternum_account_store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only persist simple, serializable fields
      partialize: (state) => ({ accountName: state.accountName }),
    },
  ),
);
