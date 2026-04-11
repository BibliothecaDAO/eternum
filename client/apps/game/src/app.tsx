/**
 * Eternum Game Client - Witcher-inspired Landing
 */
import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { env } from "../env";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { normalizeLegacyPlayLocation } from "./play/navigation/play-route";
import { getActiveWorld } from "./runtime/world";
import "./index.css";
import { preloadGameRouteModule } from "./game-entry-preload";
import {
  AmmView,
  LandingFactoryRoute,
  LandingLayout,
  LandingLearnRoute,
  LandingNewsRoute,
  LandingPlayRoute,
  LeaderboardView,
  MarketsView,
  ProfileView,
} from "./ui/features/landing";
import { resolveLegacyLandingHref } from "./ui/features/landing/navigation/landing-route-redirects";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { useBootDocumentState } from "./ui/modules/boot-loader";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { getRandomBackgroundImage } from "./ui/utils/utils";

// Lazy load the entire game route to avoid loading heavy deps (World, Dojo, Three.js, etc.) on landing
const LazyGameRoute = lazy(preloadGameRouteModule);

const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));
const FactoryV2Page = lazy(() =>
  import("./ui/features/factory-v2").then((module) => ({ default: module.FactoryV2Page })),
);

const LandingHomeRoute = () => {
  const location = useLocation();
  const legacyHref = resolveLegacyLandingHref(location);

  if (legacyHref) {
    return <Navigate to={legacyHref} replace />;
  }

  return <LandingPlayRoute />;
};

const GameRouteShell = ({ backgroundImage }: { backgroundImage: string }) => {
  const location = useLocation();
  const normalizedLegacyHref = normalizeLegacyPlayLocation(location, getActiveWorld());

  if (normalizedLegacyHref) {
    return <Navigate to={normalizedLegacyHref} replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyGameRoute backgroundImage={backgroundImage} />
    </Suspense>
  );
};

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
            <Route path="/" element={<LandingLayout />}>
              <Route index element={<LandingHomeRoute />} />
              <Route path="learn" element={<LandingLearnRoute />} />
              <Route path="news" element={<LandingNewsRoute />} />
              <Route path="factory" element={<LandingFactoryRoute />} />
              <Route path="profile" element={<ProfileView />} />
              <Route path="markets" element={<MarketsView />} />
              <Route path="amm" element={<AmmView />} />
              <Route path="leaderboard" element={<LeaderboardView />} />
            </Route>

            <Route path="/play/:chain/:world/:scene" element={<GameRouteShell backgroundImage={backgroundImage} />} />
            <Route path="/play/*" element={<GameRouteShell backgroundImage={backgroundImage} />} />

            <Route
              path="/factory/legacy"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <FactoryPage />
                </Suspense>
              }
            />

            <Route
              path="/factory/v2"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <FactoryV2Page />
                </Suspense>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MusicRouterProvider>
      </BrowserRouter>
    </StarknetProvider>
  );
}

export default App;
