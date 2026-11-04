import { profileOfIdentityUser, type CampaignKey } from "@realms-world/identity";

import { CODE_ALPHABET, CODE_LENGTH } from "./campaigns";

/** A friend as their inviter sees them: their public name, when they were counted, and the account to look up. */
export interface ReferredFriend {
  friend: string;
  name: string | null;
  countedAt: number | null;
}

export interface Referrer {
  code: string;
  ticketEarnedAt: number | null;
  goldenEarnedAt: number | null;
}

/** A new code takes another try only when it collides with another inviter's; eight letters make that rare. */
const CODE_ATTEMPTS = 4;

const newReferralCode = () =>
  [...crypto.getRandomValues(new Uint8Array(CODE_LENGTH))]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");

/** Referral links and the friends they brought, in D1 (migrations/0027_campaign_referrals.sql). */
export function createCampaignReferralStore(db: D1Database) {
  const referrer = (campaign: CampaignKey, account: string) =>
    db
      .prepare(
        `SELECT "code", "ticket_earned_at" AS "ticketEarnedAt", "golden_earned_at" AS "goldenEarnedAt"
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
        .bind(campaign, account, newReferralCode())
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

  /** Records the friend for their inviter; a friend already recorded keeps their first inviter. */
  const record = (campaign: CampaignKey, friend: string, inviter: string, now: number) =>
    db
      .prepare(
        `INSERT INTO "campaign_referrals" ("campaign", "friend", "referrer", "created_at") VALUES (?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(campaign, friend, inviter, now)
      .run();

  /** The inviter's friends, oldest first, with their public names. */
  const friendsOf = async (campaign: CampaignKey, inviter: string): Promise<ReferredFriend[]> =>
    (
      await db
        .prepare(
          `SELECT f."friend", f."counted_at" AS "countedAt", u."id", u."name", u."image" FROM "campaign_referrals" f
           JOIN "user" u ON u."realmsId" = f."friend"
           WHERE f."campaign" = ? AND f."referrer" = ? ORDER BY f."created_at", f."friend"`,
        )
        .bind(campaign, inviter)
        .all<{ friend: string; countedAt: number | null; id: string; name: string; image: string | null }>()
    ).results.map((row) => ({ friend: row.friend, name: profileOfIdentityUser(row).name, countedAt: row.countedAt }));

  /** Counts friends for their inviter; a friend once counted stays counted at the moment first seen. */
  const markCounted = async (campaign: CampaignKey, friends: string[], now: number) => {
    if (friends.length === 0) return;
    await db.batch(
      friends.map((friend) =>
        db
          .prepare(
            `UPDATE "campaign_referrals" SET "counted_at" = ? WHERE "campaign" = ? AND "friend" = ? AND "counted_at" IS NULL`,
          )
          .bind(now, campaign, friend),
      ),
    );
  };

  /** Notes the reward the inviter's friends earned; the first moment stays. */
  const markEarned = (campaign: CampaignKey, inviter: string, reward: "ticket" | "golden", now: number) =>
    db
      .prepare(
        `UPDATE "campaign_referrers" SET "${reward}_earned_at" = coalesce("${reward}_earned_at", ?)
         WHERE "campaign" = ? AND "referrer" = ?`,
      )
      .bind(now, campaign, inviter)
      .run();

  return { referrerFor, inviterOf, record, friendsOf, markCounted, markEarned };
}
