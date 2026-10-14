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
 * Everything the Play tab draws, read once: the directory's games, Blitz's rows, the player's latest finished games, the
 * sign-in status and the clock, and the board that sorts them. The board is unknown until the directory and the session
 * answer.
 */
export const usePlayFacts = () => {
  const { status, session } = useIdentitySession();
  const directory = useDirectory();
  const slots = usePlaytestSlots();
  const now = useNowSeconds();
  const { data: player } = useRealmsPlayer();
  const signedIn = status === "signed-in";
  const history = useRecentResults(RECENT_FINISHED, player, signedIn && player !== null);
  const games = directory.data?.games ?? [];
  const listed = slots.data?.slots ?? [];
  const refunds = useRefundSlots(listed, session ? payoutAddressOf(session.user) : null);
  const blitz = blitzRows(games, listed, refunds);
  const finished = signedIn ? (history.data?.games ?? []) : [];
  const known = directory.isSuccess && status !== "loading";
  const board = known ? playBoard({ signedIn, games, blitz, finished, seenResults: readSeenResults() }) : undefined;
  return { directory, slots, now, games, blitz, refunds, signedIn, board };
};

export type PlayFacts = ReturnType<typeof usePlayFacts>;
