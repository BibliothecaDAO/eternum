import { Buffer } from "node:buffer";
import { afterEach, expect, it, vi } from "vitest";
import type { PushEnvelope } from "@bibliothecadao/notifications";
import { sendApnsPush } from "./apns-push";
import { pushTopic } from "./web-push";
import { apnsKey } from "./workerd-harness";

afterEach(() => vi.restoreAllMocks());

const now = 1_800_000_000_000;
const apnsToken = "0f".repeat(32);
const envelope = (tag = "fights:/g/0xa/1"): PushEnvelope => ({
  version: 1,
  kind: "game",
  subscriptionId: "00000000-0000-4000-8000-000000000001",
  notification: {
    version: 1,
    id: "battle:1",
    owner: "0x1",
    title: "Your army was attacked",
    body: "Open the game to see the fight.",
    tag,
    target: "/g/0xa/1",
    createdAt: now,
    expiresAt: now + 3_600_000,
  },
});
const answering = (status: number, body?: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
const requestOf = (fetchPush: ReturnType<typeof answering>) => {
  const [url, init] = fetchPush.mock.calls.at(-1)!;
  return { url: String(url), headers: init!.headers as Record<string, string>, body: JSON.parse(String(init!.body)) };
};

it("sends the alert to the app's token under its tag's collapse id, kept until it expires, signed with the team key", async () => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  const { credentials, publicKey } = await apnsKey();
  const fetchPush = answering(200);
  expect(await sendApnsPush(credentials, apnsToken, envelope(), fetchPush)).toBe("accepted");
  const { url, headers, body } = requestOf(fetchPush);
  expect(url).toBe(`https://api.push.apple.com/3/device/${apnsToken}`);
  expect(fetchPush.mock.calls[0]![1]).toMatchObject({ method: "POST", redirect: "manual" });
  expect(headers).toMatchObject({
    "apns-topic": "party.realms.play",
    "apns-push-type": "alert",
    "apns-priority": "10",
    "apns-expiration": String((now + 3_600_000) / 1000),
    // The same name a browser's push service replaces by: one tag, one alert on every transport.
    "apns-collapse-id": await pushTopic("fights:/g/0xa/1"),
  });
  expect(body).toEqual({
    aps: { alert: { title: "Your army was attacked", body: "Open the game to see the fight." }, sound: "default" },
    envelope: envelope(),
  });

  const [header, claims, signature] = headers.authorization!.replace(/^bearer /, "").split(".");
  expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "ES256", kid: credentials.keyId });
  const issued = JSON.parse(Buffer.from(claims!, "base64url").toString());
  expect(issued.iss).toBe(credentials.teamId);
  expect(now / 1000 - issued.iat).toBeLessThan(30 * 60);
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    Buffer.from(signature!, "base64url"),
    new TextEncoder().encode(`${header}.${claims}`),
  );
  expect(verified).toBe(true);
});

it("renews the provider token at most once every half hour, so APNs never refuses it as renewed too often", async () => {
  const { credentials } = await apnsKey();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  const fetchPush = answering(200);
  const tokenAt = async (time: number) => {
    clock.mockReturnValue(time);
    await sendApnsPush(
      credentials,
      apnsToken,
      { ...envelope(), notification: { ...envelope().notification, expiresAt: time + 60_000 } },
      fetchPush,
    );
    return requestOf(fetchPush).headers.authorization;
  };
  const halfHour = 30 * 60_000;
  const start = Math.floor(now / halfHour) * halfHour;
  const first = await tokenAt(start);
  expect(await tokenAt(start + halfHour - 1)).toBe(first);
  expect(await tokenAt(start + halfHour)).not.toBe(first);
});

it.each([
  [410, { reason: "Unregistered" }, "expired"],
  [400, { reason: "BadDeviceToken" }, "expired"],
  [400, { reason: "DeviceTokenNotForTopic" }, "expired"],
  [400, { reason: "BadCollapseId" }, "rejected"],
  [403, { reason: "ExpiredProviderToken" }, "rejected"],
  [429, { reason: "TooManyRequests" }, "retry"],
  [503, { reason: "ServiceUnavailable" }, "retry"],
])("an APNs %i %j is %s", async (status, reason, outcome) => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  const { credentials } = await apnsKey();
  expect(await sendApnsPush(credentials, apnsToken, envelope(), answering(status, reason))).toBe(outcome);
});

it("sends nothing for an alert past its life", async () => {
  vi.spyOn(Date, "now").mockReturnValue(now + 3_600_000);
  const { credentials } = await apnsKey();
  const fetchPush = answering(200);
  expect(await sendApnsPush(credentials, apnsToken, envelope(), fetchPush)).toBe("rejected");
  expect(fetchPush).not.toHaveBeenCalled();
});
