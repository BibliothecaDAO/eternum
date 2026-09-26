import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";

/** The one sign-in flow's route. Every surface that needs a signed-in player sends them here with where to return. */
export const SIGN_IN_PATH = "/sign-in";

type LocationLike = { pathname: string; search: string; hash?: string };

const PARSE_BASE = "https://realms.invalid";

/**
 * Where the flow may send the player once signed in: a path on this site, or home. A value that could leave the site
 * (`//host`, `/\host`, a scheme) or that points back into the flow is refused, so the route is never an open redirect.
 */
export const safeNextPath = (raw: string | null | undefined): string => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  const url = new URL(raw, PARSE_BASE);
  if (url.origin !== PARSE_BASE || url.pathname === SIGN_IN_PATH) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
};

/** The flow's href for a return path; the path is checked here too, so no caller can build an unsafe one. */
export const signInHref = (next: string): string => `${SIGN_IN_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;

/** The flow's own return path, read from its URL. */
export const nextOf = (search: string): string => safeNextPath(new URLSearchParams(search).get("next"));

/**
 * The page a player asks to sign in from, as the path that brings them back to it. A game's view is rebuilt from its
 * route, so the session's spectate intent rides along even where in-app navigation dropped it from the URL.
 */
export const returnPathOf = (location: LocationLike): string => {
  if (location.pathname === SIGN_IN_PATH) return nextOf(location.search);
  const play = parsePlayRoute(location);
  if (play) return buildPlayHref(play);
  return `${location.pathname}${location.search}${location.hash ?? ""}`;
};

/** Sends the player to the sign-in flow; it returns them to `next`, or to the page they asked from. */
export const useRequestSignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((next?: string) => navigate(signInHref(next ?? returnPathOf(location))), [location, navigate]);
};
