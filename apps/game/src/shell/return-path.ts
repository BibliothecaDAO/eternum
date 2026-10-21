import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";

type LocationLike = { pathname: string; search: string; hash?: string };

const PARSE_BASE = "https://realms.invalid";

/**
 * Where a detour may send the player back to: a path on this site, or home. A value that could leave the site (`//host`,
 * `/\host`, a scheme) is refused, so no `next` is ever an open redirect.
 */
export const safeNextPath = (raw: string | null | undefined): string => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  const url = new URL(raw, PARSE_BASE);
  if (url.origin !== PARSE_BASE) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
};

/** A detour's return path, read from its URL's `next`. */
export const nextOf = (search: string): string => safeNextPath(new URLSearchParams(search).get("next"));

/**
 * The page a player leaves for a detour (Discord, a wallet), as the path that brings them back to it. A game's view is
 * rebuilt from its route, so the session's spectate intent rides along even where in-app navigation dropped it from
 * the URL.
 */
export const returnPathOf = (location: LocationLike): string => {
  const play = parsePlayRoute(location);
  if (play) return buildPlayHref(play);
  return `${location.pathname}${location.search}${location.hash ?? ""}`;
};
