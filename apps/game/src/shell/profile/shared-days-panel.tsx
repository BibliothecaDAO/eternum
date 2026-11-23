import type { ShareTally } from "@realms-world/identity";
import {
  aspectName,
  formatShort,
  FRIEND_FRAGMENTS,
  FRIENDS_BONUS_FRAGMENTS,
  FRIENDS_LIMIT,
  type AspectId,
} from "@bibliothecadao/types";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { AppFigure, AppPanel } from "@/ui/design-system/kit/app-elements";
import { PROFILE_WORDS, SEASON_INVITE_WORDS, SHARED_DAYS_WORDS } from "@/ui/design-system/kit/words";

import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "../play/season-invite";
import { useShareTally } from "../share/own-shares";

const STEPS = ["posted", "visits", "joined", "activated"] as const satisfies readonly (keyof ShareTally)[];

export const SharedDaysPanel = ({ aspect = null }: { aspect?: AspectId | null }) => {
  const { session } = useIdentitySession();
  const tally = useShareTally();
  if (!session || !tally) return null;
  const paid = Math.min(FRIENDS_LIMIT, Math.max(0, tally.friendsPaid));
  return (
    <AppPanel title={SHARED_DAYS_WORDS.title} label={SHARED_DAYS_WORDS.title} icon="share">
      <div className="flex flex-col gap-5" data-referrals-panel>
        {aspect !== null ? (
          <InviteStrip aspect={aspect} />
        ) : (
          <p className="text-app-label text-app-muted">{PROFILE_WORDS.noAspectInvite}</p>
        )}
        <div className="referrals-track" data-referrals-track>
          <div className="referrals-track__head">
            <span className="text-app-strong text-app-ink">{PROFILE_WORDS.friendsProgress(paid, FRIENDS_LIMIT)}</span>
            <span className="text-app-label text-app-gold">
              {PROFILE_WORDS.friendMilestone(FRIEND_FRAGMENTS, FRIENDS_BONUS_FRAGMENTS, FRIENDS_LIMIT)}
            </span>
          </div>
          <ol className="referrals-slots" aria-label={PROFILE_WORDS.friendsProgress(paid, FRIENDS_LIMIT)}>
            {Array.from({ length: FRIENDS_LIMIT }, (_, index) => {
              const reached = index < paid;
              const isFinal = index === FRIENDS_LIMIT - 1;
              return (
                <li
                  key={index}
                  className="referrals-slot"
                  data-reached={reached || undefined}
                  data-final={isFinal || undefined}
                >
                  {reached ? <Icon name="check" size={14} /> : index + 1}
                </li>
              );
            })}
          </ol>
        </div>
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
      </div>
    </AppPanel>
  );
};

const InviteStrip = ({ aspect }: { aspect: AspectId }) => {
  const invite = useSeasonInvite(aspect);
  return (
    <div className="flex flex-col gap-3">
      <div className="referrals-invite">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-app-strong text-app-ink">{SEASON_INVITE_WORDS.title}</span>
          <span className="text-app-label text-app-muted">{SEASON_INVITE_WORDS.line(aspectName(aspect))}</span>
        </div>
        <CopySeasonInvite invite={invite} size="md" />
      </div>
      <SeasonInviteAlerts invite={invite} />
    </div>
  );
};
