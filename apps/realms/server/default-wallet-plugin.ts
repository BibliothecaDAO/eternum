import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import { Effect } from "effect";
import {
  defaultWalletDeployment,
  defaultWalletSignature,
  passkeyPublicKeyX,
  WALLET_RECOVERY,
} from "@realms-world/identity/wallet";
import type { AuthContext, BetterAuthPlugin, Session, User } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { hash } from "starknet";
import { z } from "zod";

import { readDefaultWallet, walletDeploymentOf } from "./default-wallets";
import type { DefaultWalletRow } from "./default-wallets";
import type { IdentityEnv } from "./env";
import { SponsorRefusedError, walletExecutionOf } from "./sponsor";
import type { Sponsor, SponsoredExecution } from "./sponsor";
import { changeWallet, deliverWalletNotices, linkFirstWallet, spendSignInCode } from "./wallet-changes";
import type { SendWalletNotice } from "./wallet-changes";
import { RecoveryNotSentError, RecoveryUnderWayError, startRecovery } from "./wallet-recovery";
import type { WalletEscape } from "@realms-world/identity/wallet";

interface DefaultWalletOptions {
  /** The app's origin: passkeys are made on it, and the wallet's signer names it. */
  origin: string;
  /** The environment chain's id, as a hex felt. */
  chainId: string;
  db: D1Database;
  guardian: Pick<IdentityEnv["GUARDIAN"], "publicKey" | "signWalletExecution">;
  /** Null while the environment has no sponsor key: sending and recovery are refused, loudly; receiving still works. */
  sponsor: Sponsor | null;
  isDeployed(address: string): Promise<boolean>;
  readEscape(address: string): Promise<WalletEscape>;
  checkCode(context: AuthContext, email: string, otp: string): Promise<unknown>;
  sendNotice: SendWalletNotice;
}

/** Sponsored calls a default wallet makes a UTC day: each costs about 0.8 STRK (reports/default-wallet-2.md). */
export const SPONSORED_CALLS_PER_DAY = 3;
/** A sign-in this recent vouches for a first payout wallet in place of a new emailed code. */
const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const Passkey = z.object({ credentialId: base64Url.max(1400), publicKey: base64Url.max(200) }).strict();
const EmailCode = z.string().length(SIGN_IN_CODE_LENGTH).regex(/^\d+$/);
const CreateBody = z.object({ passkey: Passkey.optional(), otp: EmailCode.optional() }).strict();
const RecoveryBody = z.object({ passkey: Passkey, otp: EmailCode }).strict();
const Felt = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/);
const BuildBody = z
  .object({
    calls: z
      .object({ contractAddress: Felt, entrypoint: z.string().min(1).max(64), calldata: Felt.array().max(64) })
      .strict()
      .array()
      .min(1)
      .max(5),
  })
  .strict();
const ExecuteBody = z
  .object({ typedData: z.record(z.string(), z.unknown()), ownerSignature: Felt.array().max(400) })
  .strict();

interface SignedInContext {
  context: AuthContext & { session: { session: Session; user: User & { realmsId?: string } } };
}

/** The default wallet as the client needs it to sign: its address and the passkey that owns it now. */
const viewOf = (row: DefaultWalletRow) => ({
  address: row.address,
  credentialId: row.credential_id,
  publicKeyX: row.public_key_x,
  origin: row.origin,
  rpId: row.rp_id,
});

const CANCEL_SELECTOR = BigInt(hash.getSelectorFromName(WALLET_RECOVERY.cancel));

/**
 * The default wallet: a Ready 0.5 account owned by a passkey the player makes on this app, with the Realms guardian as
 * its guardian. Making it writes it as the account's payout wallet through the same rows a linked wallet uses. Sending
 * from it goes through the sponsor: the sponsor builds the outside execution, the passkey signs it in the browser, the
 * guardian co-signs it here, and the sponsor submits it, within a daily cap. A call to the wallet itself is refused,
 * but for a recovery's cancel, which the owner's passkey signs; a lost passkey's recovery starts here with the emailed
 * code (wallet-recovery.ts).
 */
