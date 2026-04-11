import { useEffect } from "react";
import { parseEntryRoute } from "@/play/navigation/play-route";
import { primePlayEntryRoute } from "@/game-entry-preload";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { GameEntryModal } from "../components/game-entry-modal";
import { PlayView } from "./play-view";

type EntryRouteState = {
  returnTo?: string;
};

const resolveBackgroundTab = (returnTo: string | undefined) => {
  if (!returnTo) {
    return "play" as const;
  }

  if (returnTo.startsWith("/learn")) {
    return "learn" as const;
  }

  if (returnTo.startsWith("/news")) {
    return "news" as const;
  }

  if (returnTo.startsWith("/factory")) {
    return "factory" as const;
  }

  return "play" as const;
};

export const LandingEntryRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const entryRoute = parseEntryRoute(location);

  if (!entryRoute) {
    return <Navigate to="/" replace />;
  }

  const state = location.state as EntryRouteState | null;
  const returnTo = state?.returnTo && state.returnTo !== location.pathname ? state.returnTo : "/";
  const activeTab = resolveBackgroundTab(returnTo);

  useEffect(() => {
    primePlayEntryRoute();
  }, []);

  const handleClose = () => {
    navigate(returnTo, { replace: true });
  };

  return (
    <>
      <PlayView activeTab={activeTab} disableReviewFlow />
      <GameEntryModal
        isOpen
        onClose={handleClose}
        worldName={entryRoute.worldName}
        chain={entryRoute.chain}
        isSpectateMode={entryRoute.intent === "spectate"}
        isForgeMode={entryRoute.intent === "forge"}
        eternumEntryIntent={entryRoute.intent === "settle" ? "settle" : "play"}
        numHyperstructuresLeft={entryRoute.intent === "forge" ? (entryRoute.hyperstructuresLeft ?? 0) : 0}
      />
    </>
  );
};
