import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useAddressStore } from "@/hooks/store/use-address-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { OnboardingContainer, StepContainer } from "@/ui/layouts/onboarding";
import { OnboardingButton } from "@/ui/layouts/onboarding-button";
import { CountdownTimer, LoadingScreen } from "@/ui/modules/loading-screen";
import { SpectateButton } from "@/ui/modules/onboarding/steps";
import { displayAddress } from "@/ui/utils/utils";
import { getRandomRealmEntity } from "@/utils/realms";
import { ContractAddress, SetupResult } from "@bibliothecadao/eternum";
import { DojoContext } from "@bibliothecadao/react";
import ControllerConnector from "@cartridge/connector/controller";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { useAccount, useConnect } from "@starknet-react/core";
import { ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { Env, env } from "../../../env";
import { useNavigateToHexView } from "../helpers/use-navigate";
import { useNavigateToRealmViewByAccount } from "../helpers/use-navigate-to-realm-view-by-account";

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
}: DojoProviderProps & {
  masterAccount: Account;
  controllerAccount: AccountInterface | null;
  backgroundImage: string;
}) => {
  useNavigateToRealmViewByAccount(value.components);

  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setAddressName = useAddressStore((state) => state.setAddressName);

  const currentValue = useContext(DojoContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, connector } = useAccount();

  const [accountsInitialized, setAccountsInitialized] = useState(false);

  const navigateToHexView = useNavigateToHexView();

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

  const [accountToUse, setAccountToUse] = useState<Account | AccountInterface>(
    new Account(value.network.provider.provider, NULL_ACCOUNT.address, NULL_ACCOUNT.privateKey),
  );

  const onSpectatorModeClick = () => {
    const randomRealmEntity = getRandomRealmEntity(value.components);
    const structureBase = randomRealmEntity && getComponentValue(value.components.Structure, randomRealmEntity)?.base;
    structureBase && navigateToHexView(new Position({ x: structureBase.coord_x, y: structureBase.coord_y }));
  };

  useEffect(() => {
    if (!controllerAccount) {
      setAccountToUse(new Account(value.network.provider.provider, NULL_ACCOUNT.address, NULL_ACCOUNT.privateKey));
    } else {
      setAccountToUse(controllerAccount);
    }
  }, [controllerAccount]);

  useEffect(() => {
    const setUserName = async () => {
      
      let username;
      try {
        username = await (connector as unknown as ControllerConnector)?.username();
        if (!username) {
          username = "adventurer"; // Default to adventurer in local mode
        }
      } catch (error) {
        username = "adventurer"; // If username() fails, we're in local mode
        console.log("Using default username 'adventurer' for local mode");
      }

      const usernameFelt = cairoShortStringToFelt(username.slice(0, 31));
      value.systemCalls.set_address_name({
        signer: controllerAccount!,
        name: usernameFelt,
      });
      setAddressName(username);
    };

    if (controllerAccount) {
      useAccountStore.getState().setAccount(controllerAccount);

      const addressName = runQuery([
        HasValue(value.components.AddressName, { address: ContractAddress(controllerAccount!.address) }),
      ]);

      if (addressName.size === 0) {
        setUserName();
      }

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

  if (!accountsInitialized) {
    return <LoadingScreen backgroundImage={backgroundImage} />;
  }

  if (isConnecting) {
    return (
      <>
        <CountdownTimer backgroundImage={backgroundImage} />
        <LoadingScreen backgroundImage={backgroundImage} />
      </>
    );
  }

  if (!isConnected && !isConnecting && showBlankOverlay) {
    return (
      <>
        <CountdownTimer backgroundImage={backgroundImage} />
        <OnboardingContainer backgroundImage={backgroundImage}>
          <StepContainer>
            <div className="flex justify-center space-x-8 mt-2 md:mt-4">
              {!isConnected && (
                <>
                  <SpectateButton onClick={onSpectatorModeClick} />
                  <OnboardingButton
                    onClick={connectWallet}
                    className="!bg-[#FCB843] !text-black border-none hover:!bg-[#FCB843]/80"
                  >
                    <CartridgeSmall className="w-5 md:w-6 mr-1 md:mr-2 fill-black" />
                    Log In
                  </OnboardingButton>
                </>
              )}
            </div>
          </StepContainer>
        </OnboardingContainer>
      </>
    );
  }

  if (!controllerAccount && isConnected) {
    // Connected but controllerAccount is not set yet
    return <LoadingScreen backgroundImage={backgroundImage} />;
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
