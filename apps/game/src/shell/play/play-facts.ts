import { useIdentitySession } from "@/hooks/context/identity-session";

import { useDirectory, useRealmsPlayer, useRecentResults } from "../herald";
import { seasonOpening } from "../season";
import { useSeasonCalendar } from "../season-calendar";
import { useNowSeconds } from "../use-now";
import { playBoard } from "./play-board";
import { readSeenResults } from "./seen-results";

/** How many of the player's latest finished games Play looks through for results they have not opened. */
const RECENT_FINISHED = 8;

/**
 * A read the board stands on that has not answered in full: still on its way, or failed with its retry. A source that
 * is missing here answered; one that is listed here is never drawn as "nothing there".
 */
export type SourceGap = { service: "season" | "results" } & (
  | { kind: "pending" }
  | { kind: "failed"; error: unknown; retry: () => void }
);

type Read = {
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

const gapOf = (service: SourceGap["service"], read: Read, partial: unknown = null): SourceGap | null => {
  const retry = () => void read.refetch();
  if (read.isError) return { service, kind: "failed", error: read.error, retry };
  if (!read.isSuccess) return { service, kind: "pending" };
  return partial ? { service, kind: "failed", error: partial, retry } : null;
};

/**
 * The player's results: their account address must be known before their history can be read, and a history some of
 * whose shards did not answer is a failure too, though the games it did return are still shown.
 */
const resultsGap = (player: Read, history: Read & { data?: { failures: readonly unknown[] } }): SourceGap | null =>
  player.isError
    ? gapOf("results", player)
    : gapOf("results", history, history.data?.failures.length ? history.data.failures : null);

export const usePlayFacts = () => {
  const { status } = useIdentitySession();
  const directory = useDirectory();
  const calendar = useSeasonCalendar();
  const now = useNowSeconds();
  const player = useRealmsPlayer();
  const signedIn = status === "signed-in";
  const history = useRecentResults(RECENT_FINISHED, player.data, signedIn && player.data !== null);
  const games = directory.data?.games ?? [];
  const finished = signedIn ? (history.data?.games ?? []) : [];
  const known = directory.isSuccess && status !== "loading";
  const board = known ? playBoard({ signedIn, games, finished, seenResults: readSeenResults() }) : undefined;
  const gaps = [gapOf("season", calendar), signedIn ? resultsGap(player, history) : null].filter(
    (gap): gap is SourceGap => gap !== null,
  );
  const opening = calendar.data ? seasonOpening(calendar.data.phases, now) : null;
  return { directory, now, games, finished, signedIn, board, gaps, opening };
};

export type PlayFacts = ReturnType<typeof usePlayFacts>;
