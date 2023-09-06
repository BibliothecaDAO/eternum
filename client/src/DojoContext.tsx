import { createContext, ReactNode, useContext, useMemo } from "react";
import { SetupResult } from "./dojo/setup";
import { Account, RpcProvider } from "starknet";
import { useBurner } from "@dojoengine/create-burner";
import { displayAddress } from "./utils/utils";

const DojoContext = createContext<SetupResult | null>(null);

type Props = {
  children: ReactNode;
  value: SetupResult;
};

export const DojoProvider = ({ children, value }: Props) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");
  return <DojoContext.Provider value={value}>{children}</DojoContext.Provider>;
};

export const useDojo = () => {
  const value = useContext(DojoContext);

  const provider = useMemo(
    () =>
      new RpcProvider({
        nodeUrl: import.meta.env.VITE_KATANA_URL!,
      }),
    [],
  );

  const masterAddress = import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!;
  const privateKey = import.meta.env.VITE_KATANA_ACCOUNT_1_PRIVATE_KEY!;
  const masterAccount = useMemo(
    () => new Account(provider, masterAddress, privateKey),
    [provider, masterAddress, privateKey],
  );

  const { create, list, get, account, select, isDeploying } = useBurner({
    masterAccount: masterAccount,
    accountClassHash: import.meta.env.VITE_PUBLIC_ACCOUNT_CLASS_HASH!,
  });

  if (!value) throw new Error("Must be used within a DojoProvider");
  return {
    setup: value,
    account: {
      create,
      list,
      get,
      select,
      account: account ? account : masterAccount,
      masterAccount,
      isDeploying,
      accountDisplay: displayAddress(account?.address!),
    },
  };
};
