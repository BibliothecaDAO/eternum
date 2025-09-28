import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { OnboardingBlankOverlay } from "@/ui/layouts/onboarding-blank-overlay";

import { LoadingScreen } from "@/ui/modules/loading-screen";
import { displayAddress } from "@/ui/utils/utils";
import { SetupResult } from "@bibliothecadao/dojo";
import { DojoContext } from "@bibliothecadao/react";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount, useConnect } from "@starknet-react/core";
import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { Env, env } from "../../../env";
import { useSpectatorModeClick } from "../helpers/use-navigate";

const NULL_ACCOUNT = {
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

interface DojoProviderProps {
  children: ReactNode;
  value: SetupResult;
  backgroundImage: string;
}

const MAX_ACCOUNT_INITIALIZATION_RETRIES = 10;
const RETRY_INTERVAL_MS = 100;

const useMasterAccount = (rpcProvider: RpcProvider) => {
  const masterAddress = env.VITE_PUBLIC_MASTER_ADDRESS;
  const privateKey = env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
  return useMemo(
    () => new Account({ provider: rpcProvider, address: masterAddress, signer: privateKey }),
    [rpcProvider, masterAddress, privateKey],
  );
};

const useRpcProvider = () => {
  return useMemo(
    () =>
      new RpcProvider({
        nodeUrl: env.VITE_PUBLIC_NODE_URL,
      }),
    [],
  );
};

export const DojoProvider = ({ children, value, backgroundImage }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const rpcProvider = useRpcProvider();
  const masterAccount = useMasterAccount(rpcProvider);
  const controllerAccount = useControllerAccount();

  return (
    <DojoContextProvider
      value={value}
      masterAccount={masterAccount}
      controllerAccount={controllerAccount || null}
      backgroundImage={backgroundImage}
    >
      {children}
    </DojoContextProvider>
  );
};

const DojoContextProvider = ({
  children,
  value,
  masterAccount,
  controllerAccount,
  backgroundImage,
}: Omit<DojoProviderProps, "backgroundImage"> & {
  masterAccount: Account;
  controllerAccount: AccountInterface | null;
  backgroundImage: string;
}) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, connector } = useAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!connector) {
        return;
      }

      const username = await (connector as unknown as ControllerConnector)?.username();
      if (username) {
        setAccountName(username);
      }
    };

    fetchUsername();
  }, [connector, setAccountName]);

  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [retries, setRetries] = useState(0);

  const connectWallet = useCallback(async () => {
    if (isConnected || isConnecting) {
      return;
    }

    const primaryConnector = connectors[0];

    if (!primaryConnector) {
      console.error("Failed to connect wallet: no connector available");
      return;
    }

    try {
      console.log("Attempting to connect wallet...");
      await connect({ connector: primaryConnector });
      console.log("Wallet connected successfully.");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  }, [connect, connectors, isConnected, isConnecting]);

  const [accountToUse, setAccountToUse] = useState<Account | AccountInterface>(() =>
    new Account({
      provider: value.network.provider.provider,
      address: NULL_ACCOUNT.address,
      signer: NULL_ACCOUNT.privateKey,
    }),
  );

  const onSpectatorModeClick = useSpectatorModeClick(value.components);

  useEffect(() => {
    if (controllerAccount) {
      setAccountToUse(controllerAccount);
      setAccountsInitialized(true);
      return;
    }

    if (retries >= MAX_ACCOUNT_INITIALIZATION_RETRIES) {
      setAccountsInitialized(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRetries((prevRetries) => prevRetries + 1);
    }, RETRY_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [controllerAccount, retries]);

  if (!accountsInitialized) {
    return <LoadingScreen backgroundImage={backgroundImage} />;
  }

  if (!isConnected && !isConnecting && showBlankOverlay) {
    return (
      <OnboardingBlankOverlay
        backgroundImage={backgroundImage}
        onConnect={connectWallet}
        onSpectate={onSpectatorModeClick}
      />
    );
  }

  if (!controllerAccount && isConnected) {
    // Connected but controllerAccount is not set yet
    return <LoadingScreen backgroundImage={backgroundImage} />;
  }

  // Once account is set, render the children
  return (
    <>
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
    </>
  );
};
