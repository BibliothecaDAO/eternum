import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { useGameBootstrap } from "@/hooks/context/use-game-bootstrap";
import { useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { SetupResult } from "@/init/bootstrap";
import { OnboardingBlankOverlay } from "@/ui/layouts/onboarding-blank-overlay";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { useAccount, useConnect } from "@starknet-react/core";
import type { AccountInterface } from "starknet";
import { Account } from "starknet";

const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

type AccountGateReadyState = {
  status: "ready";
  account: Account | AccountInterface;
};

type AccountGatePendingState = {
  status: "pending" | "connect" | "initializing" | "waiting";
  fallback: ReactNode;
  connectWallet?: () => void;
};

type AccountGateState = AccountGateReadyState | AccountGatePendingState;

type BootstrapStep = {
  status: "idle" | "loading" | "error" | "ready";
  progress: number;
  error: Error | null;
  retry: () => void;
};

type AccountStep = {
  status: AccountGateState["status"] | "unavailable";
  fallback?: ReactNode;
  connectWallet?: () => void;
  account?: Account | AccountInterface;
};

type TosStep = {
  accepted: boolean;
};

type EligibilityStep = {
  status: "pending" | "ready" | "unknown";
};

type OnboardingStep = {
  open: boolean;
};

type ReadyStep = {
  canEnter: boolean;
  setupResult?: SetupResult;
  account?: Account | AccountInterface;
};

export type PlayFlowActiveStep =
  | "bootstrap"
  | "bootstrap-error"
  | "world"
  | "account"
  | "tos"
  | "eligibility"
  | "onboarding"
  | "ready";

type PlayFlowSteps = {
  world: { status: "pending" | "ready"; fallback?: ReactNode };
  bootstrap: BootstrapStep;
  account: AccountStep;
  tos: TosStep;
  eligibility: EligibilityStep;
  onboarding: OnboardingStep;
  ready: ReadyStep;
};

type UseAccountGateParams = {
  backgroundImage: string;
  setupResult: SetupResult | null;
  showBlankOverlay: boolean;
  onEnterWorld: () => void;
};

const useAccountGate = ({
  backgroundImage,
  setupResult,
  showBlankOverlay,
  onEnterWorld,
}: UseAccountGateParams): AccountGateState => {
  const controllerAccount = useControllerAccount();
  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, connector } = useAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);
  const spectatorNavigate = useSpectatorModeClick(setupResult?.components ?? null);

  const [placeholderAccount, setPlaceholderAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!setupResult) {
      setPlaceholderAccount(null);
      return;
    }

    setPlaceholderAccount((current) => {
      if (current) {
        return current;
      }

      return new Account({
        provider: setupResult.network.provider.provider,
        address: NULL_ACCOUNT.address,
        signer: NULL_ACCOUNT.privateKey,
      });
    });
  }, [setupResult]);

  useEffect(() => {
    if (!connector) {
      return;
    }

    const resolveUsername = async () => {
      try {
        const maybeConnector = connector as unknown as { username?: () => Promise<string | undefined> };
        const username = await maybeConnector.username?.();
        if (username) {
          setAccountName(username);
        }
      } catch (error) {
        console.error("Failed to load controller username", error);
      }
    };

    void resolveUsername();
  }, [connector, setAccountName]);

  const connectWallet = useCallback(() => {
    if (isConnected || isConnecting) {
      return;
    }

    const primaryConnector = connectors[0];

    if (!primaryConnector) {
      console.error("Unable to connect wallet: no connectors available");
      return;
    }

    connect({ connector: primaryConnector });
  }, [connect, connectors, isConnected, isConnecting]);

  const handleSpectate = useCallback(() => {
    spectatorNavigate();
    onEnterWorld();
  }, [onEnterWorld, spectatorNavigate]);

  // Allow showing the connect overlay even before bootstrap completes
  if (!isConnected && !isConnecting && showBlankOverlay) {
    return {
      status: "connect",
      fallback: (
        <OnboardingBlankOverlay
          backgroundImage={backgroundImage}
          onConnect={connectWallet}
          onSpectate={handleSpectate}
        />
      ),
      connectWallet,
    };
  }

  if (!setupResult || (!placeholderAccount && !controllerAccount)) {
    return {
      status: "initializing",
      fallback: <LoadingScreen backgroundImage={backgroundImage} />,
    };
  }

  if (!controllerAccount && isConnected) {
    return {
      status: "waiting",
      fallback: <LoadingScreen backgroundImage={backgroundImage} />,
    };
  }

  const resolvedAccount = controllerAccount ?? placeholderAccount;

  if (!resolvedAccount) {
    return {
      status: "pending",
      fallback: <LoadingScreen backgroundImage={backgroundImage} />,
    };
  }

  return {
    status: "ready",
    account: resolvedAccount,
  };
};

