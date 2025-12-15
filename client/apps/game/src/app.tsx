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
import { useUnifiedOnboarding } from "./hooks/context/use-unified-onboarding";
import "./index.css";
import type { SetupResult } from "./init/bootstrap";
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
import { UnifiedOnboardingScreen } from "./ui/layouts/unified-onboarding";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";

import { World } from "./ui/layouts/world";

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
            <World backgroundImage={backgroundImage} />
            <WorldLoading />
          </StoryEventToastProvider>
        </ErrorBoundary>
      </MetagameProvider>
    </DojoProvider>
  );
};

// Admin sub-app removed; /factory is a standalone route now

const GameRoute = ({ backgroundImage }: { backgroundImage: string }) => {
  const state = useUnifiedOnboarding(backgroundImage);
  const { phase, setupResult, account } = state;

  // Phases that don't need Dojo: world-select, account, loading
  if (phase === "world-select" || phase === "account" || phase === "loading") {
    return <UnifiedOnboardingScreen backgroundImage={backgroundImage} state={state} />;
  }

  // Settlement and Ready phases both render the full game
  // The onboarding overlay (PlayOverlayManager) handles showing settlement UI
  // when showBlankOverlay is true in the UI store
  if (!setupResult || !account) {
    return <LoadingScreen backgroundImage={backgroundImage} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={setupResult} account={account} />;
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
