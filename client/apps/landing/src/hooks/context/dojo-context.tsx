import { displayAddress } from "@/lib/utils";
import { SetupNetworkResult, SetupResult } from "@bibliothecadao/dojo";
import { useAccount } from "@starknet-react/core";
import { ReactNode, createContext, useContext, useMemo } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { env } from "../../../env";
interface DojoAccount {
  account: Account | AccountInterface | null;
  accountDisplay: string;
}

interface DojoResult {
  setup: DojoContextType;
  account: DojoAccount;
  network: SetupNetworkResult;
  masterAccount: Account | AccountInterface;
}

interface DojoContextType extends SetupResult {
  masterAccount: Account | AccountInterface;
  account: DojoAccount;
}

const DojoContext = createContext<DojoContextType | null>(null);

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

  return (
    <DojoContextProvider value={value} controllerAccount={account || null}>
      {children}
    </DojoContextProvider>
  );
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
    () => new Account({provider: rpcProvider, address: masterAddress, signer: privateKey}),
    [rpcProvider, masterAddress, privateKey],
  );

  const displayAddr = controllerAccount ? displayAddress(controllerAccount.address) : displayAddress(masterAddress);

  return (
    <DojoContext.Provider
      value={{
        ...value,
        masterAccount,
        account: {
          account: controllerAccount,
          accountDisplay: displayAddr,
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
