import { useEffect } from "react";
import { parseEntryRoute } from "@/play/navigation/play-route";
import { primePlayEntryRoute } from "@/game-entry-preload";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { GameEntryModal } from "../components/game-entry-modal";
import { resolveLandingEntryState, type LandingEntryRouteState } from "../lib/landing-entry-state";
import { PlayView } from "./play-view";

export const LandingEntryRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const entryRoute = parseEntryRoute(location);
  const entryState = resolveLandingEntryState({
    pathname: location.pathname,
    state: location.state as LandingEntryRouteState | null,
  });

  useEffect(() => {
    if (entryRoute) {
      primePlayEntryRoute();
    }
  }, [entryRoute]);

  if (!entryRoute) {
    return <Navigate to="/" replace />;
  }

  const handleClose = () => {
    navigate(entryState.returnTo, { replace: true });
  };

  return (
    <>
      <PlayView activeTab={entryState.activeTab} disableReviewFlow initialModeFilter={entryState.landingModeFilter} />
      <GameEntryModal
        isOpen
        onClose={handleClose}
        worldName={entryRoute.worldName}
        chain={entryRoute.chain}
        isSpectateMode={entryRoute.intent === "spectate"}
        isForgeMode={entryRoute.intent === "forge"}
        autoSettleEnabled={entryRoute.autoSettle}
        eternumEntryIntent={entryRoute.intent === "settle" ? "settle" : "play"}
        numHyperstructuresLeft={entryRoute.intent === "forge" ? (entryRoute.hyperstructuresLeft ?? 0) : 0}
      />
    </>
  );
};
