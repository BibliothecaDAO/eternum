import { createContext, ReactNode, useContext } from "react";
import { SetupResult } from "./dojo/setup";
import { Account, RpcProvider } from "starknet";
import { useBurner } from "@dojoengine/create-burner";

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

  const provider = new RpcProvider({
    nodeUrl: import.meta.env.VITE_KATANA_URL,
  });

  const masterAccount = new Account(
    provider,
    import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!,
    import.meta.env.VITE_KATANA_ACCOUNT_1_PRIVATE_KEY!,
  );

  const { create, list, get, account, select, isDeploying } = useBurner({
    masterAccount: masterAccount,
    accountClassHash: import.meta.env.VITE_PUBLIC_ACCOUNT_CLASS_HASH!,
    provider: provider,
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
      isDeploying,
    },
  };
};
