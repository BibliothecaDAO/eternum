import type { CampaignReferral } from "@realms-world/identity";
import { useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useCampaignReferral } from "@/hooks/use-referral";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import {
  AppButton,
  AppChip,
  AppDialog,
  AppIconButton,
  AppPanel,
  AppPortrait,
  AppRow,
} from "@/ui/design-system/kit/app-elements";
import { REFERRAL_WORDS } from "@/ui/design-system/kit/words";
import { useLayout } from "@/shell/frame/layout";

import { DEVCON } from "../join/devcon";
import { useDevconEntry } from "../join/devcon-entry";
import { DevconTicket } from "../join/devcon-ticket";

type Friend = CampaignReferral["friends"][number];

/**
 * Invite friends, on the player's own page while Devcon still gives tickets: their link to share, what friends who sign
 * up through it get and earn them, the two ways to golden (a golden friend who counts, or the link at its count), and
 * each friend's progress. Golden earned on a home the game has not confirmed yet says so, and promises no claim. Once
 * friends earn the inviter a ticket or golden that is theirs to use, it says so once, over the page.
 */
export const InvitePanel = () => {
  const { open, referral } = useCampaignReferral(DEVCON.campaign);
  const phone = useLayout() === "phone";
  if (!open) return null;
  if (referral.isError)
    return (
      <AppPanel title={REFERRAL_WORDS.title} icon="people">
        <p className="text-app-ink">{REFERRAL_WORDS.unreadable}</p>
      </AppPanel>
    );
  if (!referral.data) return null;
  const { home, friends, code, link, goldenPending } = referral.data;
  return (
    <AppPanel
      title={REFERRAL_WORDS.title}
      label={REFERRAL_WORDS.title}
      icon="people"
      cue={
        <AppChip tone="gold" icon={link.golden ? "devcon-golden-realm-0" : undefined}>
          {link.golden ? REFERRAL_WORDS.goldenLinkChip : REFERRAL_WORDS.toGoldenLink(link.counted, DEVCON.goldenLinkAt)}
        </AppChip>
      }
    >
      {phone ? (
        <CompactBody referral={referral.data} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-app-ink">{promiseOf(home)}</p>
          {goldenPending && (
            <p className="flex items-center gap-2 text-app-ink">
              <Icon name="hourglass" size={20} />
              {REFERRAL_WORDS.pending}
            </p>
          )}
          <LinkRow code={code} />
          {home === "free" && <TicketProgress counted={link.counted} />}
          {(home === "ticket" || home === "devcon") && !goldenPending && referral.data.tier !== "golden" && (
            <GoldenWays referral={referral.data} />
          )}
          {friends.length > 0 && (
            <div className="flex flex-col">
              {friends.map((friend, index) => (
                <FriendRow key={index} friend={friend} />
              ))}
            </div>
          )}
        </div>
      )}
      <RewardMoment referral={referral.data} />
    </AppPanel>
  );
};

/**
 * A phone's Invite friends, compact (owner, 4 November: "way more compact on mobile"): the promise in a line, the link
 * and its icon-only Copy (and Share) on one row, the link's way to golden as one row of slots ending in the golden
 * link's mark, and each friend as one dense row; a second line only where a status needs it.
 */
const CompactBody = ({ referral }: { referral: CampaignReferral }) => (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-app-ink">{compactPromiseOf(referral.home)}</p>
    {referral.goldenPending && (
      <p className="flex items-center gap-2 text-sm text-app-ink">
        <Icon name="hourglass" size={18} />
        {REFERRAL_WORDS.compact.pending}
      </p>
    )}
    <CompactLink code={referral.code} />
    <LinkSlots counted={referral.link.counted} golden={referral.link.golden} />
    {referral.friends.length > 0 && (
      <ul className="flex flex-col divide-y divide-[var(--app-line)]">
        {referral.friends.map((friend, index) => (
          <CompactFriend key={index} friend={friend} />
        ))}
      </ul>
    )}
  </div>
);

