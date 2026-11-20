import type { ShareTally } from "@realms-world/identity";
import { formatShort } from "@bibliothecadao/types";

import { AppFigure, AppPanel } from "@/ui/design-system/kit/app-elements";
import { SHARED_DAYS_WORDS } from "@/ui/design-system/kit/words";

import { useShareTally } from "../share/own-shares";

/** The funnel's steps a player sees, each with its count from identity's tally, in the order a friend takes them. */
const STEPS = ["posted", "visits", "joined", "activated"] as const satisfies readonly (keyof ShareTally)[];

export const SharedDaysPanel = () => {
  const tally = useShareTally();
  if (!tally || (tally.posted === 0 && tally.joined === 0)) return null;
  return (
    <AppPanel title={SHARED_DAYS_WORDS.title} label={SHARED_DAYS_WORDS.title} icon="share">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STEPS.map((step) => (
          <AppFigure key={step} value={formatShort(tally[step])} label={SHARED_DAYS_WORDS.steps[step]} />
        ))}
      </div>
      <div data-shared-friends className="grid grid-cols-2 gap-4">
        <AppFigure value={SHARED_DAYS_WORDS.ofLimit(tally.friendsPaid)} label={SHARED_DAYS_WORDS.friendsPaid} />
        <AppFigure value={formatShort(tally.fragmentsEarned)} label={SHARED_DAYS_WORDS.fragmentsEarned} />
      </div>
      <p className="text-app-label text-app-muted">{SHARED_DAYS_WORDS.friendRule}</p>
    </AppPanel>
  );
};
