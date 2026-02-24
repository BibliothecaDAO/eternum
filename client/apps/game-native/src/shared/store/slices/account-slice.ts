import {Account, AccountInterface} from 'starknet';

export interface AccountSlice {
  account: Account | AccountInterface | null;
  setAccount: (account: AccountInterface | null) => void;
  addressName: string | undefined;
  setAddressName: (addressName: string | undefined) => void;
}

export const createAccountSlice = (set: any): AccountSlice => ({
  account: null,
  setAccount: (account: AccountInterface | null) => set({account}),
  addressName: undefined,
  setAddressName: (addressName: string | undefined) => set({addressName}),
});
