import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { PwaUpdateRuntime } from "./pwa/pwa-update-prompt";
import { SceneRoute } from "./scene-route";
import { PwaInstallRuntime } from "./pwa/pwa-install-control";
import { appQueryClient } from "./runtime/query-client";
import { AppShell } from "./shell/app-shell";
import { FactoryPage } from "./shell/factory";
import { LearnPage } from "./shell/learn/learn-page";
import { PostPage } from "./shell/learn/post-page";
import { IS_DEV_ENVIRONMENT } from "./shell/frame/environment";
import { NotFoundPage } from "./shell/not-found";
import { BlitzListPage, BlitzLobbyPage } from "./shell/blitz/blitz-pages";
import { DominionPage, EternumPage, FrontierPage } from "./shell/play/age-pages";
import { PlayPage } from "./shell/play/play-page";
import { PlayerPage, ProfilePage, ProfileRowPage } from "./shell/profile/profile-pages";
import { ResultsPage } from "./shell/season-tab/results-page";
import { SeasonPage } from "./shell/season-tab/season-page";
import { SignInPage } from "./shell/sign-in/sign-in-page";
import { FirstFrame } from "./shell/first-frame";
import { SIGN_IN_PATH } from "./shell/sign-in/sign-in-route";

const MotionLabView = lazy(() =>
  import("./ui/features/debug/motion-lab/motion-lab-view").then((module) => ({ default: module.MotionLabView })),
);
const KitLabView = lazy(() =>
  import("./ui/features/debug/kit-lab/kit-lab-view").then((module) => ({ default: module.KitLabView })),
);
const FrontierHudLabView = lazy(() =>
  import("./ui/features/debug/frontier-hud-lab/frontier-hud-lab-view").then((module) => ({
    default: module.FrontierHudLabView,
  })),
);
const DebugThreeChunkView = lazy(() =>
  import("./ui/features/debug/three-chunk-debug-view").then((module) => ({ default: module.ThreeChunkDebugView })),
);
const DebugProceduralCharacterGymView = lazy(() =>
  import("./ui/features/debug/procedural-character-gym-view").then((module) => ({
    default: module.ProceduralCharacterGymView,
  })),
);
const DebugProceduralCharacterBenchmarkView = lazy(() =>
  import("./ui/features/debug/procedural-character-benchmark-view").then((module) => ({
    default: module.ProceduralCharacterBenchmarkView,
  })),
);
const DebugProceduralWorldGymView = lazy(() =>
  import("./ui/features/debug/procedural-character-benchmark-view").then((module) => ({
    default: module.ProceduralWorldGymView,
  })),
);
const DebugTerrainPropView = lazy(() =>
  import("./ui/features/debug/terrain-prop-debug-view").then((module) => ({ default: module.TerrainPropDebugView })),
);
const DebugProceduralTerrainBenchmarkView = lazy(() =>
  import("./ui/features/debug/procedural-terrain-benchmark-view").then((module) => ({
    default: module.ProceduralTerrainBenchmarkView,
  })),
);
const DebugWorldFxGymView = lazy(() =>
  import("./ui/features/debug/world-fx-gym-view").then((module) => ({ default: module.WorldFxGymView })),
);
const GraphicsLabView = lazy(() =>
  import("./ui/features/debug/graphics-lab-view").then((module) => ({ default: module.GraphicsLabView })),
);
// Reading matter loads on demand, so the cold path carries no post or legal text.
const TermsPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.PrivacyPage })));
const GameClientApp = lazy(() => import("./game-client-app").then((module) => ({ default: module.GameClientApp })));

const AppFallback = FirstFrame;

const LazyRoute = ({ children }: { children: ReactNode }) => <Suspense fallback={<AppFallback />}>{children}</Suspense>;

/**
 * Every page the app serves. Cloudflare Pages rewrites to the app shell only the paths `public/_redirects` names, so
 * `app-hosting.test.ts` holds that file to exactly these routes.
 */
export const appRoutes = (
  <>
    <Route element={<AppShell />}>
      <Route index element={<PlayPage />} />
      <Route path="blitz" element={<BlitzListPage />} />
      <Route path="blitz/:id" element={<BlitzLobbyPage />} />
      <Route path="frontier" element={<FrontierPage />} />
      <Route path="eternum" element={<EternumPage />} />
      <Route path="dominion" element={<DominionPage />} />
      <Route path="season" element={<SeasonPage />} />
      <Route path="results/:id" element={<ResultsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="profile/account" element={<ProfileRowPage row="account" />} />
      <Route path="profile/notifications" element={<ProfileRowPage row="notifications" />} />
      <Route path="profile/devices" element={<ProfileRowPage row="devices" />} />
      <Route path="p/:address" element={<PlayerPage />} />
      <Route path="learn" element={<LearnPage />} />
      <Route path="learn/:post" element={<PostPage />} />
      <Route
        path="terms"
        element={
          <LazyRoute>
            <TermsPage />
          </LazyRoute>
        }
      />
      <Route
        path="privacy"
        element={
          <LazyRoute>
            <PrivacyPage />
          </LazyRoute>
        }
      />
      <Route path="factory" element={<FactoryPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    <Route path={SIGN_IN_PATH} element={<SignInPage />} />
    <Route
      path="/g/:chain/:game/*"
      element={
        <SceneRoute fallback={<AppFallback />}>
          <GameClientApp />
        </SceneRoute>
      }
    />
    {/* The labs and debug scenes exist only in the dev environment's build. */}
    {IS_DEV_ENVIRONMENT && (
      <>
        <Route
          path="/lab/motion"
          element={
            <LazyRoute>
              <MotionLabView />
            </LazyRoute>
          }
        />
        <Route
          path="/lab/kit/*"
          element={
            <LazyRoute>
              <KitLabView />
            </LazyRoute>
          }
        />
        <Route
          path="/lab/frontier-hud/*"
          element={
            <LazyRoute>
              <FrontierHudLabView />
            </LazyRoute>
          }
        />
        <Route
          path="/lab/*"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <GraphicsLabView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/three-chunks"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugThreeChunkView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/procedural-characters"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugProceduralCharacterGymView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/procedural-character-benchmark"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugProceduralCharacterBenchmarkView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/procedural-world-gym"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugProceduralWorldGymView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/terrain-props"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugTerrainPropView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/procedural-terrain-benchmark"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugProceduralTerrainBenchmarkView />
            </SceneRoute>
          }
        />
        <Route
          path="/debug/world-fx"
          element={
            <SceneRoute fallback={<AppFallback />}>
              <DebugWorldFxGymView />
            </SceneRoute>
          }
        />
      </>
    )}
  </>
);

/**
 * One app: the shell (home, play, results, account) is the cold path and carries no game module; a game, with the
 * 3D client and its mode's screens, loads only under `/g/:chain/:game`.
 */
function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={appQueryClient}>
        <PwaUpdateRuntime />
        <PwaInstallRuntime />
        <Routes>{appRoutes}</Routes>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
