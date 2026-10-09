import type { AuthContext, BetterAuthPlugin, Session, User } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";

import { normalizeStarknetAddress, parseSiwsTypedData, payoutWalletStatement } from "@realms-world/identity";

import { changeWallet } from "./wallet-changes";
import { authorizeSiwsNonce, SiwsVerificationError } from "./siws-verification";
import { WalletNotDeployedError, type VerifyWalletSignature } from "./wallet-signature";

interface SiwsPluginOptions {
  /** The app's origin: a signed message must name its host. */
  origin: string;
  verifySignature: VerifyWalletSignature;
  db: D1Database;
  checkCode(context: AuthContext, email: string, otp: string): Promise<unknown>;
  sendNotice(email: string, address: string | null, id: string): Promise<void>;
}

const SiwsProof = z.object({
  message: z.string(),
  signature: z.string().array(),
  address: z.string(),
});

const NONCE_LIFETIME_MS = 15 * 60 * 1000;

/** An endpoint behind the session middleware: it knows who is signed in. */
type SignedInContext = { context: AuthContext & { session: { session: Session; user: User & { realmsId?: string } } } };

const EmailCode = z.string().regex(/^\d{6}$/);
const realmsIdOf = (ctx: SignedInContext) => {
  const id = ctx.context.session.user.realmsId;
  if (!id) throw new APIError("INTERNAL_SERVER_ERROR", { message: "account_identity_missing" });
  return id;
};

const unauthorized = (reason: string) => new APIError("UNAUTHORIZED", { message: `Unauthorized: ${reason}` });

/**
 * A wallet is linked to a Realms account, never a way to sign in: players sign in with Discord or an emailed code. An
 * account has one wallet at a time and a wallet one account at a time; the unique `address` column is the race-proof
 * truth. Linking a new wallet replaces the account's current one in one update, and unlinking frees it for another
 * account.
 */
export const siws = (options: SiwsPluginOptions) => {
  const expectedHost = new URL(options.origin).host;

  /** The normalized wallet address a proof speaks for; the nonce is consumed only after the signature verifies. */
  const verifyProof = async (ctx: SignedInContext, proof: z.infer<typeof SiwsProof>): Promise<string> => {
    const owner = normalizeStarknetAddress(proof.address);
    const message = parseSiwsTypedData(proof.message);
    if (message.message.statement !== payoutWalletStatement(realmsIdOf(ctx)))
      throw unauthorized("Realms account mismatch");
    const nonce = await ctx.context.internalAdapter.findVerificationValue(`siws_${realmsIdOf(ctx)}_${owner}`);
    if (!nonce || new Date() > nonce.expiresAt) throw unauthorized("Invalid or expired nonce");
    if (nonce.value !== message.message.nonce) throw unauthorized("Nonce mismatch");
    if (normalizeStarknetAddress(message.message.address) !== owner) throw unauthorized("Address mismatch");
    if (message.domain.name !== expectedHost) throw unauthorized(`Domain mismatch (signed=${message.domain.name})`);
    if (message.domain.chainId !== "SN_MAIN") throw unauthorized("Unsupported network");
    try {
      await authorizeSiwsNonce({
        verifySignature: () => options.verifySignature(message, proof.signature, proof.address),
        consumeNonce: async () =>
          (await ctx.context.adapter.deleteMany({
            model: "verification",
            where: [
              { field: "id", value: nonce.id },
              { field: "expiresAt", operator: "gt", value: new Date() },
            ],
          })) === 1,
      });
    } catch (error) {
      if (error instanceof WalletNotDeployedError)
        throw new APIError("BAD_REQUEST", { code: "WALLET_NOT_DEPLOYED", message: "WALLET_NOT_DEPLOYED" });
      if (error instanceof SiwsVerificationError) throw unauthorized(error.message);
      throw unauthorized("Something went wrong. Please try again later.");
    }
    return owner;
  };

  const findUserByWallet = (ctx: { context: AuthContext }, owner: string) =>
    ctx.context.adapter.findOne<{ id: string }>({ model: "user", where: [{ field: "address", value: owner }] });

  return {
    id: "sign-in-with-starknet",
    schema: {
      user: {
        fields: {
          address: { type: "string", unique: true, required: false, input: false },
          walletLinkedAt: { type: "number", required: false, input: false },
        },
      },
    },
    endpoints: {
      nonce: createAuthEndpoint(
        "/siws/nonce",
        { method: "POST", body: z.object({ address: z.string() }), use: [sessionMiddleware] },
        async (ctx) => {
          const nonce = [...crypto.getRandomValues(new Uint8Array(32))]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `siws_${realmsIdOf(ctx)}_${normalizeStarknetAddress(ctx.body.address)}`,
            value: nonce,
            expiresAt: new Date(Date.now() + NONCE_LIFETIME_MS),
          });
          return { nonce, realmsId: realmsIdOf(ctx) };
        },
      ),
      link: createAuthEndpoint(
        "/siws/link",
        { method: "POST", body: SiwsProof.extend({ otp: EmailCode }), use: [sessionMiddleware] },
        async (ctx) => {
          const owner = await verifyProof(ctx, ctx.body);
          // Who holds the wallet is the database's answer, never the session's copy of the account.
          const holder = await findUserByWallet(ctx, owner);
          if (holder && holder.id !== ctx.context.session.user.id)
            throw new APIError("CONFLICT", { message: "WALLET_LINKED_ELSEWHERE" });
          await changeWallet(options, ctx.context, ctx.context.session.user, owner, ctx.body.otp);
          return ctx.json({ address: owner });
        },
      ),
      unlink: createAuthEndpoint(
        "/siws/unlink",
        { method: "POST", body: z.object({ otp: EmailCode }), use: [sessionMiddleware] },
        async (ctx) => {
          await changeWallet(options, ctx.context, ctx.context.session.user, null, ctx.body.otp);
          return ctx.json({ address: null });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
};
