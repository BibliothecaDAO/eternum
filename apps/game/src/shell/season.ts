import { formatDate } from "@bibliothecadao/types";

import { isGameOver } from "@/runtime/world/directory";
import { PLAY_WORDS, SEASON } from "@/ui/design-system/kit/words";
import { type DayClock, dayTone } from "@/ui/features/frontier/hud/day-clock";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";

import type { DirectoryGame } from "./herald";
import { gameKey } from "./play/play-board";
import { ARCHIVED_SEASONS, archivedSeason } from "./season-tab/archive/archive";

/** The player's realm in the season: the structure the directory lists for them, if they have founded one. */
export const seasonRealm = (season: Pick<DirectoryGame, "player_state">) =>
  season.player_state?.structures.find((structure) => isRealmCategory(structure.category));

/**
 * The Frontier season a screen shows: the player's own, where their realm stands, else a live one. Among several, the
 * latest to start, then the lowest game id, so the choice never rests on the directory's order.
 */
export const chooseSeason = (games: readonly DirectoryGame[], signedIn: boolean): DirectoryGame | undefined => {
  const seasons = games
    .filter((game) => game.mode === "frontier" && !isGameOver(game))
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at || a.game_id - b.game_id);
  const live = seasons.filter((game) => game.status === "Live");
  const available = live.length > 0 ? live : seasons;
  return (signedIn ? available.find((game) => seasonRealm(game)) : undefined) ?? available[0];
};

/**
 * Frontier's seasons that have ended, the last to end first: those the directory still lists until they settle, the
 * settled ones in the history, and the archived ones whose shard is gone. A season named twice is the directory's,
 * else the history's.
 */
export const endedSeasons = (listed: readonly DirectoryGame[], settled: readonly DirectoryGame[]): DirectoryGame[] => {
  const byGame = new Map([...ARCHIVED_SEASONS, ...settled, ...listed].map((game) => [gameKey(game), game]));
  return [...byGame.values()]
    .filter((game) => game.mode === "frontier" && isGameOver(game))
    .toSorted((a, b) => b.clock.end_at - a.clock.end_at || a.game_id - b.game_id);
};

/**
 * Frontier's day as the directory serves it (day_index, day_ends_at, next_day_length): one-based as the player counts
 * it, when today ends, the time left and tomorrow's length. A field the directory does not serve (an older Herald, no
 * day under way) stays undefined and draws as a dash, as does a day whose end has passed until the directory reads
 * again. Today's start is not served, so the dial's share of today stays unknown.
 */
export const directoryDay = (
  season: Pick<DirectoryGame, "day_index" | "day_ends_at" | "next_day_length">,
  now: number,
): DayClock => {
  const endsAt = season.day_ends_at ?? undefined;
  const current = endsAt !== undefined && endsAt > now;
  const secondsLeft = current ? endsAt - now : undefined;
  return {
    day: current && season.day_index != null ? season.day_index + 1 : undefined,
    endsAt: current ? endsAt : undefined,
    secondsLeft,
    tomorrowSeconds: current ? (season.next_day_length ?? undefined) : undefined,
    shareLeft: undefined,
    tone: secondsLeft === undefined ? "calm" : dayTone(secondsLeft),
  };
};

/**
 * A season's name, the one every surface shows: an archived season's own ("Playtest"), else its number as the directory
 * serves it and the glossary writes it ("Season 0" for Devcon, "Season 1"); a number the directory does not serve is a
 * dash.
 */
export const seasonTitle = (season: Pick<DirectoryGame, "season_number" | "chainId" | "game_id">): string =>
  archivedSeason({ chainId: season.chainId, gameId: season.game_id })?.name ??
  `${SEASON} ${season.season_number ?? "—"}`;

/** An ended season and the day it ended, "Playtest · Ended 31 Oct". */
export const seasonEnded = (season: DirectoryGame): string =>
  `${seasonTitle(season)} · ${PLAY_WORDS.ended} ${formatDate(season.clock.end_at)}`;
