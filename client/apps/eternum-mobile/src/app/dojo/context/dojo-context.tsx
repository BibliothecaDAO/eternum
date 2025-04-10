import { displayAddress } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Loading } from "@/shared/ui/loading";
import { SetupResult } from "@bibliothecadao/dojo";
import { DojoContext } from "@bibliothecadao/react";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount } from "@starknet-react/core";
import { ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { Env, env } from "../../../../env";

export const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

const requiredEnvs: (keyof Env)[] = [
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

const useMasterAccount = (rpcProvider: RpcProvider) => {
  const masterAddress = env.VITE_PUBLIC_MASTER_ADDRESS;
  const privateKey = env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
  return useMemo(() => new Account(rpcProvider, masterAddress, privateKey), [rpcProvider, masterAddress, privateKey]);
};

const useRpcProvider = () => {
  return useMemo(
    () =>
      new RpcProvider({
        nodeUrl: env.VITE_PUBLIC_NODE_URL || "http://localhost:5050",
      }),
    [],
  );
};

const useControllerAccount = () => {
  const { account, connector, isConnected } = useAccount();

  useEffect(() => {
    if (account) {
      useStore.getState().setAccount(account);
    }
  }, [account, isConnected]);

  useEffect(() => {
    if (connector) {
      useStore.getState().setConnector(connector as unknown as ControllerConnector);
    }
  }, [connector, isConnected]);

  return account;
};

export const DojoProvider = ({ children, value }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const rpcProvider = useRpcProvider();
  const masterAccount = useMasterAccount(rpcProvider);
  const controllerAccount = useControllerAccount();

  return (
    <DojoContextProvider value={value} masterAccount={masterAccount} controllerAccount={controllerAccount || null}>
      {children}
    </DojoContextProvider>
  );
};

const DojoContextProvider = ({
  children,
  value,
  masterAccount,
  controllerAccount,
}: DojoProviderProps & {
  masterAccount: Account;
  controllerAccount: AccountInterface | null;
}) => {
  // const setAddressName = useStore((state) => state.setAddressName);

  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  // const { connect, connectors } = useConnect();
  const { isConnected, isConnecting } = useAccount();

  const [accountsInitialized, setAccountsInitialized] = useState(false);

  const [retries, setRetries] = useState(0);

  // const connectWallet = async () => {
  //   try {
  //     console.log("Attempting to connect wallet...");
  //     await connect({ connector: connectors[0] });
  //     console.log("Wallet connected successfully.");
  //   } catch (error) {
  //     console.error("Failed to connect wallet:", error);
  //   }
  // };

  const [accountToUse, setAccountToUse] = useState<Account | AccountInterface>(
    new Account(value.network.provider.provider, NULL_ACCOUNT.address, NULL_ACCOUNT.privateKey),
  );

  useEffect(() => {
    if (!controllerAccount) {
      setAccountToUse(new Account(value.network.provider.provider, NULL_ACCOUNT.address, NULL_ACCOUNT.privateKey));
    } else {
      setAccountToUse(controllerAccount);
    }
  }, [controllerAccount]);

  useEffect(() => {
    // const setUserName = async () => {
    //   const username = await (connector as ControllerConnector)?.username();
    //   if (!username) return;

    //   const usernameFelt = cairoShortStringToFelt(username.slice(0, 31));
    //   value.systemCalls.set_address_name({
    //     signer: controllerAccount!,
    //     name: usernameFelt,
    //   });
    //   setAddressName(username);
    // };

    if (controllerAccount) {
      useStore.getState().setAccount(controllerAccount);

      setAccountsInitialized(true);
    } else {
      setTimeout(() => {
        setRetries((prevRetries) => {
          if (prevRetries < 10) {
            return prevRetries + 1;
          } else {
            setAccountsInitialized(true);
            return prevRetries;
          }
        });
      }, 100);
    }
  }, [controllerAccount, retries]);

  if (!accountsInitialized || isConnecting) {
    return (
      <div className="h-screen flex justify-center items-center">
        <Loading />
      </div>
    );
  }

  if (!isConnected && !isConnecting) {
    return children;
  }

  if (!controllerAccount && isConnected) {
    return (
      <div className="h-screen flex justify-center items-center">
        <Loading text="Initializing..." />
      </div>
    );
  }

  // Once account is set, render the children
  return (
    <DojoContext.Provider
      value={{
        ...value,
        masterAccount,
        account: {
          account: accountToUse,
          accountDisplay: displayAddress((accountToUse as Account | AccountInterface)?.address || ""),
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
