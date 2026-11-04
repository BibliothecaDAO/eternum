import type { WalletExecution } from "@realms-world/guardian";
import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import { defaultWalletDeployment, defaultWalletSignature, passkeyPublicKeyX } from "@realms-world/identity/wallet";
import type { AuthContext, BetterAuthPlugin, Session, User } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { shortString } from "starknet";
import { z } from "zod";

import type { IdentityEnv } from "./env";
import type { Sponsor, SponsoredExecution, WalletDeployment } from "./sponsor";
import { changeWallet, linkFirstWallet } from "./wallet-changes";

interface DefaultWalletOptions {
  /** The app's origin: passkeys are made on it, and the wallet's signer names it. */
  origin: string;
  /** The environment chain's id, as a hex felt. */
  chainId: string;
  db: D1Database;
  guardian: Pick<IdentityEnv["GUARDIAN"], "publicKey" | "signWalletExecution">;
  /** Null while the environment has no sponsor key: sending is refused, loudly, and nothing else changes. */
  sponsor: Sponsor | null;
  isDeployed(address: string): Promise<boolean>;
  checkCode(context: AuthContext, email: string, otp: string): Promise<unknown>;
  sendNotice(email: string, address: string | null, id: string): Promise<void>;
}

/** Sponsored calls a default wallet makes a UTC day: each costs about 0.8 STRK (reports/default-wallet-2.md). */
export const SPONSORED_CALLS_PER_DAY = 3;
/** A sign-in this recent vouches for a first payout wallet in place of a new emailed code. */
const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const CreateBody = z
  .object({
    passkey: z
      .object({ credentialId: base64Url.max(1400), publicKey: base64Url.max(200) })
      .strict()
      .optional(),
    otp: z.string().length(SIGN_IN_CODE_LENGTH).regex(/^\d+$/).optional(),
  })
  .strict();
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

/** The default wallet as the client needs it to sign: its address and the passkey that owns it. */
interface DefaultWalletRow {
  address: string;
  credential_id: string;
  public_key_x: string;
  origin: string;
  rp_id: string;
}

const viewOf = (row: DefaultWalletRow) => ({
  address: row.address,
  credentialId: row.credential_id,
  publicKeyX: row.public_key_x,
  origin: row.origin,
  rpId: row.rp_id,
});

/**
 * The default wallet: a Ready 0.5 account owned by a passkey the player makes on this app, with the Realms guardian as
 * its guardian. Making it writes it as the account's payout wallet through the same rows a linked wallet uses. Sending
 * from it goes through the sponsor: the sponsor builds the outside execution, the passkey signs it in the browser, the
 * guardian co-signs it here (never a call to the wallet itself), and the sponsor submits it, within a daily cap.
 */
