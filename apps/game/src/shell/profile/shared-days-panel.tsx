import type { InvitedFriends, InvitedFriendState, ShareTally } from "@realms-world/identity";
import { aspectName, formatShort, type AspectId } from "@bibliothecadao/types";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppFigure, AppPanel } from "@/ui/design-system/kit/app-elements";
import {
  INVITED_FRIENDS_WORDS,
  PROFILE_WORDS,
  SEASON_INVITE_WORDS,
  SHARED_DAYS_WORDS,
} from "@/ui/design-system/kit/words";

import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "../play/season-invite";
import { useInvitedFriends, useShareTally } from "../share/own-shares";

const STEPS = ["posted", "visits", "joined", "activated"] as const satisfies readonly (keyof ShareTally)[];

const FRIEND_STATE_ICONS = { joined: "person", reached: "check", paid: "fragment" } satisfies Record<
  InvitedFriendState,
  IconMeaning
>;

export const SharedDaysPanel = ({
  aspect = null,
  aspectPending = false,
}: {
  aspect?: AspectId | null;
  aspectPending?: boolean;
}) => {
  const { session } = useIdentitySession();
  const tally = useShareTally();
  const friends = useInvitedFriends();
  if (!session || !tally) return null;
  return (
    <AppPanel title={SHARED_DAYS_WORDS.title} label={SHARED_DAYS_WORDS.title} icon="share">
      <div className="flex flex-col gap-5" data-referrals-panel>
        {aspect !== null ? (
          <InviteStrip fallbackAspect={aspect} />
        ) : !aspectPending ? (
          <p className="text-app-label text-app-muted">{PROFILE_WORDS.noAspectInvite}</p>
        ) : null}
        <p className="text-app-strong text-app-gold" data-referrals-reward>
          {PROFILE_WORDS.friendReward}
        </p>
        <InvitedFriendsList friends={friends} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STEPS.map((step) => (
            <AppFigure key={step} value={formatShort(tally[step])} label={SHARED_DAYS_WORDS.steps[step]} />
          ))}
        </div>
        <div data-shared-friends className="grid grid-cols-2 gap-4">
          <AppFigure value={formatShort(tally.friendsPaid)} label={SHARED_DAYS_WORDS.friendsPaid} />
          <AppFigure value={formatShort(tally.fragmentsEarned)} label={SHARED_DAYS_WORDS.fragmentsEarned} />
        </div>
      </div>
    </AppPanel>
  );
};

const InvitedFriendsList = ({ friends }: { friends: InvitedFriends["friends"] | null }) => {
  if (friends === null) return null;
  return (
    <section className="referrals-friends" data-invited-friends>
      <span className="text-app-strong text-app-ink">{INVITED_FRIENDS_WORDS.title}</span>
      {friends.length === 0 ? (
        <p className="referrals-friends__empty" data-invited-friends-empty>
          {INVITED_FRIENDS_WORDS.empty}
        </p>
      ) : (
        <ul className="referrals-friends__list">
          {friends.map((friend) => (
            <li
              key={`${friend.joinedAt}:${friend.name ?? ""}`}
              className="referrals-friend"
              data-friend-state={friend.state}
            >
              <span className="referrals-friend__icon" aria-hidden="true">
                <Icon name={FRIEND_STATE_ICONS[friend.state]} size={20} />
              </span>
              <span className="referrals-friend__name">{friend.name ?? INVITED_FRIENDS_WORDS.unnamed}</span>
              <span className="referrals-friend__pill">{INVITED_FRIENDS_WORDS.states[friend.state]}</span>
              {friend.glory !== null && (
                <span className="referrals-friend__glory">{INVITED_FRIENDS_WORDS.glory(friend.glory)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const InviteStrip = ({ fallbackAspect }: { fallbackAspect: AspectId }) => {
  const invite = useSeasonInvite();
  const shownAspect = invite.aspect ?? fallbackAspect;
  return (
    <div className="flex flex-col gap-3">
      <div className="referrals-invite">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-app-strong text-app-ink">{SEASON_INVITE_WORDS.title}</span>
          <span className="text-app-label text-app-muted">{SEASON_INVITE_WORDS.line(aspectName(shownAspect))}</span>
        </div>
        <CopySeasonInvite invite={invite} size="md" />
      </div>
      <SeasonInviteAlerts invite={invite} />
    </div>
  );
};
