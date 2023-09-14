import { createContext, ReactNode, useContext, useMemo } from "react";
import { SetupResult } from "./dojo/setup";
import { Account, RpcProvider } from "starknet";
import { useBurner } from "@dojoengine/create-burner";
import { displayAddress } from "./utils/utils";

type EternumContext = {
  setup: SetupResult;
  account: {
    create: () => void;
    list: () => any[];
    get: (id: string) => any;
    select: (id: string) => void;
    account: Account;
    masterAccount: Account;
    isDeploying: boolean;
    accountDisplay: string;
    clear: () => void;
  };
};

const DojoContext = createContext<EternumContext | null>(null);

type Props = {
  children: ReactNode;
  value: SetupResult;
};

export const DojoProvider = ({ children, value }: Props) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

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

  const { create, list, get, account, select, isDeploying, clear } = useBurner({
    masterAccount: masterAccount,
    accountClassHash: import.meta.env.VITE_PUBLIC_ACCOUNT_CLASS_HASH!,
    nodeUrl: import.meta.env.VITE_KATANA_URL!,
  });

  const selectedAccount = useMemo(() => {
    return account || masterAccount;
  }, [account]);

  const contextValue: EternumContext = {
    setup: value, // the provided setup
    account: {
      create, // create a new account
      list, // list all accounts
      get, // get an account by id
      select, // select an account by id
      account: selectedAccount, // the selected account
      masterAccount, // the master account
      isDeploying, // is the account being deployed
      accountDisplay: displayAddress(account?.address!),
      clear,
    },
  };

  return <DojoContext.Provider value={contextValue}>{children}</DojoContext.Provider>;
};

export const useDojo = () => {
  const value = useContext(DojoContext);
  if (!value) throw new Error("Must be used within a DojoProvider");
  return value;
};
