import type { BetterAuthPlugin } from "better-auth";
import { jsonRpcProvider, useProvider } from "@starknet-react/core";
//import { createConfig, getEnsAvatar, getEnsName, http } from "@wagmi/core";
//import { mainnet, sepolia } from "@wagmi/core/chains";
import { generateId } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
// Zod
import { z } from "zod";

import { eq, user as userTable } from "@realms-world/db";
// Database Instance
import { db } from "@realms-world/db/client";
// SIWE deps
import { ISiwsMessage, SiwsTypedData } from "@realms-world/siws";

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
          console.log(nonce);
          // Store nonce with 15-minute expiration
          await ctx.context.internalAdapter.createVerificationValue({
            id: generateId(),
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
          const { message, signature } = ctx.body;
          // Parse and validate SIWS message
          console.log(ctx.body);
          const siwsMessage = SiwsTypedData.fromJson(message);
          console.log(siwsMessage);
          try {
            // Find stored nonce to check it's validity
            const verification =
              await ctx.context.internalAdapter.findVerificationValue(
                `siws_${ctx.body.address.toLowerCase()}`,
              );
            console.log(verification);
            // Ensure nonce is valid and not expired
            if (!verification || new Date() > verification.expiresAt) {
              throw new APIError("UNAUTHORIZED", {
                message: "Unauthorized: Invalid or expired nonce",
              });
            }
            function rpc(chain) {
              return {
                nodeUrl: `https://https://starknet-${chain}.public.blastapi.io`,
              };
            }

            // Verify SIWS message
            const verified = await siwsMessage.verify(
              {
                signature,
                nonce: verification.value,
                domain:
                  ctx.request?.headers.get("host") ?? "http://localhost:3000", //nextAuthUrl.host,
                network: siwsMessage.domain.chainId,
              },
              {
                provider: rpc(
                  siwsMessage.domain.chainId === "SN_MAIN"
                    ? "mainnet"
                    : "sepolia",
                ),
              },
            );
            console.log(verified);
            if (!verified.success) {
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
              where: eq(userTable.address, ctx.body.address),
            });

            if (!user) {
              const tempEmail = `${ctx.body.address}@${process.env.NEXT_PUBLIC_BASE_URL}`;
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
                address: ctx.body.address,
                //avatar: avatar ?? "",
              });
            }

            const session = await ctx.context.internalAdapter.createSession(
              user.id,
              ctx.request,
            );
            console.log(session);
            if (!session) {
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
          } catch (error: any) {
            if (error instanceof APIError) throw error;
            throw new APIError("UNAUTHORIZED", {
              message: "Something went wrong. Please try again later.",
              error: error.message,
            });
          }
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
