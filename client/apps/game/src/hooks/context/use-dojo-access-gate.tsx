import { ReactNode, useCallback, useEffect, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { OnboardingBlankOverlay } from "@/ui/layouts/onboarding-blank-overlay";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount, useConnect } from "@starknet-react/core";
import { Account, AccountInterface } from "starknet";

import type { SetupResult } from "@/init/bootstrap";
import { useSpectatorModeClick } from "../helpers/use-navigate";

const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

const MAX_ACCOUNT_INITIALIZATION_RETRIES = 10;
const RETRY_INTERVAL_MS = 100;

interface DojoAccessGateReadyState {
  type: "ready";
  account: Account | AccountInterface;
}

interface DojoAccessGatePendingState {
  type: "pending";
  fallback: ReactNode;
}

export type DojoAccessGateState = DojoAccessGateReadyState | DojoAccessGatePendingState;

interface UseDojoAccessGateParams {
  backgroundImage: string;
  setupResult: SetupResult;
  controllerAccount: AccountInterface | null;
}

export const useDojoAccessGate = ({
  backgroundImage,
  setupResult,
  controllerAccount,
}: UseDojoAccessGateParams): DojoAccessGateState => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, connector } = useAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);
  const spectatorNavigate = useSpectatorModeClick(setupResult.components);

  const [accountToUse, setAccountToUse] = useState<Account | AccountInterface>(
    () =>
      new Account({
        provider: setupResult.network.provider.provider,
        address: NULL_ACCOUNT.address,
        signer: NULL_ACCOUNT.privateKey,
      }),
  );
  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!controllerAccount) {
      return;
    }

    setAccountToUse(controllerAccount);
    setAccountsInitialized(true);
  }, [controllerAccount]);

  useEffect(() => {
    if (controllerAccount || accountsInitialized) {
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
  }, [controllerAccount, accountsInitialized, retries]);

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
      await connect({ connector: primaryConnector });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  }, [connect, connectors, isConnected, isConnecting]);

  useEffect(() => {
    if (!connector) {
      return;
    }

    const fetchUsername = async () => {
      try {
        const username = await (connector as unknown as ControllerConnector)?.username?.();
        if (username) {
          setAccountName(username);
        }
      } catch (error) {
        console.error("Failed to get username:", error);
      }
    };

    void fetchUsername();
  }, [connector, setAccountName]);

  if (!accountsInitialized) {
    return {
      type: "pending",
      fallback: <LoadingScreen backgroundImage={backgroundImage} />,
    };
  }

  if (!isConnected && !isConnecting && showBlankOverlay) {
    return {
      type: "pending",
      fallback: (
        <OnboardingBlankOverlay
          backgroundImage={backgroundImage}
          onConnect={connectWallet}
          onSpectate={spectatorNavigate}
        />
      ),
    };
  }

  if (!controllerAccount && isConnected) {
    return {
      type: "pending",
      fallback: <LoadingScreen backgroundImage={backgroundImage} />,
    };
  }

  return {
    type: "ready",
    account: accountToUse,
  };
};