/** The link on one row: its address, Copy as its icon, and Share where the device shares. */
const CompactLink = ({ code }: { code: string }) => {
  const { url, copied, copy, share } = useShareLink(code);
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/25 py-1 pl-3 pr-1">
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-app-ink">{url.replace(/^https?:\/\//, "")}</span>
      <AppIconButton
        icon={copied ? "check" : "copy"}
        label={copied ? REFERRAL_WORDS.copied : REFERRAL_WORDS.copy}
        kind="secondary"
        onClick={copy}
      />
      {share && <AppIconButton icon="share" label={REFERRAL_WORDS.share} kind="secondary" onClick={share} />}
    </div>
  );
};

/** The link's counted friends as one row of slots, the golden link's mark at its end, with its rule in a line. */
const LinkSlots = ({ counted, golden }: { counted: number; golden: boolean }) => (
  <div className="flex flex-col gap-1">
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={REFERRAL_WORDS.toGoldenLink(counted, DEVCON.goldenLinkAt)}
    >
      {Array.from({ length: DEVCON.goldenLinkAt }, (_, index) => (
        <span
          key={index}
          className={`grid h-5 min-w-0 flex-1 place-items-center rounded border ${
            index < counted || golden
              ? "border-[rgb(var(--app-gold))] bg-[rgb(var(--app-gold))/0.25]"
              : "border-[var(--app-line)]"
          }`}
        >
          {(index < counted || golden) && <Icon name="check" size={12} />}
        </span>
      ))}
      <span className={golden ? "" : "opacity-50"}>
        <Icon name="devcon-golden-realm-0" size={28} />
      </span>
    </div>
    <span className="text-xs text-app-ink opacity-75">
      {golden ? REFERRAL_WORDS.compact.linkGolden : REFERRAL_WORDS.compact.linkRule(DEVCON.goldenLinkAt)}
    </span>
  </div>
);

/** A friend in one row: their name, a golden ticket's mark and their status; the reason under it only when not counted. */
const CompactFriend = ({ friend }: { friend: Friend }) => {
  const name = friend.name ?? REFERRAL_WORDS.unnamed;
  return (
    <li className="flex flex-col py-1.5" title={REFERRAL_WORDS.friend[friend.state]}>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold text-app-ink">{name}</span>
        {friend.golden && (
          <span title={REFERRAL_WORDS.golden} className="shrink-0">
            <Icon name="devcon-golden-realm-0" size={22} />
            <span className="sr-only">{REFERRAL_WORDS.golden}</span>
          </span>
        )}
        <CompactStatus state={friend.state} />
      </span>
      {friend.state === "excluded" && (
        <span className="text-xs text-app-ink opacity-75">{REFERRAL_WORDS.compact.excluded}</span>
      )}
    </li>
  );
};

const CompactStatus = ({ state }: { state: Friend["state"] }) =>
  state === "counted" ? (
    <AppChip tone="good" icon="check">
      {REFERRAL_WORDS.counted}
    </AppChip>
  ) : (
    <AppChip>{REFERRAL_WORDS.compact.status[state]}</AppChip>
  );

/** The friend's address for this link, and Copy and Share as the device offers them. */
const useShareLink = (code: string) => {
  const url = `${window.location.origin}${DEVCON.referralPath(code)}`;
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(() => undefined);
  const share =
    typeof navigator.share === "function"
      ? () => void navigator.share({ text: REFERRAL_WORDS.shareText, url }).catch(() => undefined)
      : null;
  return { url, copied, copy, share };
};

/** The link a friend opens, with Share where the device shares and Copy everywhere. */
const LinkRow = ({ code }: { code: string }) => {
  const { url, copied, copy, share } = useShareLink(code);
  const canShare = share !== null;
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
        <AppButton kind="primary" icon="share" onClick={share ?? undefined}>
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
      icon="devcon-realm-0"
      reached
      title={REFERRAL_WORDS.forEachFriend}
      detail={REFERRAL_WORDS.forEachFriendDetail}
    />
    <Milestone
      icon="devcon-realm-0"
      reached={counted > 0}
      title={REFERRAL_WORDS.yourRealm}
      detail={REFERRAL_WORDS.yourRealmDetail}
    />
  </div>
);