export const usePlayFlow = (backgroundImage: string) => {
  const { status, setupResult, error, retry, progress } = useGameBootstrap(true);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);

  const enterWorld = useCallback(() => {
    setShowBlankOverlay(false);
  }, [setShowBlankOverlay]);

  const accountGate = useAccountGate({
    backgroundImage,
    setupResult: status === "ready" ? (setupResult ?? null) : null,
    showBlankOverlay,
    onEnterWorld: enterWorld,
  });

  const worldStep = useMemo(() => ({ status: "ready" as const }), []);

  const bootstrapStep: BootstrapStep = useMemo(() => {
    if (status === "error") {
      return {
        status: "error",
        progress: progress ?? 0,
        error,
        retry,
      };
    }

    if (status === "ready") {
      return {
        status: "ready",
        progress: 100,
        error: null,
        retry,
      };
    }

    return {
      status: status === "idle" ? "idle" : "loading",
      progress: progress ?? 0,
      error: null,
      retry,
    };
  }, [status, progress, error, retry]);

  const accountStep: AccountStep = useMemo(() => {
    // Surface the connect overlay even if bootstrap isn't done
    if (accountGate.status === "connect") {
      return {
        status: "connect",
        fallback: accountGate.fallback,
        connectWallet: accountGate.connectWallet,
      };
    }

    if (status !== "ready") {
      return { status: "unavailable" };
    }

    if (accountGate.status === "ready") {
      return {
        status: "ready",
        account: accountGate.account,
      };
    }

    return {
      status: accountGate.status,
      fallback: accountGate.fallback,
      connectWallet: accountGate.connectWallet,
    };
  }, [accountGate, status]);

  const tosStep: TosStep = useMemo(
    () => ({
      accepted: hasAcceptedTS,
    }),
    [hasAcceptedTS],
  );

  const eligibilityStep: EligibilityStep = useMemo(() => {
    if (!hasAcceptedTS) {
      return { status: "pending" };
    }

    if (showBlankOverlay) {
      return { status: "unknown" };
    }

    return { status: "ready" };
  }, [hasAcceptedTS, showBlankOverlay]);

  const onboardingStep: OnboardingStep = useMemo(
    () => ({
      open: showBlankOverlay,
    }),
    [showBlankOverlay],
  );

  const readyStep: ReadyStep = useMemo(() => {
    if (bootstrapStep.status !== "ready" || accountStep.status !== "ready") {
      return { canEnter: false };
    }

    if (showBlankOverlay) {
      return { canEnter: false, setupResult: setupResult ?? undefined, account: accountStep.account };
    }

    return {
      canEnter: true,
      setupResult: setupResult ?? undefined,
      account: accountStep.account,
    };
  }, [bootstrapStep.status, accountStep, showBlankOverlay, setupResult]);

  const steps: PlayFlowSteps = useMemo(
    () => ({
      world: worldStep,
      bootstrap: bootstrapStep,
      account: accountStep,
      tos: tosStep,
      eligibility: eligibilityStep,
      onboarding: onboardingStep,
      ready: readyStep,
    }),
    [worldStep, bootstrapStep, accountStep, tosStep, eligibilityStep, onboardingStep, readyStep],
  );

  const activeStep: PlayFlowActiveStep = useMemo(() => {
    if (worldStep.status !== "ready") {
      return "world";
    }

    // Let users connect before bootstrap completes
    if (accountStep.status === "connect") {
      return "account";
    }

    if (bootstrapStep.status === "error") {
      return "bootstrap-error";
    }

    if (bootstrapStep.status !== "ready") {
      return "bootstrap";
    }

    if (accountStep.status !== "ready") {
      return "account";
    }

    if (!tosStep.accepted) {
      return "tos";
    }

    if (eligibilityStep.status !== "ready") {
      return "eligibility";
    }

    if (onboardingStep.open) {
      return "onboarding";
    }

    return "ready";
  }, [
    worldStep.status,
    bootstrapStep.status,
    accountStep.status,
    tosStep.accepted,
    eligibilityStep.status,
    onboardingStep.open,
  ]);

  return {
    activeStep,
    steps,
    enterWorld,
  };
};

export type UsePlayFlowResult = ReturnType<typeof usePlayFlow>;
