import type { BetterAuthPlugin } from "better-auth";
//import { createConfig, getEnsAvatar, getEnsName, http } from "@wagmi/core";
//import { mainnet, sepolia } from "@wagmi/core/chains";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
// Zod
import { z } from "zod";

import { eq, user as userTable } from "@realms-world/db";
import { db } from "@realms-world/db/client";
// SIWE deps
import { SiwsTypedData } from "@realms-world/siws";
import { RpcProvider, verifyMessageInStarknet } from "starknet";

const size = 256;
let index = size;
let buffer: string;

export function uid(length = 11) {
  if (!buffer || index + length > size * 2) {
    buffer = "";
    index = 0;
    for (let i = 0; i < size; i++) {
      buffer += ((256 + Math.random() * 256) | 0).toString(16).substring(1);
    }
  }
  return buffer.substring(index, index++ + length);
}

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

function getRpcNodeUrl(chainId: "SN_MAIN" | "SN_SEPOLIA") {
  if (chainId === "SN_MAIN") {
    return "https://api.cartridge.gg/x/starknet/mainnet";
  }
  return "https://api.cartridge.gg/x/starknet/sepolia";
}

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
          const nonce = uid(64);
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
            const verification =
              await ctx.context.internalAdapter.findVerificationValue(
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

            if (
              siwsMessage.message.address.toLowerCase() !== address.toLowerCase()
            ) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Address mismatch",
              });
            }

            const requestHost = getHostname(ctx.request?.headers.get("host")) ?? "localhost";
            const configuredHost = getHostname(options.domain);
            const signedHost = getHostname(siwsMessage.domain.name);
            const matchesRequestHost = isEquivalentHost(signedHost, requestHost);
            const matchesConfiguredHost = isEquivalentHost(
              signedHost,
              configuredHost,
            );

            const domainMismatch =
              !signedHost || (!matchesRequestHost && !matchesConfiguredHost);
            const isProduction = process.env.NODE_ENV === "production";
            if (domainMismatch && isProduction) {
              throw new APIError("UNAUTHORIZED", {
                message: `Unauthorized: Domain mismatch (signed=${signedHost ?? "n/a"}, request=${requestHost}, configured=${configuredHost ?? "n/a"})`,
              });
            }

            if (
              siwsMessage.domain.chainId !== "SN_MAIN" &&
              siwsMessage.domain.chainId !== "SN_SEPOLIA"
            ) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Unsupported network",
              });
            }

            // The SIWS package in use targets an older starknet Contract API.
            // Verify against the account contract using starknet v9 directly.
            const provider = new RpcProvider({
              nodeUrl: getRpcNodeUrl(siwsMessage.domain.chainId),
            });

            const isValid = await verifyMessageInStarknet(
              provider,
              siwsMessage as unknown as Parameters<typeof verifyMessageInStarknet>[1],
              signature,
              address,
            );

            if (!isValid) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Invalid SIWE signature",
              });
            }

            // Delete used nonce to prevent replay attacks
            // now moved to n after hook on /sign-out route
            // await ctx.context.internalAdapter.deleteVerificationValue(
            //   verification.id
            // );

            let user = await db.query.user.findFirst({
              where: eq(userTable.id, address),
            });

            if (!user) {
              const tempEmail = `${address}@${process.env.VITE_PUBLIC_BASE_URL}`;
              /*const ens = await getEnsName(wagmiConfig, {
                address: ctx.body.address as `0x${string}`,
                chainId: options.chainId ?? 1,
              });

              const avatar = await getEnsAvatar(wagmiConfig, {
                name: (ens as string) ?? ctx.body.address,
                chainId: options.chainId ?? 1,
              });*/

              user = await ctx.context.internalAdapter.createUser({
                name: /*ens ??*/ ctx.body.address,
                email: tempEmail,
                id: ctx.body.address,
                //avatar: avatar ?? "",
              });
            }

            const session = await ctx.context.internalAdapter.createSession(
              user.id,
              ctx,
            );

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
            const message =
              error instanceof Error ? error.message : "Unknown error";
            throw new APIError("UNAUTHORIZED", {
              message: "Something went wrong. Please try again later.",
              error: message,
            });
          }
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
