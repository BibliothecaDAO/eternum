import { CAMPAIGNS, isCampaignKey, type CampaignKey, type TicketTier } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import type { CampaignStanding, HomeSource } from "./campaign-entry";
import { accountKey } from "./campaign-entry";
import { createCampaignReferralStore, type ReferredFriend } from "./campaign-referral-store";
import { createCampaignTicketStore } from "./campaign-ticket-store";
import { readCampaignCode } from "./campaigns";
import { json } from "./http";

/**
 * What referral settlement reads and calls beyond D1: the inviter's home source, the season boards, the account each
 * Realms id plays with, and the relay that turns a founded Devcon home golden.
 */
export interface ReferralWorld {
  db: D1Database;
  homeSource: (realmsId: string, presets: readonly number[]) => Promise<HomeSource | null>;
  standings: (presets: readonly number[]) => Promise<Map<string, CampaignStanding> | null>;
  accountOf: (realmsId: string) => Promise<string>;
  upgradeHome: (home: { chainId: string; gameId: number; realmsId: string }) => Promise<Response>;
}

type Board = Map<string, CampaignStanding>;

/**
 * The account's home as its friends' rewards see it: no ticket yet (free), a ticket not on a home yet (ticket), a
 * founded Devcon home the board shows regular (devcon) or golden (golden), or a home whose claim comes from elsewhere
 * (held), which friends earn nothing for.
 */
type InviterHome = "free" | "ticket" | "devcon" | "golden" | "held";
/** A friend who shares a mailbox or device with the inviter or a counted friend is excluded: one person counts once. */
type FriendState = "signed" | "founded" | "counted" | "excluded";

/** The tier a link draws for a friend's ticket: golden at the campaign's odds, from the Worker's own randomness. */
export const drawFriendTier = (campaign: CampaignKey): TicketTier =>
  crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32 < CAMPAIGNS[campaign].referral.goldenOdds
    ? "golden"
    : "regular";

/**
 * GET /api/campaigns/referral?campaign=: the signed-in account's referral link, its friends and what they earned it,
 * settled against the season board first.
 */
export async function handleCampaignReferral(request: Request, auth: IdentityAuth, world: ReferralWorld) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => undefined);
  if (session === undefined) return json({ error: "authentication_unavailable" }, 503);
  if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
  const campaign = new URL(request.url).searchParams.get("campaign");
  if (!isCampaignKey(campaign)) return json({ error: "invalid_campaign" }, 400);
  try {
    return await referralAnswer(world, campaign, session.user.realmsId);
  } catch {
    return json({ error: "campaigns_unavailable" }, 503);
  }
}

/** GET /api/campaigns/referral/<code>?campaign=: the public name of the inviter whose link a friend opened. */
export async function handleCampaignReferrer(db: D1Database, url: URL, code: string) {
  const campaign = url.searchParams.get("campaign");
  const referral = readCampaignCode(code);
  if (!isCampaignKey(campaign) || !referral) return json({ error: "referral_unknown" }, 404);
  const inviter = await createCampaignReferralStore(db).inviterOf(campaign, referral);
  return inviter ? json({ name: inviter.name }) : json({ error: "referral_unknown" }, 404);
}

async function referralAnswer(world: ReferralWorld, campaign: CampaignKey, inviter: string) {
  const settled = await settleReferrals(world, campaign, inviter, nowSeconds());
  const referrer = await createCampaignReferralStore(world.db).referrerFor(campaign, inviter);
  const source = await world.homeSource(inviter, CAMPAIGNS[campaign].presets);
  if (source === null) return json({ error: "campaigns_unavailable" }, 503);
  const standing = settled.board?.get(accountKey(await world.accountOf(inviter)));
  const home = inviterHome(source, settled.ticket?.tier ?? null, standing);
  return json({
    code: referrer.code,
    home,
    tier: settled.ticket?.tier ?? null,
    // Earned golden whose upgrade the board does not show yet: honest until it does, never claimed as done.
    goldenPending: home === "devcon" && settled.ticket?.tier === "golden",
    link: {
      counted: settled.friends.filter((friend) => friend.countedAt !== null).length,
      golden: referrer.goldenLinkAt !== null,
    },
    friends: await Promise.all(
      settled.friends.map(async (friend) => ({
        name: friend.name,
        state: await friendState(world, friend, settled),
        golden: friend.tier === "golden",
      })),
    ),
    earned: { ticket: referrer.ticketEarnedAt !== null, golden: referrer.goldenEarnedAt !== null },
  });
}

const inviterHome = (
  source: HomeSource,
  tier: TicketTier | null,
  standing: CampaignStanding | undefined,
): InviterHome => {
  if (source === "realm" || (source === "campaign" && tier === null)) return "held";
  if (source === "none") return tier === null ? "free" : "ticket";
  return standing?.tier === 2 ? "golden" : "devcon";
};

async function friendState(
  world: ReferralWorld,
  friend: ReferredFriend,
  { board, excluded }: { board: Board | null; excluded: Set<string> },
): Promise<FriendState> {
  if (friend.countedAt !== null) return "counted";
  if (excluded.has(friend.friend)) return "excluded";
  return board?.has(accountKey(await world.accountOf(friend.friend))) ? "founded" : "signed";
}

/**
 * Settles what the account's friends earned it, then the account's own golden home. Friends count once the season
 * board shows them founded with a site cleared, each with their own mailbox and device. The first counted friend gives
 * a home with no ticket a regular one; a golden friend who counts, or the link's `goldenLinkAt`th counted friend, turns
 * the inviter golden, and the latter turns the link golden for every friend on it. A golden ticket on a founded home the
 * board still shows regular asks the relay to upgrade it, whether friends or the link earned it. Every step is safe to
 * repeat, so any read may settle; a step that cannot be told now waits for the next read. Nothing settles after the
 * season.
 */