export const defaultWallet = (options: DefaultWalletOptions) => {
  const { origin, hostname: rpId } = new URL(options.origin);

  const realmsIdOf = (ctx: SignedInContext) => {
    const id = ctx.context.session.user.realmsId;
    if (!id) throw new APIError("INTERNAL_SERVER_ERROR", { message: "account_identity_missing" });
    return id;
  };
  const read = (realmsId: string) =>
    options.db
      .prepare(`SELECT address, credential_id, public_key_x, origin, rp_id FROM default_wallets WHERE realms_id = ?`)
      .bind(realmsId)
      .first<DefaultWalletRow>();
  const requireWallet = async (ctx: SignedInContext) => {
    const row = await read(realmsIdOf(ctx));
    if (!row) throw new APIError("NOT_FOUND", { message: "NO_DEFAULT_WALLET" });
    return row;
  };
  const requireSponsor = () => {
    if (options.sponsor) return options.sponsor;
    console.error("default_wallet_sponsor_unavailable");
    throw new APIError("SERVICE_UNAVAILABLE", { message: "SPONSOR_UNAVAILABLE" });
  };

  /**
   * The account's wallet: the one it made before, or the one this passkey would make, with the row that records it. A
   * row is written only with the payout link (linkAsPayout), so a passkey refused there leaves nothing behind for a
   * later link to pick up.
   */
  const walletFor = async (realmsId: string, passkey: z.infer<typeof CreateBody>["passkey"]) => {
    const existing = await read(realmsId);
    if (existing) return { row: existing, record: [] };
    if (!passkey) throw new APIError("BAD_REQUEST", { message: "PASSKEY_REQUIRED" });
    const owner = { origin, rpId, publicKeyX: publicKeyXOf(passkey.publicKey) };
    const { address } = defaultWalletDeployment(owner, await options.guardian.publicKey(), realmsId);
    const row = { address, credential_id: passkey.credentialId, public_key_x: owner.publicKeyX, origin, rp_id: rpId };
    return { row, record: [recordWallet(realmsId, row)] };
  };
  /** The wallet's row, kept only once the account's payout wallet is this address, in the same transaction. */
  const recordWallet = (realmsId: string, row: DefaultWalletRow) =>
    options.db
      .prepare(
        `INSERT INTO default_wallets (realms_id, address, credential_id, public_key_x, origin, rp_id, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM "user" WHERE "realmsId" = ?1 AND address = ?2)`,
      )
      .bind(realmsId, row.address, row.credential_id, row.public_key_x, row.origin, row.rp_id, Date.now());

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

  /** The deployment the sponsor must make first, while the wallet has never been deployed. */
  const pendingDeployment = async (realmsId: string, row: DefaultWalletRow): Promise<WalletDeployment | null> =>
    (await options.isDeployed(row.address))
      ? null
      : defaultWalletDeployment(
          { origin: row.origin, rpId: row.rp_id, publicKeyX: row.public_key_x },
          await options.guardian.publicKey(),
          realmsId,
        );

  return {
    id: "default-wallet",
    endpoints: {
      readDefaultWallet: createAuthEndpoint(
        "/wallet/default",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const row = await read(realmsIdOf(ctx));
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
          if (ctx.body.calls.some((call) => BigInt(call.contractAddress) === BigInt(row.address)))
            throw new APIError("FORBIDDEN", { message: "WALLET_SELF_CALL" });
          if ((await sponsoredToday(options.db, realmsIdOf(ctx))) >= SPONSORED_CALLS_PER_DAY)
            throw new APIError("TOO_MANY_REQUESTS", { message: "SPONSOR_CAP_REACHED" });
          const deployment = await pendingDeployment(realmsIdOf(ctx), row);
          return ctx.json({ typedData: await sponsor.build(row.address, ctx.body.calls, deployment) });
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
          if (!(await reserveSponsoredCall(options.db, realmsId)))
            throw new APIError("TOO_MANY_REQUESTS", { message: "SPONSOR_CAP_REACHED" });
          try {
            const guardian = await options.guardian.signWalletExecution(options.chainId, row.address, execution);
            const signature = defaultWalletSignature(ctx.body.ownerSignature, {
              publicKey: await options.guardian.publicKey(),
              ...guardian,
            });
            const deployment = await pendingDeployment(realmsId, row);
            return ctx.json({ transactionHash: await sponsor.execute(row.address, typedData, signature, deployment) });
          } catch (error) {
            await releaseSponsoredCall(options.db, realmsId);
            console.error("default_wallet_execute_failed", { error: error instanceof Error ? error.message : error });
            throw new APIError("BAD_GATEWAY", { message: "SPONSOR_REFUSED" });
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

/**
 * The outside execution the sponsor built, read field by field: only a SNIP-9 v2 execution for this chain. The
 * guardian rebuilds its message from these fields, so it co-signs exactly what was read here.
 */
const walletExecutionOf = (typedData: SponsoredExecution, chainId: string): WalletExecution => {
  // A caller's JSON: any field may be missing.
  const { domain, message, primaryType } = typedData as unknown as {
    domain?: Record<string, unknown>;
    message?: Record<string, unknown>;
    primaryType?: string;
  };
  const isExecution =
    primaryType === "OutsideExecution" &&
    domain?.name === "Account.execute_from_outside" &&
    String(domain.version) === "2" &&
    feltOf(domain.chainId) === BigInt(chainId) &&
    Array.isArray(message?.Calls);
  if (!isExecution) throw new APIError("BAD_REQUEST", { message: "NOT_AN_OUTSIDE_EXECUTION" });
  return {
    caller: String(message.Caller),
    nonce: String(message.Nonce),
    executeAfter: String(message["Execute After"]),
    executeBefore: String(message["Execute Before"]),
    calls: (message.Calls as Record<string, unknown>[]).map((call) => ({
      to: String(call.To),
      selector: String(call.Selector),
      calldata: (call.Calldata as unknown[]).map(String),
    })),
  };
};

/** A domain chain id, which SNIP-12 allows as a short string ("SN_MAIN") or its felt. */
const feltOf = (value: unknown): bigint | null => {
  if (typeof value !== "string") return null;
  return BigInt(/^0x[0-9a-fA-F]+$/.test(value) ? value : shortString.encodeShortString(value));
};

const today = () => new Date().toISOString().slice(0, 10);

const sponsoredToday = async (db: D1Database, realmsId: string) =>
  (
    await db
      .prepare(`SELECT calls FROM wallet_sponsored_calls WHERE realms_id = ? AND day = ?`)
      .bind(realmsId, today())
      .first<{ calls: number }>()
  )?.calls ?? 0;

/** Takes one of today's sponsored calls, or none when the cap is spent; atomic, so two tabs cannot both take the last. */
const reserveSponsoredCall = async (db: D1Database, realmsId: string) =>
  (
    await db
      .prepare(
        `INSERT INTO wallet_sponsored_calls (realms_id, day, calls) VALUES (?1, ?2, 1)
         ON CONFLICT (realms_id, day) DO UPDATE SET calls = calls + 1 WHERE calls < ?3`,
      )
      .bind(realmsId, today(), SPONSORED_CALLS_PER_DAY)
      .run()
  ).meta.changes === 1;

/** Gives back a call the sponsor did not submit. */
const releaseSponsoredCall = (db: D1Database, realmsId: string) =>
  db
    .prepare(`UPDATE wallet_sponsored_calls SET calls = calls - 1 WHERE realms_id = ? AND day = ? AND calls > 0`)
    .bind(realmsId, today())
    .run();
