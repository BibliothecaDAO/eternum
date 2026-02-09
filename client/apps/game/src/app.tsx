/**
 * Eternum Game Client - Witcher-inspired Landing
 */
import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { env } from "../env";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import "./index.css";
import { LandingLayout, PlayView, ProfileView, MarketsView, LeaderboardView } from "./ui/features/landing";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { getRandomBackgroundImage } from "./ui/utils/utils";

// Lazy load the entire game route to avoid loading heavy deps (World, Dojo, Three.js, etc.) on landing
const LazyGameRoute = lazy(() => import("./game-route").then((module) => ({ default: module.GameRoute })));

const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));

function App() {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
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

  return (
    <StarknetProvider>
      <BrowserRouter>
        <MusicRouterProvider>
          <Routes>
            {/* New unified landing layout */}
            <Route path="/" element={<LandingLayout />}>
              {/* Play view with game selector - uses real world data */}
              <Route index element={<PlayView />} />

              {/* Profile with sub-tabs (Stats, Cosmetics, Wallet) */}
              <Route path="profile" element={<ProfileView />} />

              {/* Markets */}
              <Route path="markets" element={<MarketsView />} />

              {/* Leaderboard */}
              <Route path="leaderboard" element={<LeaderboardView />} />
            </Route>

            {/* Game route - triggered when entering a game */}
            <Route
              path="/play/*"
              element={
                <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} prefetchPlayAssets />}>
                  <LazyGameRoute backgroundImage={backgroundImage} />
                </Suspense>
              }
            />

            {/* Standalone factory route */}
            <Route
              path="/factory"
              element={
                <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
                  <FactoryPage />
                </Suspense>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MusicRouterProvider>
      </BrowserRouter>
    </StarknetProvider>
  );
}

export default App;