export async function settleReferrals(world: ReferralWorld, campaign: CampaignKey, account: string, now: number) {
  const referrals = createCampaignReferralStore(world.db);
  const tickets = createCampaignTicketStore(world.db);
  let friends = await referrals.friendsOf(campaign, account);
  let ticket = await tickets.ticketOf(campaign, account);
  const unsettled = { friends, board: null, ticket, excluded: new Set<string>() };
  if (now >= CAMPAIGNS[campaign].redeemUntil || (friends.length === 0 && ticket?.tier !== "golden")) return unsettled;
  const board = await world.standings(CAMPAIGNS[campaign].presets);
  if (board === null) return unsettled;
  let excluded = new Set<string>();
  if (friends.length > 0) {
    excluded = await countFriends(world, campaign, account, friends, board, now);
    ticket = await rewardInviter(world, campaign, account, await referrals.friendsOf(campaign, account), now);
    // Read again: the golden link may just have turned every friend's ticket golden.
    friends = await referrals.friendsOf(campaign, account);
  }
  if (ticket?.tier === "golden") await applyGolden(world, account, board);
  return { friends, board, ticket, excluded };
}

/**
 * Counts each friend the board shows with a site cleared whose mailbox and device are their own: neither the
 * inviter's nor a counted friend's. Friends counted before keep their count and claim their identity first; the rest
 * are taken oldest first. A friend whose device is not known yet waits for it. Answers the friends excluded as
 * someone else's.
 */
async function countFriends(
  world: ReferralWorld,
  campaign: CampaignKey,
  inviter: string,
  friends: ReferredFriend[],
  board: Board,
  now: number,
) {
  const referrals = createCampaignReferralStore(world.db);
  const own = await referrals.identityOf(inviter);
  const mailboxes = new Set<string | null>([own.mailbox, ...friends.filter(isCounted).map((friend) => friend.mailbox)]);
  const devices = new Set<string | null>([
    ...own.devices,
    ...friends.filter(isCounted).map((friend) => friend.deviceKey),
  ]);
  const excluded = new Set<string>();
  const newlyCounted: { friend: string; deviceKey: string }[] = [];
  for (const friend of friends.filter((candidate) => !isCounted(candidate))) {
    if (!(await hasClearedSite(world, friend, board))) continue;
    const deviceKey = friend.deviceKey ?? (await referrals.identityOf(friend.friend)).devices[0];
    if (deviceKey === undefined) continue;
    if (mailboxes.has(friend.mailbox) || devices.has(deviceKey)) {
      excluded.add(friend.friend);
      continue;
    }
    mailboxes.add(friend.mailbox);
    devices.add(deviceKey);
    newlyCounted.push({ friend: friend.friend, deviceKey });
  }
  await referrals.markCounted(campaign, newlyCounted, now);
  return excluded;
}

const isCounted = (friend: ReferredFriend) => friend.countedAt !== null;

const hasClearedSite = async (world: ReferralWorld, friend: ReferredFriend, board: Board) =>
  (board.get(accountKey(await world.accountOf(friend.friend)))?.sitesCleared ?? 0) >= 1;

/**
 * The inviter's ticket after paying what its counted friends earned, each grant one transaction with its mark: the
 * link gone golden for its friends, then the inviter's own ticket, regular or golden, or its promotion. A held-Realm
 * home earns its inviter nothing; its friends still take the golden link.
 */
async function rewardInviter(
  world: ReferralWorld,
  campaign: CampaignKey,
  inviter: string,
  friends: ReferredFriend[],
  now: number,
) {
  const referrals = createCampaignReferralStore(world.db);
  const tickets = createCampaignTicketStore(world.db);
  const ticket = await tickets.ticketOf(campaign, inviter);
  const counted = friends.filter(isCounted);
  if (counted.length === 0) return ticket;
  const { referral } = CAMPAIGNS[campaign];
  const linkGolden = counted.length >= referral.goldenLinkAt;
  const goldenEarned = linkGolden || counted.some((friend) => friend.tier === "golden");
  const { goldenLinkAt } = await referrals.referrerFor(campaign, inviter);
  const grants: D1PreparedStatement[] =
    linkGolden && goldenLinkAt === null ? referrals.goldLink(campaign, inviter, now) : [];
  const owesInviter = ticket === null || (goldenEarned && ticket.tier === "regular");
  const source = owesInviter ? await world.homeSource(inviter, CAMPAIGNS[campaign].presets) : null;
  if (ticket === null && source === "none")
    grants.push(...referrals.giveInviterTicket(campaign, inviter, goldenEarned ? "golden" : "regular", now));
  if (ticket?.tier === "regular" && goldenEarned && (source === "none" || source === "campaign"))
    grants.push(...referrals.promoteInviter(campaign, inviter, now));
  await referrals.grant(grants);
  return tickets.ticketOf(campaign, inviter);
}

/**
 * A golden ticket on a home the board still shows regular asks the relay to turn the home golden; a refusal or an
 * unreachable relay leaves it for the next read. A home not founded yet, or founded without a ticket, takes the golden
 * ticket's tier when it founds or attaches it, with no call.
 */
async function applyGolden(world: ReferralWorld, account: string, board: Board) {
  const home = board.get(accountKey(await world.accountOf(account)));
  if (home?.tier !== 1) return;
  const response = await world
    .upgradeHome({ chainId: home.chainId, gameId: home.gameId, realmsId: account })
    .catch(() => json({ error: "value_relay_unreachable" }, 503));
  if (response.ok) return;
  const { error } = (await response.json().catch(() => ({}))) as { error?: string };
  console.warn(JSON.stringify({ event: "campaign_upgrade_refused", status: response.status, error: error ?? null }));
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
