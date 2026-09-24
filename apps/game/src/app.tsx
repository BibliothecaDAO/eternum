import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { PwaUpdatePrompt } from "./pwa/pwa-update-prompt";
import { SceneRoute } from "./scene-route";
import { PwaInstallRuntime } from "./pwa/pwa-install-control";
import { AccountPage } from "./shell/account";
import { FirstNamePrompt } from "./shell/first-name-prompt";
import { AppShell } from "./shell/app-shell";
import { FactoryPage } from "./shell/factory";
import { HomePage } from "./shell/home";
import { LearnPage } from "./shell/learn";
import { NewsPage } from "./shell/news";
import { NotFoundPage } from "./shell/not-found";
import { PlayPage } from "./shell/play";
import { PlayerPage } from "./shell/player";
import { ResultsPage } from "./shell/results";

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
const ScrollIndexPage = lazy(() => import("./shell/scroll").then((module) => ({ default: module.ScrollIndexPage })));
const ScrollPostPage = lazy(() => import("./shell/scroll").then((module) => ({ default: module.ScrollPostPage })));
const TermsPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.PrivacyPage })));
const GameClientApp = lazy(() => import("./game-client-app").then((module) => ({ default: module.GameClientApp })));

const AppFallback = () => <div className="min-h-screen bg-black" />;

const LazyRoute = ({ children }: { children: ReactNode }) => <Suspense fallback={<AppFallback />}>{children}</Suspense>;

const shellQueryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 1 } },
});

/**
 * One app: the shell (home, play, results, account) is the cold path and carries no game module; a game, with the
 * 3D client and its mode's screens, loads only under `/g/:chain/:game`.
 */
function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={shellQueryClient}>
        <PwaUpdatePrompt />
        <PwaInstallRuntime />
        <FirstNamePrompt />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="p/:address" element={<PlayerPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route
              path="scroll"
              element={
                <LazyRoute>
                  <ScrollIndexPage />
                </LazyRoute>
              }
            />
            <Route
              path="scroll/:slug"
              element={
                <LazyRoute>
                  <ScrollPostPage />
                </LazyRoute>
              }
            />
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
          <Route
            path="/g/:chain/:game/*"
            element={
              <SceneRoute fallback={<AppFallback />}>
                <GameClientApp />
              </SceneRoute>
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
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
