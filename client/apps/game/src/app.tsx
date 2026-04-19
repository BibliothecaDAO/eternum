import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./index.css";

const DebugThreeChunkView = lazy(() =>
  import("./ui/features/debug").then((module) => ({ default: module.ThreeChunkDebugView })),
);
const GameClientApp = lazy(() => import("./game-client-app").then((module) => ({ default: module.GameClientApp })));

const AppFallback = () => <div className="min-h-screen bg-black" />;

const DebugRouteShell = () => (
  <Suspense fallback={<AppFallback />}>
    <DebugThreeChunkView />
  </Suspense>
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
        <Route path="/debug/three-chunks" element={<DebugRouteShell />} />
        <Route path="*" element={<GameClientRouteShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
