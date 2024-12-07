import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import { SetupNetworkResult } from "@/dojo/setupNetwork";
import { Position } from "@/types/Position";
import { OnboardingContainer, StepContainer } from "@/ui/layouts/Onboarding";
import { OnboardingButton } from "@/ui/layouts/OnboardingButton";
import { LoadingScreen } from "@/ui/modules/LoadingScreen";
import { ACCOUNT_CHANGE_EVENT } from "@/ui/modules/onboarding/Steps";
import { ContractAddress } from "@bibliothecadao/eternum";
import ControllerConnector from "@cartridge/connector/controller";
import { BurnerProvider, useBurnerManager } from "@dojoengine/create-burner";
import { HasValue, runQuery } from "@dojoengine/recs";
import { useAccount, useConnect } from "@starknet-react/core";
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { Env, env } from "../../../env";
import { SetupResult } from "../../dojo/setup";
import { displayAddress, getRandomBackgroundImage } from "../../ui/utils/utils";
import { useQuery } from "../helpers/useQuery";
import { useAddressStore } from "../store/useAddressStore";
import useUIStore from "../store/useUIStore";
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
      useAccountStore.getState().setAccount(account);
    }
  }, [account, isConnected]);

  useEffect(() => {
    if (connector) {
      useAccountStore.getState().setConnector(connector as unknown as ControllerConnector);
    }
  }, [connector, isConnected]);

  return account;
};

export const DojoProvider = ({ children, value, backgroundImage }: DojoProviderProps & { backgroundImage: string }) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const rpcProvider = useRpcProvider();
  const masterAccount = useMasterAccount(rpcProvider);
  const controllerAccount = useControllerAccount();

  return (
    <BurnerProvider
      initOptions={{
        masterAccount,
        accountClassHash: env.VITE_PUBLIC_ACCOUNT_CLASS_HASH,
        rpcProvider,
        feeTokenAddress: env.VITE_PUBLIC_FEE_TOKEN_ADDRESS,
      }}
    >
      <DojoContextProvider
        value={value}
        masterAccount={masterAccount}
        controllerAccount={controllerAccount!}
        backgroundImage={backgroundImage}
      >
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
  backgroundImage,
}: DojoProviderProps & {
  masterAccount: Account;
  controllerAccount: AccountInterface | null;
  backgroundImage: string;
}) => {
  const setSpectatorMode = useUIStore((state) => state.setSpectatorMode);
  const isSpectatorMode = useUIStore((state) => state.isSpectatorMode);
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setAddressName = useAddressStore((state) => state.setAddressName);

  const { handleUrlChange } = useQuery();

  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

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

  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, connector } = useAccount();

  const [accountsInitialized, setAccountsInitialized] = useState(false);

  const [retries, setRetries] = useState(0);

  const connectWallet = async () => {
    try {
      console.log("Attempting to connect wallet...");
      await connect({ connector: connectors[0] });
      console.log("Wallet connected successfully.");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const onSpectatorModeClick = () => {
    setSpectatorMode(true);
    handleUrlChange(new Position({ x: 0, y: 0 }).toMapLocationUrl());
    window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
    showBlankOverlay(false);
  };

  // Determine which account to use based on environment
  const isDev = env.VITE_PUBLIC_DEV === true;
  const accountToUse = isDev
    ? burnerAccount
    : isSpectatorMode
      ? new Account(value.network.provider.provider, "0x0", "0x0")
      : controllerAccount;

  useEffect(() => {
    const setUserName = async () => {
      const username = await (connector as ControllerConnector)?.username();
      if (!username) return;

      //   value.systemCalls.set_address_name({
      //     signer: controllerAccount!,
      //     name: username,
      //   });
      //   setAddressName(username);
    };

    if (isDev) {
      if (burnerAccount) {
        console.log("Setting account from burner hook:", burnerAccount);
        useAccountStore.getState().setAccount(burnerAccount);
        setAccountsInitialized(true);
      } else {
        console.log("Burner account is null in development.");
      }
    } else {
      if (controllerAccount) {
        console.log("Setting account from controllerAccount:", controllerAccount);
        useAccountStore.getState().setAccount(controllerAccount);

        const addressName = runQuery([
          HasValue(value.components.AddressName, { address: ContractAddress(controllerAccount!.address) }),
        ]);

        if (addressName.size === 0) {
          setUserName();
        }

        setAccountsInitialized(true);
      } else {
        console.log("ControllerAccount is null in production or not connected.");
        setTimeout(() => {
          setRetries((prevRetries) => {
            // Explicitly set a maximum number of renders/retries
            if (prevRetries < 10) {
              // Change 10 to your desired number of renders
              // Force a re-render by updating state
              return prevRetries + 1;
            } else {
              setAccountsInitialized(true);
              return prevRetries;
            }
          });
        }, 100);
      }
    }
  }, [isDev, controllerAccount, burnerAccount, retries]);

  const bg = `/images/covers/${getRandomBackgroundImage()}.png`;

  if (!accountsInitialized) {
    return <LoadingScreen backgroundImage={bg} />;
  }

  // Handle Loading Screen
  if (isDev) {
    if (!burnerAccount) {
      return <LoadingScreen backgroundImage={bg} />;
    }
  } else {
    if (isConnecting) {
      return <LoadingScreen backgroundImage={bg} />;
    }
    if (!isConnected && !isConnecting && !controllerAccount && !isSpectatorMode) {
      return (
        <OnboardingContainer backgroundImage={backgroundImage}>
          <StepContainer>
            <div className="flex space-x-8 mt-2 md:mt-4 justify-center">
              {!isConnected && (
                <>
                  <OnboardingButton onClick={onSpectatorModeClick}>
                    <Eye className="w-5 h-5 fill-current mr-2" /> <div>Spectate</div>
                  </OnboardingButton>
                  <OnboardingButton
                    onClick={connectWallet}
                    className="!bg-[#FCB843] !text-black border-none text-black"
                  >
                    <CartridgeSmall className="w-5 md:w-6 mr-1 md:mr-2 fill-black" /> Log In
                  </OnboardingButton>
                </>
              )}
            </div>
          </StepContainer>
        </OnboardingContainer>
      );
    }

    if (!controllerAccount && isConnected) {
      // Connected but controllerAccount is not set yet
      return <LoadingScreen backgroundImage={backgroundImage} />;
    }
  }

  // Once account is set, render the children
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
          account: accountToUse as Account | AccountInterface,
          isDeploying,
          accountDisplay: displayAddress((accountToUse as Account | AccountInterface)?.address || ""),
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
