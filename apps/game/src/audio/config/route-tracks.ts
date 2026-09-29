import type { GameModeId } from "@/config/game-modes";

/**
 * Lightweight description of the current routing context used to map pages to curated music pools.
 */
interface RouteMatchContext {
  pathname: string;
  modeId: GameModeId | null;
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
    key: "play:blitz",
    priority: 90,
    mode: "shuffle",
    tracks: [
      "music.monophonic_mixtape_09",
      "music.monophonic_mixtape_10",
      "music.cha_cha_chi",
      "music.monophonic_mixtape_11",
      "music.monophonic_mixtape_12",
      "music.monophonic_mixtape_13",
      "music.monophonic_mixtape_14",
    ],
    match: (context) => context.modeId === "blitz" && createStartsWithMatcher("/g")(context),
  },
  {
    key: "play:main",
    priority: 80,
    mode: "shuffle",
    tracks: [
      "music.shadow_song",
      "music.cha_cha_chi",
      "music.twilight_harvest",
      "music.strangers_arrival",
      "music.shining_realms",
      "music.monophonic_mixtape_09",
      "music.monophonic_mixtape_10",
      "music.monophonic_mixtape_14",
    ],
    match: createStartsWithMatcher("/g"),
  },
  {
    key: "common:fallback",
    priority: 1,
    mode: "shuffle",
    tracks: [
      "music.daybreak",
      "music.birds_paradise",
      "music.morning_ember",
      "music.shadow_song",
      "music.bumu_bun",
      "music.wanderers_chronicle",
      "music.monophonic_mixtape_13",
    ],
    match: () => true,
  },
];

/**
 * Resolve the highest priority playlist for the current route; always returns a fallback playlist.
 */
export const matchRoutePlaylist = (pathname: string, override?: Partial<RouteMatchContext>): MatchedRoutePlaylist => {
  const baseContext: RouteMatchContext = {
    pathname,
    modeId: null,
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
