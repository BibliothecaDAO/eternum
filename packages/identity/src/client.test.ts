import { describe, expect, it, vi } from "vitest";

import { createIdentityClient } from "./client";

describe("identity client", () => {
  it("signs the server nonce and returns the resulting session", async () => {
    const session = {
      session: { id: "session-1", expiresAt: "2026-08-26T00:00:00.000Z", userId: "0x123" },
      user: { id: "0x123", name: "0x123", email: "0x123@realms.test" },
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ nonce: "nonce-1" }))
      .mockResolvedValueOnce(Response.json({ token: "token-1" }))
      .mockResolvedValueOnce(Response.json(session));
    const signTypedData = vi.fn().mockResolvedValue(["0x1", "0x2"]);
    const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });

    await expect(
      client.signIn({
        address: "0x123",
        chainId: "SN_MAIN",
        domain: "realms.test",
        uri: "https://realms.test",
        signTypedData,
      }),
    ).resolves.toEqual(session);

    expect(signTypedData).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://realms.test/api/auth/siws/nonce");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("returns null when no session exists", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });

    await expect(client.getSession()).resolves.toBeNull();
  });
});
