import type { ShareTally } from "@realms-world/identity";
import { formatShort } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";

import { identityClient } from "@/hooks/context/identity-session";
import { AppFigure, AppPanel } from "@/ui/design-system/kit/app-elements";
import { SHARED_DAYS_WORDS } from "@/ui/design-system/kit/words";

/** The funnel's steps a player sees, each with its count from identity's tally, in the order a friend takes them. */
const STEPS = ["posted", "visits", "joined", "activated"] as const satisfies readonly (keyof ShareTally)[];

/**
 * What the player's shared days brought, on their own page once they have shared one (identity's tally, settled as it
 * is read): days posted, how often friends opened them, the friends who joined through them, and those who went on to
 * clear a site. Credit for bringing players, never a reward for posting.
 */
export const SharedDaysPanel = () => {
  const tally = useQuery({ queryKey: ["shareTally"], queryFn: () => identityClient.shareTally(), retry: false });
  if (!tally.data || tally.data.links === 0) return null;
  return (
    <AppPanel title={SHARED_DAYS_WORDS.title} label={SHARED_DAYS_WORDS.title} icon="share">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STEPS.map((step) => (
          <AppFigure key={step} value={formatShort(tally.data[step])} label={SHARED_DAYS_WORDS.steps[step]} />
        ))}
      </div>
    </AppPanel>
  );
};
