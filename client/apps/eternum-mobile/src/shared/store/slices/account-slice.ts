import { ControllerConnector } from "@cartridge/connector";
import { Account, AccountInterface } from "starknet";

export interface AccountSlice {
  account: Account | AccountInterface | null;
  setAccount: (account: AccountInterface | null) => void;
  connector: ControllerConnector | null;
  setConnector: (connector: ControllerConnector) => void;
  addressName: undefined | string;
  setAddressName: (addressName: string | undefined) => void;
}

export const createAccountSlice = (set: any) => ({
  account: null,
  setAccount: (account: AccountInterface | null) => set({ account }),
  connector: null,
  setConnector: (connector: ControllerConnector) => set({ connector }),
  addressName: undefined,
  setAddressName: (addressName: string | undefined) => set({ addressName }),
});
