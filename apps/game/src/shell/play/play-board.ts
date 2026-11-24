import { isGameOver } from "@/runtime/world/directory";

import type { DirectoryGame } from "../herald";
import { chooseSeason, isAccelerated, isRehearsal, seasonRealm } from "../season";

type PlayVerb = "resume" | "play" | "results";

export type PlayItem = {
  key: string;
  verb: PlayVerb | null;
  mine: boolean;
  game: DirectoryGame;
};

type PlayBoard = {
  lead: PlayItem | null;
  rehearsals: PlayItem[];
  results: PlayItem[];
};

export const idleCard = (items: readonly PlayItem[]): boolean => items.every((item) => item.verb === null);

export type PlayBoardFacts = {
  signedIn: boolean;
  games: readonly DirectoryGame[];
  finished: readonly DirectoryGame[];
  seenResults: ReadonlySet<string>;
};

export const gameKey = (game: Pick<DirectoryGame, "chainId" | "game_id">) => `${game.chainId}:${game.game_id}`;

const LEAD_ORDER: readonly ((item: PlayItem) => boolean)[] = [
  (item) => item.verb === "resume",
  (item) => item.verb === "play",
  (item) => item.verb === "results",
];

export const playBoard = (facts: PlayBoardFacts): PlayBoard => {
  const items = [...frontierItems(facts), ...resultItems(facts)];
  const lead = LEAD_ORDER.map((matches) => items.find(matches)).find((item) => item !== undefined) ?? null;
  const rehearsals = rehearsalItems(facts);
  const results = items.filter((item) => item !== lead && item.verb === "results");
  return { lead, rehearsals, results };
};

const gameItem = (game: DirectoryGame, verb: PlayVerb | null, mine: boolean): PlayItem => ({
  key: gameKey(game),
  verb,
  mine,
  game,
});

const frontierItems = ({ games, signedIn }: PlayBoardFacts): PlayItem[] => {
  const season = chooseSeason(games, signedIn);
  if (!season) return [];
  const live = season.status === "Live";
  if (signedIn && live && seasonRealm(season)) return [gameItem(season, "resume", true)];
  return [gameItem(season, "play", false)];
};

const rehearsalItems = ({ games, signedIn }: PlayBoardFacts): PlayItem[] =>
  games
    .filter((game) => game.mode === "frontier" && isRehearsal(game) && !isGameOver(game))
    .toSorted(
      (a, b) =>
        Number(isAccelerated(a)) - Number(isAccelerated(b)) ||
        b.clock.start_main_at - a.clock.start_main_at ||
        a.game_id - b.game_id,
    )
    .map((game) => {
      const live = game.status === "Live";
      const mine = signedIn && seasonRealm(game) !== undefined;
      return gameItem(game, live && mine ? "resume" : "play", mine);
    });

const resultItems = ({ signedIn, games, finished, seenResults }: PlayBoardFacts): PlayItem[] => {
  if (!signedIn) return [];
  const endedSeasons = games.filter(
    (game) => game.mode === "frontier" && !isRehearsal(game) && isGameOver(game) && seasonRealm(game),
  );
  const unseen = [...endedSeasons, ...finished].filter(
    (game) => game.mode === "frontier" && !isRehearsal(game) && !seenResults.has(gameKey(game)),
  );
  const newest = unseen[0];
  return newest ? [gameItem(newest, "results", true)] : [];
};
