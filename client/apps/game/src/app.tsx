import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { env } from "../env";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import "./index.css";
import { IS_MOBILE } from "./ui/config";
import {
  LandingAccount,
  LandingCreateMarket,
  LandingCreateMarketTest,
  LandingLeaderboard,
  LandingMarketDetails,
  LandingMarkets,
  LandingMint,
  LandingPlayer,
  LandingWelcome,
} from "./ui/features/landing";
import { MarketsProviders } from "./ui/features/landing/sections/markets";
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
  const mobileRedirectUrl = useMemo(() => {
    if (isConstructionMode || !IS_MOBILE || typeof window === "undefined") {
      return null;
    }

    try {
      const current = new URL(window.location.href);
      if (current.pathname.startsWith("/mobile")) return null;

      const target = new URL("/mobile", current.origin);
      return target.toString();
    } catch {
      return null;
    }
  }, [isConstructionMode]);
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

  useEffect(() => {
    if (!mobileRedirectUrl) return;
    window.location.replace(mobileRedirectUrl);
  }, [mobileRedirectUrl]);

  if (isConstructionMode) {
    return <ConstructionGate />;
  }

  if (mobileRedirectUrl) {
    return <MobileBlocker mobileVersionUrl={mobileRedirectUrl} />;
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
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center text-gold/60">Loading cosmetics...</div>
                    }
                  >
                    <LazyLandingCosmetics />
                  </Suspense>
                }
              />
              <Route path="account" element={<LandingAccount />} />
              <Route path="player" element={<LandingPlayer />} />
              <Route
                path="create-market"
                element={
                  <MarketsProviders>
                    <LandingCreateMarket />
                  </MarketsProviders>
                }
              />
              <Route
                path="create-market-test"
                element={
                  <MarketsProviders>
                    <LandingCreateMarketTest />
                  </MarketsProviders>
                }
              />
              <Route path="mint" element={<LandingMint />} />
              <Route
                path="markets"
                element={
                  <MarketsProviders>
                    <LandingMarkets />
                  </MarketsProviders>
                }
              />
              <Route path="markets/:marketId" element={<LandingMarketDetails />} />
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
