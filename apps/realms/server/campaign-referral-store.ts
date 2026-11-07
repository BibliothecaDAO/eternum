import { profileOfIdentityUser, type CampaignKey, type TicketTier } from "@realms-world/identity";

import { newPublicCode } from "./campaigns";

/** A friend as their inviter's settlement reads them: who they are to the anti-alt check, their ticket and their count. */
export interface ReferredFriend {
  friend: string;
  name: string | null;
  mailbox: string;
  browser: string | null;
  tier: TicketTier | null;
  countedAt: number | null;
}

export interface Referrer {
  code: string;
  ticketEarnedAt: number | null;
  goldenEarnedAt: number | null;
  goldenLinkAt: number | null;
}

/** Who an account is to the one-person check: its mailbox, null when unknown, and every browser it was signed in on. */
export interface Identity {
  mailbox: string | null;
  browsers: string[];
}

interface CampaignTicket {
  campaign: CampaignKey;
  owner: string;
  tier: TicketTier;
}

/**
 * Whether a browser, as the counting write's SQL names it, is someone else's on the link: one the inviter was ever
 * signed in on, or a counted friend's, kept or ever signed in on. `f` is the friend being counted.
 */
const taken = (
  browser: string,
) => `(${browser} IN (SELECT "browser" FROM "account_browsers" WHERE "realmsId" = f."referrer")
  OR EXISTS (SELECT 1 FROM "campaign_referrals" AS o
             WHERE o."campaign" = f."campaign" AND o."referrer" = f."referrer" AND o."counted_at" IS NOT NULL
               AND (o."browser" = ${browser}
                    OR EXISTS (SELECT 1 FROM "account_browsers" AS b WHERE b."realmsId" = o."friend" AND b."browser" = ${browser}))))`;

/** A new code takes another try only when it collides with another inviter's; eight letters make that rare. */
const CODE_ATTEMPTS = 4;

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

/**
 * The mailbox an email reaches: lowercased, without a +tag, and for Gmail without dots, so one inbox's aliases are one
 * mailbox to the anti-alt check.
 */
export const mailboxOf = (email: string): string => {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const base = local.split("+")[0]!;
  return GMAIL.has(domain) ? `${base.replaceAll(".", "")}@gmail.com` : `${base}@${domain}`;
};

/**
 * Referral links and the friends they brought, in D1 (migrations/0027_campaign_referrals.sql). Every write that grants
 * something is one batch with the record that marks it granted, so a failure leaves neither and the next read retries.
 */
