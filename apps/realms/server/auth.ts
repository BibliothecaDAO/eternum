import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import { RpcProvider, verifyMessageInStarknet } from "starknet";

import type { IdentityEnv } from "./env";
import { nameRuleViolation } from "./name-rules";
import { isNameTaken } from "./names";
import { realmsIdOf } from "./realms-id";
import { siws, type VerifyWalletSignature } from "./siws-plugin";

const PORTRAIT_PATTERN = /^(0[1-9]|1[0-2])$/;

/** Mainnet wallets verify their own signatures; the identity RPC asks the wallet contract. */
const verifyOnMainnet =
  (rpcUrl: string): VerifyWalletSignature =>
  (message, signature, address) =>
    verifyMessageInStarknet(
      new RpcProvider({ nodeUrl: rpcUrl }),
      message as unknown as Parameters<typeof verifyMessageInStarknet>[1],
      signature,
      address,
    );

/**
 * A new user's id is fixed here and never changes: the Realms id derives from it and places the player's account on
 * every shard. A new user starts with its id as its name, which reads as "not chosen" until they pick one.
 */
const assignRealmsIdentity = async (user: Record<string, unknown>) => {
  const id = crypto.randomUUID().replaceAll("-", "");
  return { data: { ...user, id, name: id, realmsId: realmsIdOf(id) } };
};

/** A player's way back in is a passkey: a linked wallet only recovers an account that has none, once. */
export const hasPasskey = async (db: D1Database, userId: string): Promise<boolean> =>
  (await db.prepare('SELECT 1 FROM "passkey" WHERE "userId" = ? LIMIT 1').bind(userId).first()) !== null;

/**
 * The identity service: passkey sign-in, passkey-first sign-up through an anonymous session that the passkey is then
 * added to, so the user and its Realms id stay the same, and wallets linked to an account. Name changes pass one chokepoint: the
 * update hook validates format and pre-checks uniqueness for every writer; the unique index on lower(name) is the
 * race-proof guarantee.
 */
export const createIdentityAuth = (
  env: Pick<IdentityEnv, "DB" | "BASE_URL" | "BETTER_AUTH_SECRET" | "IDENTITY_RPC_URL">,
  verifySignature: VerifyWalletSignature = verifyOnMainnet(env.IDENTITY_RPC_URL),
) =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BASE_URL,
    basePath: "/api/auth",
    database: env.DB,
    session: { cookieCache: { enabled: true, maxAge: 60 * 60 } },
    user: {
      additionalFields: {
        realmsId: { type: "string", unique: true, required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: { before: assignRealmsIdentity },
        update: {
          before: async (data, ctx) => {
            if (typeof data.name === "string") {
              const violation = nameRuleViolation(data.name);
              if (violation) throw new APIError("UNPROCESSABLE_ENTITY", { message: `NAME_INVALID:${violation}` });
              if (await isNameTaken(env.DB, data.name, ctx?.context.session?.user.id)) {
                throw new APIError("UNPROCESSABLE_ENTITY", { message: "NAME_TAKEN" });
              }
            }
            if (typeof data.image === "string" && !PORTRAIT_PATTERN.test(data.image)) {
              throw new APIError("UNPROCESSABLE_ENTITY", { message: "PORTRAIT_INVALID" });
            }
            return { data };
          },
        },
      },
    },
    plugins: [
      siws({ origin: env.BASE_URL, verifySignature, hasPasskey: (userId) => hasPasskey(env.DB, userId) }),
      passkey({ rpID: new URL(env.BASE_URL).hostname, rpName: "Realms", origin: env.BASE_URL }),
      anonymous({ emailDomainName: new URL(env.BASE_URL).hostname, disableDeleteAnonymousUser: true }),
    ],
  });

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;
