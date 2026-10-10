import type { AuthContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import { Effect } from "effect";

interface WalletChangeServices {
  db: D1Database;
  checkCode(context: AuthContext, email: string, otp: string): Promise<unknown>;
  sendNotice(email: string, address: string | null, id: string): Promise<void>;
}

/** Consume the wallet-change code in the same transaction that changes the wallet and queues its notice. */
export const changeWallet = (
  services: WalletChangeServices,
  context: AuthContext,
  user: User,
  address: string | null,
  otp: string,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (!user.emailVerified) return yield* Effect.fail(new APIError("FORBIDDEN", { message: "email_not_verified" }));
      const verification = yield* Effect.promise(() =>
        context.internalAdapter.findVerificationValue(`sign-in-otp-${user.email.toLowerCase()}`),
      );
      if (!verification) return yield* Effect.fail(new APIError("BAD_REQUEST", { message: "INVALID_OTP" }));
      yield* Effect.tryPromise({ try: () => services.checkCode(context, user.email, otp), catch: (error) => error });
      const id = crypto.randomUUID();
      const result = yield* Effect.tryPromise({
        try: () => writeWalletChange(services.db, user, address, verification, id),
        catch: () => new APIError("CONFLICT", { message: "WALLET_LINKED_ELSEWHERE" }),
      });
      if (result[0]!.meta.changes !== 1)
        return yield* Effect.fail(new APIError("BAD_REQUEST", { message: "INVALID_OTP" }));
      // Delivery may retry, using the notice id as the provider's idempotency key.
      yield* deliverWalletNotices(services.db, services.sendNotice);
    }),
  );

const writeWalletChange = (
  db: D1Database,
  user: User,
  address: string | null,
  verification: { id: string; value: string },
  id: string,
) =>
  db.batch([
    db
      .prepare(
        `UPDATE "user" SET "walletLinkedAt" = CASE WHEN ?1 IS NULL THEN NULL WHEN "address" = ?1 THEN "walletLinkedAt" ELSE CAST(unixepoch('subsec') * 1000 AS INTEGER) END, "address" = ?1, "updatedAt" = ?2 WHERE "id" = ?3 AND EXISTS (
      SELECT 1 FROM verification WHERE id = ?4 AND value = ?5 AND julianday(expiresAt) > julianday('now'))`,
      )
      .bind(address, new Date().toISOString(), user.id, verification.id, verification.value),
    db
      .prepare(`INSERT INTO wallet_change_notices (id, email, address) SELECT ?, ?, ? WHERE changes() = 1`)
      .bind(id, user.email, address),
    db
      .prepare(
        `UPDATE wallet_link_history SET replaced_at = (SELECT COALESCE("walletLinkedAt",CAST(unixepoch("updatedAt",'subsec')*1000 AS INTEGER)) FROM "user" WHERE id=?1)
      WHERE account=(SELECT "realmsId" FROM "user" WHERE id=?1) AND replaced_at IS NULL
      AND wallet IS NOT (SELECT address FROM "user" WHERE id=?1) AND EXISTS(SELECT 1 FROM wallet_change_notices WHERE id=?2)`,
      )
      .bind(user.id, id),
    db
      .prepare(
        `INSERT INTO wallet_link_history(account,wallet,linked_at,ready_at)
      SELECT "realmsId",address,"walletLinkedAt","walletLinkedAt"+86400000 FROM "user" WHERE id=?1 AND address IS NOT NULL
      AND EXISTS(SELECT 1 FROM wallet_change_notices WHERE id=?2)
      AND NOT EXISTS(SELECT 1 FROM wallet_link_history WHERE account="user"."realmsId" AND replaced_at IS NULL)`,
      )
      .bind(user.id, id),
    db.prepare("DELETE FROM verification WHERE id = ? AND value = ?").bind(verification.id, verification.value),
  ]);

/** Pending security notices survive a failed provider request or a Worker restart. */
export const deliverWalletNotices = (db: D1Database, send: WalletChangeServices["sendNotice"]) =>
  Effect.gen(function* () {
    const { results } = yield* Effect.promise(() =>
      db
        .prepare("SELECT id, email, address FROM wallet_change_notices ORDER BY rowid LIMIT 50")
        .all<{ id: string; email: string; address: string | null }>(),
    );
    for (const notice of results) {
      yield* Effect.tryPromise({
        try: () => send(notice.email, notice.address, notice.id),
        catch: () => new Error("wallet_notice_delivery_failed"),
      }).pipe(
        Effect.flatMap(() =>
          Effect.promise(() => db.prepare("DELETE FROM wallet_change_notices WHERE id = ?").bind(notice.id).run()),
        ),
        Effect.catch(() => Effect.logError("wallet_notice_delivery_failed", { noticeId: notice.id })),
      );
    }
  });