export function createCampaignReferralStore(db: D1Database) {
  const referrer = (campaign: CampaignKey, account: string) =>
    db
      .prepare(
        `SELECT "code", "ticket_earned_at" AS "ticketEarnedAt", "golden_earned_at" AS "goldenEarnedAt",
                "golden_link_at" AS "goldenLinkAt"
         FROM "campaign_referrers" WHERE "campaign" = ? AND "referrer" = ?`,
      )
      .bind(campaign, account)
      .first<Referrer>();

  /** The account's referral link, made on first ask and the same ever after. Safe to repeat, and to race. */
  const referrerFor = async (campaign: CampaignKey, account: string): Promise<Referrer> => {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const held = await referrer(campaign, account);
      if (held) return held;
      await db
        .prepare(
          `INSERT INTO "campaign_referrers" ("campaign", "referrer", "code") VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
        )
        .bind(campaign, account, newPublicCode())
        .run();
    }
    throw new Error("referral_code_unavailable");
  };

  /** The inviter behind a referral code, and their public name; null for a code no link carries. */
  const inviterOf = (campaign: CampaignKey, code: string) =>
    db
      .prepare(
        `SELECT r."referrer", u."id", u."name", u."image" FROM "campaign_referrers" r
         JOIN "user" u ON u."realmsId" = r."referrer" WHERE r."campaign" = ? AND r."code" = ?`,
      )
      .bind(campaign, code)
      .first<{ referrer: string; id: string; name: string; image: string | null }>()
      .then((row) => (row ? { referrer: row.referrer, name: profileOfIdentityUser(row).name } : null));

  /**
   * The friend's ticket from the inviter's link, recorded for the inviter in the same batch: golden when the link has
   * gone golden, else at the tier drawn for it. Null when the friend already held a ticket, which records nothing. A
   * friend's account is newer than their inviter's: an older account still gets its ticket, but brought no one, so two
   * accounts never count for each other.
   */
  const giveFriendTicket = async (
    campaign: CampaignKey,
    friend: { realmsId: string; mailbox: string; browser: string | null },
    inviter: string,
    drawn: TicketTier,
    now: number,
  ): Promise<CampaignTicket | null> => {
    const [given] = await db.batch<CampaignTicket>([
      db
        .prepare(
          `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at")
           VALUES (?, ?, NULL, CASE WHEN EXISTS (SELECT 1 FROM "campaign_referrers" WHERE "campaign" = ? AND "referrer" = ?
                                                 AND "golden_link_at" IS NOT NULL) THEN 'golden' ELSE ? END, ?)
           ON CONFLICT DO NOTHING RETURNING "campaign", "owner", "tier"`,
        )
        .bind(campaign, friend.realmsId, campaign, inviter, drawn, now),
      db
        .prepare(
          `INSERT INTO "campaign_referrals" ("campaign", "friend", "referrer", "created_at", "mailbox", "browser")
           SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1
             AND julianday((SELECT "createdAt" FROM "user" WHERE "realmsId" = ?2))
                 > julianday((SELECT "createdAt" FROM "user" WHERE "realmsId" = ?3))
           ON CONFLICT DO NOTHING`,
        )
        .bind(campaign, friend.realmsId, inviter, now, friend.mailbox, friend.browser),
    ]);
    return given?.results[0] ?? null;
  };

  /** The inviter's friends, oldest first, with their public names, tickets and anti-alt identity. */
  const friendsOf = async (campaign: CampaignKey, inviter: string): Promise<ReferredFriend[]> =>
    (
      await db
        .prepare(
          `SELECT f."friend", f."mailbox", f."browser", f."counted_at" AS "countedAt", t."tier",
                  u."id", u."name", u."image"
           FROM "campaign_referrals" f
           JOIN "user" u ON u."realmsId" = f."friend"
           LEFT JOIN "campaign_tickets" t ON t."campaign" = f."campaign" AND t."owner" = f."friend"
           WHERE f."campaign" = ? AND f."referrer" = ? ORDER BY f."created_at", f."rowid"`,
        )
        .bind(campaign, inviter)
        .all<Omit<ReferredFriend, "name"> & { id: string; name: string; image: string | null }>()
    ).results.map(({ id, name, image, ...friend }) => ({
      ...friend,
      name: profileOfIdentityUser({ id, name, image }).name,
    }));

  /** The account's mailbox and every browser it was ever signed in on: who it is to the one-person check. */
  const identityOf = async (realmsId: string): Promise<Identity> => {
    const [user, browsers] = await db.batch<{ email?: string; browser?: string }>([
      db.prepare('SELECT "email" FROM "user" WHERE "realmsId" = ?').bind(realmsId),
      db.prepare('SELECT "browser" FROM "account_browsers" WHERE "realmsId" = ? ORDER BY "browser"').bind(realmsId),
    ]);
    const email = user?.results[0]?.email;
    return {
      mailbox: email === undefined ? null : mailboxOf(email),
      browsers: (browsers?.results ?? []).map((row) => row.browser!),
    };
  };

  /**
   * Counts friends for their inviter, keeping the browser each counted on; a friend once counted stays counted. The
   * write itself refuses a friend who shares the inviter's mailbox or any browser, or a counted friend's on the link:
   * every browser either account was ever signed in on (account_browsers), and each counted friend's kept one. Reads
   * that race, each deciding from its own snapshot, still count one person once.
   */
  const markCounted = async (
    campaign: CampaignKey,
    inviter: string,
    own: Identity,
    friends: { friend: string; browser: string }[],
    now: number,
  ) => {
    if (friends.length === 0) return;
    await db.batch(
      friends.map(({ friend, browser }) =>
        db
          .prepare(
            `UPDATE "campaign_referrals" AS f SET "counted_at" = ?1, "browser" = coalesce(f."browser", ?2)
             WHERE f."campaign" = ?3 AND f."friend" = ?4 AND f."referrer" = ?5 AND f."counted_at" IS NULL
               AND f."mailbox" IS NOT ?6
               AND NOT EXISTS (SELECT 1 FROM "campaign_referrals" AS o
                               WHERE o."campaign" = f."campaign" AND o."referrer" = f."referrer"
                                 AND o."counted_at" IS NOT NULL AND o."mailbox" = f."mailbox")
               AND NOT ${taken('coalesce(f."browser", ?2)')}
               AND NOT EXISTS (SELECT 1 FROM "account_browsers" AS mine
                               WHERE mine."realmsId" = f."friend" AND ${taken('mine."browser"')})`,
          )
          .bind(now, browser, campaign, friend, inviter, own.mailbox),
      ),
    );
  };

  /** Every browser each friend on the link was ever signed in on, by friend: the one-person check's whole relation. */
  const browsersOfFriends = async (campaign: CampaignKey, inviter: string) => {
    const { results } = await db
      .prepare(
        `SELECT f."friend", b."browser" FROM "campaign_referrals" AS f
         JOIN "account_browsers" AS b ON b."realmsId" = f."friend"
         WHERE f."campaign" = ? AND f."referrer" = ?`,
      )
      .bind(campaign, inviter)
      .all<{ friend: string; browser: string }>();
    const byFriend = new Map<string, string[]>();
    for (const { friend, browser } of results) byFriend.set(friend, [...(byFriend.get(friend) ?? []), browser]);
    return byFriend;
  };

  /** The inviter's reward ticket, with the mark that friends earned it, both or neither. */
  const giveInviterTicket = (campaign: CampaignKey, inviter: string, tier: TicketTier, now: number) => [
    db
      .prepare(
        `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at")
         VALUES (?, ?, NULL, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(campaign, inviter, tier, now),
    db
      .prepare(
        `UPDATE "campaign_referrers" SET "ticket_earned_at" = coalesce("ticket_earned_at", ?),
           "golden_earned_at" = CASE WHEN ? = 'golden' THEN coalesce("golden_earned_at", ?) ELSE "golden_earned_at" END
         WHERE "campaign" = ? AND "referrer" = ? AND changes() = 1`,
      )
      .bind(now, tier, now, campaign, inviter),
  ];

  /** The inviter's regular ticket turned golden, with the mark that friends earned it, both or neither. */
  const promoteInviter = (campaign: CampaignKey, inviter: string, now: number) => [
    db
      .prepare(
        `UPDATE "campaign_tickets" SET "tier" = 'golden' WHERE "campaign" = ? AND "owner" = ? AND "tier" = 'regular'`,
      )
      .bind(campaign, inviter),
    db
      .prepare(
        `UPDATE "campaign_referrers" SET "golden_earned_at" = coalesce("golden_earned_at", ?)
         WHERE "campaign" = ? AND "referrer" = ? AND changes() = 1`,
      )
      .bind(now, campaign, inviter),
  ];

  /**
   * The link gone golden: marked once, and every friend's ticket on it golden, those given before and, through
   * giveFriendTicket, after. The inviter's own ticket is the inviter reward's, which a held Realm never takes.
   */
  const goldLink = (campaign: CampaignKey, inviter: string, now: number) => [
    db
      .prepare(
        `UPDATE "campaign_referrers" SET "golden_link_at" = coalesce("golden_link_at", ?)
         WHERE "campaign" = ? AND "referrer" = ?`,
      )
      .bind(now, campaign, inviter),
    db
      .prepare(
        `UPDATE "campaign_tickets" SET "tier" = 'golden' WHERE "campaign" = ? AND "tier" = 'regular'
           AND "owner" IN (SELECT "friend" FROM "campaign_referrals" WHERE "campaign" = ? AND "referrer" = ?)`,
      )
      .bind(campaign, campaign, inviter),
  ];

  /** Applies grants built above, all in one transaction. */
  const grant = async (statements: D1PreparedStatement[]) => {
    if (statements.length > 0) await db.batch(statements);
  };

  return {
    referrerFor,
    inviterOf,
    giveFriendTicket,
    friendsOf,
    identityOf,
    markCounted,
    browsersOfFriends,
    giveInviterTicket,
    promoteInviter,
    goldLink,
    grant,
  };
}
