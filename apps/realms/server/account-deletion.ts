import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import type { User } from "better-auth";
import { APIError } from "better-auth/api";

import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { spendSignInCode } from "./wallet-changes";

/**
 * DELETE /api/account `{ otp }`: deletes the signed-in Realms account, once an emailed sign-in code (the one a wallet
 * change takes) confirms it. The code is spent first; then one transaction removes or keeps every row the account owns
 * and records the deletion (`account_deletions`). A deleted account has no session, no email, no name and no way in:
 * signing in with the same email later makes a new account with a new Realms id.
 *
 * Chat lives outside that transaction, in the account's inbox, so its end is a second step that can always finish:
 * the inbox is marked deleted and emptied and closes the account's sockets, in the inbox and in every room it joined
 * (chat-inbox.ts `forgetOwner`). The request runs it at once; if it fails or the Worker stops first, the minute cron
 * finishes it from the recorded deletion (`finishAccountDeletions`). Until then the account has no session, so it opens
 * no new socket.
 *
 * The `user` row stays as an anonymous tombstone holding only its id, Realms id and creation time, because rows that
 * must stay reference its Realms id (and `campaign_tickets` would cascade away with it).
 *
 * | Store                                                              | Decision                                       |
 * | ------------------------------------------------------------------ | ---------------------------------------------- |
 * | `user`                                                             | anonymised: email, name, portrait, suggested   |
 * |                                                                    | name, payout wallet and visit cleared; email   |
 * |                                                                    | unverified; news emails stopped                |
 * | `session`, `account` (sign-in providers), `verification` (codes)   | deleted                                        |
 * | `notification_preferences`, `notification_push_subscriptions`      | deleted                                        |
 * | `realms_accounts`, `device_sessions`, `revoked_devices`,           | deleted: no device can be approved again       |
 * | `account_browsers`                                                 |                                                |
 * | `build_order_books`, `news_email_sends`, `interface_openings`      | deleted                                        |
 * | `campaign_referrers`, `campaign_referrals` (as friend or referrer) | deleted; an inviter keeps what it earned       |
 * | `default_wallets`, `wallet_recoveries`, `sponsored_executions`     | deleted: the wallet stays on chain, owned by   |
 * |                                                                    | the player's passkey; email recovery ends      |
 * | `wallet_change_notices`                                            | deleted                                        |
 * | `ChatInbox` (direct messages, block list, rooms joined)            | emptied, and closed to new messages for good   |
 * | chat sockets (the inbox's and each room's)                         | closed                                         |
 * | `account_deletions`                                                | written: the Realms id, when, and when chat    |
 * |                                                                    | was closed                                     |
 * | `campaign_tickets`                                                 | kept: a spent flyer code stays spent, and the  |
 * |                                                                    | home it gave its source to is on chain         |
 * | `wallet_link_history`                                              | kept, its open link closed now: it says which  |
 * |                                                                    | account a wallet paid for in a past game       |
 * | `pay_decisions`                                                    | kept: the ledger's record of signed payouts    |
 * | `social_handoffs`                                                  | kept until they expire (minutes); they hold    |
 * |                                                                    | session cookies this deletion already ended    |
 * | `ChatRoom` messages, peers' `ChatInbox` copies                     | kept until 30 days old (chat/retention.ts)     |
 * | On chain: gameplay accounts, ratings by wallet, the default wallet | kept: Realms cannot delete or move them        |
 */
export const handleAccountDeletion = async (
  request: Request,
  auth: IdentityAuth,
  env: Pick<IdentityEnv, "DB" | "CHAT_INBOX">,
): Promise<Response> => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
  const otp = await readCode(request);
  if (!otp) return json({ error: "invalid_code" }, 400);
  const refusal = await spendCode(auth, env.DB, session.user, otp);
  if (refusal) return refusal;
  await env.DB.batch(accountDeletion(env.DB, session.user, session.user.realmsId, Date.now()));
  await closeChat(env, session.user.realmsId);
  return json({ deleted: true });
};

/** The cron's step: closes chat for every deletion whose request stopped before it did (safe to run again). */
export const finishAccountDeletions = async (env: Pick<IdentityEnv, "DB" | "CHAT_INBOX">): Promise<void> => {
  const { results } = await env.DB.prepare(
    `SELECT "realms_id" FROM "account_deletions" WHERE "chat_closed_at" IS NULL LIMIT 50`,
  ).all<{ realms_id: string }>();
  for (const { realms_id } of results) await closeChat(env, realms_id);
};

