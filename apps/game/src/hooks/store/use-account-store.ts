import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { ContractAddress } from "@bibliothecadao/types";
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

/**
 * The player this client views and acts as: null with no gameplay account, and null in a session entered to spectate
 * (whose play route signs with the read-only spectator account), so no viewer ever owns a row by holding address zero.
 */
const viewerOf = (account: AccountState["account"]): ContractAddress | null => {
  if (!account?.address || isExplicitSpectateSession()) return null;
  const address = ContractAddress(account.address);
  return address === 0n ? null : address;
};

export const accountAddress = (): ContractAddress | null => viewerOf(useAccountStore.getState().account);

export const useAccountAddress = (): ContractAddress | null => useAccountStore((state) => viewerOf(state.account));
