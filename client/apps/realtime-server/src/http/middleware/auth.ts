import type { MiddlewareHandler } from "hono";
import { verifyRealtimeSessionToken } from "@bibliothecadao/types";

export interface PlayerSession {
  playerId: string;
  walletAddress?: string;
  displayName?: string;
  aliases: string[];
}

export type AppEnv = {
  Variables: {
    playerSession?: PlayerSession;
  };
};

export const attachPlayerSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header("authorization");
  const bearerToken =
    authorization && authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const tokenSecret = process.env.REALTIME_SESSION_TOKEN_SECRET;

  if (bearerToken && tokenSecret) {
    try {
      const payload = await verifyRealtimeSessionToken(bearerToken, tokenSecret);
      c.set("playerSession", {
        playerId: payload.playerId,
        walletAddress: payload.walletAddress,
        displayName: payload.displayName,
        aliases: [payload.playerId, payload.walletAddress].filter((value): value is string => Boolean(value)),
      });
      await next();
      return;
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Invalid realtime session token.",
        },
        401,
      );
    }
  }

  const allowInsecureSession =
    process.env.ALLOW_INSECURE_PLAYER_SESSION === "true" ||
    (!process.env.REALTIME_SESSION_TOKEN_SECRET && process.env.NODE_ENV !== "production");

  const playerId = allowInsecureSession
    ? (c.req.header("x-player-id") ??
      c.req.query("playerId") ??
      (() => {
        try {
          return c.req.param("playerId");
        } catch {
          return undefined;
        }
      })())
    : undefined;

  if (playerId) {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      await next();
      return;
    }

    const rawWalletHeader = c.req.header("x-wallet-address") ?? c.req.query("walletAddress") ?? undefined;
    const walletAddress = rawWalletHeader?.trim() ? rawWalletHeader.trim() : undefined;
    const rawDisplayName = c.req.header("x-player-name") ?? c.req.query("playerName") ?? undefined;
    const displayName = rawDisplayName?.trim() ? rawDisplayName.trim() : undefined;

    const aliases = [normalizedPlayerId];
    if (walletAddress && !aliases.includes(walletAddress)) {
      aliases.push(walletAddress);
    }

    c.set("playerSession", {
      playerId: normalizedPlayerId,
      walletAddress,
      displayName,
      aliases,
    });
  }

  await next();
};

export const requirePlayerSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  if (!c.get("playerSession")) {
    return c.json({ error: "Player session required." }, 401);
  }

  await next();
};
