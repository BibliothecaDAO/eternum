import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("posts the sign-out with credentials so the play client can end the session", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ success: true }));
    const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });

    await expect(client.signOut()).resolves.toBeUndefined();

    expect(fetch.mock.calls[0]?.[0]).toBe("https://realms.test/api/auth/sign-out");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("returns null when no session exists", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });

    await expect(client.getSession()).resolves.toBeNull();
  });
});

afterEach(() => vi.unstubAllGlobals());
it.each([
  "http://localhost:4183",
  "https://127.0.0.1:4183",
  "http://[::1]:4183",
  "https://play.realms.party",
  "https://localhost.attacker.invalid",
])("selects session transport and persists across reload for %s", async (origin) => {
  const stored = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  };
  vi.stubGlobal("window", { location: { origin }, localStorage });
  const session = { session: { id: "test" }, user: { id: "player" } };
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ nonce: "nonce" }))
    .mockResolvedValueOnce(Response.json({ token: "session-token" }))
    .mockImplementation(async () => Response.json(session));
  const options = { baseUrl: "https://realms.test/api/auth", fetch };
  await createIdentityClient(options).signIn({
    address: "0x123",
    chainId: "SN_MAIN",
    domain: "realms.test",
    uri: "https://realms.test",
    signTypedData: async () => ["0x1"],
  });
  const reloaded = createIdentityClient(options);
  await reloaded.getSession();
  const loopback = !origin.includes("realms.party") && !origin.includes("attacker");
  expect(stored.size).toBe(loopback ? 1 : 0);
  expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get("authorization")).toBe(
    loopback ? "Bearer session-token" : null,
  );
  expect(fetch.mock.calls.at(-1)?.[1]?.credentials).toBe("include");
  await reloaded.signOut();
  expect(stored.size).toBe(0);
});
