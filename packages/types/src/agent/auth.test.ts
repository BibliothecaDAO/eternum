import { describe, expect, it } from "vitest";

import { signRealtimeSessionToken, verifyRealtimeSessionToken } from "./auth";

describe("realtime session token helpers", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signRealtimeSessionToken(
      {
        playerId: "player-1",
        walletAddress: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        displayName: "Player One",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "super-secret",
    );

    const payload = await verifyRealtimeSessionToken(token, "super-secret");
    expect(payload.playerId).toBe("player-1");
    expect(payload.displayName).toBe("Player One");
  });

  it("rejects expired tokens", async () => {
    const token = await signRealtimeSessionToken(
      {
        playerId: "player-1",
        issuedAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      "super-secret",
    );

    await expect(verifyRealtimeSessionToken(token, "super-secret")).rejects.toThrow("expired");
  });
});
