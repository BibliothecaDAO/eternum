import { resolveEntryContextFromEntryRoute } from "@/game-entry/context";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { GameEntryModal } from "../components/game-entry-modal";
import { resolveLandingEntryState, type LandingEntryRouteState } from "../lib/landing-entry-state";
import { PlayView } from "./play-view";

export const LandingEntryRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const entryContext = resolveEntryContextFromEntryRoute(location);
  const entryState = resolveLandingEntryState({
    pathname: location.pathname,
    state: location.state as LandingEntryRouteState | null,
  });

  if (!entryContext) {
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
        worldName={entryContext.worldName}
        chain={entryContext.chain}
        isSpectateMode={entryContext.intent === "spectate"}
        isForgeMode={entryContext.intent === "forge"}
        autoSettleEnabled={entryContext.autoSettle}
        eternumEntryIntent={entryContext.intent === "settle" ? "settle" : "play"}
        numHyperstructuresLeft={entryContext.intent === "forge" ? (entryContext.hyperstructuresLeft ?? 0) : 0}
      />
    </>
  );
};
