import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { ErrorBoundary, TransactionNotification, WorldLoading } from "@/ui/shared";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { Account, AccountInterface } from "starknet";
import { env } from "../env";
import { DojoProvider } from "./hooks/context/dojo-context";
import { MetagameProvider } from "./hooks/context/metagame-provider";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { usePlayFlow } from "./hooks/context/use-play-flow";
import "./index.css";
import type { SetupResult } from "./init/bootstrap";
import { IS_MOBILE } from "./ui/config";
import {
  LandingAccount,
  LandingCosmetics,
  LandingLeaderboard,
  LandingCreateMarket,
  LandingCreateMarketTest,
  LandingMarketDetails,
  LandingMint,
  LandingMarkets,
  LandingPlayer,
  LandingWelcome,
} from "./ui/features/landing";
import { StoryEventToastBridge, StoryEventToastProvider } from "./ui/features/story-events";
import { LandingLayout } from "./ui/layouts/landing";
import { PlayOverlayManager } from "./ui/layouts/play-overlay-manager";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";

const World = lazy(() => import("./ui/layouts/world").then((module) => ({ default: module.World })));
const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));

type ReadyAppProps = {
  backgroundImage: string;
  setupResult: SetupResult;
  account: Account | AccountInterface;
};

// Served from client/public/videos/landing/background.mp4
const LANDING_BACKGROUND_VIDEO = "/videos/menu.mp4";

const ReadyApp = ({ backgroundImage, setupResult, account }: ReadyAppProps) => {
  return (
    <DojoProvider value={setupResult} account={account}>
      <MetagameProvider>
        <ErrorBoundary>
          <StoryEventToastProvider>
            <StoryEventToastBridge />
            <TransactionNotification />
            <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
              <World backgroundImage={backgroundImage} />
            </Suspense>
            <WorldLoading />
          </StoryEventToastProvider>
        </ErrorBoundary>
      </MetagameProvider>
    </DojoProvider>
  );
};

// Admin sub-app removed; /factory is a standalone route now

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

  // Ensure modals (world selector, etc.) can render before world is ready
  const EarlyOverlays = <PlayOverlayManager backgroundImage={backgroundImage} enableOnboarding={false} />;

  if (activeStep === "world") {
    return (
      <>
        {EarlyOverlays}
        {steps.world.fallback ?? <LoadingScreen backgroundImage={backgroundImage} />}
      </>
    );
  }

  if (activeStep === "bootstrap-error") {
    return (
      <>
        {EarlyOverlays}
        <BootstrapError error={steps.bootstrap.error} onRetry={steps.bootstrap.retry} />
      </>
    );
  }

  if (activeStep === "bootstrap") {
    return (
      <>
        {EarlyOverlays}
        <LoadingScreen backgroundImage={backgroundImage} progress={steps.bootstrap.progress} />
      </>
    );
  }

  if (activeStep === "account" && steps.account.fallback) {
    return (
      <>
        {EarlyOverlays}
        {steps.account.fallback}
      </>
    );
  }

  const readyData = steps.ready;

  if (!readyData.setupResult || !readyData.account) {
    return <LoadingScreen backgroundImage={backgroundImage} progress={steps.bootstrap.progress} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={readyData.setupResult} account={readyData.account} />;
};

// Admin route wrapper removed

function App() {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const isMobileBlocked = !isConstructionMode && IS_MOBILE;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useEffect(() => {
    const handleBeforeUnload = () => {
      void cleanupTracing();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void cleanupTracing();
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
            <Route
              path="/"
              element={<LandingLayout backgroundImage={backgroundImage} backgroundVideo={LANDING_BACKGROUND_VIDEO} />}
            >
              <Route index element={<LandingWelcome />} />
              <Route path="cosmetics" element={<LandingCosmetics />} />
              <Route path="account" element={<LandingAccount />} />
              <Route path="player" element={<LandingPlayer />} />
              <Route path="create-market" element={<LandingCreateMarket />} />
              <Route path="create-market-test" element={<LandingCreateMarketTest />} />
              <Route path="mint" element={<LandingMint />} />
              <Route path="markets" element={<LandingMarkets />} />
              <Route path="markets/:marketId" element={<LandingMarketDetails />} />
              <Route path="leaderboard" element={<LandingLeaderboard />} />
            </Route>
            <Route path="/play/*" element={<GameRoute backgroundImage={backgroundImage} />} />
            {/* Standalone factory route that does not require game bootstrap/sync */}
            <Route
              path="/factory"
              element={
                <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
                  <FactoryPage />
                </Suspense>
              }
            />
            {/* Admin route removed; factory now lives at top-level /factory */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MusicRouterProvider>
      </BrowserRouter>
    </StarknetProvider>
  );
}

export default App;
