import { getGameModeId } from "@/config/game-modes";
import type { GameModeId } from "@/config/game-modes";

/**
 * Lightweight description of the current routing context used to map pages to curated music pools.
 */
interface RouteMatchContext {
  pathname: string;
  modeId: GameModeId;
}

export type PlaylistMode = "sequence" | "shuffle";

interface RouteTrackDefinition {
  key: string;
  priority: number;
  mode?: PlaylistMode;
  tracks: string[];
  match: (context: RouteMatchContext) => boolean;
}

export interface MatchedRoutePlaylist {
  key: string;
  tracks: string[];
  mode: PlaylistMode;
}

const normalizePathname = (pathname: string) => {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
};

const createStartsWithMatcher = (prefix: string) => {
  const normalized = normalizePathname(prefix);
  return ({ pathname }: RouteMatchContext) => {
    const normalizedPath = normalizePathname(pathname);
    return normalizedPath === normalized || normalizedPath.startsWith(`${normalized}/`);
  };
};

const createExactMatcher = (target: string) => {
  const normalized = normalizePathname(target);
  return ({ pathname }: RouteMatchContext) => normalizePathname(pathname) === normalized;
};

// Curated route → playlist mapping. Higher priority wins when multiple definitions match.
const ROUTE_TRACK_DEFINITIONS: RouteTrackDefinition[] = [
  {
    key: "landing:overview",
    priority: 60,
    mode: "shuffle",
    tracks: ["music.daybreak", "music.morning_ember", "music.beyond_horizon"],
    match: createExactMatcher("/"),
  },
  {
    key: "landing:profile",
    priority: 55,
    mode: "sequence",
    tracks: ["music.nomads_ballad", "music.happy_realm"],
    match: createStartsWithMatcher("/profile"),
  },
  {
    key: "landing:markets",
    priority: 55,
    mode: "shuffle",
    tracks: ["music.rain_pool", "music.beyond_horizon", "music.celestial_shores"],
    match: createStartsWithMatcher("/markets"),
  },
  {
    key: "landing:amm",
    priority: 56,
    mode: "sequence",
    tracks: ["music.rain_pool", "music.shadow_song", "music.strangers_arrival"],
    match: createStartsWithMatcher("/amm"),
  },
  {
    key: "landing:leaderboard",
    priority: 55,
    mode: "sequence",
    tracks: ["music.rain_pool", "music.beyond_horizon"],
    match: createStartsWithMatcher("/leaderboard"),
  },
  {
    key: "play:blitz",
    priority: 90,
    mode: "shuffle",
    tracks: ["music.blitz", "music.order_of_anger", "music.order_of_rage", "music.light_through_darkness"],
    match: (context) => context.modeId === "blitz" && createStartsWithMatcher("/play")(context),
  },
  {
    key: "play:main",
    priority: 80,
    mode: "shuffle",
    tracks: ["music.shadow_song", "music.twilight_harvest", "music.strangers_arrival", "music.shining_realms"],
    match: createStartsWithMatcher("/play"),
  },
  {
    key: "common:fallback",
    priority: 1,
    mode: "shuffle",
    tracks: ["music.daybreak", "music.morning_ember", "music.shadow_song", "music.wanderers_chronicle"],
    match: () => true,
  },
];

/**
 * Resolve the highest priority playlist for the current route; always returns a fallback playlist.
 */
export const matchRoutePlaylist = (pathname: string, override?: Partial<RouteMatchContext>): MatchedRoutePlaylist => {
  const baseContext: RouteMatchContext = {
    pathname,
    modeId: getGameModeId(),
    ...override,
  };

  const matches = ROUTE_TRACK_DEFINITIONS.filter((definition) => definition.match(baseContext));

  const selected = matches.toSorted((a, b) => b.priority - a.priority)[0] ?? ROUTE_TRACK_DEFINITIONS[0];

  return {
    key: selected.key,
    mode: selected.mode ?? "sequence",
    tracks: [...selected.tracks],
  };
};
