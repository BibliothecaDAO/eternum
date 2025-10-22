import type { MiddlewareHandler } from "hono";

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
  const playerId =
    c.req.header("x-player-id") ??
    c.req.query("playerId") ??
    (() => {
      try {
        return c.req.param("playerId");
      } catch {
        return undefined;
      }
    })();

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
