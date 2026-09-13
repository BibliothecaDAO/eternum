import { afterEach, describe, expect, it, vi } from "vitest";

import { createIdentityClient } from "./client";

describe("identity client", () => {
  it("uses the credentialed identity transport for preference reads and conditional saves", async () => {
    const preferences = { owner: "0x1", level: "standard", revision: 2 };
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json(preferences));
    const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });
    expect(await client.getNotificationPreferences()).toEqual(preferences);
    expect(fetch.mock.calls[0]).toEqual([
      "https://realms.test/api/notifications/preferences",
      expect.objectContaining({ credentials: "include", cache: "no-store", method: "GET" }),
    ]);
    await client.saveNotificationPreferences({ owner: "0x1", level: "standard", revision: 1 });
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      credentials: "include",
      method: "POST",
      body: JSON.stringify({ owner: "0x1", level: "standard", revision: 1 }),
    });
    fetch.mockResolvedValueOnce(Response.json({ error: "preference_conflict" }, { status: 409 }));
    await expect(client.saveNotificationPreferences({ owner: "0x1", level: "off", revision: 1 })).rejects.toThrow(
      "another device",
    );
  });
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

it("uses credentialed identity routes for push setup and a device capability for post-logout revocation", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({ enabled: false }));
  const client = createIdentityClient({ baseUrl: "https://realms.test/api/auth", fetch });
  await client.getPushConfiguration();
  expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://realms.test/api/notifications/push/config");
  const id = "11111111-1111-4111-8111-111111111111";
  const registration = {
    owner: "0x1",
    id,
    token: id,
    subscription: { endpoint: "https://web.push.apple.com/test", keys: { p256dh: "key", auth: "secret" } },
  };
  await client.registerPushSubscription(registration);
  expect(fetch.mock.calls.at(-1)).toEqual([
    "https://realms.test/api/notifications/push/subscribe",
    expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify(registration) }),
  ]);
  await client.getPushSubscriptionStatus("0x1", id);
  expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://realms.test/api/notifications/push/status");
  await client.sendPushTest("0x1", id, "/enter/madara/game");
  expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://realms.test/api/notifications/push/test");
  await client.revokePushSubscription(id, id);
  expect(fetch.mock.calls.at(-1)?.[1]?.body).toBe(JSON.stringify({ id, token: id }));
  expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://realms.test/api/notifications/push/revoke");
});
