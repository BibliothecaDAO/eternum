import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./index.css";

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
const DebugTerrainPropView = lazy(() =>
  import("./ui/features/debug/terrain-prop-debug-view").then((module) => ({ default: module.TerrainPropDebugView })),
);
const DebugProceduralTerrainView = lazy(() =>
  import("./ui/features/debug/procedural-terrain-debug-view").then((module) => ({
    default: module.ProceduralTerrainDebugView,
  })),
);
const DebugProceduralTerrainBenchmarkView = lazy(() =>
  import("./ui/features/debug/procedural-terrain-benchmark-view").then((module) => ({
    default: module.ProceduralTerrainBenchmarkView,
  })),
);
const GameClientApp = lazy(() => import("./game-client-app").then((module) => ({ default: module.GameClientApp })));

const AppFallback = () => <div className="min-h-screen bg-black" />;

const DebugRouteShell = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<AppFallback />}>{children}</Suspense>
);

const GameClientRouteShell = () => (
  <Suspense fallback={<AppFallback />}>
    <GameClientApp />
  </Suspense>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/debug/three-chunks"
          element={
            <DebugRouteShell>
              <DebugThreeChunkView />
            </DebugRouteShell>
          }
        />
        <Route
          path="/debug/procedural-characters"
          element={
            <DebugRouteShell>
              <DebugProceduralCharacterGymView />
            </DebugRouteShell>
          }
        />
        <Route
          path="/debug/procedural-character-benchmark"
          element={
            <DebugRouteShell>
              <DebugProceduralCharacterBenchmarkView />
            </DebugRouteShell>
          }
        />
        <Route
          path="/debug/terrain-props"
          element={
            <DebugRouteShell>
              <DebugTerrainPropView />
            </DebugRouteShell>
          }
        />
        <Route
          path="/debug/procedural-terrain"
          element={
            <DebugRouteShell>
              <DebugProceduralTerrainView />
            </DebugRouteShell>
          }
        />
        <Route
          path="/debug/procedural-terrain-benchmark"
          element={
            <DebugRouteShell>
              <DebugProceduralTerrainBenchmarkView />
            </DebugRouteShell>
          }
        />
        <Route path="*" element={<GameClientRouteShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
