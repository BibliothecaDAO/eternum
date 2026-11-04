import type { CampaignReferral } from "@realms-world/identity";
import { useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useCampaignReferral } from "@/hooks/use-referral";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton, AppChip, AppDialog, AppPanel, AppPortrait, AppRow } from "@/ui/design-system/kit/app-elements";
import { REFERRAL_WORDS } from "@/ui/design-system/kit/words";

import { DEVCON } from "../join/devcon";
import { useDevconEntry } from "../join/devcon-entry";
import { DevconTicket } from "../join/devcon-ticket";

type Friend = CampaignReferral["friends"][number];

/**
 * Invite friends, on the player's own page while Devcon still gives tickets: their link to share, what friends who sign
 * up through it get and earn them, and each friend's progress. Once friends earn the inviter a ticket or golden, it
 * says so once, over the page.
 */
export const InvitePanel = () => {
  const { open, referral } = useCampaignReferral(DEVCON.campaign);
  if (!open) return null;
  if (referral.isError)
    return (
      <AppPanel title={REFERRAL_WORDS.title} icon="people">
        <p className="text-app-ink">{REFERRAL_WORDS.unreadable}</p>
      </AppPanel>
    );
  if (!referral.data) return null;
  const { home, friends, code } = referral.data;
  const counted = friends.filter((friend) => friend.state === "counted").length;
  return (
    <AppPanel
      title={REFERRAL_WORDS.title}
      icon="people"
      cue={
        home === "devcon" ? (
          <AppChip tone="gold">{REFERRAL_WORDS.toGolden(counted, DEVCON.goldenAt)}</AppChip>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-app-ink">
          {home === "devcon" ? REFERRAL_WORDS.promise.devcon(DEVCON.goldenAt) : REFERRAL_WORDS.promise[home]}
        </p>
        <LinkRow code={code} />
        {home === "free" && <TicketProgress counted={counted} />}
        {home === "devcon" && <GoldenProgress counted={counted} />}
        {friends.length > 0 && (
          <div className="flex flex-col">
            {friends.map((friend, index) => (
              <FriendRow key={index} friend={friend} />
            ))}
          </div>
        )}
      </div>
      <RewardMoment referral={referral.data} />
    </AppPanel>
  );
};

/** The link a friend opens, with Share where the device shares and Copy everywhere. */
const LinkRow = ({ code }: { code: string }) => {
  const url = `${window.location.origin}${DEVCON.referralPath(code)}`;
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";
  const copy = () =>
    void navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(() => undefined);
  const share = () => void navigator.share({ text: REFERRAL_WORDS.shareText, url }).catch(() => undefined);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2">
      <span className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
        <Icon name="share" size={22} />
        <span className="min-w-0 truncate font-mono text-sm text-app-ink">{url.replace(/^https?:\/\//, "")}</span>
      </span>
      <AppButton kind={canShare ? "secondary" : "primary"} icon="copy" onClick={copy}>
        {copied ? REFERRAL_WORDS.copied : REFERRAL_WORDS.copy}
      </AppButton>
      {canShare && (
        <AppButton kind="primary" icon="share" onClick={share}>
          {REFERRAL_WORDS.share}
        </AppButton>
      )}
    </div>
  );
};

/** A free home's two steps: every friend's realm, and the inviter's own at the first friend counted. */
const TicketProgress = ({ counted }: { counted: number }) => (
  <div className="grid grid-cols-2 gap-2">
    <Milestone
      icon="devcon-realm"
      reached
      title={REFERRAL_WORDS.forEachFriend}
      detail={REFERRAL_WORDS.forEachFriendDetail}
    />
    <Milestone
      icon="devcon-realm"
      reached={counted > 0}
      title={REFERRAL_WORDS.yourRealm}
      detail={REFERRAL_WORDS.yourRealmDetail}
    />
  </div>
);

/** A Devcon home's steps to golden, one per friend counted. */
const GoldenProgress = ({ counted }: { counted: number }) => (
  <div className="grid grid-cols-3 gap-2">
    {Array.from({ length: DEVCON.goldenAt }, (_, index) => {
      const last = index === DEVCON.goldenAt - 1;
      return (
        <Milestone
          key={index}
          icon={last ? "devcon-golden-realm" : "check"}
          reached={index < counted}
          title={last ? REFERRAL_WORDS.goldenRealm : REFERRAL_WORDS.friendStep(index + 1)}
          detail={index < counted ? REFERRAL_WORDS.stepCounted : REFERRAL_WORDS.stepWaiting}
        />
      );
    })}
  </div>
);

const Milestone = ({
  icon,
  reached,
  title,
  detail,
}: {
  icon: IconMeaning;
  reached: boolean;
  title: string;
  detail: string;
}) => (
  <div
    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center ${
      reached ? "border-[rgb(var(--app-gold))]" : "border-[var(--app-line)] opacity-60"
    }`}
  >
    <Icon name={icon} size={44} />
    <span className="font-semibold text-app-ink">{title}</span>
    <span className="text-xs text-app-ink opacity-75">{detail}</span>
  </div>
);

const FriendRow = ({ friend }: { friend: Friend }) => {
  const name = friend.name ?? REFERRAL_WORDS.unnamed;
  return (
    <AppRow
      lead={<AppPortrait name={name} size="sm" />}
      title={name}
      detail={REFERRAL_WORDS.friend[friend.state]}
      trail={
        friend.state === "counted" ? (
          <AppChip tone="good" icon="check">
            {REFERRAL_WORDS.counted}
          </AppChip>
        ) : (
          <AppChip>{REFERRAL_WORDS.waiting}</AppChip>
        )
      }
    />
  );
};

/**
 * What friends earned the inviter, said once per account and reward on this device: golden over a ticket when both are
 * new. The identity service stays the record; this device only remembers having said it.
 */
const RewardMoment = ({ referral }: { referral: CampaignReferral }) => {
  const { session } = useIdentitySession();
  const entry = useDevconEntry();
  const account = session?.user.realmsId ?? "";
  const reward = referral.earned.golden ? "golden" : referral.earned.ticket ? "ticket" : null;
  const [closed, setClosed] = useState<typeof reward>(null);
  if (reward === null || closed === reward || wasSaid(account, reward)) return null;
  const close = () => {
    sayOnce(account, reward);
    if (referral.earned.ticket) sayOnce(account, "ticket");
    setClosed(reward);
  };
  const firstCounted = referral.friends.find((friend) => friend.state === "counted")?.name ?? null;
  return (
    <AppDialog
      title={
        reward === "golden" ? REFERRAL_WORDS.goldenTitle(DEVCON.goldenAt) : REFERRAL_WORDS.ticketTitle(firstCounted)
      }
      onClose={close}
      actions={
        <AppButton kind="primary" icon="play" to={entry ?? "/"} onClick={close}>
          {reward === "golden" ? REFERRAL_WORDS.goldenAction : REFERRAL_WORDS.ticketAction}
        </AppButton>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <DevconTicket tier={reward === "golden" ? "golden" : "regular"} />
        <p>{reward === "golden" ? REFERRAL_WORDS.goldenBody : REFERRAL_WORDS.ticketBody}</p>
      </div>
    </AppDialog>
  );
};

const saidKey = (account: string, reward: "ticket" | "golden") =>
  `realms:referral-said:${DEVCON.campaign}:${account}:${reward}`;

const wasSaid = (account: string, reward: "ticket" | "golden") => {
  try {
    return localStorage.getItem(saidKey(account, reward)) !== null;
  } catch {
    return false;
  }
};

const sayOnce = (account: string, reward: "ticket" | "golden") => {
  try {
    localStorage.setItem(saidKey(account, reward), "1");
  } catch {
    // Without storage it is said again on the next visit.
  }
};
