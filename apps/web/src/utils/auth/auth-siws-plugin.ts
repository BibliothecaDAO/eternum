import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { and, eq, gt, verification as verificationTable } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { resolveEndpoint } from "@realms-world/chain";
import { SiwsTypedData } from "@realms-world/siws";
import { RpcProvider, verifyMessageInStarknet } from "starknet";

import { authorizeSiwsNonce, SiwsVerificationError } from "./siws-verification";

export interface SIWSPluginOptions {
  domain: string;
  // Optional configuration
  chainId?: 1 | 11155111 | undefined;
  version?: string;
  resources?: string[];
}

function normalizeDomain(value?: string | null) {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function getHostname(value?: string | null) {
  const normalized = normalizeDomain(value);
  if (!normalized) return undefined;

  // Handle IPv6 host:port form like [::1]:3000.
  if (normalized.startsWith("[") && normalized.includes("]")) {
    const end = normalized.indexOf("]");
    return normalized.slice(1, end);
  }

  const [host] = normalized.split(":");
  return host;
}

function isEquivalentHost(a?: string, b?: string) {
  if (!a || !b) return false;
  const loopbacks = new Set(["localhost", "127.0.0.1", "::1"]);
  if (a === b) return true;
  return loopbacks.has(a) && loopbacks.has(b);
}

const resolveIdentityRpcUrl = () =>
  resolveEndpoint(process.env.IDENTITY_RPC_URL, {
    name: "IDENTITY_RPC_URL",
    browserFacing: false,
  });

export const consumeSiwsNonce = async (id: string): Promise<boolean> => {
  const consumed = await db
    .delete(verificationTable)
    .where(and(eq(verificationTable.id, id), gt(verificationTable.expiresAt, new Date())))
    .returning({ id: verificationTable.id });
  return consumed.length === 1;
};

export const siws = (options: SIWSPluginOptions) =>
  ({
    id: "sign-in-with-starknet",
    schema: {
      user: {
        fields: {
          address: {
            type: "string",
            unique: true,
          },
        },
      },
    },
    endpoints: {
      // Generate nonce endpoint
      nonce: createAuthEndpoint(
        "/siws/nonce",
        {
          method: "POST",
          body: z.object({
            address: z.string(),
          }),
        },
        async (ctx) => {
          const nonce = randomBytes(32).toString("hex");
          // Store nonce with 15-minute expiration
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `siws_${ctx.body.address.toLowerCase()}`,
            value: nonce,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          });

          return { nonce };
        },
      ),
      // Verify siws payload
      verify: createAuthEndpoint(
        "/siws/verify",
        {
          method: "POST",
          body: z.object({
            message: z.string(),
            signature: z.string().array(),
            address: z.string(),
          }),
        },
        async (ctx) => {
          const { message, signature, address } = ctx.body;

          const siwsMessage = SiwsTypedData.fromJson(message);
          try {
            // Find stored nonce to check it's validity
            const verification = await ctx.context.internalAdapter.findVerificationValue(
              `siws_${address.toLowerCase()}`,
            );
            // Ensure nonce is valid and not expired
            if (!verification || new Date() > verification.expiresAt) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Invalid or expired nonce",
              });
            }

            if (verification.value !== siwsMessage.message.nonce) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Nonce mismatch",
              });
            }

            if (siwsMessage.message.address.toLowerCase() !== address.toLowerCase()) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Address mismatch",
              });
            }

            const requestHost = getHostname(ctx.request?.headers.get("host")) ?? "localhost";
            const configuredHost = getHostname(options.domain);
            const signedHost = getHostname(siwsMessage.domain.name);
            const matchesRequestHost = isEquivalentHost(signedHost, requestHost);
            const matchesConfiguredHost = isEquivalentHost(signedHost, configuredHost);

            const domainMismatch = !signedHost || (!matchesRequestHost && !matchesConfiguredHost);
            const isProduction = process.env.NODE_ENV === "production";
            if (domainMismatch && isProduction) {
              throw new APIError("UNAUTHORIZED", {
                message: `Unauthorized: Domain mismatch (signed=${signedHost ?? "n/a"}, request=${requestHost}, configured=${configuredHost ?? "n/a"})`,
              });
            }

            if (siwsMessage.domain.chainId !== "SN_MAIN") {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Unsupported network",
              });
            }

            const provider = new RpcProvider({
              nodeUrl: resolveIdentityRpcUrl(),
            });
            await authorizeSiwsNonce({
              verifySignature: () =>
                verifyMessageInStarknet(
                  provider,
                  siwsMessage as unknown as Parameters<typeof verifyMessageInStarknet>[1],
                  signature,
                  address,
                ),
              consumeNonce: () => consumeSiwsNonce(verification.id),
            });

            let user = await ctx.context.internalAdapter.findUserById(address);

            if (!user) {
              const tempEmail = `${address}@${getHostname(options.domain) ?? "realms.world"}`;

              user = await ctx.context.internalAdapter.createUser({
                name: ctx.body.address,
                email: tempEmail,
                id: ctx.body.address,
              });
            }

            const session = await ctx.context.internalAdapter.createSession(user.id);

            if (!session.id) {
              return ctx.json(null, {
                status: 500,
                body: {
                  message: "Internal Server Error",
                  status: "500",
                },
              });
            }

            await setSessionCookie(ctx, { session, user });

            return ctx.json({ token: session.token });
          } catch (error: unknown) {
            if (error instanceof APIError) throw error;
            if (error instanceof SiwsVerificationError) {
              throw new APIError("UNAUTHORIZED", { message: `Unauthorized: ${error.message}` });
            }
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new APIError("UNAUTHORIZED", {
              message: "Something went wrong. Please try again later.",
              error: message,
            });
          }
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
