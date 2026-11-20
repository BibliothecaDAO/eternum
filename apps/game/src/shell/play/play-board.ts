import { isGameOver } from "@/runtime/world/directory";

import type { DirectoryGame } from "../herald";
import { chooseSeason, seasonRealm } from "../season";

/** The modes Play offers, in the order its ages stand side by side. */
export const PLAY_MODES = ["blitz", "frontier", "eternum"] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

/** What a game offers the player, at most one verb each. */
type PlayVerb = "resume" | "play" | "results";

/**
 * One game on Play, read once: its mode, when it is (under way now, still to come, or finished and not yet opened on
 * this device), its one verb or none, and whether it is the player's own (their seat, their realm, their entry, their
 * result).
 */
export type PlayItem = {
  key: string;
  mode: PlayMode;
  when: "now" | "next" | "done";
  verb: PlayVerb | null;
  mine: boolean;
  game: DirectoryGame;
};

/**
 * Play: the lead (the step the player most likely came for, with the one gold verb), then each age's other games,
 * those under way now first, then the next, then the finished. Every game appears once.
 */
export type PlayBoard = {
  lead: PlayItem | null;
  ages: Record<PlayMode, PlayItem[]>;
};

const WHEN_ORDER: readonly PlayItem["when"][] = ["now", "next", "done"];

/**
 * A mode's card (Play's lead or an age's column) is idle when it holds nothing to do now: none of its games offers a
 * verb, and nothing else on it does (Blitz's Build orders). Owner, 29 October 2026: "blitz deactivated looks good,
 * eternum deactivated should exist as well".
 */
export const idleCard = (items: readonly PlayItem[], buildOrders = false): boolean =>
  !buildOrders && items.every((item) => item.verb === null);

export type PlayBoardFacts = {
  signedIn: boolean;
  /** The directory's live and upcoming games. */
  games: readonly DirectoryGame[];
  /** The player's own finished games (the directory's history for them), newest first. */
  finished: readonly DirectoryGame[];
  /** The finished games whose results this device has opened (gameKey). */
  seenResults: ReadonlySet<string>;
};

/** A game's identity across shards. */
export const gameKey = (game: Pick<DirectoryGame, "chainId" | "game_id">) => `${game.chainId}:${game.game_id}`;

const LEAD_ORDER: readonly ((item: PlayItem) => boolean)[] = [
  (item) => item.verb === "resume",
  (item) => item.mode === "frontier" && item.verb === "play",
  (item) => item.verb === "results",
];

export const playBoard = (facts: PlayBoardFacts): PlayBoard => {
  const items = [...frontierItems(facts), ...resultItems(facts)];
  const lead = LEAD_ORDER.map((matches) => items.find(matches)).find((item) => item !== undefined) ?? null;
  const rest = items.filter((item) => item !== lead);
  const ages = Object.fromEntries(
    PLAY_MODES.map((mode) => [
      mode,
      WHEN_ORDER.flatMap((when) => rest.filter((item) => item.mode === mode && item.when === when)),
    ]),
  ) as Record<PlayMode, PlayItem[]>;
  return { lead, ages };
};

const gameItem = (
  game: DirectoryGame,
  mode: PlayMode,
  when: PlayItem["when"],
  verb: PlayVerb | null,
  mine: boolean,
): PlayItem => ({ key: gameKey(game), mode, when, verb, mine, game });

/** Frontier's season: the player's day to resume, else the season to play (free when signed out). */
const frontierItems = ({ games, signedIn }: PlayBoardFacts): PlayItem[] => {
  const season = chooseSeason(games, signedIn);
  if (!season) return [];
  const live = season.status === "Live";
  if (signedIn && live && seasonRealm(season)) return [gameItem(season, "frontier", "now", "resume", true)];
  return [gameItem(season, "frontier", live ? "now" : "next", "play", false)];
};

/**
 * The player's results not yet opened on this device, the newest per mode: a Frontier season over where they founded a
 * realm (still in the directory), and their finished games from the history. Signed out, there are none.
 */
const resultItems = ({ signedIn, games, finished, seenResults }: PlayBoardFacts): PlayItem[] => {
  if (!signedIn) return [];
  const endedSeasons = games.filter((game) => game.mode === "frontier" && isGameOver(game) && seasonRealm(game));
  const unseen = [...endedSeasons, ...finished].filter((game) => !seenResults.has(gameKey(game)));
  return PLAY_MODES.flatMap((mode) => {
    const newest = unseen.find((game) => modeOf(game) === mode);
    return newest ? [gameItem(newest, mode, "done", "results", true)] : [];
  });
};

/** A finished game's mode on Play: unknown modes stay out. */
const modeOf = (game: DirectoryGame): PlayMode | null => {
  if (game.mode === "frontier" || game.mode === "eternum" || game.mode === "blitz") return game.mode;
  return null;
};

export const holdsNothing = (board: PlayBoard): boolean =>
  board.lead === null && PLAY_MODES.every((mode) => board.ages[mode].length === 0);
