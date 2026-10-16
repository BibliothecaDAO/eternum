import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";

import { useRefundSlots } from "../blitz/entry";
import { blitzRows } from "../blitz-rows";
import { usePlaytestSlots } from "../blitz-slot";
import { useDirectory, useRealmsPlayer, useRecentResults } from "../herald";
import { useNowSeconds } from "../use-now";
import { playBoard } from "./play-board";
import { readSeenResults } from "./seen-results";

/** How many of the player's latest finished games Play looks through for results they have not opened. */
const RECENT_FINISHED = 8;

/**
 * A read the board stands on that has not answered in full: still on its way, or failed with its retry. A source that
 * is missing here answered; one that is listed here is never drawn as "nothing there".
 */
export type SourceGap = { service: "slots" | "results" } & (
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

/**
 * Everything the Play tab draws, read once: the directory's games, Blitz's rows, the player's latest finished games, the
 * sign-in status and the clock, and the board that sorts them. The board is unknown until the directory and the session
 * answer; the slots and the player's history each either answered or stand as a gap, so a slot outage never reads as
 * "nothing scheduled" and a history outage never hides a result without saying so.
 */
export const usePlayFacts = () => {
  const { status, session } = useIdentitySession();
  const directory = useDirectory();
  const slots = usePlaytestSlots();
  const now = useNowSeconds();
  const player = useRealmsPlayer();
  const signedIn = status === "signed-in";
  const history = useRecentResults(RECENT_FINISHED, player.data, signedIn && player.data !== null);
  const games = directory.data?.games ?? [];
  const listed = slots.data?.slots ?? [];
  const refunds = useRefundSlots(listed, session ? payoutAddressOf(session.user) : null);
  const blitz = blitzRows(games, listed, refunds);
  const finished = signedIn ? (history.data?.games ?? []) : [];
  const known = directory.isSuccess && status !== "loading";
  const board = known ? playBoard({ signedIn, games, blitz, finished, seenResults: readSeenResults() }) : undefined;
  const gaps = [gapOf("slots", slots), signedIn ? resultsGap(player, history) : null].filter(
    (gap): gap is SourceGap => gap !== null,
  );
  return { directory, slots, now, games, blitz, refunds, signedIn, board, gaps };
};

export type PlayFacts = ReturnType<typeof usePlayFacts>;