/** The deleted account's chat ends (its inbox's `forgetOwner`), then the deletion records it; a failure waits for the cron. */
const closeChat = async (env: Pick<IdentityEnv, "DB" | "CHAT_INBOX">, realmsId: string) => {
  try {
    await env.CHAT_INBOX.get(env.CHAT_INBOX.idFromName(realmsId)).forgetOwner(realmsId);
    await env.DB.prepare(`UPDATE "account_deletions" SET "chat_closed_at" = ? WHERE "realms_id" = ?`)
      .bind(Date.now(), realmsId)
      .run();
  } catch (error) {
    console.error("account_deletion_chat_unfinished", realmsId, error);
  }
};

const CODE = new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`);

const readCode = async (request: Request): Promise<string | null> => {
  try {
    const { otp } = JSON.parse(await readBody(request, 256)) as { otp?: unknown };
    return typeof otp === "string" && CODE.test(otp) ? otp : null;
  } catch {
    return null;
  }
};

/** Spends the account's emailed code; a wrong, expired or spent code answers as the auth service answers it. */
const spendCode = async (auth: IdentityAuth, db: D1Database, user: User, otp: string): Promise<Response | null> => {
  const checkCode = (_context: unknown, email: string, code: string) =>
    auth.api.checkVerificationOTP({ body: { email, otp: code, type: "sign-in" } });
  try {
    await spendSignInCode({ db, checkCode }, await auth.$context, user, otp);
    return null;
  } catch (error) {
    if (error instanceof APIError) return json(error.body ?? {}, error.statusCode);
    throw error;
  }
};

/** Every store the account reaches by its Realms id that goes with it (the table above). */
const DELETED_BY_REALMS_ID = [
  ["notification_preferences", "owner"],
  ["notification_push_subscriptions", "owner"],
  ["realms_accounts", "realmsId"],
  ["device_sessions", "realmsId"],
  ["revoked_devices", "realmsId"],
  ["account_browsers", "realmsId"],
  ["build_order_books", "owner"],
  ["interface_openings", "owner"],
  ["news_email_sends", "realmsId"],
  ["campaign_referrers", "referrer"],
  ["campaign_referrals", "friend"],
  ["campaign_referrals", "referrer"],
  ["default_wallets", "realms_id"],
  ["wallet_recoveries", "realms_id"],
  ["sponsored_executions", "realms_id"],
] as const;

/**
 * One transaction: the account's rows removed, its wallet link closed, its `user` row left anonymous, and the deletion
 * recorded with its chat still to close.
 */
const accountDeletion = (db: D1Database, user: User, realmsId: string, now: number): D1PreparedStatement[] => [
  ...DELETED_BY_REALMS_ID.map(([table, column]) =>
    db.prepare(`DELETE FROM "${table}" WHERE "${column}" = ?`).bind(realmsId),
  ),
  db.prepare(`DELETE FROM "session" WHERE "userId" = ?`).bind(user.id),
  db.prepare(`DELETE FROM "account" WHERE "userId" = ?`).bind(user.id),
  db.prepare(`DELETE FROM "verification" WHERE "identifier" = ?`).bind(`sign-in-otp-${user.email.toLowerCase()}`),
  db.prepare(`DELETE FROM "wallet_change_notices" WHERE "email" = ?`).bind(user.email),
  db
    .prepare(`UPDATE "wallet_link_history" SET "replaced_at" = ? WHERE "account" = ? AND "replaced_at" IS NULL`)
    .bind(now, realmsId),
  anonymiseUser(db, user.id, now),
  db.prepare(`INSERT INTO "account_deletions" ("realms_id", "deleted_at") VALUES (?, ?)`).bind(realmsId, now),
];

/**
 * The tombstone: its email becomes `deleted:<id>`, which no email sign-in accepts and no mail reaches, and its name its
 * id, which reads as no name chosen.
 */
const anonymiseUser = (db: D1Database, userId: string, now: number) =>
  db
    .prepare(
      `UPDATE "user" SET "email" = 'deleted:' || "id", "emailVerified" = 0, "name" = "id", "image" = NULL,
       "suggestedName" = NULL, "address" = NULL, "walletLinkedAt" = NULL, "lastSeenAt" = NULL,
       "newsEmailOptOutAt" = ?1, "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "id" = ?2`,
    )
    .bind(now, userId);