export const defaultWallet = (options: DefaultWalletOptions) => {
  const { origin, hostname: rpId } = new URL(options.origin);

  const realmsIdOf = (ctx: SignedInContext) => {
    const id = ctx.context.session.user.realmsId;
    if (!id) throw new APIError("INTERNAL_SERVER_ERROR", { message: "account_identity_missing" });
    return id;
  };
  const requireWallet = async (ctx: SignedInContext) => {
    const row = await readDefaultWallet(options.db, realmsIdOf(ctx));
    if (!row) throw new APIError("NOT_FOUND", { message: "NO_DEFAULT_WALLET" });
    return row;
  };
  const requireSponsor = () => {
    if (options.sponsor) return options.sponsor;
    console.error("default_wallet_sponsor_unavailable");
    throw new APIError("SERVICE_UNAVAILABLE", { message: "SPONSOR_UNAVAILABLE" });
  };
  const pendingDeployment = async (row: DefaultWalletRow) =>
    (await options.isDeployed(row.address)) ? null : walletDeploymentOf(row, await options.guardian.publicKey());

  /**
   * The account's wallet: the one it made before, or the one this passkey would make, with the row that records it. A
   * row is written only with the payout link (linkAsPayout), so a passkey refused there leaves nothing behind for a
   * later link to pick up.
   */
  const walletFor = async (realmsId: string, passkey: z.infer<typeof Passkey> | undefined) => {
    const existing = await readDefaultWallet(options.db, realmsId);
    if (existing) return { row: existing, record: [] };
    if (!passkey) throw new APIError("BAD_REQUEST", { message: "PASSKEY_REQUIRED" });
    const owner = { origin, rpId, publicKeyX: publicKeyXOf(passkey.publicKey) };
    const { address } = defaultWalletDeployment(owner, await options.guardian.publicKey(), realmsId);
    const row: DefaultWalletRow = {
      realms_id: realmsId,
      address,
      deploy_key_x: owner.publicKeyX,
      credential_id: passkey.credentialId,
      public_key_x: owner.publicKeyX,
      origin,
      rp_id: rpId,
    };
    return { row, record: [recordWallet(row)] };
  };
  /** The wallet's row, kept only once the account's payout wallet is this address, in the same transaction. */
  const recordWallet = (row: DefaultWalletRow) =>
    options.db
      .prepare(
        `INSERT INTO default_wallets (realms_id, address, deploy_key_x, credential_id, public_key_x, origin, rp_id, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM "user" WHERE "realmsId" = ?1 AND address = ?2)`,
      )
      .bind(
        row.realms_id,
        row.address,
        row.deploy_key_x,
        row.credential_id,
        row.public_key_x,
        row.origin,
        row.rp_id,
        Date.now(),
      );

  /**
   * The wallet as the account's payout wallet, its row with it: a first wallet on a fresh sign-in, else with an emailed
   * code, as any other wallet change takes (wallet-changes.ts).
   */
  const linkAsPayout = async (
    ctx: SignedInContext,
    address: string,
    otp: string | undefined,
    record: D1PreparedStatement[],
  ) => {
    const { user, session } = ctx.context.session;
    if ((user as { address?: string | null }).address === address) return;
    if (otp) return changeWallet(options, ctx.context, user, address, otp, record);
    if (Date.now() - new Date(session.createdAt).getTime() > FRESH_SIGN_IN_MS)
      throw new APIError("FORBIDDEN", { message: "CODE_REQUIRED" });
    await linkFirstWallet(options, user, address, record);
  };

  /** A call to the wallet itself is refused, but a recovery's cancel alone, which the owner's passkey signs. */
  const refuseSelfCalls = (row: DefaultWalletRow, calls: { to: string; selector: string }[]) => {
    const selfCalls = calls.filter((call) => BigInt(call.to) === BigInt(row.address));
    const [only] = calls;
    const isCancel = calls.length === 1 && selfCalls.length === 1 && BigInt(only?.selector ?? 0) === CANCEL_SELECTOR;
    if (selfCalls.length > 0 && !isCancel) throw new APIError("FORBIDDEN", { message: "WALLET_SELF_CALL" });
  };

  /** The account's signature: the owner's passkey, then the guardian's co-signature over the same execution. */
  const cosigned = async (
    row: DefaultWalletRow,
    execution: NonNullable<ReturnType<typeof walletExecutionOf>>,
    ownerSignature: string[],
  ) =>
    defaultWalletSignature(ownerSignature, {
      publicKey: await options.guardian.publicKey(),
      ...(await options.guardian.signWalletExecution(options.chainId, row.address, execution)),
    });

  return {
    id: "default-wallet",
    endpoints: {
      readDefaultWallet: createAuthEndpoint(
        "/wallet/default",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const row = await readDefaultWallet(options.db, realmsIdOf(ctx));
          return ctx.json({ wallet: row ? viewOf(row) : null });
        },
      ),
      createDefaultWallet: createAuthEndpoint(
        "/wallet/default",
        { method: "POST", body: CreateBody, use: [sessionMiddleware] },
        async (ctx) => {
          const { row, record } = await walletFor(realmsIdOf(ctx), ctx.body.passkey);
          await linkAsPayout(ctx, row.address, ctx.body.otp, record);
          return ctx.json({ wallet: viewOf(row) });
        },
      ),
      buildDefaultWalletCall: createAuthEndpoint(
        "/wallet/default/build",
        { method: "POST", body: BuildBody, use: [sessionMiddleware] },
        async (ctx) => {
          const row = await requireWallet(ctx);
          const sponsor = requireSponsor();
          refuseSelfCalls(
            row,
            ctx.body.calls.map((call) => ({
              to: call.contractAddress,
              selector: hash.getSelectorFromName(call.entrypoint),
            })),
          );
          if ((await sponsoredToday(options.db, realmsIdOf(ctx))) >= SPONSORED_CALLS_PER_DAY)
            throw new APIError("TOO_MANY_REQUESTS", { message: "SPONSOR_CAP_REACHED" });
          return ctx.json({
            typedData: await sponsor.build(row.address, ctx.body.calls, await pendingDeployment(row)),
          });
        },
      ),
      executeDefaultWalletCall: createAuthEndpoint(
        "/wallet/default/execute",
        { method: "POST", body: ExecuteBody, use: [sessionMiddleware] },
        async (ctx) => {
          const realmsId = realmsIdOf(ctx);
          const row = await requireWallet(ctx);
          const sponsor = requireSponsor();
          const typedData = ctx.body.typedData as unknown as SponsoredExecution;
          const execution = walletExecutionOf(typedData, options.chainId);
          if (!execution) throw new APIError("BAD_REQUEST", { message: "NOT_AN_OUTSIDE_EXECUTION" });
          refuseSelfCalls(row, execution.calls);
          if (!(await reserveExecution(options.db, realmsId, execution.nonce)))
            throw new APIError("TOO_MANY_REQUESTS", { message: "SPONSOR_CAP_REACHED" });
          const signature = await cosigned(row, execution, ctx.body.ownerSignature).catch(async (error: unknown) => {
            await releaseExecution(options.db, realmsId, execution.nonce);
            throw refused("default_wallet_cosign_failed", error);
          });
          try {
            return ctx.json({
              transactionHash: await sponsor.execute(row.address, typedData, signature, await pendingDeployment(row)),
            });
          } catch (error) {
            if (!(error instanceof SponsorRefusedError)) throw uncertain(error);
            await releaseExecution(options.db, realmsId, execution.nonce);
            throw refused("default_wallet_execute_refused", error);
          }
        },
      ),
      startWalletRecovery: createAuthEndpoint(
        "/wallet/default/recovery",
        { method: "POST", body: RecoveryBody, use: [sessionMiddleware] },
        async (ctx) => {
          const row = await requireWallet(ctx);
          const sponsor = requireSponsor();
          const passkey = {
            credentialId: ctx.body.passkey.credentialId,
            publicKeyX: publicKeyXOf(ctx.body.passkey.publicKey),
          };
          const { user } = ctx.context.session;
          const spendCode = () => spendSignInCode(options, ctx.context, user, ctx.body.otp);
          try {
            const transactionHash = await startRecovery({ ...options, sponsor }, row, passkey, user.email, spendCode);
            await Effect.runPromise(deliverWalletNotices(options.db, options.sendNotice));
            return ctx.json({ transactionHash });
          } catch (error) {
            if (error instanceof RecoveryUnderWayError)
              throw new APIError("CONFLICT", { message: "RECOVERY_UNDER_WAY" });
            if (error instanceof APIError) throw error;
            if (error instanceof RecoveryNotSentError) throw refused("wallet_recovery_start_refused", error);
            throw uncertain(error);
          }
        },
      ),
    },
  } satisfies BetterAuthPlugin;
};

