import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";

import { useRefundSlots } from "../blitz/entry";
import { blitzRows } from "../blitz-rows";
import { usePlaytestSlots } from "../blitz-slot";
import { useDirectory } from "../herald";
import { useNowSeconds } from "../use-now";
import { nextStep } from "./next-step";
import { readSeenResults } from "./seen-results";

/**
 * Everything the Play tab draws, read once: the directory's games, Blitz's rows, the sign-in status and the clock, and the
 * next step the table chose. Unknown until the directory and the session answer.
 */
export const usePlayFacts = () => {
  const { status, session } = useIdentitySession();
  const directory = useDirectory();
  const slots = usePlaytestSlots();
  const now = useNowSeconds();
  const games = directory.data?.games ?? [];
  const listed = slots.data?.slots ?? [];
  const blitz = blitzRows(games, listed, useRefundSlots(listed, session ? payoutAddressOf(session.user) : null));
  const signedIn = status === "signed-in";
  const known = directory.isSuccess && status !== "loading";
  const step = known ? nextStep({ signedIn, games, blitz, seenResults: readSeenResults() }) : undefined;
  return { directory, slots, now, games, blitz, signedIn, step };
};

export type PlayFacts = ReturnType<typeof usePlayFacts>;
