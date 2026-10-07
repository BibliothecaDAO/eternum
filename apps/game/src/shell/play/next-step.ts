import { isGameOver } from "@/runtime/world/directory";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { chooseSeason, seasonRealm } from "../season";
import type { AgeMode } from "./ages";

/** What the home card offers: the one step the player most likely came for. */
export type NextStep =
  | { kind: "enter"; row: BlitzRow }
  | { kind: "resume"; season: DirectoryGame }
  | { kind: "results"; season: DirectoryGame }
  | { kind: "play"; season: DirectoryGame; firstVisit: boolean }
  | { kind: "blitz"; row: BlitzRow }
  | { kind: "eternum"; game: DirectoryGame | undefined };

type NextStepFacts = {
  signedIn: boolean;
  games: readonly DirectoryGame[];
  blitz: readonly BlitzRow[];
  /** The finished seasons whose results this device has already opened (gameKey). */
  seenResults: ReadonlySet<string>;
};

/** A game's identity across shards. */
export const gameKey = (game: Pick<DirectoryGame, "chainId" | "game_id">) => `${game.chainId}:${game.game_id}`;

const ownBlitzToEnter = ({ blitz }: NextStepFacts) => blitz.find((row) => row.action === "enter");

const seasonUnderWay = ({ signedIn, games }: NextStepFacts) => {
  const season = chooseSeason(games, signedIn);
  return signedIn && season?.status === "Live" && seasonRealm(season) ? season : undefined;
};

const unseenSeasonOver = ({ signedIn, games, seenResults }: NextStepFacts) =>
  signedIn
    ? games.find(
        (game) => game.mode === "frontier" && isGameOver(game) && seasonRealm(game) && !seenResults.has(gameKey(game)),
      )
    : undefined;

const nextEternum = ({ games }: NextStepFacts) =>
  games
    .filter((game) => game.mode === "eternum" && !isGameOver(game))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];

/**
 * The home card's one table, first match wins (spec 03): a Blitz seat in a live game → Enter; a Frontier day under
 * way → Resume; a season over and unseen → Results; else Frontier's season → Play (Play free signed out). With no
 * Frontier season, the next age that has one: a Blitz to watch or join, else Eternum's opening.
 */
export const nextStep = (facts: NextStepFacts): NextStep => {
  const blitzSeat = ownBlitzToEnter(facts);
  if (blitzSeat) return { kind: "enter", row: blitzSeat };
  const underWay = seasonUnderWay(facts);
  if (underWay) return { kind: "resume", season: underWay };
  const over = unseenSeasonOver(facts);
  if (over) return { kind: "results", season: over };
  const season = chooseSeason(facts.games, facts.signedIn);
  if (season) return { kind: "play", season, firstVisit: !facts.signedIn };
  const blitz = facts.blitz[0];
  if (blitz) return { kind: "blitz", row: blitz };
  return { kind: "eternum", game: nextEternum(facts) };
};

/** The age a step belongs to, so the other three show as tiles; Frontier's while the table resolves. */
export const ageOfStep = (step: NextStep | undefined): AgeMode => {
  if (!step) return "frontier";
  if (step.kind === "enter" || step.kind === "blitz") return "blitz";
  if (step.kind === "eternum") return "eternum";
  return "frontier";
};
