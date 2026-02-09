/**
 * Game route module - lazy loaded to avoid pulling heavy deps (World, Dojo, Three.js, etc.)
 * into the landing page bundle.
 */
import { ErrorBoundary, Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useEffect } from "react";
import type { Account, AccountInterface } from "starknet";
import { env } from "../env";
import { DojoProvider } from "./hooks/context/dojo-context";
import { MetagameProvider } from "./hooks/context/metagame-provider";
import { useUnifiedOnboarding } from "./hooks/context/use-unified-onboarding";
import { useTransactionListener } from "./hooks/use-transaction-listener";
import type { SetupResult } from "./init/bootstrap";
import { StoryEventToastBridge } from "./ui/features/story-events";
import { resolveOnboardingPhaseForScreen, shouldRenderOnboardingScreen } from "./ui/layouts/loading-flow";
import { UnifiedOnboardingScreen } from "./ui/layouts/unified-onboarding";
import { World } from "./ui/layouts/world";

type ReadyAppProps = {
  backgroundImage: string;
  setupResult: SetupResult;
  account: Account | AccountInterface;
};

const TransactionListenerBridge = () => {
  useTransactionListener();
  return null;
};

const ReadyApp = ({ backgroundImage, setupResult, account }: ReadyAppProps) => {
  return (
    <DojoProvider value={setupResult} account={account}>
      <MetagameProvider>
        <ErrorBoundary>
          <StoryEventToastBridge />
          <TransactionListenerBridge />
          <TransactionNotification />
          <World backgroundImage={backgroundImage} />
          <WorldLoading />
          <Toaster />
        </ErrorBoundary>
      </MetagameProvider>
    </DojoProvider>
  );
};

export const GameRoute = ({ backgroundImage }: { backgroundImage: string }) => {
  useEffect(() => {
    if (!env.VITE_TRACING_ENABLED) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setupTracing = async () => {
      const { initializeTracing, cleanupTracing } = await import("./tracing");
      if (cancelled) return;
      initializeTracing({ enableMetricsCollection: false });
      cleanup = () => {
        void cleanupTracing();
      };
    };

    void setupTracing();

    return () => {
      cancelled = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const state = useUnifiedOnboarding(backgroundImage);
  const { phase, setupResult, account } = state;
  const hasSetupResult = setupResult !== null;
  const hasAccount = account !== null;
  const shouldRenderOnboarding = shouldRenderOnboardingScreen(phase, hasSetupResult, hasAccount);
  const onboardingPhase = resolveOnboardingPhaseForScreen(phase, hasSetupResult, hasAccount);

  if (shouldRenderOnboarding) {
    return <UnifiedOnboardingScreen backgroundImage={backgroundImage} state={{ ...state, phase: onboardingPhase }} />;
  }

  if (!setupResult || !account) {
    return <UnifiedOnboardingScreen backgroundImage={backgroundImage} state={{ ...state, phase: "loading" }} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={setupResult} account={account} />;
};