const publicKeyXOf = (spki: string): string => {
  try {
    return passkeyPublicKeyX(
      Uint8Array.from(atob(spki.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)),
    );
  } catch {
    throw new APIError("BAD_REQUEST", { message: "PASSKEY_INVALID" });
  }
};

/** Proven never sent: nothing reached the chain, and the day's call was given back. */
const refused = (event: string, error: unknown) => {
  console.error(event, { error: error instanceof Error ? error.message : error });
  return new APIError("BAD_GATEWAY", { message: "SPONSOR_REFUSED" });
};

/**
 * Perhaps sent: the sponsor's answer was lost. The day's call stays spent, and the caller keeps the same signed
 * execution: resubmitted, its nonce lets it run at most once, and the wallet's `is_valid_outside_execution_nonce` tells
 * whether it ran.
 */
const uncertain = (error: unknown) => {
  console.error("default_wallet_execute_uncertain", { error: error instanceof Error ? error.message : error });
  return new APIError("SERVICE_UNAVAILABLE", { message: "SEND_UNCERTAIN" });
};

const today = () => new Date().toISOString().slice(0, 10);

const sponsoredToday = async (db: D1Database, realmsId: string) =>
  (
    await db
      .prepare(`SELECT COUNT(*) AS calls FROM sponsored_executions WHERE realms_id = ? AND day = ?`)
      .bind(realmsId, today())
      .first<{ calls: number }>()
  )?.calls ?? 0;

/**
 * Takes one of today's sponsored calls for this execution, or answers it already holds one (a resubmission of the same
 * nonce); none when the cap is spent. One batch, so two tabs cannot both take the last.
 */
const reserveExecution = async (db: D1Database, realmsId: string, nonce: string) => {
  const [, held] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO sponsored_executions (realms_id, nonce, day)
         SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM sponsored_executions WHERE realms_id = ?1 AND day = ?3) < ?4`,
      )
      .bind(realmsId, nonce, today(), SPONSORED_CALLS_PER_DAY),
    db.prepare(`SELECT 1 AS held FROM sponsored_executions WHERE realms_id = ? AND nonce = ?`).bind(realmsId, nonce),
  ]);
  return held?.results.length === 1;
};

/** Gives back the call of an execution proven never sent. */
const releaseExecution = (db: D1Database, realmsId: string, nonce: string) =>
  db.prepare(`DELETE FROM sponsored_executions WHERE realms_id = ? AND nonce = ?`).bind(realmsId, nonce).run();
