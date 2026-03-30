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
import { preloadGameRouteModule } from "./game-entry-preload";
import { LandingLayout, PlayView, ProfileView, MarketsView, LeaderboardView, AmmView } from "./ui/features/landing";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { useBootDocumentState } from "./ui/modules/boot-loader";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { getRandomBackgroundImage } from "./ui/utils/utils";

// Lazy load the entire game route to avoid loading heavy deps (World, Dojo, Three.js, etc.) on landing
const LazyGameRoute = lazy(() => preloadGameRouteModule().then((module) => ({ default: module.default })));

const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));
const FactoryV2Page = lazy(() =>
  import("./ui/features/factory-v2").then((module) => ({ default: module.FactoryV2Page })),
);

function App() {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useBootDocumentState(isConstructionMode ? "app-ready" : null);

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

              {/* AMM */}
              <Route path="amm" element={<AmmView />} />

              {/* Leaderboard */}
              <Route path="leaderboard" element={<LeaderboardView />} />
            </Route>

            {/* Game route - triggered when entering a game */}
            <Route
              path="/play/*"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <LazyGameRoute backgroundImage={backgroundImage} />
                </Suspense>
              }
            />

            {/* Standalone factory route */}
            <Route
              path="/factory"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <FactoryPage />
                </Suspense>
              }
            />

            {/* Standalone factory v2 route */}
            <Route
              path="/factory/v2"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <FactoryV2Page />
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
