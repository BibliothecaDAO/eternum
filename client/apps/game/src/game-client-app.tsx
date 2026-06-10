import { MusicRouterProvider } from "@/audio";
import { cleanupTracing } from "@/tracing/cleanup";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { env } from "../env";
import { preloadGameRouteModule } from "./game-entry-preload";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { useUIStore } from "./hooks/store/use-ui-store";
import { normalizeLegacyPlayLocation } from "./play/navigation/play-route";
import { normalizePlayBootLocation } from "./play/navigation/play-route-boot-normalization";
import { getActiveWorld } from "./runtime/world/store";
import { resolveLegacyLandingHref } from "./ui/features/landing/navigation/landing-route-redirects";
import { useBootDocumentState } from "./ui/modules/boot-loader";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { getRandomBackgroundImage } from "./ui/utils/utils";

const LazyGameRoute = lazy(preloadGameRouteModule);

const LandingLayout = lazy(() =>
  import("./ui/features/landing/landing-layout").then((module) => ({ default: module.LandingLayout })),
);
const LandingPlayRoute = lazy(() =>
  import("./ui/features/landing/views/landing-play-route").then((module) => ({ default: module.LandingPlayRoute })),
);
const LandingEntryRoute = lazy(() =>
  import("./ui/features/landing/views/landing-entry-route").then((module) => ({ default: module.LandingEntryRoute })),
);
const LandingLearnRoute = lazy(() =>
  import("./ui/features/landing/views/landing-learn-route").then((module) => ({ default: module.LandingLearnRoute })),
);
const LandingNewsRoute = lazy(() =>
  import("./ui/features/landing/views/landing-news-route").then((module) => ({ default: module.LandingNewsRoute })),
);
const LandingFactoryRoute = lazy(() =>
  import("./ui/features/landing/views/landing-factory-route").then((module) => ({
    default: module.LandingFactoryRoute,
  })),
);
const ProfileView = lazy(() =>
  import("./ui/features/landing/views/profile-view").then((module) => ({ default: module.ProfileView })),
);
const MarketsView = lazy(() =>
  import("./ui/features/landing/views/markets-view").then((module) => ({ default: module.MarketsView })),
);
const AmmView = lazy(() =>
  import("./ui/features/landing/views/amm-view").then((module) => ({ default: module.AmmView })),
);
const LeaderboardView = lazy(() =>
  import("./ui/features/landing/views/leaderboard-view").then((module) => ({ default: module.LeaderboardView })),
);
const FactoryPage = lazy(() => import("./ui/features/admin").then((module) => ({ default: module.FactoryPage })));
const FactoryV2Page = lazy(() =>
  import("./ui/features/factory-v2").then((module) => ({ default: module.FactoryV2Page })),
);

export const GameClientApp = () => {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useBootDocumentState(isConstructionMode ? "app-ready" : null);
  useTracingCleanup();

  if (isConstructionMode) {
    return <ConstructionGate />;
  }

  return <GameClientRoutes backgroundImage={backgroundImage} />;
};

const GameClientRoutes = ({ backgroundImage }: { backgroundImage: string }) => (
  <StarknetProvider>
    <MusicRouterProvider>
      <Routes>
        <Route path="/" element={renderLoadingRoute(<LandingLayout />)}>
          <Route index element={renderLoadingRoute(<LandingHomeRoute />)} />
          <Route path="enter/:chain/:world" element={renderLoadingRoute(<LandingEntryRoute />)} />
          <Route path="learn" element={renderLoadingRoute(<LandingLearnRoute />)} />
          <Route path="news" element={renderLoadingRoute(<LandingNewsRoute />)} />
          <Route path="factory" element={renderLoadingRoute(<LandingFactoryRoute />)} />
          <Route path="profile" element={renderLoadingRoute(<ProfileView />)} />
          <Route path="markets" element={renderLoadingRoute(<MarketsView />)} />
          <Route path="amm" element={renderLoadingRoute(<AmmView />)} />
          <Route path="leaderboard" element={renderLoadingRoute(<LeaderboardView />)} />
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
  </StarknetProvider>
);

const renderLoadingRoute = (element: ReactNode) => <Suspense fallback={<LoadingScreen />}>{element}</Suspense>;

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
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const normalizedLegacyHref = normalizeLegacyPlayLocation(location, getActiveWorld());

  if (normalizedLegacyHref) {
    return <Navigate to={normalizedLegacyHref} replace />;
  }

  const normalizedBootHref = showBlankOverlay ? normalizePlayBootLocation(location) : null;
  if (normalizedBootHref) {
    return <Navigate to={normalizedBootHref} replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyGameRoute backgroundImage={backgroundImage} />
    </Suspense>
  );
};

const useTracingCleanup = () => {
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
};
