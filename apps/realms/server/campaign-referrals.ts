import { CAMPAIGNS, isCampaignKey, type CampaignKey } from "@realms-world/identity";

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

/** What the inviter's friends can still earn them: a ticket, golden, or nothing more. */
type InviterHome = "free" | "devcon" | "golden" | "held";
type FriendState = "signed" | "founded" | "counted";

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
  const { friends, board, ticket } = await settleReferrals(world, campaign, inviter, nowSeconds());
  const referrer = await createCampaignReferralStore(world.db).referrerFor(campaign, inviter);
  const home = ticket?.tier === "golden" ? "golden" : await inviterHome(world, campaign, inviter, ticket !== null);
  if (home === null) return json({ error: "campaigns_unavailable" }, 503);
  return json({
    code: referrer.code,
    home,
    friends: await Promise.all(
      friends.map(async (friend) => ({ name: friend.name, state: await friendState(world, friend, board) })),
    ),
    earned: { ticket: referrer.ticketEarnedAt !== null, golden: referrer.goldenEarnedAt !== null },
  });
}

async function inviterHome(
  world: ReferralWorld,
  campaign: CampaignKey,
  inviter: string,
  holdsTicket: boolean,
): Promise<InviterHome | null> {
  const source = await world.homeSource(inviter, CAMPAIGNS[campaign].presets);
  if (source === null) return null;
  if (source === "realm" || (source === "campaign" && !holdsTicket)) return "held";
  return holdsTicket ? "devcon" : "free";
}

async function friendState(
  world: ReferralWorld,
  friend: ReferredFriend,
  board: Map<string, CampaignStanding> | null,
): Promise<FriendState> {
  if (friend.countedAt !== null) return "counted";
  return board?.has(accountKey(await world.accountOf(friend.friend))) ? "founded" : "signed";
}

/**
 * Counts the inviter's friends who stand on the season board with a site cleared, then pays what they earned: a
 * regular ticket for a free home at the first, and golden at the campaign's count, applied onchain once the home is a
 * founded Devcon home. Every step is safe to repeat, so any read may settle, and a step that cannot be told now (a board
 * or a shard that cannot say, a relay that refuses for now) waits for the next read. Nothing settles after the season.
 */
export async function settleReferrals(world: ReferralWorld, campaign: CampaignKey, inviter: string, now: number) {
  const referrals = createCampaignReferralStore(world.db);
  const tickets = createCampaignTicketStore(world.db);
  const friends = await referrals.friendsOf(campaign, inviter);
  const ticket = await tickets.ticketOf(campaign, inviter);
  if (friends.length === 0 || now >= CAMPAIGNS[campaign].redeemUntil) return { friends, board: null, ticket };
  const board = await world.standings(CAMPAIGNS[campaign].presets);
  if (board === null) return { friends, board, ticket };
  const counted = await countFriends(world, campaign, friends, board, now);
  const rewarded = await rewardInviter(world, campaign, inviter, counted, now);
  if (rewarded?.tier === "golden") await applyGolden(world, inviter, board);
  return { friends: await referrals.friendsOf(campaign, inviter), board, ticket: rewarded };
}

async function countFriends(
  world: ReferralWorld,
  campaign: CampaignKey,
  friends: ReferredFriend[],
  board: Map<string, CampaignStanding>,
  now: number,
) {
  const cleared = await Promise.all(
    friends
      .filter((friend) => friend.countedAt === null)
      .map(async (friend) => ({
        friend: friend.friend,
        cleared: (board.get(accountKey(await world.accountOf(friend.friend)))?.sitesCleared ?? 0) >= 1,
      })),
  );
  const newlyCounted = cleared.filter((row) => row.cleared).map((row) => row.friend);
  await createCampaignReferralStore(world.db).markCounted(campaign, newlyCounted, now);
  return friends.filter((friend) => friend.countedAt !== null).length + newlyCounted.length;
}

/** The inviter's ticket after paying what `counted` friends earned; a held-Realm home earns nothing. */
async function rewardInviter(
  world: ReferralWorld,
  campaign: CampaignKey,
  inviter: string,
  counted: number,
  now: number,
) {
  const referrals = createCampaignReferralStore(world.db);
  const tickets = createCampaignTicketStore(world.db);
  let ticket = await tickets.ticketOf(campaign, inviter);
  const earnsTicket = counted >= 1 && ticket === null;
  const earnsGolden = counted >= CAMPAIGNS[campaign].referral.goldenAt && ticket?.tier !== "golden";
  if (!earnsTicket && !earnsGolden) return ticket;
  const source = await world.homeSource(inviter, CAMPAIGNS[campaign].presets);
  if (earnsTicket && source === "none") {
    const { ticket: given, given: isNew } = await tickets.give(campaign, inviter, now);
    if (isNew) await referrals.markEarned(campaign, inviter, "ticket", now);
    ticket = given;
  }
  if (earnsGolden && ticket?.tier === "regular" && (source === "none" || source === "campaign")) {
    if (await tickets.promote(campaign, inviter)) await referrals.markEarned(campaign, inviter, "golden", now);
    ticket = await tickets.ticketOf(campaign, inviter);
  }
  return ticket;
}

/**
 * A golden ticket on a home the board still shows regular asks the relay to turn the home golden; a refusal or an
 * unreachable relay leaves it for the next read. A home not founded yet, or founded without a ticket, takes the golden
 * ticket's tier when it founds or attaches it, with no call.
 */
async function applyGolden(world: ReferralWorld, inviter: string, board: Map<string, CampaignStanding>) {
  const home = board.get(accountKey(await world.accountOf(inviter)));
  if (home?.tier !== 1) return;
  const response = await world
    .upgradeHome({ chainId: home.chainId, gameId: home.gameId, realmsId: inviter })
    .catch(() => json({ error: "value_relay_unreachable" }, 503));
  if (response.ok) return;
  const { error } = (await response.json().catch(() => ({}))) as { error?: string };
  console.warn(JSON.stringify({ event: "campaign_upgrade_refused", status: response.status, error: error ?? null }));
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
