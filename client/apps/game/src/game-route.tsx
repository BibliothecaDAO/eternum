/**
 * Game route module - lazy loaded to avoid pulling heavy deps (World, Dojo, Three.js, etc.)
 * into the landing page bundle.
 */
import { ErrorBoundary, Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import type { Account, AccountInterface } from "starknet";
import { env } from "../env";
import { DojoProvider } from "./hooks/context/dojo-context";
import { useUnifiedOnboarding } from "./hooks/context/use-unified-onboarding";
import { useTransactionListener } from "./hooks/use-transaction-listener";
import type { SetupResult } from "./init/bootstrap";
import { StoryEventToastBridge } from "./ui/features/story-events";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { World } from "./ui/layouts/world";
import { resolveGameRouteView } from "./game-route.utils";

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
      <ErrorBoundary>
        <StoryEventToastBridge />
        <TransactionListenerBridge />
        <TransactionNotification />
        <World backgroundImage={backgroundImage} />
        <WorldLoading />
        <Toaster />
      </ErrorBoundary>
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
  const { phase, setupResult, account, bootstrap } = state;
  const routeView = resolveGameRouteView({
    phase,
    hasSetupResult: setupResult !== null,
    hasAccount: account !== null,
  });

  if (routeView === "redirect") {
    return <Navigate to="/" replace />;
  }

  if (routeView === "loading") {
    return <LoadingScreen backgroundImage={backgroundImage} progress={bootstrap.progress} />;
  }

  if (!setupResult || !account) {
    return <LoadingScreen backgroundImage={backgroundImage} progress={bootstrap.progress} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={setupResult} account={account} />;
};
