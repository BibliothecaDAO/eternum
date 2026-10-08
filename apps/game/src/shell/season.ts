import { isGameOver } from "@/runtime/world/directory";
import { type DayClock, dayTone } from "@/ui/features/frontier/hud/day-clock";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";

import type { DirectoryGame } from "./herald";

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