const compactPromiseOf = (home: CampaignReferral["home"]) => {
  if (home === "free" || home === "devcon") return REFERRAL_WORDS.compact.promise[home](DEVCON.goldenOneIn);
  return REFERRAL_WORDS.compact.promise[home];
};

const promiseOf = (home: CampaignReferral["home"]) => {
  if (home === "free" || home === "devcon") return REFERRAL_WORDS.promise[home](DEVCON.goldenOneIn);
  return REFERRAL_WORDS.promise[home];
};

/** A regular ticket's two ways to golden: a golden friend who counts, or the link at its count of friends. */
const GoldenWays = ({ referral }: { referral: CampaignReferral }) => (
  <div className="grid grid-cols-2 gap-2">
    <Milestone
      icon="devcon-golden-realm-0"
      reached={referral.friends.some((friend) => friend.golden && friend.state === "counted")}
      title={REFERRAL_WORDS.goldenFriend}
      detail={REFERRAL_WORDS.goldenFriendDetail(DEVCON.goldenOneIn)}
    />
    <Milestone
      icon="devcon-golden-realm-0"
      reached={referral.link.golden}
      title={REFERRAL_WORDS.goldenLink}
      detail={`${REFERRAL_WORDS.goldenLinkDetail(DEVCON.goldenLinkAt)} · ${REFERRAL_WORDS.toGoldenLink(
        referral.link.counted,
        DEVCON.goldenLinkAt,
      )}`}
    />
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
        <span className="flex items-center gap-1">
          {friend.golden && <AppChip tone="gold">{REFERRAL_WORDS.golden}</AppChip>}
          <FriendChip state={friend.state} />
        </span>
      }
    />
  );
};

const FriendChip = ({ state }: { state: Friend["state"] }) => {
  if (state === "counted")
    return (
      <AppChip tone="good" icon="check">
        {REFERRAL_WORDS.counted}
      </AppChip>
    );
  return <AppChip>{state === "excluded" ? REFERRAL_WORDS.notCounted : REFERRAL_WORDS.waiting}</AppChip>;
};

/**
 * What friends earned the inviter, once it is theirs to use: golden once the board shows the realm golden or the golden
 * ticket waits to be added, a ticket while it waits to be added. Golden still pending says nothing here, so it is said
 * once it lands. Said once per account and reward on this device: golden over a ticket when both are new. The identity
 * service stays the record; this device only remembers having said it.
 */
const RewardMoment = ({ referral }: { referral: CampaignReferral }) => {
  const { session } = useIdentitySession();
  const entry = useDevconEntry();
  const account = session?.user.realmsId ?? "";
  const reward = rewardToSay(referral);
  const [closed, setClosed] = useState<typeof reward>(null);
  if (reward === null || closed === reward || wasSaid(account, reward)) return null;
  const close = () => {
    sayOnce(account, reward);
    if (referral.earned.ticket) sayOnce(account, "ticket");
    setClosed(reward);
  };
  const firstCounted = referral.friends.find((friend) => friend.state === "counted")?.name ?? null;
  const where = referral.home === "golden" ? "golden" : "ticket";
  return (
    <AppDialog
      title={
        reward === "golden"
          ? REFERRAL_WORDS.goldenTitle(referral.link.golden)
          : REFERRAL_WORDS.ticketTitle(firstCounted)
      }
      onClose={close}
      actions={
        <AppButton kind="primary" icon="play" to={entry ?? "/"} onClick={close}>
          {reward === "golden" ? REFERRAL_WORDS.goldenAction[where] : REFERRAL_WORDS.ticketAction}
        </AppButton>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <DevconTicket tier={reward === "golden" ? "golden" : "regular"} />
        <p>{reward === "golden" ? REFERRAL_WORDS.goldenBody[where] : REFERRAL_WORDS.ticketBody}</p>
      </div>
    </AppDialog>
  );
};

/** The reward the inviter can use now: golden on the board or on a ticket to add, or a ticket to add; else none. */
const rewardToSay = ({ earned, home, tier }: CampaignReferral): "golden" | "ticket" | null => {
  if (earned.golden && (home === "golden" || (home === "ticket" && tier === "golden"))) return "golden";
  if (earned.ticket && home === "ticket") return "ticket";
  return null;
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
