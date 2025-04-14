import { SetupNetworkResult, SetupResult } from "@bibliothecadao/dojo";
import { createContext, useContext } from "react";
import { Account, AccountInterface } from "starknet";

export interface DojoAccount {
  account: Account | AccountInterface;
  accountDisplay: string;
}

export interface DojoContextType extends SetupResult {
  masterAccount: Account | AccountInterface;
  account: DojoAccount;
}

export interface DojoResult {
  setup: DojoContextType;
  account: DojoAccount;
  network: SetupNetworkResult;
  masterAccount: Account | AccountInterface;
}

export const DojoContext = createContext<DojoContextType | null>(null);

export const useDojo = (): DojoResult => {
  const contextValue = useContext(DojoContext);
  if (!contextValue) throw new Error("The `useDojo` hook must be used within a `DojoProvider`");

  return {
    setup: contextValue,
    account: contextValue.account,
    network: contextValue.network,
    masterAccount: contextValue.masterAccount,
  };
};
