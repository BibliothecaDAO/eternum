import { aspects, catalogOrder, formatDate, isSeasonGame, type AspectId } from "@bibliothecadao/types";
import { canonicalRealm } from "@bibliothecadao/eternum";
import {
  nativeFragmentConstants,
  nativeRaceConstants,
  raceStage,
  raceStageHeight,
  rankRaceStandings,
  spendsFragments,
} from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRace } from "@bibliothecadao/eternum/game-sync";

import { isGameOver } from "@/runtime/world/directory";
import {
  ASPECT_PAGE_WORDS,
  DAY,
  HOME_STEP_WORDS,
  PLAY_WORDS,
  SEASON,
  dayOfSeason,
  gameSpeed,
} from "@/ui/design-system/kit/words";
import { type DayClock, dayTone } from "@/ui/features/frontier/hud/day-clock";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";

import release from "../../../../contracts/l3/world-native/schema/release-definition.json";
import type { SeasonPhase } from "./season-calendar";
import type { DirectoryGame } from "./herald";
import { gameKey } from "./play/play-board";
import { ARCHIVED_SEASONS, archivedSeason } from "./season-tab/archive/archive";

export const isRehearsal = (game: Pick<DirectoryGame, "name">): boolean => !isSeasonGame(game.name);

export const isAccelerated = (game: Pick<DirectoryGame, "clock_scale">): boolean =>
  gameSpeed(game.clock_scale) !== undefined;

/** The player's realm in the season: the structure the directory lists for them, if they have founded one. */

export const seasonRealm = (season: Pick<DirectoryGame, "player_state">) =>
  season.player_state?.structures.find((structure) => isRealmCategory(structure.category));

export const seasonRealmId = (season: Pick<DirectoryGame, "player_state"> | null | undefined): number | null =>
  (season ? seasonRealm(season)?.realm_id : undefined) ?? season?.player_state?.held_realm_id ?? null;

/**
 * The Frontier season a screen shows: the player's own, where their realm stands, else a live one. Among several, the
 * latest to start, then the lowest game id, so the choice never rests on the directory's order.
 */
export const chooseSeason = (games: readonly DirectoryGame[], signedIn: boolean): DirectoryGame | undefined => {
  const seasons = games
    .filter((game) => game.mode === "frontier" && !isRehearsal(game) && !isGameOver(game))
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
    .filter((game) => game.mode === "frontier" && !isRehearsal(game) && isGameOver(game))
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

export const seasonTitle = (
  season: Pick<DirectoryGame, "season_number" | "chainId" | "game_id" | "name" | "clock_scale">,
): string => {
  const archived = archivedSeason({ chainId: season.chainId, gameId: season.game_id });
  if (archived) return archived.name;
  if (isRehearsal(season)) return isAccelerated(season) ? PLAY_WORDS.rehearsal : PLAY_WORDS.finalTestnet;
  return season.season_number != null ? `${SEASON} ${season.season_number}` : SEASON;
};

/** An ended season and the day it ended, "Playtest · Ended 31 Oct". */
export const seasonEnded = (season: DirectoryGame): string =>
  `${seasonTitle(season)} · ${PLAY_WORDS.ended} ${formatDate(season.clock.end_at)}`;

export const SEASON_SPENDS_FRAGMENTS = spendsFragments({ command_mask: BigInt(release.definition.rules.command_mask) });

const SEASON_DAYS = Number(release.definition.economy.race.Some.season_days);
export const RACE_STAGE_COUNT = nativeRaceConstants.STAGE_COUNT;

export const questBonusPercentOf = (
  game: Pick<DirectoryGame, "quest_bonus_percent"> | null | undefined,
): number | null => game?.quest_bonus_percent ?? null;

export const realmQuestBonus = (bonusPercent: number, wonder: boolean): string =>
  HOME_STEP_WORDS.questBonus(bonusPercent, wonder ? nativeFragmentConstants.WONDER_QUEST_FRAGMENTS : 0);

export const seasonDaysOf = (game: Pick<DirectoryGame, "aspect_race"> | null | undefined): number | null =>
  game?.aspect_race?.season_days ?? null;

export const seasonDayLabel = (day: number | undefined, seasonDays: number | null): string | null =>
  day === undefined ? null : seasonDays !== null ? dayOfSeason(String(day), String(seasonDays)) : `${DAY} ${day}`;

const TRIUMPH_ENTRIES = Object.entries(ASPECT_PAGE_WORDS.triumph).map(([stage, name]) => ({
  stage: Number(stage),
  name,
}));

export const RACE_TRIUMPHS: readonly { stage: number; name: string }[] = Array.from(
  { length: RACE_STAGE_COUNT - 1 },
  (_, index) => {
    const stage = index + 1;
    const entry = TRIUMPH_ENTRIES.find((item) => item.stage === stage);
    if (!entry) throw new Error(`Missing Triumph name for stage ${stage}`);
    return entry;
  },
);

if (TRIUMPH_ENTRIES.length !== RACE_TRIUMPHS.length) {
  throw new Error(`Expected ${RACE_TRIUMPHS.length} Triumph names, found ${TRIUMPH_ENTRIES.length}`);
}

export const raceStageOf = (height: number, finishHeight: number): number =>
  raceStage(height, raceStageHeight(finishHeight));

export type AspectRaceStanding = {
  id: AspectId;
  name: string;
  rank: number;
  height: number;
  stage: number;
  finished: boolean;
  members: number | null;
};

export const aspectRaceStandings = (
  race: HeraldAspectRace,
  members: Readonly<Record<AspectId, number>> | null,
): {
  finishHeight: number;
  stageHeight: number;
  standings: AspectRaceStanding[];
  byAspect: Record<AspectId, AspectRaceStanding>;
  winner: AspectRaceStanding | null;
} => {
  const finishHeight = race.finish_height;
  const stageHeight = raceStageHeight(finishHeight);
  const standings: AspectRaceStanding[] = rankRaceStandings(
    aspects.map((aspect) => ({
      aspect: aspect.id,
      name: aspect.name,
      height: race.heights[aspect.id],
    })),
    stageHeight,
  ).map((row) => ({
    id: row.aspect,
    name: row.name,
    rank: row.rank,
    height: row.height,
    stage: row.stage,
    finished: row.finished,
    members: members?.[row.aspect] ?? null,
  }));
  const byAspect = Object.fromEntries(standings.map((row) => [row.id, row])) as Record<AspectId, AspectRaceStanding>;
  const winner = standings.find((row) => row.finished) ?? null;
  return { finishHeight, stageHeight, standings, byAspect, winner };
};

export const seasonPlayerHome = (season: Pick<DirectoryGame, "player_state"> | null | undefined) => {
  const realmId = seasonRealmId(season);
  const realm = realmId !== null ? canonicalRealm(realmId) : null;
  const order = realm && realm.order !== 0 ? catalogOrder(realm.order) : null;
  const aspect: AspectId | null = order?.aspect ?? null;
  return { realmId, realm, order, aspect };
};

export const seasonPlayerAspect = (season: Pick<DirectoryGame, "player_state"> | null | undefined): AspectId | null =>
  seasonPlayerHome(season).aspect;

export type SeasonOpening = { startsAt: number; seasonDays: number | null };

export const seasonOpening = (phases: readonly SeasonPhase[], now: number): SeasonOpening | null => {
  const frontier = phases.find((phase) => phase.phase === "frontier");
  if (frontier?.phase !== "frontier") return null;
  const startsAt = Date.parse(frontier.startsAt) / 1000;
  if (!(startsAt > now)) return null;
  return {
    startsAt,
    seasonDays: SEASON_DAYS,
  };
};
