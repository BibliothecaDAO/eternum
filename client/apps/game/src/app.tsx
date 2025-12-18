import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { env } from "../env";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import "./index.css";
import { IS_MOBILE } from "./ui/config";
import { LandingAccount, LandingLeaderboard, LandingPlayer, LandingWelcome } from "./ui/features/landing";
import { LandingLayout } from "./ui/layouts/landing";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";

// Lazy load the entire game route to avoid loading heavy deps (World, Dojo, Three.js, etc.) on landing
const LazyGameRoute = lazy(() => import("./game-route").then((module) => ({ default: module.GameRoute })));

const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));

// Lazy load cosmetics to avoid pulling three.js into the main landing bundle
const LazyLandingCosmetics = lazy(() =>
  import("./ui/features/landing/sections/cosmetics").then((module) => ({ default: module.LandingCosmetics })),
);

// Served from client/public/videos/landing/background.mp4
const LANDING_BACKGROUND_VIDEO = "/videos/menu.mp4";

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
              <Route
                path="cosmetics"
                element={
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-gold/60">Loading cosmetics...</div>}>
                    <LazyLandingCosmetics />
                  </Suspense>
                }
              />
              <Route path="account" element={<LandingAccount />} />
              <Route path="player" element={<LandingPlayer />} />
              <Route path="leaderboard" element={<LandingLeaderboard />} />
            </Route>
            <Route
              path="/play/*"
              element={
                <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
                  <LazyGameRoute backgroundImage={backgroundImage} />
                </Suspense>
              }
            />
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
