import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import type { MembershipResolver } from "../../../channels/membership";
import { createAttachPlayerSession, type AppEnv } from "../../middleware/auth";
import { createWorldChatRoutes } from "../world-chat";

describe("game channel authorization", () => {
  it("rejects history and publish before touching storage when Herald says non-member", async () => {
    const membership: MembershipResolver = {
      channelsForPlayer: () => Effect.succeed(new Set()),
      isMember: () => Effect.succeed(false),
    };
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      createAttachPlayerSession({
        resolve: () =>
          Effect.succeed({ playerId: "0xa", membershipPlayerId: "0xgame", displayName: "Alice", aliases: ["0xa"] }),
      }),
    );
    app.route("/chat", createWorldChatRoutes(membership));
    const headers = { cookie: "better-auth.session_token=trusted", "content-type": "application/json" };

    const history = await app.request("/chat?zoneId=game:7", { headers });
    const publish = await app.request("/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ zoneId: "game:7", content: "spoof" }),
    });

    expect(history.status).toBe(403);
    expect(publish.status).toBe(403);
  });
});
