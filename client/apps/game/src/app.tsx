import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing";
import { ErrorBoundary, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { env } from "../env";
import { DojoProvider } from "./hooks/context/dojo-context";
import { MetagameProvider } from "./hooks/context/metagame-provider";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { usePlayFlow } from "./hooks/context/use-play-flow";
import "./index.css";
import type { SetupResult } from "./init/bootstrap";
import type { Account, AccountInterface } from "starknet";
import { IS_MOBILE } from "./ui/config";
import {
  LandingAccount,
  LandingCosmetics,
  LandingLeaderboard,
  LandingPlayer,
  LandingWelcome,
} from "./ui/features/landing";
import { StoryEventToastBridge, StoryEventToastProvider } from "./ui/features/story-events";
import { LandingLayout } from "./ui/layouts/landing";
import { World } from "./ui/layouts/world";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";

type ReadyAppProps = {
  backgroundImage: string;
  setupResult: SetupResult;
  account: Account | AccountInterface;
};

const ReadyApp = ({ backgroundImage, setupResult, account }: ReadyAppProps) => {
  return (
    <DojoProvider value={setupResult} account={account}>
      <MetagameProvider>
        <ErrorBoundary>
          <StoryEventToastProvider>
            <StoryEventToastBridge />
            <TransactionNotification />
            <World backgroundImage={backgroundImage} />
            <WorldLoading />
          </StoryEventToastProvider>
        </ErrorBoundary>
      </MetagameProvider>
    </DojoProvider>
  );
};

const BootstrapError = ({ error, onRetry }: { error?: Error | null; onRetry: () => void }) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0f0f0f] p-6 text-center text-white">
      <h1 className="text-xl font-semibold">Unable to start Eternum</h1>
      <p className="mt-2 max-w-md text-sm text-white/70">
        Something went wrong while preparing the world. Please try reloading the page.
      </p>
      {error?.message ? <p className="mt-2 max-w-md text-xs text-white/50">{error.message}</p> : null}
      <button
        className="mt-6 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
};

const GameRoute = ({ backgroundImage }: { backgroundImage: string }) => {
  const { activeStep, steps } = usePlayFlow(backgroundImage);

  if (activeStep === "bootstrap-error") {
    return <BootstrapError error={steps.bootstrap.error} onRetry={steps.bootstrap.retry} />;
  }

  if (activeStep === "bootstrap") {
    return <LoadingScreen backgroundImage={backgroundImage} progress={steps.bootstrap.progress} />;
  }

  if (activeStep === "account" && steps.account.fallback) {
    return <>{steps.account.fallback}</>;
  }

  const readyData = steps.ready;

  if (!readyData.setupResult || !readyData.account) {
    return <LoadingScreen backgroundImage={backgroundImage} progress={steps.bootstrap.progress} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={readyData.setupResult} account={readyData.account} />;
};

function App() {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const isMobileBlocked = !isConstructionMode && IS_MOBILE;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupTracing();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      cleanupTracing();
    };
  }, []);

  if (isConstructionMode) {
    return <ConstructionGate />;
  }

  if (isMobileBlocked) {
    return <MobileBlocker mobileVersionUrl={env.VITE_PUBLIC_MOBILE_VERSION_URL} />;
  }

  return (
    <StarknetProvider>
      <BrowserRouter>
        <MusicRouterProvider>
          <Routes>
            <Route path="/" element={<LandingLayout backgroundImage={backgroundImage} />}>
              <Route index element={<LandingWelcome />} />
              <Route path="cosmetics" element={<LandingCosmetics />} />
              <Route path="account" element={<LandingAccount />} />
              <Route path="player" element={<LandingPlayer />} />
              <Route path="leaderboard" element={<LandingLeaderboard />} />
            </Route>
            <Route path="/play/*" element={<GameRoute backgroundImage={backgroundImage} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MusicRouterProvider>
      </BrowserRouter>
    </StarknetProvider>
  );
}

export default App;
