import type { InvitedFriends, InvitedFriendState, ShareTally } from "@realms-world/identity";
import { aspectName, formatShort, type AspectId } from "@bibliothecadao/types";
import { Fragment } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppPanel } from "@/ui/design-system/kit/app-elements";
import {
  INVITED_FRIENDS_WORDS,
  PROFILE_WORDS,
  SEASON_INVITE_WORDS,
  SHARED_DAYS_WORDS,
} from "@/ui/design-system/kit/words";

import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "../play/season-invite";
import { useInvitedFriends, useShareTally } from "../share/own-shares";

const FRIEND_STATE_ICONS = { joined: "person", reached: "check", paid: "fragment" } satisfies Record<
  InvitedFriendState,
  IconMeaning
>;

type FunnelStageKey = keyof typeof SHARED_DAYS_WORDS.funnel;

type FunnelStage = {
  key: FunnelStageKey;
  icon: IconMeaning;
  count: number;
  gold?: boolean;
};

const hasReferralActivity = (tally: ShareTally): boolean =>
  tally.links > 0 ||
  tally.posted > 0 ||
  tally.visits > 0 ||
  tally.joined > 0 ||
  tally.activated > 0 ||
  tally.fragmentsEarned > 0;

const referralFunnelStages = (tally: ShareTally): readonly FunnelStage[] => [
  { key: "shared", icon: "share", count: Math.max(tally.links, tally.posted) },
  { key: "visits", icon: "eye", count: tally.visits },
  { key: "joined", icon: "person", count: tally.joined },
  { key: "activated", icon: "victory", count: tally.activated },
  { key: "fragmentsEarned", icon: "fragment", count: tally.fragmentsEarned, gold: tally.fragmentsEarned > 0 },
];

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
  const active = hasReferralActivity(tally);
  return (
    <AppPanel title={SHARED_DAYS_WORDS.title} label={SHARED_DAYS_WORDS.title} icon="share">
      <div className="flex flex-col gap-4" data-referrals-panel>
        {aspect !== null ? (
          <InviteStrip fallbackAspect={aspect} />
        ) : !aspectPending ? (
          <InviteWaitsForAspect />
        ) : null}
        <p className="text-app-strong text-app-gold" data-referrals-reward>
          {PROFILE_WORDS.friendReward}
        </p>
        {active ? (
          <>
            <ReferralFunnel tally={tally} />
            <InvitedFriendsList friends={friends} />
          </>
        ) : (
          <ReferralEmptyState hasFriends={friends !== null && friends.length > 0} showFriendsHint={friends !== null} />
        )}
        {!active && friends !== null && friends.length > 0 && <InvitedFriendsList friends={friends} />}
      </div>
    </AppPanel>
  );
};

const ReferralFunnel = ({ tally }: { tally: ShareTally }) => {
  const stages = referralFunnelStages(tally);
  return (
    <ol className="referrals-funnel" data-referrals-funnel>
      {stages.map((stage, index) => (
        <Fragment key={stage.key}>
          {index > 0 && (
            <li className="referrals-funnel__arrow" aria-hidden="true">
              <Icon name="arrow-right" size={14} />
            </li>
          )}
          <li
            className="referrals-funnel__step"
            data-funnel-step={stage.key}
            data-lit={stage.gold || stage.count > 0 || undefined}
            data-gold={stage.gold || undefined}
          >
            <span className="referrals-funnel__head">
              <Icon name={stage.icon} size={15} />
              <span className="referrals-funnel__value">{formatShort(stage.count)}</span>
            </span>
            <span className="referrals-funnel__label">{SHARED_DAYS_WORDS.funnel[stage.key]}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
};

const ReferralEmptyState = ({ hasFriends, showFriendsHint }: { hasFriends: boolean; showFriendsHint: boolean }) => (
  <div className="referrals-empty" data-referrals-empty>
    <span className="referrals-empty__icon" aria-hidden="true">
      <Icon name="share" size={20} />
    </span>
    <div className="referrals-empty__copy">
      <p className="referrals-empty__line">{SHARED_DAYS_WORDS.empty}</p>
      {showFriendsHint && !hasFriends && (
        <p className="referrals-empty__hint" data-invited-friends-empty>
          {INVITED_FRIENDS_WORDS.empty}
        </p>
      )}
    </div>
  </div>
);

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

const InviteWaitsForAspect = () => (
  <div className="referrals-invite" data-invite-locked>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-app-strong text-app-ink">{PROFILE_WORDS.noAspectInviteTitle}</span>
      <span className="text-app-label text-app-muted">{PROFILE_WORDS.noAspectInvite}</span>
    </div>
    <AppButton kind="primary" size="md" icon="play" to="/">
      {PROFILE_WORDS.joinAspect}
    </AppButton>
  </div>
);

const InviteStrip = ({ fallbackAspect }: { fallbackAspect: AspectId }) => {
  const invite = useSeasonInvite();
  const shownAspect = invite.aspect ?? fallbackAspect;
  if (invite.link.none) return null;
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
