import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import { createAttachPlayerSession, createIdentitySessionResolver, requirePlayerSession, type AppEnv } from "./auth";

describe("verified identity middleware", () => {
  it("rejects spoofed header and query identities without a session cookie", async () => {
    const fetchSession = vi.fn();
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      createAttachPlayerSession(
        createIdentitySessionResolver({
          identityUrl: "http://identity",
          fetch: fetchSession,
          resolveMembershipPlayer: (owner) => Effect.succeed(owner),
        }),
      ),
    );
    app.get("/private", requirePlayerSession, (c) => c.json(c.get("playerSession")));
    app.get("/ws", requirePlayerSession, (c) => c.body(null, 101));

    const response = await app.request("/private?playerId=0xvictim", { headers: { "x-player-id": "0xvictim" } });

    expect(response.status).toBe(401);
    expect((await app.request("/ws?playerId=0xvictim")).status).toBe(401);
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("attributes the request to the better-auth session", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValue(Response.json({ session: { id: "session-1" }, user: { id: "0x000a", name: "Alice" } }));
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      createAttachPlayerSession(
        createIdentitySessionResolver({
          identityUrl: "http://identity",
          fetch: fetchSession,
          resolveMembershipPlayer: () => Effect.succeed("0xgame"),
        }),
      ),
    );
    app.get("/private", requirePlayerSession, (c) => c.json(c.get("playerSession")));

    const response = await app.request("/private?playerId=0xvictim", {
      headers: { cookie: "better-auth.session_token=trusted", "x-player-id": "0xvictim" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      playerId: "0xa",
      membershipPlayerId: "0xgame",
      displayName: "Alice",
    });
    expect(fetchSession).toHaveBeenCalledWith(
      new URL("http://identity/api/auth/get-session"),
      expect.objectContaining({ headers: expect.objectContaining({ cookie: "better-auth.session_token=trusted" }) }),
    );
  });
});
