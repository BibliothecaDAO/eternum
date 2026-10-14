import { canEnterGame, isGameOver } from "@/runtime/world/directory";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { chooseSeason, seasonRealm } from "../season";

/** The modes Play offers, in the order its switch shows them. */
export const PLAY_MODES = ["blitz", "frontier", "eternum"] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

/** What a game offers the player, at most one verb each. */
export type PlayVerb = "enter" | "resume" | "play" | "watch" | "join" | "refund" | "results";

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
} & ({ source: "row"; row: BlitzRow } | { source: "game"; game: DirectoryGame });

/**
 * Play: the lead (the step the player most likely came for, with the one gold verb), everything else under way now,
 * and each mode's next and finished games. Every game appears once.
 */
export type PlayBoard = {
  lead: PlayItem | null;
  now: PlayItem[];
  later: Record<PlayMode, PlayItem[]>;
  /** The mode the switch opens on: the first with something to do, else the first with anything. */
  openMode: PlayMode;
  /** The modes holding something of the player's (a dot on their switch). */
  marked: PlayMode[];
};

export type PlayBoardFacts = {
  signedIn: boolean;
  /** The directory's live and upcoming games. */
  games: readonly DirectoryGame[];
  blitz: readonly BlitzRow[];
  /** The player's own finished games (the directory's history for them), newest first. */
  finished: readonly DirectoryGame[];
  /** The finished games whose results this device has opened (gameKey). */
  seenResults: ReadonlySet<string>;
};

/** A game's identity across shards. */
export const gameKey = (game: Pick<DirectoryGame, "chainId" | "game_id">) => `${game.chainId}:${game.game_id}`;

/**
 * The lead, first match wins: a Blitz seat to enter; a Frontier day under way; a result of the player's not yet opened
 * (any mode); Frontier's season to play (free when signed out); a Blitz to join, else one to watch; Eternum, open or
 * opening. With none of these, nothing is running and there is no lead.
 */
const LEAD_ORDER: readonly ((item: PlayItem) => boolean)[] = [
  (item) => item.mode === "blitz" && item.verb === "enter",
  (item) => item.verb === "resume",
  (item) => item.verb === "results",
  (item) => item.mode === "frontier" && item.verb === "play",
  (item) => item.mode === "blitz" && item.verb === "join",
  (item) => item.mode === "blitz" && item.verb === "watch",
  (item) => item.mode === "eternum",
];

export const playBoard = (facts: PlayBoardFacts): PlayBoard => {
  const items = [
    ...blitzItems(facts.blitz),
    ...frontierItems(facts),
    ...eternumItems(facts.games),
    ...resultItems(facts),
  ];
  const lead = LEAD_ORDER.map((matches) => items.find(matches)).find((item) => item !== undefined) ?? null;
  const rest = items.filter((item) => item !== lead);
  const later = Object.fromEntries(
    PLAY_MODES.map((mode) => [mode, rest.filter((item) => item.mode === mode && item.when !== "now")]),
  ) as Record<PlayMode, PlayItem[]>;
  return {
    lead,
    now: rest.filter((item) => item.when === "now"),
    later,
    openMode:
      PLAY_MODES.find((mode) => later[mode].some((item) => item.verb !== null)) ??
      PLAY_MODES.find((mode) => later[mode].length > 0) ??
      PLAY_MODES[0],
    marked: PLAY_MODES.filter((mode) => later[mode].some((item) => item.mine)),
  };
};

const rowItem = (row: BlitzRow, when: PlayItem["when"], verb: PlayVerb | null, mine: boolean): PlayItem => ({
  key: row.key,
  mode: "blitz",
  when,
  verb,
  mine,
  source: "row",
  row,
});

const gameItem = (
  game: DirectoryGame,
  mode: PlayMode,
  when: PlayItem["when"],
  verb: PlayVerb | null,
  mine: boolean,
): PlayItem => ({ key: gameKey(game), mode, when, verb, mine, source: "game", game });

/** Blitz's rows as they come: a seat to enter, a game to watch, a seat waiting for its game, a slot to join, a refund. */
const blitzItems = (rows: readonly BlitzRow[]): PlayItem[] =>
  rows.map((row) => {
    switch (row.action) {
      case "enter":
        return rowItem(row, "now", "enter", true);
      case "spectate":
        return rowItem(row, row.startsAt === null ? "now" : "next", "watch", false);
      case "registered":
        return rowItem(row, "next", null, true);
      case "open":
        return rowItem(row, "next", "join", false);
      case "refund":
        return rowItem(row, "next", "refund", true);
      case null:
        return rowItem(row, row.startsAt === null ? "now" : "next", null, false);
    }
  });

/** Frontier's season: the player's day to resume, else the season to play (free when signed out). */
const frontierItems = ({ games, signedIn }: PlayBoardFacts): PlayItem[] => {
  const season = chooseSeason(games, signedIn);
  if (!season) return [];
  const live = season.status === "Live";
  if (signedIn && live && seasonRealm(season)) return [gameItem(season, "frontier", "now", "resume", true)];
  return [gameItem(season, "frontier", live ? "now" : "next", "play", false)];
};

/** Eternum's next game: open to enter, or the moment it opens. */
const eternumItems = (games: readonly DirectoryGame[]): PlayItem[] => {
  const next = games
    .filter((game) => game.mode === "eternum" && !isGameOver(game))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];
  if (!next) return [];
  return canEnterGame(next)
    ? [gameItem(next, "eternum", "now", "enter", false)]
    : [gameItem(next, "eternum", "next", null, false)];
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

/** A finished game's mode on Play: a Duel is a Blitz match; anything else unknown stays out. */
const modeOf = (game: DirectoryGame): PlayMode | null => {
  if (game.mode === "frontier" || game.mode === "eternum" || game.mode === "blitz") return game.mode;
  return game.mode === "duel" ? "blitz" : null;
};
