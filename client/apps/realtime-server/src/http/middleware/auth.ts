import type { MiddlewareHandler } from "hono";

export interface PlayerSession {
  playerId: string;
  walletAddress?: string;
  displayName?: string;
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
    c.set("playerSession", {
      playerId,
      walletAddress: c.req.header("x-wallet-address") ?? undefined,
      displayName: c.req.header("x-player-name") ?? undefined,
    });
  }

  await next();
};

export const requirePlayerSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("playerSession")) {
    return c.json({ error: "Player session required." }, 401);
  }

  await next();
};
