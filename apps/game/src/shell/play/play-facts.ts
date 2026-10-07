import { useIdentitySession } from "@/hooks/context/identity-session";

import { blitzRows } from "../blitz-rows";
import { usePlaytestSlots } from "../blitz-slot";
import { useDirectory } from "../herald";
import { useNowSeconds } from "../use-now";
import { nextStep } from "./next-step";
import { readSeenResults } from "./seen-results";

/**
 * Everything the Play tab draws, read once: the directory's games, Blitz's rows, the session and the clock, and the
 * next step the table chose. Unknown until the directory and the session answer.
 */
export const usePlayFacts = () => {
  const { status, session } = useIdentitySession();
  const directory = useDirectory();
  const slots = usePlaytestSlots();
  const now = useNowSeconds();
  const games = directory.data?.games ?? [];
  const blitz = blitzRows(games, slots.data?.slots ?? [], session?.user.realmsId);
  const signedIn = status === "signed-in";
  const known = directory.isSuccess && status !== "loading";
  const step = known ? nextStep({ signedIn, games, blitz, seenResults: readSeenResults() }) : undefined;
  return { directory, slots, now, games, blitz, signedIn, step };
};

export type PlayFacts = ReturnType<typeof usePlayFacts>;
