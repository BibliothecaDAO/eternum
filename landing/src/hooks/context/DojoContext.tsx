import { SetupNetworkResult } from "@/dojo/setupNetwork";
import { displayAddress } from "@/lib/utils";
import { BurnerProvider, useBurnerManager } from "@dojoengine/create-burner";
import { useAccount } from "@starknet-react/core";
import { ReactNode, createContext, useContext, useMemo } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { env } from "../../../env";
import { SetupResult } from "../../dojo/setup";

interface DojoAccount {
  create: () => void;
  list: () => any[];
  get: (id: string) => any;
  select: (id: string) => void;
  account: Account | AccountInterface | null;
  isDeploying: boolean;
  clear: () => void;
  accountDisplay: string;
}

interface DojoContextType extends SetupResult {
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

const requiredEnvs: (keyof typeof env)[] = [
  "VITE_PUBLIC_MASTER_ADDRESS",
  "VITE_PUBLIC_MASTER_PRIVATE_KEY",
  "VITE_PUBLIC_ACCOUNT_CLASS_HASH",
];

for (const _env of requiredEnvs) {
  if (!env[_env]) {
    throw new Error(`Environment variable ${_env} is not set!`);
  }
}

type DojoProviderProps = {
  children: ReactNode;
  value: SetupResult;
};

export const DojoProvider = ({ children, value }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const { account } = useAccount();

  if (import.meta.env.VITE_PUBLIC_DEV == "true") {
    const rpcProvider = new RpcProvider({
      nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL || "http://localhost:5050",
    });

    const masterAddress = import.meta.env.VITE_PUBLIC_MASTER_ADDRESS;
    const privateKey = import.meta.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
    const accountClassHash = import.meta.env.VITE_PUBLIC_ACCOUNT_CLASS_HASH;
    const feeTokenAddress = import.meta.env.VITE_NETWORK_FEE_TOKEN;
    const masterAccount = new Account(rpcProvider, masterAddress, privateKey);

    return (
      <BurnerProvider initOptions={{ masterAccount, accountClassHash, rpcProvider, feeTokenAddress }}>
        <DojoContextProvider value={value}>{children}</DojoContextProvider>
      </BurnerProvider>
    );
  } else {
    return (
      <DojoContextProvider value={value} controllerAccount={account}>
        {children}
      </DojoContextProvider>
    );
  }
};

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

const DojoContextProvider = ({
  children,
  value,
  controllerAccount,
}: DojoProviderProps & { controllerAccount: AccountInterface | null }) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const rpcProvider = useMemo(
    () =>
      new RpcProvider({
        nodeUrl: env.VITE_PUBLIC_NODE_URL || "http://localhost:5050",
      }),
    [],
  );

  const masterAddress = env.VITE_PUBLIC_MASTER_ADDRESS;
  const privateKey = env.VITE_PUBLIC_MASTER_PRIVATE_KEY;

  const masterAccount = useMemo(
    () => new Account(rpcProvider, masterAddress, privateKey),
    [rpcProvider, masterAddress, privateKey],
  );

  const {
    create,
    list,
    get,
    account: burnerAccount,
    select,
    isDeploying,
    clear,
  } = useBurnerManager({
    burnerManager: value.network.burnerManager,
  });

  console.log("controllerAccount", controllerAccount);

  // Determine which account to use based on environment
  const isDev = env.VITE_PUBLIC_DEV === true;
  const accountToUse = isDev ? burnerAccount : controllerAccount;

  console.log("dev " + isDev);
  console.log(accountToUse?.address);

  const activeAccount = accountToUse || (isDev ? masterAccount : null);
  const displayAddr = activeAccount ? displayAddress(activeAccount.address) : displayAddress(masterAddress);

  return (
    <DojoContext.Provider
      value={{
        ...value,
        masterAccount,
        account: {
          create,
          list,
          get,
          select,
          clear,
          account: activeAccount,
          isDeploying,
          accountDisplay: displayAddr,
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
