import ControllerConnector from "@cartridge/connector/controller";
import { Account, AccountInterface } from "starknet";
import { create } from "zustand";

interface AccountState {
  account: Account | AccountInterface | null;
  setAccount: (account: Account | AccountInterface) => void;
  connector: ControllerConnector | null;
  setConnector: (connector: ControllerConnector) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
  connector: null,
  setConnector: (connector) => set({ connector }),
}));
