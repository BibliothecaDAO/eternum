import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { env } from "../env";
import { loadGameRouteForPlayEntry } from "./game-entry-preload";
import { resolveEntryContextFromEntryRoute } from "./game-entry/context";
import { usePlayRouteReadinessStore } from "./game-entry/play-route-readiness-store";
import { GameplayAccountSync } from "./hooks/context/gameplay-account-sync";
import { useUIStore } from "./hooks/store/use-ui-store";
import { normalizePlayBootLocation } from "./play/navigation/play-route-boot-normalization";
import { LocalNotificationLifecycle } from "./pwa/local-notification-lifecycle";
import { GameEntryModal } from "./ui/features/game-entry/game-entry-modal";
import { useBootDocumentState } from "./ui/modules/boot-loader";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { getRandomBackgroundImage } from "./ui/utils/utils";

const LazyGameRoute = lazy(loadGameRouteForPlayEntry);

/** Everything under `/g/:chain/:game`: the entry into a game, then its scenes. */
export const GameClientApp = () => {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useBootDocumentState(isConstructionMode ? "app-ready" : null);

  if (isConstructionMode) {
    return <ConstructionGate />;
  }

  return (
    <GameplayAccountSync>
      <LocalNotificationLifecycle />
      <Routes>
        <Route index element={<GameEntryRoute />} />
        <Route path=":scene" element={<GameRouteShell backgroundImage={backgroundImage} />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
    </GameplayAccountSync>
  );
};

/** The doorway: settle or wait until the game is ready, then hand off to its scene. */
const GameEntryRoute = () => {
  const location = useLocation();
  const entryContext = resolveEntryContextFromEntryRoute(location);
  useBootDocumentState("app-ready");

  if (!entryContext) {
    return <Navigate to="/play" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0c0a08]">
      <GameEntryModal
        isOpen
        game={{ chainId: entryContext.chainId, gameId: entryContext.gameId }}
        isSpectateMode={entryContext.intent === "spectate"}
        autoSettleEnabled={entryContext.autoSettle}
        entryIntent={entryContext.intent === "settle" ? "settle" : "play"}
      />
    </div>
  );
};

const GameRouteShell = ({ backgroundImage }: { backgroundImage: string }) => {
  const location = useLocation();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const worldmapReady = usePlayRouteReadinessStore((state) => state.worldmapReady);

  const normalizedBootHref = showBlankOverlay ? normalizePlayBootLocation(location, { worldmapReady }) : null;
  if (normalizedBootHref) {
    return <Navigate to={normalizedBootHref} replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyGameRoute backgroundImage={backgroundImage} />
    </Suspense>
  );
};
