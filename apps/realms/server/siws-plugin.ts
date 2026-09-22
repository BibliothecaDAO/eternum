import type { AuthContext, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { normalizeStarknetAddress, parseSiwsTypedData, type SiwsTypedData } from "@realms-world/identity";

import { authorizeSiwsNonce, SiwsVerificationError } from "./siws-verification";

/** Checks a wallet's signature over the typed message; on mainnet this is the wallet contract's own check. */
export type VerifyWalletSignature = (message: SiwsTypedData, signature: string[], address: string) => Promise<boolean>;

interface SiwsPluginOptions {
  /** The app's origin: a signed message must name its host. */
  origin: string;
  verifySignature: VerifyWalletSignature;
}

const SiwsProof = z.object({
  message: z.string(),
  signature: z.string().array(),
  address: z.string(),
});

const NONCE_LIFETIME_MS = 15 * 60 * 1000;

const unauthorized = (reason: string) => new APIError("UNAUTHORIZED", { message: `Unauthorized: ${reason}` });

/**
 * Sign in with Starknet, and linking a wallet to a Realms account. A wallet belongs to at most one account and an
 * account to at most one wallet; the unique `address` column is the race-proof truth.
 */
export const siws = (options: SiwsPluginOptions) => {
  const expectedHost = new URL(options.origin).host;

  /** The normalized wallet address a proof speaks for; the nonce is consumed only after the signature verifies. */
  const verifyProof = async (ctx: { context: AuthContext }, proof: z.infer<typeof SiwsProof>): Promise<string> => {
    const owner = normalizeStarknetAddress(proof.address);
    const message = parseSiwsTypedData(proof.message);
    const nonce = await ctx.context.internalAdapter.findVerificationValue(`siws_${owner}`);
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
        },
      },
    },
    endpoints: {
      nonce: createAuthEndpoint(
        "/siws/nonce",
        { method: "POST", body: z.object({ address: z.string() }) },
        async (ctx) => {
          const nonce = [...crypto.getRandomValues(new Uint8Array(32))]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `siws_${normalizeStarknetAddress(ctx.body.address)}`,
            value: nonce,
            expiresAt: new Date(Date.now() + NONCE_LIFETIME_MS),
          });
          return { nonce };
        },
      ),
      verify: createAuthEndpoint("/siws/verify", { method: "POST", body: SiwsProof }, async (ctx) => {
        const owner = await verifyProof(ctx, ctx.body);
        const existing = await findUserByWallet(ctx, owner);
        const user =
          (existing && (await ctx.context.internalAdapter.findUserById(existing.id))) ??
          (await ctx.context.internalAdapter.createUser({
            name: owner,
            email: `${owner}@${expectedHost}`,
            emailVerified: false,
            address: owner,
          }));
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ token: session.token });
      }),
      link: createAuthEndpoint(
        "/siws/link",
        { method: "POST", body: SiwsProof, use: [sessionMiddleware] },
        async (ctx) => {
          const owner = await verifyProof(ctx, ctx.body);
          const user = ctx.context.session.user as { id: string; address?: string | null };
          if (user.address === owner) return ctx.json({ address: owner });
          if (user.address) throw new APIError("CONFLICT", { message: "WALLET_ALREADY_LINKED" });
          const holder = await findUserByWallet(ctx, owner);
          if (holder) throw new APIError("CONFLICT", { message: "WALLET_LINKED_ELSEWHERE" });
          try {
            await ctx.context.internalAdapter.updateUser(user.id, { address: owner });
          } catch {
            // A concurrent link of the same wallet lost the race on the unique address column.
            throw new APIError("CONFLICT", { message: "WALLET_LINKED_ELSEWHERE" });
          }
          return ctx.json({ address: owner });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
};
