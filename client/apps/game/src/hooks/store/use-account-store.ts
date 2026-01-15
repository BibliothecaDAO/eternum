import { ControllerConnector } from "@cartridge/connector";
import { Account, AccountInterface } from "starknet";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AccountState {
  account: Account | AccountInterface | null;
  setAccount: (account: Account | AccountInterface | null) => void;
  connector: ControllerConnector | null;
  setConnector: (connector: ControllerConnector | null) => void;
  accountName: string | null;
  setAccountName: (accountName: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      account: null,
      setAccount: (account) => set({ account }),
      connector: null,
      setConnector: (connector) => set({ connector }),
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
