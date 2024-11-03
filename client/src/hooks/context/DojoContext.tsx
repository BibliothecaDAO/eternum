import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { SetupNetworkResult } from "@/dojo/setupNetwork";
import Button from "@/ui/elements/Button";
import { LoadingScreen } from "@/ui/modules/LoadingScreen";
import { BurnerProvider, useBurnerManager } from "@dojoengine/create-burner";
import { useAccount, useConnect } from "@starknet-react/core";
import { ReactNode, createContext, useContext, useEffect, useMemo } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { SetupResult } from "../../dojo/setup";
import { displayAddress } from "../../ui/utils/utils";
import { useAccountStore } from "./accountStore";

interface DojoAccount {
  create: () => void;
  list: () => any[];
  get: (id: string) => any;
  select: (id: string) => void;
  account: Account | AccountInterface;
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

const DojoContext = createContext<DojoContextType | null>(null);

const requiredEnvs = ["VITE_PUBLIC_MASTER_ADDRESS", "VITE_PUBLIC_MASTER_PRIVATE_KEY", "VITE_PUBLIC_ACCOUNT_CLASS_HASH"];

for (const env of requiredEnvs) {
  if (!import.meta.env[env]) {
    throw new Error(`Environment variable ${env} is not set!`);
  }
}

type DojoProviderProps = {
  children: ReactNode;
  value: SetupResult;
};

const useMasterAccount = (rpcProvider: RpcProvider) => {
  const masterAddress = import.meta.env.VITE_PUBLIC_MASTER_ADDRESS;
  const privateKey = import.meta.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
  return useMemo(() => new Account(rpcProvider, masterAddress, privateKey), [rpcProvider, masterAddress, privateKey]);
};

const useRpcProvider = () => {
  return useMemo(
    () =>
      new RpcProvider({
        nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL || "http://localhost:5050",
      }),
    [],
  );
};

const useControllerAccount = () => {
  const { account: controllerAccount, isConnected } = useAccount();
  useEffect(() => {
    if (controllerAccount) {
      useAccountStore.getState().setAccount(controllerAccount);
    }
  }, [controllerAccount, isConnected]);
  return controllerAccount;
};

export const DojoProvider = ({ children, value }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const rpcProvider = useRpcProvider();
  const masterAccount = useMasterAccount(rpcProvider);
  const controllerAccount = useControllerAccount();

  return (
    <BurnerProvider
      initOptions={{
        masterAccount,
        accountClassHash: import.meta.env.VITE_PUBLIC_ACCOUNT_CLASS_HASH,
        rpcProvider,
        feeTokenAddress: import.meta.env.VITE_NETWORK_FEE_TOKEN,
      }}
    >
      <DojoContextProvider value={value} masterAccount={masterAccount} controllerAccount={controllerAccount!}>
        {children}
      </DojoContextProvider>
    </BurnerProvider>
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
  masterAccount,
  controllerAccount,
}: DojoProviderProps & { masterAccount: Account; controllerAccount: AccountInterface | null }) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const { create, list, get, account, select, isDeploying, clear } = useBurnerManager({
    burnerManager: value.network.burnerManager,
  });

  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting } = useAccount();
  const connectWallet = async () => {
    connect({ connector: connectors[0] });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (controllerAccount) {
        console.log("logging controllerAccount", controllerAccount);
        useAccountStore.getState().setAccount(controllerAccount);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [controllerAccount]);

  if (isConnecting || !isConnected) {
    return (
      // <div className="relative h-screen w-screen">
      //   <LoadingOroborus loading={true} />
      // </div>
      <LoadingScreen />
    );
  }

  // Conditionally render content based on controllerAccount
  if (!controllerAccount) {
    return (
      <div className="relative h-screen w-screen pointer-events-auto">
        <img className="absolute h-screen w-screen object-cover" src="/images/cover.png" alt="" />
        <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
          <div className="self-center bg-brown/90 rounded-lg border p-8 text-gold min-w-[600px] max-w-[800px] b overflow-hidden relative z-50 shadow-2xl border-white/40 border-gradient  ">
            <div className="w-full text-center pt-6">
              <div className="mx-auto flex mb-8">
                <img src="/images/eternum-logo.svg" className="w-72 mx-auto" alt="Eternum Logo" />
              </div>
            </div>
            <div className="flex space-x-2 mt-8 justify-center">
              {!isConnected && (
                <Button
                  className="px-4 text-[#ffc52a] border-2 border-[#ffc52a]"
                  variant={"default"}
                  onClick={connectWallet}
                >
                  <CartridgeSmall className="w-6 mr-2 fill-current" /> Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          account: controllerAccount || masterAccount,
          isDeploying,
          accountDisplay: displayAddress(controllerAccount?.address || ""),
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
