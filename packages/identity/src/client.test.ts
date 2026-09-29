import { describe, expect, it, vi } from "vitest";

import { createIdentityClient } from "./client";

describe("identity client", () => {
  it("uses the credentialed identity transport for preference reads and conditional saves", async () => {
    const preferences = { owner: "0x1", level: "standard", revision: 2 };
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json(preferences));
    const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });
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
    const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });

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
    const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });

    await expect(client.signOut()).resolves.toBeUndefined();

    expect(fetch.mock.calls[0]?.[0]).toBe("https://realms.test/api/auth/sign-out");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("returns null when no session exists", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });

    await expect(client.getSession()).resolves.toBeNull();
  });
});

it("uses credentialed identity routes for push setup and a device capability for post-logout revocation", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({ enabled: false }));
  const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });
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
  await client.setPushGameForeground("0x1", id, true);
  expect(fetch.mock.calls.at(-1)).toEqual([
    "https://realms.test/api/notifications/push/foreground",
    expect.objectContaining({
      method: "POST",
      keepalive: true,
      body: JSON.stringify({ owner: "0x1", id, foreground: true }),
    }),
  ]);
  await client.revokePushSubscription(id, id);
  expect(fetch.mock.calls.at(-1)?.[1]?.body).toBe(JSON.stringify({ id, token: id }));
  expect(fetch.mock.calls.at(-1)?.[0]).toBe("https://realms.test/api/notifications/push/revoke");
});

it("bounds a stalled push request with an abort signal", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  try {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
        }),
    );
    const client = createIdentityClient({ apiUrl: "https://realms.test/api", fetch });
    const request = client.getPushSubscriptionStatus("0x1", "device");
    const rejected = expect(request).rejects.toThrow("Timed out");
    expect(timeout).toHaveBeenCalledWith(10_000);
    controller.abort(new Error("Timed out"));
    await rejected;
  } finally {
    timeout.mockRestore();
  }
});
