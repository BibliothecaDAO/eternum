import { ControllerConnector } from "@cartridge/connector";
import { Account, AccountInterface } from "starknet";
import { create } from "zustand";

interface AccountState {
  account: Account | AccountInterface | null;
  setAccount: (account: Account | AccountInterface | null) => void;
  connector: ControllerConnector | null;
  setConnector: (connector: ControllerConnector) => void;
  accountName: string | null;
  setAccountName: (accountName: string | null) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
  connector: null,
  setConnector: (connector) => set({ connector }),
  accountName: null,
  setAccountName: (accountName) => set({ accountName }),
}));
